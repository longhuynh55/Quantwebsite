BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS strategy_lab_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  symbol text NOT NULL,
  strategy_type text NOT NULL,
  request_payload jsonb NOT NULL,
  status text NOT NULL,
  priority smallint NOT NULL DEFAULT 5,
  engine_version text NOT NULL,
  data_snapshot_id text NOT NULL,
  input_hash text NOT NULL,
  idempotency_key_hash text,
  cancel_requested boolean NOT NULL DEFAULT false,
  attempt_count integer NOT NULL DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  metrics_summary jsonb,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS strategy_lab_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES strategy_lab_runs(id) ON DELETE CASCADE,
  queue_name text NOT NULL DEFAULT 'strategy_lab_default',
  status text NOT NULL,
  attempt integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  priority smallint NOT NULL DEFAULT 5,
  lease_owner text,
  lease_expires_at timestamptz,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS strategy_lab_run_events (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES strategy_lab_runs(id) ON DELETE CASCADE,
  job_id uuid REFERENCES strategy_lab_jobs(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS strategy_lab_run_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES strategy_lab_runs(id) ON DELETE CASCADE,
  artifact_kind text NOT NULL,
  storage_uri text NOT NULL,
  content_type text NOT NULL,
  byte_size bigint NOT NULL,
  checksum_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS strategy_lab_run_results (
  run_id uuid PRIMARY KEY REFERENCES strategy_lab_runs(id) ON DELETE CASCADE,
  result_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS strategy_lab_runs_status_priority_created_at_idx
  ON strategy_lab_runs (status, priority, created_at);

CREATE INDEX IF NOT EXISTS strategy_lab_runs_symbol_created_at_desc_idx
  ON strategy_lab_runs (symbol, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS strategy_lab_runs_dedupe_idx
  ON strategy_lab_runs (
    input_hash,
    data_snapshot_id,
    engine_version,
    COALESCE(idempotency_key_hash, '')
  );

CREATE INDEX IF NOT EXISTS strategy_lab_jobs_status_next_run_at_priority_idx
  ON strategy_lab_jobs (status, next_run_at, priority);

CREATE INDEX IF NOT EXISTS strategy_lab_jobs_lease_expires_at_idx
  ON strategy_lab_jobs (lease_expires_at);

CREATE INDEX IF NOT EXISTS strategy_lab_jobs_run_id_idx
  ON strategy_lab_jobs (run_id);

CREATE INDEX IF NOT EXISTS strategy_lab_run_events_run_id_id_idx
  ON strategy_lab_run_events (run_id, id ASC);

CREATE INDEX IF NOT EXISTS strategy_lab_run_events_created_at_desc_idx
  ON strategy_lab_run_events (created_at DESC);

CREATE INDEX IF NOT EXISTS strategy_lab_run_artifacts_run_id_artifact_kind_idx
  ON strategy_lab_run_artifacts (run_id, artifact_kind);

CREATE INDEX IF NOT EXISTS strategy_lab_run_results_updated_at_desc_idx
  ON strategy_lab_run_results (updated_at DESC);

COMMIT;
