import crypto from "crypto";
import { loadOHLCVForSymbol } from "@/lib/data";
import { getDataQualityReport, getDataSourceFingerprint } from "@/lib/data";
import type { OHLCV } from "@/lib/quant/indicators";
import {
  STRATEGIES,
  STRATEGY_TYPES,
  extractNumericParams,
  runBacktest,
  validateBacktestConfigInput,
  validateStrategyParams,
  type BacktestValidationIssue,
  type StrategyConfig,
  type StrategyType,
} from "@/lib/quant/backtest";
import type {
  StrategyLabAntiBiasSignals,
  StrategyLabNormalizedRunInput,
  StrategyLabRunResultRecord,
} from "@/lib/strategy-lab/contracts";

const VALID_SYMBOL_REGEX = /^[A-Z0-9]{1,10}$/;
const MIN_CAPITAL = 1;
const MAX_CAPITAL = 1e12;
const DEFAULT_CAPITAL = 100000;
const MIN_DATA_POINTS = 30;
const LOW_COVERAGE_THRESHOLD = 0.9;
const STRATEGY_LAB_ENGINE_VERSION = process.env.STRATEGY_LAB_ENGINE_VERSION || "quant-website@0.1.0";

interface ExecuteRunInputOptions {
  signal?: AbortSignal;
}

function parseDateInput(raw: string | undefined): Date | null {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseCapital(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < MIN_CAPITAL || parsed > MAX_CAPITAL) return null;
  return parsed;
}

function isStrategyType(value: string): value is StrategyType {
  return (STRATEGY_TYPES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createValidationError(message: string, details?: BacktestValidationIssue[]): Error {
  const error = new Error(message);
  (error as Error & { code?: string; details?: BacktestValidationIssue[] }).code = "INVALID_INPUT";
  if (details && details.length > 0) {
    (error as Error & { details?: BacktestValidationIssue[] }).details = details;
  }
  return error;
}

function applyDateRange(data: OHLCV[], dateRange: StrategyLabNormalizedRunInput["dateRange"]): OHLCV[] {
  if (!dateRange?.from && !dateRange?.to) return data;

  const fromTime = parseDateInput(dateRange.from)?.getTime() ?? Number.MIN_SAFE_INTEGER;
  const toTime = parseDateInput(dateRange.to)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return data.filter((row) => {
    const time = row.date.getTime();
    return time >= fromTime && time <= toTime;
  });
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

function buildInputHash(input: StrategyLabNormalizedRunInput): string {
  const serialized = stableStringify({
    name: input.name,
    exchange: input.exchange,
    symbol: input.symbol,
    strategyType: input.strategyType,
    dateRange: input.dateRange ?? null,
    capital: input.capital,
    params: input.params,
    config: input.config,
    priority: input.priority,
  });
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

function buildAntiBiasSignals(result: StrategyLabRunResultRecord["result"]): StrategyLabAntiBiasSignals {
  const diagnostics = result.diagnostics;
  const firstMs = diagnostics.firstDate?.getTime() ?? 0;
  const lastMs = diagnostics.lastDate?.getTime() ?? firstMs;
  const elapsedYears = Math.max((lastMs - firstMs) / (365.25 * 24 * 60 * 60 * 1000), 1 / 365.25);
  const tradesPerYear = result.trades.length / elapsedYears;

  return {
    coverageRatio: diagnostics.coverageRatio,
    largestGapDays: diagnostics.largestGapDays,
    warnings: diagnostics.warnings,
    warningsCount: diagnostics.warnings.length,
    tradesPerYear,
    lowCoverage: diagnostics.coverageRatio < LOW_COVERAGE_THRESHOLD,
  };
}

function createRunAbortedError(): Error {
  const error = new Error("Run was cancelled.");
  (error as Error & { code?: string }).code = "RUN_ABORTED";
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createRunAbortedError();
  }
}

export function normalizeCreateRunRequest(payload: unknown): StrategyLabNormalizedRunInput {
  if (!isRecord(payload)) {
    throw createValidationError("Invalid JSON body.");
  }

  const symbolRaw = payload.symbol;
  if (typeof symbolRaw !== "string" || !symbolRaw.trim()) {
    throw createValidationError("symbol is required.");
  }
  const symbol = symbolRaw.trim().toUpperCase();
  if (!VALID_SYMBOL_REGEX.test(symbol)) {
    throw createValidationError("Invalid symbol format. Must be 1-10 uppercase letters or digits.");
  }

  const strategyTypeRaw = payload.strategyType;
  if (typeof strategyTypeRaw !== "string" || !strategyTypeRaw.trim()) {
    throw createValidationError("strategyType is required.");
  }
  if (!isStrategyType(strategyTypeRaw)) {
    throw createValidationError(`Invalid strategyType. Valid options: ${STRATEGY_TYPES.join(", ")}`);
  }

  const parsedCapital = parseCapital(payload.capital ?? DEFAULT_CAPITAL);
  if (parsedCapital === null) {
    throw createValidationError(`capital must be between ${MIN_CAPITAL} and ${MAX_CAPITAL.toExponential()}.`);
  }

  const exchange = typeof payload.exchange === "string" && payload.exchange.trim() ? payload.exchange.trim().toUpperCase() : "HOSE";
  if (exchange !== "HOSE") {
    throw createValidationError('Unsupported exchange. Only "HOSE" is supported.');
  }

  const dateRangeValue = payload.dateRange;
  if (dateRangeValue !== undefined && !isRecord(dateRangeValue)) {
    throw createValidationError("dateRange must be an object with optional from/to.");
  }
  const from = typeof dateRangeValue?.from === "string" ? dateRangeValue.from.trim() : undefined;
  const to = typeof dateRangeValue?.to === "string" ? dateRangeValue.to.trim() : undefined;
  const fromDate = parseDateInput(from);
  const toDate = parseDateInput(to);
  if (from && !fromDate) {
    throw createValidationError('dateRange.from must use "YYYY-MM-DD".');
  }
  if (to && !toDate) {
    throw createValidationError('dateRange.to must use "YYYY-MM-DD".');
  }
  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    throw createValidationError("dateRange.from must be less than or equal to dateRange.to.");
  }

  const priorityRaw = typeof payload.priority === "string" ? payload.priority.trim().toLowerCase() : "normal";
  if (priorityRaw !== "low" && priorityRaw !== "normal" && priorityRaw !== "high") {
    throw createValidationError('priority must be "low", "normal", or "high".');
  }

  const rawParams = isRecord(payload.params) ? payload.params : {};
  const strategyIssues = validateStrategyParams(strategyTypeRaw, rawParams);
  if (strategyIssues.length > 0) {
    throw createValidationError("Invalid strategy parameters.", strategyIssues);
  }

  const rawConfig = isRecord(payload.config) ? payload.config : {};
  const configInput = {
    executionModel: typeof rawConfig.executionModel === "string" ? rawConfig.executionModel : undefined,
    feeBps: rawConfig.feeBps as number | string | undefined,
    sellTaxBps: rawConfig.sellTaxBps as number | string | undefined,
    slippageBps: rawConfig.slippageBps as number | string | undefined,
    lotSize: rawConfig.lotSize as number | string | undefined,
  };
  const configIssues = validateBacktestConfigInput(configInput);
  if (configIssues.length > 0) {
    throw createValidationError("Invalid backtest config.", configIssues);
  }

  const resolvedName =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : STRATEGIES.find((strategy) => strategy.type === strategyTypeRaw)?.name ?? strategyTypeRaw;

  return {
    name: resolvedName,
    exchange: "HOSE",
    symbol,
    strategyType: strategyTypeRaw,
    dateRange: from || to ? { from, to } : undefined,
    capital: parsedCapital,
    params: extractNumericParams(rawParams),
    config: configInput,
    priority: priorityRaw,
  };
}

export async function executeRunInput(
  runId: string,
  input: StrategyLabNormalizedRunInput,
  options?: ExecuteRunInputOptions
): Promise<StrategyLabRunResultRecord> {
  throwIfAborted(options?.signal);
  const [dataSnapshotId, ohlcvQualityReport] = await Promise.all([
    getDataSourceFingerprint(),
    Promise.resolve(getDataQualityReport("ohlcv")),
  ]);
  throwIfAborted(options?.signal);
  const series = await loadOHLCVForSymbol(input.symbol);
  throwIfAborted(options?.signal);
  if (series.length === 0) {
    const error = new Error(`No OHLCV data found for symbol ${input.symbol}.`);
    (error as Error & { code?: string }).code = "RUN_DATA_NOT_FOUND";
    throw error;
  }

  const filteredSeries = applyDateRange(series, input.dateRange);
  throwIfAborted(options?.signal);
  if (filteredSeries.length < MIN_DATA_POINTS) {
    const error = new Error(`Insufficient data for backtest (minimum ${MIN_DATA_POINTS} rows required).`);
    (error as Error & { code?: string }).code = "INSUFFICIENT_DATA";
    throw error;
  }

  const strategyName = STRATEGIES.find((strategy) => strategy.type === input.strategyType)?.name ?? input.strategyType;
  const strategyConfig: StrategyConfig = {
    name: strategyName,
    type: input.strategyType,
    params: input.params,
  };

  throwIfAborted(options?.signal);
  const result = runBacktest(filteredSeries, strategyConfig, input.capital, input.config);
  throwIfAborted(options?.signal);
  if (result.diagnostics.usableRows < MIN_DATA_POINTS) {
    const error = new Error(`Insufficient usable rows after cleaning (minimum ${MIN_DATA_POINTS} rows required).`);
    (error as Error & { code?: string }).code = "INSUFFICIENT_USABLE_DATA";
    throw error;
  }

  const antiBiasSignals = buildAntiBiasSignals(result);
  const qualityWarnings: string[] = [];
  if (ohlcvQualityReport && ohlcvQualityReport.acceptedRatio < LOW_COVERAGE_THRESHOLD) {
    qualityWarnings.push(
      `OHLCV accepted ratio ${ohlcvQualityReport.acceptedRatio.toFixed(3)} is below ${LOW_COVERAGE_THRESHOLD.toFixed(2)}.`
    );
  }
  if (qualityWarnings.length > 0) {
    antiBiasSignals.warnings = [...antiBiasSignals.warnings, ...qualityWarnings];
    antiBiasSignals.warningsCount = antiBiasSignals.warnings.length;
  }

  return {
    runId,
    symbol: input.symbol,
    strategyType: input.strategyType,
    strategyName,
    initialCapital: input.capital,
    generatedAt: new Date().toISOString(),
    result,
    reproMetadata: {
      engineVersion: STRATEGY_LAB_ENGINE_VERSION,
      dataSnapshotId,
      inputHash: buildInputHash(input),
    },
    antiBiasSignals,
  };
}

export function getExecutionErrorMeta(error: unknown): { code: string; message: string; details?: unknown } {
  if (error instanceof Error) {
    const typedError = error as Error & { code?: string; details?: unknown };
    return {
      code: typedError.code ?? "RUN_FAILED",
      message: error.message || "Run failed.",
      details: typedError.details,
    };
  }
  return {
    code: "RUN_FAILED",
    message: "Run failed.",
  };
}

export function isValidationError(error: unknown): boolean {
  return error instanceof Error && (error as Error & { code?: string }).code === "INVALID_INPUT";
}

export function toValidationError(error: unknown): { message: string; details?: unknown } {
  if (error instanceof Error) {
    const typed = error as Error & { details?: unknown };
    return {
      message: error.message,
      details: typed.details,
    };
  }
  return { message: "Invalid input." };
}
