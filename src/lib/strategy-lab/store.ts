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

interface StrategyLabState {
  runCounter: number;
  jobCounter: number;
  eventCounter: number;
  runs: Map<string, StrategyLabRunRecord>;
  jobs: Map<string, StrategyLabJobRecord>;
  results: Map<string, StrategyLabRunResultRecord>;
  eventsByRunId: Map<string, StrategyLabRunEvent[]>;
}

export interface StrategyLabStoreSnapshot {
  version: 1;
  counters: {
    runCounter: number;
    jobCounter: number;
    eventCounter: number;
  };
  runs: StrategyLabRunRecord[];
  jobs: StrategyLabJobRecord[];
  results: StrategyLabRunResultRecord[];
  eventsByRunId: Array<{
    runId: string;
    events: StrategyLabRunEvent[];
  }>;
}

export interface StrategyLabStoreAdapter {
  name: string;
  loadSnapshot?: () => StrategyLabStoreSnapshot | null;
  persistSnapshot?: (snapshot: StrategyLabStoreSnapshot) => void;
  clearSnapshot?: () => void;
}

declare global {
  var __strategyLabState__: StrategyLabState | undefined;
}

let strategyLabStoreAdapter: StrategyLabStoreAdapter | null = null;

function createState(): StrategyLabState {
  return {
    runCounter: 0,
    jobCounter: 0,
    eventCounter: 0,
    runs: new Map<string, StrategyLabRunRecord>(),
    jobs: new Map<string, StrategyLabJobRecord>(),
    results: new Map<string, StrategyLabRunResultRecord>(),
    eventsByRunId: new Map<string, StrategyLabRunEvent[]>(),
  };
}

function toSnapshot(state: StrategyLabState): StrategyLabStoreSnapshot {
  return {
    version: 1,
    counters: {
      runCounter: state.runCounter,
      jobCounter: state.jobCounter,
      eventCounter: state.eventCounter,
    },
    runs: Array.from(state.runs.values()).map((run) => cloneRun(run)),
    jobs: Array.from(state.jobs.values()).map((job) => cloneJob(job)),
    results: Array.from(state.results.values()).map((result) => cloneResult(result)),
    eventsByRunId: Array.from(state.eventsByRunId.entries()).map(([runId, events]) => ({
      runId,
      events: events.map((event) => cloneEvent(event)),
    })),
  };
}

function fromSnapshot(snapshot: StrategyLabStoreSnapshot): StrategyLabState {
  const state = createState();
  state.runCounter = Math.max(0, Math.trunc(snapshot.counters.runCounter));
  state.jobCounter = Math.max(0, Math.trunc(snapshot.counters.jobCounter));
  state.eventCounter = Math.max(0, Math.trunc(snapshot.counters.eventCounter));

  for (const run of snapshot.runs) {
    state.runs.set(run.runId, cloneRun(run));
  }
  for (const job of snapshot.jobs) {
    state.jobs.set(job.jobId, cloneJob(job));
  }
  for (const result of snapshot.results) {
    state.results.set(result.runId, cloneResult(result));
  }
  for (const entry of snapshot.eventsByRunId) {
    state.eventsByRunId.set(entry.runId, entry.events.map((event) => cloneEvent(event)));
  }

  return state;
}

function safeCallAdapter<T>(operation: string, fn: () => T): T | null {
  try {
    return fn();
  } catch (error) {
    console.error(`[strategy-lab/store] adapter ${operation} failed:`, error);
    return null;
  }
}

function persistState(state: StrategyLabState): void {
  if (!strategyLabStoreAdapter?.persistSnapshot) return;
  const snapshot = toSnapshot(state);
  void safeCallAdapter("persistSnapshot", () => strategyLabStoreAdapter?.persistSnapshot?.(snapshot));
}

function getState(): StrategyLabState {
  if (!globalThis.__strategyLabState__) {
    const snapshot = strategyLabStoreAdapter?.loadSnapshot
      ? safeCallAdapter("loadSnapshot", () => strategyLabStoreAdapter?.loadSnapshot?.())
      : null;
    if (snapshot && snapshot.version === 1) {
      try {
        globalThis.__strategyLabState__ = fromSnapshot(snapshot);
      } catch (error) {
        console.error("[strategy-lab/store] invalid snapshot, falling back to empty state:", error);
        globalThis.__strategyLabState__ = createState();
      }
    } else {
      globalThis.__strategyLabState__ = createState();
    }
  }
  return globalThis.__strategyLabState__;
}

export function setStrategyLabStoreAdapter(adapter: StrategyLabStoreAdapter | null): void {
  strategyLabStoreAdapter = adapter;
  globalThis.__strategyLabState__ = undefined;
}

export function getStrategyLabStoreAdapterName(): string | null {
  return strategyLabStoreAdapter?.name ?? null;
}

function nextId(prefix: "run" | "job" | "evt"): string {
  const state = getState();
  if (prefix === "run") {
    state.runCounter += 1;
    return `run_${String(state.runCounter).padStart(8, "0")}`;
  }
  if (prefix === "job") {
    state.jobCounter += 1;
    return `job_${String(state.jobCounter).padStart(8, "0")}`;
  }
  state.eventCounter += 1;
  return `evt_${String(state.eventCounter).padStart(10, "0")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneRun(run: StrategyLabRunRecord): StrategyLabRunRecord {
  return {
    ...run,
    input: {
      ...run.input,
      params: { ...run.input.params },
      config: { ...run.input.config },
      dateRange: run.input.dateRange ? { ...run.input.dateRange } : undefined,
    },
    summary: run.summary
      ? {
        metrics: { ...run.summary.metrics },
        diagnostics: {
          ...run.summary.diagnostics,
          warnings: [...run.summary.diagnostics.warnings],
        },
        totalTrades: run.summary.totalTrades,
        equityPoints: run.summary.equityPoints,
        antiBiasSignals: {
          ...run.summary.antiBiasSignals,
          warnings: [...run.summary.antiBiasSignals.warnings],
        },
      }
      : undefined,
    error: run.error ? { ...run.error } : undefined,
  };
}

function cloneJob(job: StrategyLabJobRecord): StrategyLabJobRecord {
  return { ...job };
}

function cloneEvent(event: StrategyLabRunEvent): StrategyLabRunEvent {
  return {
    ...event,
    payload: event.payload ? { ...event.payload } : undefined,
  };
}

function cloneResult(result: StrategyLabRunResultRecord): StrategyLabRunResultRecord {
  return {
    ...result,
    reproMetadata: { ...result.reproMetadata },
    antiBiasSignals: {
      ...result.antiBiasSignals,
      warnings: [...result.antiBiasSignals.warnings],
    },
    result: {
      ...result.result,
      trades: result.result.trades.map((trade) => ({ ...trade })),
      equityCurve: result.result.equityCurve.map((point) => ({ ...point })),
      metrics: { ...result.result.metrics },
      diagnostics: {
        ...result.result.diagnostics,
        warnings: [...result.result.diagnostics.warnings],
      },
      configApplied: {
        ...result.result.configApplied,
        costs: { ...result.result.configApplied.costs },
        positionSizing: { ...result.result.configApplied.positionSizing },
      },
    },
  };
}

export function createQueuedRun(
  input: StrategyLabNormalizedRunInput,
  options?: { maxRetries?: number }
): {
  run: StrategyLabRunRecord;
  job: StrategyLabJobRecord;
} {
  const state = getState();
  const runId = nextId("run");
  const jobId = nextId("job");
  const timestamp = nowIso();

  const run: StrategyLabRunRecord = {
    runId,
    jobId,
    status: "queued",
    input,
    cancelRequested: false,
    attemptCount: 0,
    retryCount: 0,
    maxRetries: Math.max(0, Math.trunc(options?.maxRetries ?? 0)),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const job: StrategyLabJobRecord = {
    jobId,
    runId,
    status: "queued",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  state.runs.set(runId, run);
  state.jobs.set(jobId, job);
  state.eventsByRunId.set(runId, []);
  persistState(state);

  return { run: cloneRun(run), job: cloneJob(job) };
}

export function getRun(runId: string): StrategyLabRunRecord | null {
  const state = getState();
  const run = state.runs.get(runId);
  return run ? cloneRun(run) : null;
}

export function getJob(jobId: string): StrategyLabJobRecord | null {
  const state = getState();
  const job = state.jobs.get(jobId);
  return job ? cloneJob(job) : null;
}

export function updateRun(
  runId: string,
  patch:
    | Partial<Omit<StrategyLabRunRecord, "runId" | "jobId" | "input" | "createdAt">>
    | ((current: StrategyLabRunRecord) => Partial<Omit<StrategyLabRunRecord, "runId" | "jobId" | "input" | "createdAt">>)
): StrategyLabRunRecord | null {
  const state = getState();
  const current = state.runs.get(runId);
  if (!current) return null;

  const partial = typeof patch === "function" ? patch(cloneRun(current)) : patch;
  const next: StrategyLabRunRecord = {
    ...current,
    ...partial,
    updatedAt: nowIso(),
  };
  state.runs.set(runId, next);
  persistState(state);
  return cloneRun(next);
}

export function updateJob(
  jobId: string,
  patch:
    | Partial<Omit<StrategyLabJobRecord, "jobId" | "runId" | "createdAt">>
    | ((current: StrategyLabJobRecord) => Partial<Omit<StrategyLabJobRecord, "jobId" | "runId" | "createdAt">>)
): StrategyLabJobRecord | null {
  const state = getState();
  const current = state.jobs.get(jobId);
  if (!current) return null;

  const partial = typeof patch === "function" ? patch(cloneJob(current)) : patch;
  const next: StrategyLabJobRecord = {
    ...current,
    ...partial,
    updatedAt: nowIso(),
  };
  state.jobs.set(jobId, next);
  persistState(state);
  return cloneJob(next);
}

export function appendRunEvent(input: {
  runId: string;
  jobId: string;
  type: StrategyLabEventType;
  status: StrategyLabRunStatus;
  payload?: Record<string, unknown>;
}): StrategyLabRunEvent {
  const state = getState();
  const events = state.eventsByRunId.get(input.runId) ?? [];
  const sequence = state.eventCounter + 1;
  const event: StrategyLabRunEvent = {
    id: nextId("evt"),
    sequence,
    runId: input.runId,
    jobId: input.jobId,
    type: input.type,
    status: input.status,
    createdAt: nowIso(),
    payload: input.payload,
  };
  events.push(event);
  state.eventsByRunId.set(input.runId, events);
  persistState(state);
  return cloneEvent(event);
}

export function listRunEvents(runId: string, options?: { sinceSequence?: number; limit?: number }): StrategyLabRunEvent[] {
  const state = getState();
  const events = state.eventsByRunId.get(runId) ?? [];
  const sinceSequence = options?.sinceSequence ?? 0;
  const limited = options?.limit && options.limit > 0 ? options.limit : events.length;
  return events
    .filter((event) => event.sequence > sinceSequence)
    .slice(0, limited)
    .map((event) => cloneEvent(event));
}

export function setRunResult(runId: string, result: StrategyLabRunResultRecord): StrategyLabRunResultRecord {
  const state = getState();
  state.results.set(runId, result);
  persistState(state);
  return cloneResult(result);
}

export function getRunResult(runId: string): StrategyLabRunResultRecord | null {
  const state = getState();
  const result = state.results.get(runId);
  return result ? cloneResult(result) : null;
}

export function markRunAndJobStatus(input: {
  runId: string;
  runStatus: StrategyLabRunStatus;
  jobStatus: StrategyLabJobStatus;
  started?: boolean;
  finished?: boolean;
  error?: { code: string; message: string };
}): { run: StrategyLabRunRecord | null; job: StrategyLabJobRecord | null } {
  const state = getState();
  const existingRun = state.runs.get(input.runId);
  if (!existingRun) return { run: null, job: null };

  const now = nowIso();
  const runStartedAt = input.started && !existingRun.startedAt ? now : existingRun.startedAt;
  const runFinishedAt = input.finished ? now : existingRun.finishedAt;
  const updatedRun: StrategyLabRunRecord = {
    ...existingRun,
    status: input.runStatus,
    startedAt: runStartedAt,
    finishedAt: runFinishedAt,
    error: input.error ?? existingRun.error,
    updatedAt: now,
  };
  state.runs.set(input.runId, updatedRun);

  const existingJob = state.jobs.get(existingRun.jobId);
  if (!existingJob) {
    persistState(state);
    return { run: cloneRun(updatedRun), job: null };
  }
  const jobStartedAt = input.started && !existingJob.startedAt ? now : existingJob.startedAt;
  const jobFinishedAt = input.finished ? now : existingJob.finishedAt;
  const updatedJob: StrategyLabJobRecord = {
    ...existingJob,
    status: input.jobStatus,
    startedAt: jobStartedAt,
    finishedAt: jobFinishedAt,
    updatedAt: now,
  };
  state.jobs.set(existingRun.jobId, updatedJob);
  persistState(state);

  return { run: cloneRun(updatedRun), job: cloneJob(updatedJob) };
}

export function resetStrategyLabStore(options?: { clearPersisted?: boolean }): void {
  const clearPersisted = options?.clearPersisted !== false;
  if (options?.clearPersisted !== false && strategyLabStoreAdapter?.clearSnapshot) {
    void safeCallAdapter("clearSnapshot", () => strategyLabStoreAdapter?.clearSnapshot?.());
  }
  globalThis.__strategyLabState__ = createState();
  if (!clearPersisted) {
    persistState(globalThis.__strategyLabState__);
  }
}

export interface StrategyLabStoreStats {
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

export function getStrategyLabStoreStats(): StrategyLabStoreStats {
  const state = getState();
  const runStatuses = {
    queued: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
  };
  const jobStatuses = {
    queued: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
  };

  let lastRunUpdatedAt: string | undefined;
  for (const run of state.runs.values()) {
    runStatuses[run.status] += 1;
    if (!lastRunUpdatedAt || new Date(run.updatedAt).getTime() > new Date(lastRunUpdatedAt).getTime()) {
      lastRunUpdatedAt = run.updatedAt;
    }
  }

  for (const job of state.jobs.values()) {
    jobStatuses[job.status] += 1;
  }

  let totalEvents = 0;
  for (const events of state.eventsByRunId.values()) {
    totalEvents += events.length;
  }

  return {
    runs: {
      total: state.runs.size,
      ...runStatuses,
    },
    jobs: {
      total: state.jobs.size,
      ...jobStatuses,
    },
    results: state.results.size,
    events: totalEvents,
    lastRunUpdatedAt,
    persistence: {
      enabled: strategyLabStoreAdapter !== null,
      adapterName: strategyLabStoreAdapter?.name,
    },
  };
}
