import type { StrategyLabPostgresClient } from "@/lib/strategy-lab/repository.postgres";

export interface StrategyLabLeasedJob {
  jobId: string;
  runId: string;
  queueName: string;
  attempt: number;
  maxAttempts: number;
  priority: number;
  leaseExpiresAt: string | null;
}

export interface StrategyLabLeaseNextJobOptions {
  workerId: string;
  leaseMs: number;
  queueName?: string;
}

export async function leaseNextStrategyLabJob(
  client: StrategyLabPostgresClient,
  options: StrategyLabLeaseNextJobOptions
): Promise<StrategyLabLeasedJob | null> {
  const queueName = options.queueName?.trim() || "strategy_lab_default";
  const leaseMs = Math.max(1000, Math.trunc(options.leaseMs));

  const result = await client.query<{
    id: string;
    run_id: string;
    queue_name: string;
    attempt: number;
    max_attempts: number;
    priority: number;
    lease_expires_at: string | null;
  }>(
    `
WITH candidate AS (
  SELECT id
  FROM strategy_lab_jobs
  WHERE queue_name = $1
    AND status IN ('queued', 'retry_wait')
    AND next_run_at <= now()
  ORDER BY priority DESC, next_run_at ASC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE strategy_lab_jobs job
SET
  status = 'leased',
  lease_owner = $2,
  lease_expires_at = now() + ($3 * interval '1 millisecond'),
  last_heartbeat_at = now(),
  updated_at = now()
FROM candidate
WHERE job.id = candidate.id
RETURNING
  job.id,
  job.run_id,
  job.queue_name,
  job.attempt,
  job.max_attempts,
  job.priority,
  job.lease_expires_at
    `.trim(),
    [queueName, options.workerId, leaseMs]
  );

  const row = result.rows[0];
  if (!row) return null;
  return {
    jobId: row.id,
    runId: row.run_id,
    queueName: row.queue_name,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    priority: row.priority,
    leaseExpiresAt: row.lease_expires_at,
  };
}

export async function heartbeatStrategyLabJobLease(
  client: StrategyLabPostgresClient,
  input: {
    jobId: string;
    workerId: string;
    leaseMs: number;
  }
): Promise<boolean> {
  const leaseMs = Math.max(1000, Math.trunc(input.leaseMs));
  const result = await client.query(
    `
UPDATE strategy_lab_jobs
SET
  lease_expires_at = now() + ($3 * interval '1 millisecond'),
  last_heartbeat_at = now(),
  updated_at = now()
WHERE id = $1
  AND lease_owner = $2
  AND status IN ('leased', 'running')
    `.trim(),
    [input.jobId, input.workerId, leaseMs]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function recoverExpiredStrategyLabLeases(
  client: StrategyLabPostgresClient,
  options?: { queueName?: string; limit?: number }
): Promise<number> {
  const queueName = options?.queueName?.trim() || "strategy_lab_default";
  const limit = Math.max(1, Math.min(1000, Math.trunc(options?.limit ?? 100)));
  const result = await client.query<{ id: string }>(
    `
WITH expired AS (
  SELECT id
  FROM strategy_lab_jobs
  WHERE queue_name = $1
    AND status IN ('leased', 'running')
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < now()
  ORDER BY lease_expires_at ASC
  LIMIT $2
)
UPDATE strategy_lab_jobs job
SET
  status = 'retry_wait',
  lease_owner = NULL,
  lease_expires_at = NULL,
  next_run_at = now(),
  updated_at = now()
FROM expired
WHERE job.id = expired.id
RETURNING job.id
    `.trim(),
    [queueName, limit]
  );
  return result.rows.length;
}
