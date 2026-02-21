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
import {
  appendRunEvent,
  createQueuedRun,
  getJob,
  getRun,
  getRunResult,
  getStrategyLabStoreStats,
  listRunEvents,
  markRunAndJobStatus,
  resetStrategyLabStore,
  setRunResult,
  updateJob,
  updateRun,
} from "@/lib/strategy-lab/store";

class InMemoryStrategyLabRepository implements StrategyLabRepository {
  readonly backend = "memory" as const;
  readonly name = "strategy-lab-in-memory";

  createQueuedRun(
    input: StrategyLabNormalizedRunInput,
    options?: { maxRetries?: number }
  ): {
    run: StrategyLabRunRecord;
    job: StrategyLabJobRecord;
  } {
    return createQueuedRun(input, options);
  }

  getRun(runId: string): StrategyLabRunRecord | null {
    return getRun(runId);
  }

  getJob(jobId: string): StrategyLabJobRecord | null {
    return getJob(jobId);
  }

  updateRun(
    runId: string,
    patch: StrategyLabRunPatch | ((current: StrategyLabRunRecord) => StrategyLabRunPatch)
  ): StrategyLabRunRecord | null {
    return updateRun(runId, patch);
  }

  updateJob(
    jobId: string,
    patch: StrategyLabJobPatch | ((current: StrategyLabJobRecord) => StrategyLabJobPatch)
  ): StrategyLabJobRecord | null {
    return updateJob(jobId, patch);
  }

  appendRunEvent(input: {
    runId: string;
    jobId: string;
    type: StrategyLabEventType;
    status: StrategyLabRunStatus;
    payload?: Record<string, unknown>;
  }): StrategyLabRunEvent {
    return appendRunEvent(input);
  }

  listRunEvents(runId: string, options?: { sinceSequence?: number; limit?: number }): StrategyLabRunEvent[] {
    return listRunEvents(runId, options);
  }

  setRunResult(runId: string, result: StrategyLabRunResultRecord): StrategyLabRunResultRecord {
    return setRunResult(runId, result);
  }

  getRunResult(runId: string): StrategyLabRunResultRecord | null {
    return getRunResult(runId);
  }

  markRunAndJobStatus(input: {
    runId: string;
    runStatus: StrategyLabRunStatus;
    jobStatus: StrategyLabJobStatus;
    started?: boolean;
    finished?: boolean;
    error?: { code: string; message: string };
  }): { run: StrategyLabRunRecord | null; job: StrategyLabJobRecord | null } {
    return markRunAndJobStatus(input);
  }

  reset(options?: { clearPersisted?: boolean }): void {
    resetStrategyLabStore(options);
  }

  getStats(): StrategyLabRepositoryStats {
    return getStrategyLabStoreStats();
  }
}

export function createInMemoryStrategyLabRepository(): StrategyLabRepository {
  return new InMemoryStrategyLabRepository();
}
