import {
  STRATEGIES,
  getDefaultParamsForStrategy,
} from "@/lib/quant/backtest";
import crypto from "crypto";
import type {
  StrategyLabCreateRunAccepted,
  StrategyLabRunEvent,
  StrategyLabRunRecord,
  StrategyLabRunResultRecord,
  StrategyLabStrategySpec,
} from "@/lib/strategy-lab/contracts";
import { STRATEGY_LAB_EXCHANGE } from "@/lib/strategy-lab/contracts";
import {
  executeRunInput,
  getExecutionErrorMeta,
  isValidationError,
  normalizeCreateRunRequest,
  toValidationError,
} from "@/lib/strategy-lab/executor";
import { bootstrapStrategyLabPersistenceFromEnv } from "@/lib/strategy-lab/persistence-bootstrap";
import {
  __resetStrategyLabPostgresBootstrapForTests,
  bootstrapStrategyLabPostgresClientFromEnv,
} from "@/lib/strategy-lab/postgres-bootstrap";
import {
  createStrategyLabRepositoryFromEnv,
  type StrategyLabRepository,
  type StrategyLabRepositoryStats,
} from "@/lib/strategy-lab/repository";

export class StrategyLabError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(input: { code: string; status: number; message: string; details?: unknown }) {
    super(input.message);
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
  }
}

type ResultIncludeMode = "summary" | "equity" | "trades" | "all";

const scheduledRuns = new Map<string, ReturnType<typeof setTimeout>>();
const runAbortControllers = new Map<string, AbortController>();
const idempotentRunRegistry = new Map<string, { fingerprint: string; runId: string; createdAtMs: number }>();

const RETRYABLE_ERROR_CODES = new Set([
  "INTERNAL_ERROR",
  "UPSTREAM_UNAVAILABLE",
  "TIMEOUT",
  "TRANSIENT_ERROR",
]);

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

const STRATEGY_LAB_MAX_RETRIES = parsePositiveInteger(process.env.STRATEGY_LAB_MAX_RETRIES, 2);
const STRATEGY_LAB_RETRY_BASE_DELAY_MS = Math.max(100, parsePositiveInteger(process.env.STRATEGY_LAB_RETRY_BASE_DELAY_MS, 1000));
const STRATEGY_LAB_RETRY_MAX_DELAY_MS = Math.max(
  STRATEGY_LAB_RETRY_BASE_DELAY_MS,
  parsePositiveInteger(process.env.STRATEGY_LAB_RETRY_MAX_DELAY_MS, 10_000)
);
const STRATEGY_LAB_IDEMPOTENCY_TTL_MS = Math.max(
  60_000,
  parsePositiveInteger(process.env.STRATEGY_LAB_IDEMPOTENCY_TTL_MS, 24 * 60 * 60 * 1000)
);

const PARAM_RULES: Record<string, { label: string; type: "integer" | "number"; min: number; max: number }> = {
  shortPeriod: { label: "Short Period", type: "integer", min: 2, max: 299 },
  longPeriod: { label: "Long Period", type: "integer", min: 3, max: 300 },
  period: { label: "Period", type: "integer", min: 2, max: 200 },
  oversold: { label: "Oversold", type: "number", min: 5, max: 50 },
  overbought: { label: "Overbought", type: "number", min: 50, max: 95 },
  stdDev: { label: "Std Dev", type: "number", min: 0.5, max: 4 },
  lookback: { label: "Lookback", type: "integer", min: 2, max: 252 },
  threshold: { label: "Threshold", type: "number", min: 0.001, max: 0.5 },
};

bootstrapStrategyLabPersistenceFromEnv();
let strategyLabRepository: StrategyLabRepository = createStrategyLabRepositoryFromEnv();
let strategyLabRepositoryBootstrapPromise: Promise<void> | null = null;

function mapToStrategyLabError(error: unknown): StrategyLabError {
  if (error instanceof StrategyLabError) {
    return error;
  }
  if (isValidationError(error)) {
    const validation = toValidationError(error);
    return new StrategyLabError({
      code: "INVALID_INPUT",
      status: 400,
      message: validation.message,
      details: validation.details,
    });
  }
  return new StrategyLabError({
    code: "INTERNAL_ERROR",
    status: 500,
    message: error instanceof Error ? error.message : "Unexpected Strategy Lab error.",
  });
}

function shouldRetryRun(errorCode: string, run: StrategyLabRunRecord): boolean {
  if (errorCode === "RUN_ABORTED") {
    return false;
  }
  if (!RETRYABLE_ERROR_CODES.has(errorCode)) {
    return false;
  }
  const retryCount = run.retryCount ?? 0;
  const maxRetries = run.maxRetries ?? 0;
  return retryCount < maxRetries;
}

function getRetryDelayMs(nextRetryCount: number): number {
  const exponential = STRATEGY_LAB_RETRY_BASE_DELAY_MS * Math.pow(2, Math.max(0, nextRetryCount - 1));
  return Math.min(STRATEGY_LAB_RETRY_MAX_DELAY_MS, Math.trunc(exponential));
}

function buildRunSummary(
  result: StrategyLabRunResultRecord["result"],
  antiBiasSignals: StrategyLabRunResultRecord["antiBiasSignals"]
) {
  return {
    metrics: result.metrics,
    diagnostics: result.diagnostics,
    totalTrades: result.trades.length,
    equityPoints: result.equityCurve.length,
    antiBiasSignals,
  };
}

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

function buildRunInputFingerprint(input: ReturnType<typeof normalizeCreateRunRequest>): string {
  return crypto.createHash("sha256").update(stableStringify(input)).digest("hex");
}

function normalizeIdempotencyKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const key = raw.trim();
  if (!key) return undefined;
  if (key.length > 128) {
    throw new StrategyLabError({
      code: "INVALID_INPUT",
      status: 400,
      message: "Idempotency-Key must be 1-128 characters.",
    });
  }
  return key;
}

function purgeExpiredIdempotencyEntries(nowMs: number): void {
  for (const [key, entry] of idempotentRunRegistry.entries()) {
    if (nowMs - entry.createdAtMs > STRATEGY_LAB_IDEMPOTENCY_TTL_MS) {
      idempotentRunRegistry.delete(key);
    }
  }
}

function getOrCreateRunAbortController(runId: string): AbortController {
  const existing = runAbortControllers.get(runId);
  if (existing && !existing.signal.aborted) {
    return existing;
  }
  const controller = new AbortController();
  runAbortControllers.set(runId, controller);
  return controller;
}

function clearRunAbortController(runId: string): void {
  runAbortControllers.delete(runId);
}

async function ensureStrategyLabRepositoryReady(): Promise<void> {
  const backend = String(process.env.STRATEGY_LAB_REPOSITORY_BACKEND ?? "memory").trim().toLowerCase();
  if (backend !== "postgres") return;
  if (strategyLabRepository.backend === "postgres") return;

  if (!strategyLabRepositoryBootstrapPromise) {
    strategyLabRepositoryBootstrapPromise = (async () => {
      await bootstrapStrategyLabPostgresClientFromEnv();
      strategyLabRepository = createStrategyLabRepositoryFromEnv();
    })();
  }
  await strategyLabRepositoryBootstrapPromise;
}

async function executeRunLifecycle(runId: string): Promise<void> {
  await ensureStrategyLabRepositoryReady();
  try {
    const queuedRun = await strategyLabRepository.getRun(runId);
    if (!queuedRun) return;
    if (queuedRun.status !== "queued") return;

    if (queuedRun.cancelRequested) {
      await strategyLabRepository.markRunAndJobStatus({
        runId,
        runStatus: "cancelled",
        jobStatus: "cancelled",
        finished: true,
      });
      await strategyLabRepository.appendRunEvent({
        runId,
        jobId: queuedRun.jobId,
        type: "run_cancelled",
        status: "cancelled",
        payload: {
          reason: "cancel_requested_before_start",
        },
      });
      clearRunAbortController(runId);
      return;
    }

    const runWithAttempt = await strategyLabRepository.updateRun(runId, {
      attemptCount: (queuedRun.attemptCount ?? 0) + 1,
      lastAttemptAt: new Date().toISOString(),
      nextRetryAt: undefined,
    });

    await strategyLabRepository.markRunAndJobStatus({
      runId,
      runStatus: "running",
      jobStatus: "running",
      started: true,
    });
    await strategyLabRepository.appendRunEvent({
      runId,
      jobId: queuedRun.jobId,
      type: "run_started",
      status: "running",
      payload: {
        attemptCount: runWithAttempt?.attemptCount ?? (queuedRun.attemptCount ?? 0) + 1,
        retryCount: runWithAttempt?.retryCount ?? queuedRun.retryCount ?? 0,
        maxRetries: runWithAttempt?.maxRetries ?? queuedRun.maxRetries ?? 0,
      },
    });

    const controller = getOrCreateRunAbortController(runId);
    const execution = await executeRunInput(runId, queuedRun.input, {
      signal: controller.signal,
    });
    const latestRun = await strategyLabRepository.getRun(runId);
    if (!latestRun) return;

    if (latestRun.cancelRequested) {
      await strategyLabRepository.markRunAndJobStatus({
        runId,
        runStatus: "cancelled",
        jobStatus: "cancelled",
        finished: true,
      });
      await strategyLabRepository.appendRunEvent({
        runId,
        jobId: latestRun.jobId,
        type: "run_cancelled",
        status: "cancelled",
        payload: {
          reason: "cancel_requested_during_execution",
        },
      });
      clearRunAbortController(runId);
      return;
    }

    await strategyLabRepository.setRunResult(runId, execution);
    await strategyLabRepository.updateRun(runId, {
      summary: buildRunSummary(execution.result, execution.antiBiasSignals),
      nextRetryAt: undefined,
      error: undefined,
    });
    await strategyLabRepository.markRunAndJobStatus({
      runId,
      runStatus: "succeeded",
      jobStatus: "succeeded",
      finished: true,
    });
    await strategyLabRepository.appendRunEvent({
      runId,
      jobId: latestRun.jobId,
      type: "run_succeeded",
      status: "succeeded",
      payload: {
        totalTrades: execution.result.trades.length,
        totalReturn: execution.result.metrics.totalReturn,
        coverageRatio: execution.antiBiasSignals.coverageRatio,
        warningsCount: execution.antiBiasSignals.warningsCount,
        attemptCount: latestRun.attemptCount ?? 0,
        retryCount: latestRun.retryCount ?? 0,
      },
    });
    clearRunAbortController(runId);
  } catch (error) {
    const failedRun = await strategyLabRepository.getRun(runId);
    if (!failedRun) return;

    const meta = getExecutionErrorMeta(error);
    if (failedRun.cancelRequested || meta.code === "RUN_ABORTED") {
      await strategyLabRepository.markRunAndJobStatus({
        runId,
        runStatus: "cancelled",
        jobStatus: "cancelled",
        finished: true,
      });
      await strategyLabRepository.appendRunEvent({
        runId,
        jobId: failedRun.jobId,
        type: "run_cancelled",
        status: "cancelled",
        payload: {
          reason: meta.code === "RUN_ABORTED" ? "abort_signal" : "cancel_requested_during_execution",
        },
      });
      clearRunAbortController(runId);
      return;
    }

    if (shouldRetryRun(meta.code, failedRun)) {
      const nextRetryCount = (failedRun.retryCount ?? 0) + 1;
      const delayMs = getRetryDelayMs(nextRetryCount);
      const nextRetryAt = new Date(Date.now() + delayMs).toISOString();

      await strategyLabRepository.markRunAndJobStatus({
        runId,
        runStatus: "queued",
        jobStatus: "queued",
      });
      await strategyLabRepository.updateRun(runId, {
        retryCount: nextRetryCount,
        nextRetryAt,
        error: {
          code: meta.code,
          message: meta.message,
        },
      });
      await strategyLabRepository.appendRunEvent({
        runId,
        jobId: failedRun.jobId,
        type: "run_retry_scheduled",
        status: "queued",
        payload: {
          retryCount: nextRetryCount,
          maxRetries: failedRun.maxRetries ?? 0,
          nextRetryAt,
          retryDelayMs: delayMs,
          errorCode: meta.code,
        },
      });
      scheduleRun(runId, delayMs);
      return;
    }

    await strategyLabRepository.markRunAndJobStatus({
      runId,
      runStatus: "failed",
      jobStatus: "failed",
      finished: true,
      error: {
        code: meta.code,
        message: meta.message,
      },
    });
    await strategyLabRepository.appendRunEvent({
      runId,
      jobId: failedRun.jobId,
      type: "run_failed",
      status: "failed",
      payload: meta.details && typeof meta.details === "object" ? (meta.details as Record<string, unknown>) : undefined,
    });
    clearRunAbortController(runId);
  }
}

function cancelScheduledRun(runId: string): void {
  const timeout = scheduledRuns.get(runId);
  if (!timeout) return;
  clearTimeout(timeout);
  scheduledRuns.delete(runId);
}

function scheduleRun(runId: string, delayMs = 0): void {
  if (!shouldUseInProcessScheduler()) return;
  if (scheduledRuns.has(runId)) return;
  const timeout = setTimeout(() => {
    scheduledRuns.delete(runId);
    void executeRunLifecycle(runId);
  }, delayMs);
  scheduledRuns.set(runId, timeout);
}

function shouldUseInProcessScheduler(): boolean {
  return strategyLabRepository.backend !== "postgres";
}

export async function createStrategyLabRun(
  payload: unknown,
  options?: { idempotencyKey?: string }
): Promise<StrategyLabCreateRunAccepted> {
  await ensureStrategyLabRepositoryReady();
  try {
    const input = normalizeCreateRunRequest(payload);
    const idempotencyKey = normalizeIdempotencyKey(options?.idempotencyKey);
    let inputFingerprint: string | undefined;
    const nowMs = Date.now();
    if (idempotencyKey) {
      purgeExpiredIdempotencyEntries(nowMs);
      inputFingerprint = buildRunInputFingerprint(input);
      const existing = idempotentRunRegistry.get(idempotencyKey);
      if (existing) {
        if (existing.fingerprint !== inputFingerprint) {
          throw new StrategyLabError({
            code: "IDEMPOTENCY_KEY_CONFLICT",
            status: 409,
            message: "Idempotency-Key already used with a different payload.",
          });
        }
        const existingRun = await strategyLabRepository.getRun(existing.runId);
        if (existingRun) {
          return {
            runId: existingRun.runId,
            jobId: existingRun.jobId,
            status: existingRun.status,
            pollUrl: `/api/strategy-lab/runs/${existingRun.runId}`,
            eventsUrl: `/api/strategy-lab/runs/${existingRun.runId}/events`,
            resultUrl: `/api/strategy-lab/runs/${existingRun.runId}/result`,
          };
        }
        idempotentRunRegistry.delete(idempotencyKey);
      }
    }

    const { run, job } = await strategyLabRepository.createQueuedRun(input, {
      maxRetries: STRATEGY_LAB_MAX_RETRIES,
    });
    await strategyLabRepository.appendRunEvent({
      runId: run.runId,
      jobId: job.jobId,
      type: "run_created",
      status: "queued",
      payload: {
        symbol: run.input.symbol,
        strategyType: run.input.strategyType,
        maxRetries: run.maxRetries ?? 0,
      },
    });
    if (idempotencyKey) {
      idempotentRunRegistry.set(idempotencyKey, {
        fingerprint: inputFingerprint ?? buildRunInputFingerprint(input),
        runId: run.runId,
        createdAtMs: nowMs,
      });
    }
    scheduleRun(run.runId);
    return {
      runId: run.runId,
      jobId: job.jobId,
      status: run.status,
      pollUrl: `/api/strategy-lab/runs/${run.runId}`,
      eventsUrl: `/api/strategy-lab/runs/${run.runId}/events`,
      resultUrl: `/api/strategy-lab/runs/${run.runId}/result`,
    };
  } catch (error) {
    throw mapToStrategyLabError(error);
  }
}

export async function getStrategyLabRun(runId: string): Promise<StrategyLabRunRecord> {
  await ensureStrategyLabRepositoryReady();
  const run = await strategyLabRepository.getRun(runId);
  if (!run) {
    throw new StrategyLabError({
      code: "RUN_NOT_FOUND",
      status: 404,
      message: `Run ${runId} not found.`,
    });
  }
  return run;
}

export async function getStrategyLabRunEvents(
  runId: string,
  options?: { since?: number; limit?: number }
): Promise<StrategyLabRunEvent[]> {
  await ensureStrategyLabRepositoryReady();
  await getStrategyLabRun(runId);
  return strategyLabRepository.listRunEvents(runId, {
    sinceSequence: options?.since,
    limit: options?.limit,
  });
}

export async function getStrategyLabRunResult(
  runId: string,
  include: ResultIncludeMode,
  options?: { cursor?: string; limit?: number }
): Promise<Record<string, unknown>> {
  await ensureStrategyLabRepositoryReady();
  const run = await getStrategyLabRun(runId);
  if (run.status !== "succeeded") {
    throw new StrategyLabError({
      code: "RESULT_NOT_READY",
      status: 409,
      message: `Run ${runId} is ${run.status}.`,
      details: { status: run.status },
    });
  }

  const storedResult = await strategyLabRepository.getRunResult(runId);
  if (!storedResult) {
    throw new StrategyLabError({
      code: "RESULT_NOT_FOUND",
      status: 404,
      message: `Result for ${runId} was not found.`,
    });
  }

  if (include === "summary") {
    return {
      runId,
      status: run.status,
      symbol: storedResult.symbol,
      strategyType: storedResult.strategyType,
      strategyName: storedResult.strategyName,
      initialCapital: storedResult.initialCapital,
      generatedAt: storedResult.generatedAt,
      reproMetadata: storedResult.reproMetadata,
      summary: buildRunSummary(storedResult.result, storedResult.antiBiasSignals),
    };
  }

  const withPagination = (items: unknown[], pagination?: { cursor?: string; limit?: number }) => {
    if (!pagination || (!pagination.cursor && !pagination.limit)) {
      return {
        items,
        page: null as null | {
          cursor: string;
          limit: number;
          nextCursor: string | null;
          total: number;
        },
      };
    }
    const limit = Math.max(1, Math.min(1000, Math.trunc(pagination.limit ?? 200)));
    const offsetRaw = pagination.cursor ? Number.parseInt(pagination.cursor, 10) : 0;
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;
    const sliced = items.slice(offset, offset + limit);
    const nextOffset = offset + sliced.length;
    return {
      items: sliced,
      page: {
        cursor: String(offset),
        limit,
        nextCursor: nextOffset < items.length ? String(nextOffset) : null,
        total: items.length,
      },
    };
  };

  if (include === "equity") {
    const paged = withPagination(storedResult.result.equityCurve, options);
    return {
      runId,
      status: run.status,
      symbol: storedResult.symbol,
      strategyType: storedResult.strategyType,
      generatedAt: storedResult.generatedAt,
      reproMetadata: storedResult.reproMetadata,
      antiBiasSignals: storedResult.antiBiasSignals,
      equityCurve: paged.items,
      page: paged.page,
      metrics: storedResult.result.metrics,
    };
  }

  if (include === "trades") {
    const paged = withPagination(storedResult.result.trades, options);
    return {
      runId,
      status: run.status,
      symbol: storedResult.symbol,
      strategyType: storedResult.strategyType,
      generatedAt: storedResult.generatedAt,
      reproMetadata: storedResult.reproMetadata,
      antiBiasSignals: storedResult.antiBiasSignals,
      trades: paged.items,
      page: paged.page,
      metrics: storedResult.result.metrics,
    };
  }

  return {
    status: run.status,
    ...storedResult,
  };
}

export async function cancelStrategyLabRun(runId: string): Promise<StrategyLabRunRecord> {
  await ensureStrategyLabRepositoryReady();
  const run = await getStrategyLabRun(runId);
  if (run.status === "succeeded" || run.status === "failed" || run.status === "cancelled") {
    throw new StrategyLabError({
      code: "RUN_NOT_CANCELLABLE",
      status: 409,
      message: `Run ${runId} is already ${run.status}.`,
    });
  }

  if (!run.cancelRequested) {
    await strategyLabRepository.updateRun(runId, { cancelRequested: true });
    await strategyLabRepository.appendRunEvent({
      runId,
      jobId: run.jobId,
      type: "run_cancel_requested",
      status: run.status,
    });
  }
  const controller = runAbortControllers.get(runId);
  if (controller && !controller.signal.aborted) {
    controller.abort();
  }

  const latest = await strategyLabRepository.getRun(runId);
  if (!latest) {
    throw new StrategyLabError({
      code: "RUN_NOT_FOUND",
      status: 404,
      message: `Run ${runId} not found.`,
    });
  }

  if (latest.status === "queued") {
    cancelScheduledRun(runId);
    await strategyLabRepository.markRunAndJobStatus({
      runId,
      runStatus: "cancelled",
      jobStatus: "cancelled",
      finished: true,
    });
    await strategyLabRepository.appendRunEvent({
      runId,
      jobId: latest.jobId,
      type: "run_cancelled",
      status: "cancelled",
      payload: {
        reason: "cancel_requested_before_start",
      },
    });
    clearRunAbortController(runId);
  }

  return getStrategyLabRun(runId);
}

export function listStrategyLabStrategies(): StrategyLabStrategySpec[] {
  return STRATEGIES.map((strategy) => {
    const defaults = getDefaultParamsForStrategy(strategy.type);
    const params = Object.entries(defaults).map(([key, defaultValue]) => {
      const rule = PARAM_RULES[key];
      return {
        key,
        label: rule?.label ?? key,
        type: rule?.type ?? "number",
        min: rule?.min ?? Number.NEGATIVE_INFINITY,
        max: rule?.max ?? Number.POSITIVE_INFINITY,
        defaultValue,
      };
    });

    return {
      type: strategy.type,
      name: strategy.name,
      exchange: STRATEGY_LAB_EXCHANGE,
      params,
    };
  });
}

export function parseResultInclude(value: string | null): ResultIncludeMode {
  const normalized = String(value ?? "summary").trim().toLowerCase();
  if (normalized === "summary" || normalized === "equity" || normalized === "trades" || normalized === "all") {
    return normalized;
  }
  throw new StrategyLabError({
    code: "INVALID_INPUT",
    status: 400,
    message: 'Invalid include. Use one of: "summary", "equity", "trades", "all".',
  });
}

export async function __resetStrategyLabForTests(): Promise<void> {
  for (const timeout of scheduledRuns.values()) {
    clearTimeout(timeout);
  }
  scheduledRuns.clear();
  for (const controller of runAbortControllers.values()) {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  }
  runAbortControllers.clear();
  idempotentRunRegistry.clear();
  strategyLabRepositoryBootstrapPromise = null;
  __resetStrategyLabPostgresBootstrapForTests();
  await strategyLabRepository.reset();
}

export function __setStrategyLabRepositoryForTests(repository: StrategyLabRepository | null): void {
  strategyLabRepository = repository ?? createStrategyLabRepositoryFromEnv();
  strategyLabRepositoryBootstrapPromise = null;
}

export async function getStrategyLabHealthSnapshot(): Promise<{
  scheduler: {
    queuedInScheduler: number;
  };
  controllers: {
    runningAbortControllers: number;
  };
  store: StrategyLabRepositoryStats;
}> {
  await ensureStrategyLabRepositoryReady();
  return {
    scheduler: {
      queuedInScheduler: scheduledRuns.size,
    },
    controllers: {
      runningAbortControllers: runAbortControllers.size,
    },
    store: await strategyLabRepository.getStats(),
  };
}
