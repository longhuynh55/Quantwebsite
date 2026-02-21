import type { StrategyType } from "@/lib/quant/backtest";
import type {
  StrategyLabEventType,
  StrategyLabJobStatus,
  StrategyLabRunStatus,
  StrategyLabRunSummary,
} from "@/lib/strategy-lab/contracts";

export type StrategyLabDbJsonPrimitive = string | number | boolean | null;
export type StrategyLabDbJson = StrategyLabDbJsonPrimitive | StrategyLabDbJson[] | { [key: string]: StrategyLabDbJson };

export type StrategyLabDbJobStatus = StrategyLabJobStatus | "leased" | "retry_wait" | "dead_letter";

export type StrategyLabDbArtifactKind = "summary_json" | "equity_curve_json" | "trades_json" | "report_xlsx";

export interface StrategyLabRunRow {
  id: string;
  name: string | null;
  symbol: string;
  strategy_type: StrategyType;
  request_payload: StrategyLabDbJson;
  status: StrategyLabRunStatus;
  priority: number;
  engine_version: string;
  data_snapshot_id: string;
  input_hash: string;
  idempotency_key_hash: string | null;
  cancel_requested: boolean;
  attempt_count: number;
  retry_count: number;
  max_retries: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  metrics_summary: StrategyLabRunSummary | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface StrategyLabJobRow {
  id: string;
  run_id: string;
  queue_name: string;
  status: StrategyLabDbJobStatus;
  attempt: number;
  max_attempts: number;
  priority: number;
  lease_owner: string | null;
  lease_expires_at: string | null;
  next_run_at: string;
  last_heartbeat_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface StrategyLabRunEventRow {
  id: number;
  run_id: string;
  job_id: string | null;
  event_type: StrategyLabEventType;
  payload: StrategyLabDbJson;
  created_at: string;
}

export interface StrategyLabRunArtifactRow {
  id: string;
  run_id: string;
  artifact_kind: StrategyLabDbArtifactKind;
  storage_uri: string;
  content_type: string;
  byte_size: number;
  checksum_sha256: string;
  created_at: string;
}

export interface StrategyLabRunResultRow {
  run_id: string;
  result_payload: StrategyLabDbJson;
  created_at: string;
  updated_at: string;
}
