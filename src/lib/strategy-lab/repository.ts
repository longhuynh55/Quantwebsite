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
import { createInMemoryStrategyLabRepository } from "@/lib/strategy-lab/repository.in-memory";
import {
  createStrategyLabPostgresRepository,
  type StrategyLabPostgresClient,
  type StrategyLabPostgresRepositoryOptions,
} from "@/lib/strategy-lab/repository.postgres";

export type StrategyLabRepositoryBackend = "memory" | "postgres";
export type StrategyLabAwaitable<T> = T | Promise<T>;

export interface StrategyLabRepositoryStats {
  runs: {
    total: number;
    queued: number;
    running: number;
    succeeded: number;
    failed: number;
    cancelled: number;
  };
  jobs: {
    total: number;
    queued: number;
    running: number;
    succeeded: number;
    failed: number;
    cancelled: number;
  };
  results: number;
  events: number;
  lastRunUpdatedAt?: string;
  persistence: {
    enabled: boolean;
    adapterName?: string;
  };
}

export type StrategyLabRunPatch = Partial<Omit<StrategyLabRunRecord, "runId" | "jobId" | "input" | "createdAt">>;
export type StrategyLabJobPatch = Partial<Omit<StrategyLabJobRecord, "jobId" | "runId" | "createdAt">>;

export interface StrategyLabRepository {
  readonly backend: StrategyLabRepositoryBackend;
  readonly name: string;
  createQueuedRun(
    input: StrategyLabNormalizedRunInput,
    options?: { maxRetries?: number }
  ): StrategyLabAwaitable<{
    run: StrategyLabRunRecord;
    job: StrategyLabJobRecord;
  }>;
  getRun(runId: string): StrategyLabAwaitable<StrategyLabRunRecord | null>;
  getJob(jobId: string): StrategyLabAwaitable<StrategyLabJobRecord | null>;
  updateRun(
    runId: string,
    patch: StrategyLabRunPatch | ((current: StrategyLabRunRecord) => StrategyLabRunPatch)
  ): StrategyLabAwaitable<StrategyLabRunRecord | null>;
  updateJob(
    jobId: string,
    patch: StrategyLabJobPatch | ((current: StrategyLabJobRecord) => StrategyLabJobPatch)
  ): StrategyLabAwaitable<StrategyLabJobRecord | null>;
  appendRunEvent(input: {
    runId: string;
    jobId: string;
    type: StrategyLabEventType;
    status: StrategyLabRunStatus;
    payload?: Record<string, unknown>;
  }): StrategyLabAwaitable<StrategyLabRunEvent>;
  listRunEvents(runId: string, options?: { sinceSequence?: number; limit?: number }): StrategyLabAwaitable<StrategyLabRunEvent[]>;
  setRunResult(runId: string, result: StrategyLabRunResultRecord): StrategyLabAwaitable<StrategyLabRunResultRecord>;
  getRunResult(runId: string): StrategyLabAwaitable<StrategyLabRunResultRecord | null>;
  markRunAndJobStatus(input: {
    runId: string;
    runStatus: StrategyLabRunStatus;
    jobStatus: StrategyLabJobStatus;
    started?: boolean;
    finished?: boolean;
    error?: { code: string; message: string };
  }): StrategyLabAwaitable<{ run: StrategyLabRunRecord | null; job: StrategyLabJobRecord | null }>;
  reset(options?: { clearPersisted?: boolean }): StrategyLabAwaitable<void>;
  getStats(): StrategyLabAwaitable<StrategyLabRepositoryStats>;
}

export interface StrategyLabRepositoryFactoryOptions {
  backend?: StrategyLabRepositoryBackend;
  postgres?: StrategyLabPostgresRepositoryOptions;
}

declare global {
  var __strategyLabPostgresClient__: StrategyLabPostgresClient | undefined;
}

export function createStrategyLabRepository(options?: StrategyLabRepositoryFactoryOptions): StrategyLabRepository {
  if (options?.backend === "postgres") {
    if (options.postgres) {
      return createStrategyLabPostgresRepository(options.postgres);
    }
  }
  return createInMemoryStrategyLabRepository();
}

export function createStrategyLabRepositoryFromEnv(): StrategyLabRepository {
  const backendRaw = String(process.env.STRATEGY_LAB_REPOSITORY_BACKEND ?? "memory").trim().toLowerCase();
  if (backendRaw === "postgres") {
    const client = globalThis.__strategyLabPostgresClient__;
    if (client) {
      return createStrategyLabPostgresRepository({
        client,
        schema: process.env.STRATEGY_LAB_REPOSITORY_SCHEMA,
      });
    }
    throw new Error(
      "[strategy-lab/repository] STRATEGY_LAB_REPOSITORY_BACKEND=postgres but no client is configured."
    );
  }
  return createInMemoryStrategyLabRepository();
}
