import type { BacktestConfigInput, BacktestResult, StrategyType } from "@/lib/quant/backtest";

export const STRATEGY_LAB_EXCHANGE = "HOSE";

export type StrategyLabRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type StrategyLabJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type StrategyLabEventType =
  | "run_created"
  | "run_started"
  | "run_retry_scheduled"
  | "run_succeeded"
  | "run_failed"
  | "run_cancel_requested"
  | "run_cancelled";

export interface StrategyLabDateRange {
  from?: string;
  to?: string;
}

export interface StrategyLabCreateRunRequest {
  name?: string;
  exchange?: string;
  symbol: string;
  strategyType: StrategyType;
  dateRange?: StrategyLabDateRange;
  capital?: number;
  params?: Record<string, unknown>;
  config?: BacktestConfigInput;
  priority?: "low" | "normal" | "high";
}

export interface StrategyLabNormalizedRunInput {
  name: string;
  exchange: typeof STRATEGY_LAB_EXCHANGE;
  symbol: string;
  strategyType: StrategyType;
  dateRange?: StrategyLabDateRange;
  capital: number;
  params: Record<string, number>;
  config: BacktestConfigInput;
  priority: "low" | "normal" | "high";
}

export interface StrategyLabRunSummary {
  metrics: BacktestResult["metrics"];
  diagnostics: BacktestResult["diagnostics"];
  totalTrades: number;
  equityPoints: number;
  antiBiasSignals: StrategyLabAntiBiasSignals;
}

export interface StrategyLabRunRecord {
  runId: string;
  jobId: string;
  status: StrategyLabRunStatus;
  input: StrategyLabNormalizedRunInput;
  cancelRequested: boolean;
  attemptCount?: number;
  retryCount?: number;
  maxRetries?: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  summary?: StrategyLabRunSummary;
  error?: {
    code: string;
    message: string;
  };
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface StrategyLabJobRecord {
  jobId: string;
  runId: string;
  status: StrategyLabJobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface StrategyLabRunResultRecord {
  runId: string;
  symbol: string;
  strategyType: StrategyType;
  strategyName: string;
  initialCapital: number;
  generatedAt: string;
  result: BacktestResult;
  reproMetadata: StrategyLabReproMetadata;
  antiBiasSignals: StrategyLabAntiBiasSignals;
}

export interface StrategyLabReproMetadata {
  engineVersion: string;
  dataSnapshotId: string;
  inputHash: string;
}

export interface StrategyLabAntiBiasSignals {
  coverageRatio: number;
  largestGapDays: number;
  warnings: string[];
  warningsCount: number;
  tradesPerYear: number;
  lowCoverage: boolean;
}

export interface StrategyLabRunEvent {
  id: string;
  sequence: number;
  runId: string;
  jobId: string;
  type: StrategyLabEventType;
  status: StrategyLabRunStatus;
  createdAt: string;
  payload?: Record<string, unknown>;
}

export interface StrategyLabCreateRunAccepted {
  runId: string;
  jobId: string;
  status: StrategyLabRunStatus;
  pollUrl: string;
  eventsUrl: string;
  resultUrl: string;
}

export interface StrategyLabStrategyParamSpec {
  key: string;
  label: string;
  type: "integer" | "number";
  min: number;
  max: number;
  defaultValue: number;
}

export interface StrategyLabStrategySpec {
  type: StrategyType;
  name: string;
  exchange: typeof STRATEGY_LAB_EXCHANGE;
  params: StrategyLabStrategyParamSpec[];
}
