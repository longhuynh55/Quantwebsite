import crypto from "crypto";
import type {
  StrategyLabEventType,
  StrategyLabJobRecord,
  StrategyLabJobStatus,
  StrategyLabNormalizedRunInput,
  StrategyLabRunEvent,
  StrategyLabRunRecord,
  StrategyLabRunResultRecord,
  StrategyLabRunStatus,
} from "@/lib/strategy-lab/contracts";
import type {
  StrategyLabJobPatch,
  StrategyLabRepository,
  StrategyLabRepositoryStats,
  StrategyLabRunPatch,
} from "@/lib/strategy-lab/repository";
import type {
  StrategyLabDbJson,
  StrategyLabDbJobStatus,
  StrategyLabJobRow,
  StrategyLabRunEventRow,
  StrategyLabRunResultRow,
  StrategyLabRunRow,
} from "@/lib/strategy-lab/db/models";

export interface StrategyLabPostgresQueryResult<T> {
  rows: T[];
  rowCount: number | null;
}

export interface StrategyLabPostgresClient {
  query<T = unknown>(queryText: string, values?: readonly unknown[]): Promise<StrategyLabPostgresQueryResult<T>>;
}

export interface StrategyLabPostgresRepositoryOptions {
  client: StrategyLabPostgresClient;
  schema?: string;
}

const ENGINE_VERSION = process.env.STRATEGY_LAB_ENGINE_VERSION || "quant-website@0.1.0";
const DATA_SNAPSHOT_ID = process.env.STRATEGY_LAB_DATA_SNAPSHOT_ID || "runtime-unknown";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

function buildInputHash(input: StrategyLabNormalizedRunInput): string {
  return crypto.createHash("sha256").update(stableStringify(input)).digest("hex");
}

function sanitizeSchema(schemaRaw: string | undefined): string {
  const schema = schemaRaw?.trim() || "public";
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
    throw new Error(`[strategy-lab/postgres-repository] Invalid schema: ${schema}`);
  }
  return schema;
}

function toPriority(input: StrategyLabNormalizedRunInput["priority"]): number {
  if (input === "high") return 8;
  if (input === "low") return 3;
  return 5;
}

function fromDbJobStatus(status: StrategyLabDbJobStatus): StrategyLabJobStatus {
  if (status === "leased") return "running";
  if (status === "retry_wait") return "queued";
  if (status === "dead_letter") return "failed";
  return status;
}

function asRunStatus(value: unknown): StrategyLabRunStatus {
  if (value === "queued" || value === "running" || value === "succeeded" || value === "failed" || value === "cancelled") {
    return value;
  }
  return "queued";
}

function asRunInput(value: unknown): StrategyLabNormalizedRunInput {
  return value as StrategyLabNormalizedRunInput;
}

function toIsoOrUndefined(value: string | null): string | undefined {
  return value ?? undefined;
}

function parseDbJson<T>(value: StrategyLabDbJson): T {
  return value as T;
}

class PostgresStrategyLabRepository implements StrategyLabRepository {
  readonly backend = "postgres" as const;
  readonly name = "strategy-lab-postgres";

  private readonly client: StrategyLabPostgresClient;
  private readonly schema: string;

  constructor(options: StrategyLabPostgresRepositoryOptions) {
    this.client = options.client;
    this.schema = sanitizeSchema(options.schema);
  }

  private table(name: string): string {
    return `${this.schema}.${name}`;
  }

  private mapRun(row: StrategyLabRunRow): StrategyLabRunRecord {
    return {
      runId: row.id,
      jobId: "",
      status: row.status,
      input: asRunInput(row.request_payload),
      cancelRequested: row.cancel_requested,
      attemptCount: row.attempt_count,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      lastAttemptAt: toIsoOrUndefined(row.last_attempt_at),
      nextRetryAt: toIsoOrUndefined(row.next_retry_at),
      summary: row.metrics_summary ?? undefined,
      error: row.error_code || row.error_message
        ? {
          code: row.error_code ?? "RUN_FAILED",
          message: row.error_message ?? "Run failed.",
        }
        : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: toIsoOrUndefined(row.started_at),
      finishedAt: toIsoOrUndefined(row.finished_at),
    };
  }

  private mapJob(row: StrategyLabJobRow): StrategyLabJobRecord {
    return {
      jobId: row.id,
      runId: row.run_id,
      status: fromDbJobStatus(row.status),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: toIsoOrUndefined(row.started_at),
      finishedAt: toIsoOrUndefined(row.finished_at),
    };
  }

  private async attachJob(run: StrategyLabRunRecord): Promise<StrategyLabRunRecord> {
    const job = await this.getJobByRunId(run.runId);
    return {
      ...run,
      jobId: job?.jobId ?? run.jobId,
    };
  }

  private async getJobByRunId(runId: string): Promise<StrategyLabJobRecord | null> {
    const result = await this.client.query<StrategyLabJobRow>(
      `
SELECT *
FROM ${this.table("strategy_lab_jobs")}
WHERE run_id = $1
ORDER BY created_at DESC
LIMIT 1
      `.trim(),
      [runId]
    );
    const row = result.rows[0];
    return row ? this.mapJob(row) : null;
  }

  async createQueuedRun(
    input: StrategyLabNormalizedRunInput,
    options?: { maxRetries?: number }
  ): Promise<{
    run: StrategyLabRunRecord;
    job: StrategyLabJobRecord;
  }> {
    const priority = toPriority(input.priority);
    const maxRetries = Math.max(0, Math.trunc(options?.maxRetries ?? 0));
    const maxAttempts = maxRetries + 1;

    const runInsert = await this.client.query<StrategyLabRunRow>(
      `
INSERT INTO ${this.table("strategy_lab_runs")} (
  name,
  symbol,
  strategy_type,
  request_payload,
  status,
  priority,
  engine_version,
  data_snapshot_id,
  input_hash,
  cancel_requested,
  attempt_count,
  retry_count,
  max_retries
)
VALUES ($1, $2, $3, $4::jsonb, 'queued', $5, $6, $7, $8, false, 0, 0, $9)
RETURNING *
      `.trim(),
      [
        input.name,
        input.symbol,
        input.strategyType,
        JSON.stringify(input),
        priority,
        ENGINE_VERSION,
        DATA_SNAPSHOT_ID,
        buildInputHash(input),
        maxRetries,
      ]
    );

    const runRow = runInsert.rows[0];
    if (!runRow) {
      throw new Error("[strategy-lab/postgres-repository] Failed to insert run.");
    }

    const jobInsert = await this.client.query<StrategyLabJobRow>(
      `
INSERT INTO ${this.table("strategy_lab_jobs")} (
  run_id,
  queue_name,
  status,
  attempt,
  max_attempts,
  priority,
  next_run_at
)
VALUES ($1, 'strategy_lab_default', 'queued', 0, $2, $3, now())
RETURNING *
      `.trim(),
      [runRow.id, maxAttempts, priority]
    );

    const jobRow = jobInsert.rows[0];
    if (!jobRow) {
      throw new Error("[strategy-lab/postgres-repository] Failed to insert job.");
    }

    const run = this.mapRun(runRow);
    return {
      run: {
        ...run,
        jobId: jobRow.id,
      },
      job: this.mapJob(jobRow),
    };
  }

  async getRun(runId: string): Promise<StrategyLabRunRecord | null> {
    const result = await this.client.query<StrategyLabRunRow>(
      `
SELECT *
FROM ${this.table("strategy_lab_runs")}
WHERE id = $1
LIMIT 1
      `.trim(),
      [runId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return this.attachJob(this.mapRun(row));
  }

  async getJob(jobId: string): Promise<StrategyLabJobRecord | null> {
    const result = await this.client.query<StrategyLabJobRow>(
      `
SELECT *
FROM ${this.table("strategy_lab_jobs")}
WHERE id = $1
LIMIT 1
      `.trim(),
      [jobId]
    );
    const row = result.rows[0];
    return row ? this.mapJob(row) : null;
  }

  async updateRun(
    runId: string,
    patch: StrategyLabRunPatch | ((current: StrategyLabRunRecord) => StrategyLabRunPatch)
  ): Promise<StrategyLabRunRecord | null> {
    const current = await this.getRun(runId);
    if (!current) return null;

    const partial = typeof patch === "function" ? patch(current) : patch;
    const updates: string[] = ["updated_at = now()"];
    const values: unknown[] = [runId];

    const push = (clause: string, value: unknown) => {
      values.push(value);
      updates.push(`${clause} = $${values.length}`);
    };

    if (partial.status !== undefined) push("status", partial.status);
    if (partial.cancelRequested !== undefined) push("cancel_requested", partial.cancelRequested);
    if (partial.attemptCount !== undefined) push("attempt_count", partial.attemptCount);
    if (partial.retryCount !== undefined) push("retry_count", partial.retryCount);
    if (partial.maxRetries !== undefined) push("max_retries", partial.maxRetries);
    if (partial.lastAttemptAt !== undefined) push("last_attempt_at", partial.lastAttemptAt);
    if (partial.nextRetryAt !== undefined) push("next_retry_at", partial.nextRetryAt);
    if (partial.summary !== undefined) push("metrics_summary", JSON.stringify(partial.summary));
    if (partial.error !== undefined) {
      push("error_code", partial.error?.code ?? null);
      push("error_message", partial.error?.message ?? null);
    }
    if (partial.startedAt !== undefined) push("started_at", partial.startedAt ?? null);
    if (partial.finishedAt !== undefined) push("finished_at", partial.finishedAt ?? null);

    await this.client.query(
      `
UPDATE ${this.table("strategy_lab_runs")}
SET ${updates.join(", ")}
WHERE id = $1
      `.trim(),
      values
    );

    return this.getRun(runId);
  }

  async updateJob(
    jobId: string,
    patch: StrategyLabJobPatch | ((current: StrategyLabJobRecord) => StrategyLabJobPatch)
  ): Promise<StrategyLabJobRecord | null> {
    const current = await this.getJob(jobId);
    if (!current) return null;

    const partial = typeof patch === "function" ? patch(current) : patch;
    const updates: string[] = ["updated_at = now()"];
    const values: unknown[] = [jobId];

    const push = (clause: string, value: unknown) => {
      values.push(value);
      updates.push(`${clause} = $${values.length}`);
    };

    if (partial.status !== undefined) push("status", partial.status);
    if (partial.startedAt !== undefined) push("started_at", partial.startedAt ?? null);
    if (partial.finishedAt !== undefined) push("finished_at", partial.finishedAt ?? null);

    await this.client.query(
      `
UPDATE ${this.table("strategy_lab_jobs")}
SET ${updates.join(", ")}
WHERE id = $1
      `.trim(),
      values
    );

    return this.getJob(jobId);
  }

  async appendRunEvent(input: {
    runId: string;
    jobId: string;
    type: StrategyLabEventType;
    status: StrategyLabRunStatus;
    payload?: Record<string, unknown>;
  }): Promise<StrategyLabRunEvent> {
    const payload = {
      status: input.status,
      ...(input.payload ?? {}),
    };

    const inserted = await this.client.query<StrategyLabRunEventRow>(
      `
INSERT INTO ${this.table("strategy_lab_run_events")} (
  run_id,
  job_id,
  event_type,
  payload,
  created_at
)
VALUES ($1, $2, $3, $4::jsonb, now())
RETURNING *
      `.trim(),
      [input.runId, input.jobId, input.type, JSON.stringify(payload)]
    );

    const row = inserted.rows[0];
    if (!row) {
      throw new Error("[strategy-lab/postgres-repository] Failed to append event.");
    }

    return {
      id: `evt_${String(row.id).padStart(10, "0")}`,
      sequence: row.id,
      runId: row.run_id,
      jobId: row.job_id ?? input.jobId,
      type: row.event_type,
      status: asRunStatus((row.payload as Record<string, unknown>)?.status),
      createdAt: row.created_at,
      payload: parseDbJson<Record<string, unknown>>(row.payload),
    };
  }

  async listRunEvents(runId: string, options?: { sinceSequence?: number; limit?: number }): Promise<StrategyLabRunEvent[]> {
    const since = Math.max(0, Math.trunc(options?.sinceSequence ?? 0));
    const limit = Math.max(1, Math.min(1000, Math.trunc(options?.limit ?? 200)));

    const result = await this.client.query<StrategyLabRunEventRow>(
      `
SELECT *
FROM ${this.table("strategy_lab_run_events")}
WHERE run_id = $1
  AND id > $2
ORDER BY id ASC
LIMIT $3
      `.trim(),
      [runId, since, limit]
    );

    return result.rows.map((row) => ({
      id: `evt_${String(row.id).padStart(10, "0")}`,
      sequence: row.id,
      runId: row.run_id,
      jobId: row.job_id ?? "",
      type: row.event_type,
      status: asRunStatus((row.payload as Record<string, unknown>)?.status),
      createdAt: row.created_at,
      payload: parseDbJson<Record<string, unknown>>(row.payload),
    }));
  }

  async setRunResult(runId: string, result: StrategyLabRunResultRecord): Promise<StrategyLabRunResultRecord> {
    await this.client.query(
      `
INSERT INTO ${this.table("strategy_lab_run_results")} (run_id, result_payload, created_at, updated_at)
VALUES ($1, $2::jsonb, now(), now())
ON CONFLICT (run_id)
DO UPDATE SET
  result_payload = EXCLUDED.result_payload,
  updated_at = now()
      `.trim(),
      [runId, JSON.stringify(result)]
    );
    return result;
  }

  async getRunResult(runId: string): Promise<StrategyLabRunResultRecord | null> {
    const result = await this.client.query<StrategyLabRunResultRow>(
      `
SELECT *
FROM ${this.table("strategy_lab_run_results")}
WHERE run_id = $1
LIMIT 1
      `.trim(),
      [runId]
    );

    const row = result.rows[0];
    if (!row) return null;
    return parseDbJson<StrategyLabRunResultRecord>(row.result_payload);
  }

  async markRunAndJobStatus(input: {
    runId: string;
    runStatus: StrategyLabRunStatus;
    jobStatus: StrategyLabJobStatus;
    started?: boolean;
    finished?: boolean;
    error?: { code: string; message: string };
  }): Promise<{ run: StrategyLabRunRecord | null; job: StrategyLabJobRecord | null }> {
    const runUpdates: string[] = ["status = $2", "updated_at = now()"];
    const runValues: unknown[] = [input.runId, input.runStatus];

    if (input.started) {
      runUpdates.push("started_at = COALESCE(started_at, now())");
    }
    if (input.finished) {
      runUpdates.push("finished_at = COALESCE(finished_at, now())");
    }
    if (input.error) {
      runValues.push(input.error.code);
      runUpdates.push(`error_code = $${runValues.length}`);
      runValues.push(input.error.message);
      runUpdates.push(`error_message = $${runValues.length}`);
    }

    await this.client.query(
      `
UPDATE ${this.table("strategy_lab_runs")}
SET ${runUpdates.join(", ")}
WHERE id = $1
      `.trim(),
      runValues
    );

    const job = await this.getJobByRunId(input.runId);
    if (!job) {
      const runOnly = await this.getRun(input.runId);
      return { run: runOnly, job: null };
    }

    await this.updateJob(job.jobId, {
      status: input.jobStatus,
      startedAt: input.started ? new Date().toISOString() : undefined,
      finishedAt: input.finished ? new Date().toISOString() : undefined,
    });

    const [runRecord, jobRecord] = await Promise.all([
      this.getRun(input.runId),
      this.getJob(job.jobId),
    ]);
    return {
      run: runRecord,
      job: jobRecord,
    };
  }

  async reset(options?: { clearPersisted?: boolean }): Promise<void> {
    if (options?.clearPersisted === false) {
      return;
    }
    await this.client.query(
      `
TRUNCATE TABLE
  ${this.table("strategy_lab_run_results")},
  ${this.table("strategy_lab_run_events")},
  ${this.table("strategy_lab_jobs")},
  ${this.table("strategy_lab_runs")}
RESTART IDENTITY CASCADE
      `.trim()
    );
  }

  async getStats(): Promise<StrategyLabRepositoryStats> {
    const [runCounts, jobCounts, resultCount, eventCount, lastRunUpdatedAt] = await Promise.all([
      this.client.query<{ status: StrategyLabRunStatus; count: string }>(
        `
SELECT status, count(*)::text AS count
FROM ${this.table("strategy_lab_runs")}
GROUP BY status
        `.trim()
      ),
      this.client.query<{ status: StrategyLabDbJobStatus; count: string }>(
        `
SELECT status, count(*)::text AS count
FROM ${this.table("strategy_lab_jobs")}
GROUP BY status
        `.trim()
      ),
      this.client.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${this.table("strategy_lab_run_results")}`),
      this.client.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${this.table("strategy_lab_run_events")}`),
      this.client.query<{ updated_at: string }>(
        `
SELECT updated_at
FROM ${this.table("strategy_lab_runs")}
ORDER BY updated_at DESC
LIMIT 1
        `.trim()
      ),
    ]);

    const runs = {
      total: 0,
      queued: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const row of runCounts.rows) {
      const value = Number.parseInt(row.count, 10) || 0;
      runs.total += value;
      runs[row.status] = value;
    }

    const jobs = {
      total: 0,
      queued: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const row of jobCounts.rows) {
      const value = Number.parseInt(row.count, 10) || 0;
      jobs.total += value;
      const normalized = fromDbJobStatus(row.status);
      jobs[normalized] += value;
    }

    return {
      runs,
      jobs,
      results: Number.parseInt(resultCount.rows[0]?.count ?? "0", 10) || 0,
      events: Number.parseInt(eventCount.rows[0]?.count ?? "0", 10) || 0,
      lastRunUpdatedAt: lastRunUpdatedAt.rows[0]?.updated_at,
      persistence: {
        enabled: true,
        adapterName: `${this.name}:${this.schema}`,
      },
    };
  }
}

export function createStrategyLabPostgresRepository(
  options: StrategyLabPostgresRepositoryOptions
): StrategyLabRepository {
  return new PostgresStrategyLabRepository(options);
}
