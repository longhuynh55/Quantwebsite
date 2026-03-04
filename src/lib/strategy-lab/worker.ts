import {
  executeRunInput,
  getExecutionErrorMeta,
  normalizeCreateRunRequest,
} from "@/lib/strategy-lab/executor";
import {
  heartbeatStrategyLabJobLease,
  leaseNextStrategyLabJob,
  recoverExpiredStrategyLabLeases,
} from "@/lib/strategy-lab/postgres-queue";
import type { StrategyLabPostgresClient } from "@/lib/strategy-lab/repository.postgres";

const RETRYABLE_ERROR_CODES = new Set([
  "INTERNAL_ERROR",
  "UPSTREAM_UNAVAILABLE",
  "TIMEOUT",
  "TRANSIENT_ERROR",
]);

export type StrategyLabWorkerStepStatus =
  | "idle"
  | "succeeded"
  | "retry_wait"
  | "failed"
  | "cancelled";

export interface StrategyLabWorkerStepResult {
  status: StrategyLabWorkerStepStatus;
  runId?: string;
  jobId?: string;
}

export interface StrategyLabWorkerOptions {
  client: StrategyLabPostgresClient;
  workerId: string;
  queueName?: string;
  leaseMs?: number;
  heartbeatMs?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
}

interface StrategyLabRunPayloadRow {
  id: string;
  request_payload: unknown;
  cancel_requested: boolean;
}

interface StrategyLabWorkerInternals {
  leaseNext: typeof leaseNextStrategyLabJob;
  heartbeat: typeof heartbeatStrategyLabJobLease;
  recoverExpired: typeof recoverExpiredStrategyLabLeases;
}

const defaultInternals: StrategyLabWorkerInternals = {
  leaseNext: leaseNextStrategyLabJob,
  heartbeat: heartbeatStrategyLabJobLease,
  recoverExpired: recoverExpiredStrategyLabLeases,
};

function isRetryable(code: string): boolean {
  return RETRYABLE_ERROR_CODES.has(code);
}

function clampDelay(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function getRetryDelayMs(
  attempt: number,
  options: Pick<StrategyLabWorkerOptions, "retryBaseDelayMs" | "retryMaxDelayMs">
): number {
  const baseDelay = clampDelay(options.retryBaseDelayMs ?? 1000, 100, 60_000);
  const maxDelay = clampDelay(options.retryMaxDelayMs ?? 10_000, baseDelay, 5 * 60_000);
  const exponential = baseDelay * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(maxDelay, Math.trunc(exponential));
}

async function appendEvent(
  client: StrategyLabPostgresClient,
  input: {
    runId: string;
    jobId: string;
    eventType: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  await client.query(
    `
INSERT INTO strategy_lab_run_events (run_id, job_id, event_type, payload, created_at)
VALUES ($1, $2, $3, $4::jsonb, now())
    `.trim(),
    [input.runId, input.jobId, input.eventType, JSON.stringify(input.payload ?? {})]
  );
}

async function loadRunPayload(
  client: StrategyLabPostgresClient,
  runId: string
): Promise<StrategyLabRunPayloadRow | null> {
  const result = await client.query<StrategyLabRunPayloadRow>(
    `
SELECT id, request_payload, cancel_requested
FROM strategy_lab_runs
WHERE id = $1
LIMIT 1
    `.trim(),
    [runId]
  );
  return result.rows[0] ?? null;
}

async function isRunCancelRequested(
  client: StrategyLabPostgresClient,
  runId: string
): Promise<boolean> {
  const result = await client.query<{ cancel_requested: boolean }>(
    `
SELECT cancel_requested
FROM strategy_lab_runs
WHERE id = $1
LIMIT 1
    `.trim(),
    [runId]
  );
  return Boolean(result.rows[0]?.cancel_requested);
}

async function markCancelled(
  client: StrategyLabPostgresClient,
  input: { runId: string; jobId: string; reason: string }
): Promise<void> {
  await client.query(
    `
UPDATE strategy_lab_runs
SET status = 'cancelled',
    updated_at = now(),
    finished_at = COALESCE(finished_at, now())
WHERE id = $1
    `.trim(),
    [input.runId]
  );
  await client.query(
    `
UPDATE strategy_lab_jobs
SET status = 'cancelled',
    lease_owner = NULL,
    lease_expires_at = NULL,
    updated_at = now(),
    finished_at = COALESCE(finished_at, now())
WHERE id = $1
    `.trim(),
    [input.jobId]
  );
  await appendEvent(client, {
    runId: input.runId,
    jobId: input.jobId,
    eventType: "run_cancelled",
    payload: {
      status: "cancelled",
      reason: input.reason,
    },
  });
}

export async function runOneStrategyLabWorkerStep(
  options: StrategyLabWorkerOptions,
  internals: StrategyLabWorkerInternals = defaultInternals
): Promise<StrategyLabWorkerStepResult> {
  const queueName = options.queueName?.trim() || "strategy_lab_default";
  const leaseMs = clampDelay(options.leaseMs ?? 30_000, 1_000, 5 * 60_000);
  const heartbeatMs = clampDelay(options.heartbeatMs ?? Math.max(1_000, Math.trunc(leaseMs / 2)), 1_000, leaseMs);

  await internals.recoverExpired(options.client, { queueName });

  const leased = await internals.leaseNext(options.client, {
    workerId: options.workerId,
    queueName,
    leaseMs,
  });

  if (!leased) {
    return { status: "idle" };
  }

  const run = await loadRunPayload(options.client, leased.runId);
  if (!run) {
    await options.client.query(
      `
UPDATE strategy_lab_jobs
SET status = 'dead_letter',
    lease_owner = NULL,
    lease_expires_at = NULL,
    last_error = 'Run not found',
    updated_at = now()
WHERE id = $1
      `.trim(),
      [leased.jobId]
    );
    return { status: "failed", runId: leased.runId, jobId: leased.jobId };
  }

  if (run.cancel_requested) {
    await markCancelled(options.client, {
      runId: leased.runId,
      jobId: leased.jobId,
      reason: "cancel_requested_before_start",
    });
    return { status: "cancelled", runId: leased.runId, jobId: leased.jobId };
  }

  const markRunningResult = await options.client.query(
    `
UPDATE strategy_lab_jobs
SET status = 'running',
    attempt = attempt + 1,
    updated_at = now()
WHERE id = $1
  AND lease_owner = $2
    `.trim(),
    [leased.jobId, options.workerId]
  );
  if ((markRunningResult.rowCount ?? 0) !== 1) {
    await appendEvent(options.client, {
      runId: leased.runId,
      jobId: leased.jobId,
      eventType: "run_failed",
      payload: {
        status: "failed",
        errorCode: "LEASE_LOST",
        errorMessage: "Worker lost lease ownership before execution started.",
      },
    });
    return { status: "failed", runId: leased.runId, jobId: leased.jobId };
  }
  await options.client.query(
    `
UPDATE strategy_lab_runs
SET status = 'running',
    updated_at = now(),
    started_at = COALESCE(started_at, now())
WHERE id = $1
    `.trim(),
    [leased.runId]
  );
  await appendEvent(options.client, {
    runId: leased.runId,
    jobId: leased.jobId,
    eventType: "run_started",
    payload: {
      status: "running",
      workerId: options.workerId,
      attempt: leased.attempt + 1,
      maxAttempts: leased.maxAttempts,
    },
  });

  const abortController = new AbortController();
  let leaseLost = false;
  const heartbeatTimer = setInterval(() => {
    void (async () => {
      try {
        const heartbeatOk = await internals.heartbeat(options.client, {
          jobId: leased.jobId,
          workerId: options.workerId,
          leaseMs,
        });
        if (!heartbeatOk) {
          leaseLost = true;
          if (!abortController.signal.aborted) {
            abortController.abort();
          }
          return;
        }
        const cancelRequested = await isRunCancelRequested(options.client, leased.runId);
        if (cancelRequested && !abortController.signal.aborted) {
          abortController.abort();
        }
      } catch {
        leaseLost = true;
        abortController.abort();
      }
    })();
  }, heartbeatMs);

  try {
    const normalizedInput = normalizeCreateRunRequest(run.request_payload);
    const execution = await executeRunInput(leased.runId, normalizedInput, {
      signal: abortController.signal,
    });
    if (leaseLost) {
      const error = new Error("Worker lease lost during execution.");
      (error as Error & { code?: string }).code = "LEASE_LOST";
      throw error;
    }

    await options.client.query(
      `
UPDATE strategy_lab_runs
SET status = 'succeeded',
    metrics_summary = $2::jsonb,
    error_code = NULL,
    error_message = NULL,
    updated_at = now(),
    finished_at = now()
WHERE id = $1
      `.trim(),
      [
        leased.runId,
        JSON.stringify({
          metrics: execution.result.metrics,
          diagnostics: execution.result.diagnostics,
          totalTrades: execution.result.trades.length,
          equityPoints: execution.result.equityCurve.length,
          antiBiasSignals: execution.antiBiasSignals,
        }),
      ]
    );
    await options.client.query(
      `
UPDATE strategy_lab_jobs
SET status = 'succeeded',
    lease_owner = NULL,
    lease_expires_at = NULL,
    updated_at = now(),
    finished_at = now()
WHERE id = $1
      `.trim(),
      [leased.jobId]
    );
    await appendEvent(options.client, {
      runId: leased.runId,
      jobId: leased.jobId,
      eventType: "run_succeeded",
      payload: {
        status: "succeeded",
        totalTrades: execution.result.trades.length,
        totalReturn: execution.result.metrics.totalReturn,
      },
    });

    return { status: "succeeded", runId: leased.runId, jobId: leased.jobId };
  } catch (error) {
    const meta = getExecutionErrorMeta(error);
    const cancelRequested = meta.code === "RUN_ABORTED" || (await isRunCancelRequested(options.client, leased.runId));
    if (cancelRequested) {
      await markCancelled(options.client, {
        runId: leased.runId,
        jobId: leased.jobId,
        reason: meta.code === "RUN_ABORTED" ? "abort_signal" : "cancel_requested_during_execution",
      });
      return { status: "cancelled", runId: leased.runId, jobId: leased.jobId };
    }

    const currentAttempt = leased.attempt + 1;
    const shouldRetry = isRetryable(meta.code) && currentAttempt < leased.maxAttempts;

    if (shouldRetry) {
      const retryDelayMs = getRetryDelayMs(currentAttempt, options);
      await options.client.query(
        `
UPDATE strategy_lab_runs
SET status = 'queued',
    error_code = $2,
    error_message = $3,
    updated_at = now()
WHERE id = $1
        `.trim(),
        [leased.runId, meta.code, meta.message]
      );
      await options.client.query(
        `
UPDATE strategy_lab_jobs
SET status = 'retry_wait',
    lease_owner = NULL,
    lease_expires_at = NULL,
    next_run_at = now() + ($2 * interval '1 millisecond'),
    last_error = $3,
    updated_at = now()
WHERE id = $1
        `.trim(),
        [leased.jobId, retryDelayMs, `${meta.code}: ${meta.message}`]
      );
      await appendEvent(options.client, {
        runId: leased.runId,
        jobId: leased.jobId,
        eventType: "run_retry_scheduled",
        payload: {
          status: "queued",
          retryDelayMs,
          errorCode: meta.code,
          currentAttempt,
          maxAttempts: leased.maxAttempts,
        },
      });
      return { status: "retry_wait", runId: leased.runId, jobId: leased.jobId };
    }

    await options.client.query(
      `
UPDATE strategy_lab_runs
SET status = 'failed',
    error_code = $2,
    error_message = $3,
    updated_at = now(),
    finished_at = now()
WHERE id = $1
      `.trim(),
      [leased.runId, meta.code, meta.message]
    );
    await options.client.query(
      `
UPDATE strategy_lab_jobs
SET status = 'dead_letter',
    lease_owner = NULL,
    lease_expires_at = NULL,
    last_error = $2,
    updated_at = now(),
    finished_at = now()
WHERE id = $1
      `.trim(),
      [leased.jobId, `${meta.code}: ${meta.message}`]
    );
    await appendEvent(options.client, {
      runId: leased.runId,
      jobId: leased.jobId,
      eventType: "run_failed",
      payload: {
        status: "failed",
        errorCode: meta.code,
        errorMessage: meta.message,
      },
    });

    return { status: "failed", runId: leased.runId, jobId: leased.jobId };
  } finally {
    clearInterval(heartbeatTimer);
  }
}

export async function runStrategyLabWorkerLoop(
  options: StrategyLabWorkerOptions & { signal?: AbortSignal; idleDelayMs?: number }
): Promise<void> {
  const idleDelayMs = clampDelay(options.idleDelayMs ?? 1000, 100, 30_000);
  while (!options.signal?.aborted) {
    const step = await runOneStrategyLabWorkerStep(options);
    if (step.status === "idle") {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), idleDelayMs);
      });
    }
  }
}
