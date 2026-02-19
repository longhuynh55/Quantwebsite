import { NextResponse } from "next/server";
import { getDataQualityReport, getDatasetLoadStatus, loadOHLCVForSymbol } from "@/lib/data";
import { getDataBackendStatus } from "@/lib/dataBackend";
import { queryDuckDbRows } from "@/lib/duckdbClient";
import {
  BacktestConfigInput,
  STRATEGIES,
  STRATEGY_TYPES,
  StrategyConfig,
  StrategyType,
  extractNumericParams,
  runBacktest,
  validateBacktestConfigInput,
  validateStrategyParams,
} from "@/lib/quant/backtest";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";
import { createLogger, createTraceId, toErrorMeta, type AppLogger } from "@/lib/logger";

const VALID_SYMBOL_REGEX = /^[A-Z0-9]{1,10}$/;
const MIN_CAPITAL = 1;
const MAX_CAPITAL = 1e12;
const DEFAULT_CAPITAL = 100000;
const RATE_LIMIT_MAX = 30;
const MIN_DATA_QUALITY_RATIO = 0.95;
const MIN_DATA_POINTS = 30;
const backtestingApiLogger = createLogger("api.backtesting");
const STRATEGY_PARAM_KEYS = [
  "shortPeriod",
  "longPeriod",
  "period",
  "oversold",
  "overbought",
  "stdDev",
  "lookback",
  "threshold",
] as const;

function isStrategyType(value: string): value is StrategyType {
  return (STRATEGY_TYPES as readonly string[]).includes(value);
}

function parseNumberish(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDataQualityError(dataset: "ohlcv"): string | null {
  const loadStatus = getDatasetLoadStatus(dataset);
  if (loadStatus.status === "error") {
    const reason = loadStatus.reason ?? "unavailable";
    return loadStatus.message ?? `OHLCV dataset is unavailable (${reason}).`;
  }

  const report = getDataQualityReport(dataset);
  if (!report) {
    // Symbol-level queries (not full dataset loads) may not populate a dataset-wide quality report.
    return null;
  }

  if (report.acceptedRatio >= MIN_DATA_QUALITY_RATIO) {
    return null;
  }

  return (
    `Data quality check failed for ${dataset}: accepted ${report.acceptedRows}/${report.totalRows} ` +
    `(${(report.acceptedRatio * 100).toFixed(2)}%), required >= ${(MIN_DATA_QUALITY_RATIO * 100).toFixed(0)}%`
  );
}

function parseCapital(rawCapital: unknown): number | null {
  const capital = parseNumberish(rawCapital);
  if (capital === null || capital < MIN_CAPITAL || capital > MAX_CAPITAL) {
    return null;
  }
  return capital;
}

function parseConfigInput(raw: Record<string, unknown>): BacktestConfigInput {
  return {
    executionModel: typeof raw.executionModel === "string" ? raw.executionModel : undefined,
    feeBps: raw.feeBps as number | string | undefined,
    sellTaxBps: raw.sellTaxBps as number | string | undefined,
    slippageBps: raw.slippageBps as number | string | undefined,
    lotSize: raw.lotSize as number | string | undefined,
  };
}

function parseStrategyParamsFromRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const key of STRATEGY_PARAM_KEYS) {
    if (raw[key] !== undefined) {
      params[key] = raw[key];
    }
  }
  return params;
}

function parseStrategyParamsFromQuery(searchParams: URLSearchParams): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const key of STRATEGY_PARAM_KEYS) {
    const raw = searchParams.get(key);
    if (raw === null) continue;
    const numeric = parseNumberish(raw);
    params[key] = numeric ?? raw;
  }
  return params;
}

function formatValidationError(prefix: string, issues: { field: string; message: string }[]): string {
  const first = issues[0];
  return `${prefix}: ${first.field} - ${first.message}`;
}

async function getOhlcvOutageErrorForEmptyResult(): Promise<string | null> {
  const ohlcvLoadStatus = getDatasetLoadStatus("ohlcv");
  if (ohlcvLoadStatus.status === "error") {
    const reason = ohlcvLoadStatus.reason ?? "unavailable";
    return ohlcvLoadStatus.message ?? `OHLCV dataset is unavailable (${reason}).`;
  }
  if (ohlcvLoadStatus.status === "ok") {
    return null;
  }

  try {
    const backendStatus = await getDataBackendStatus();
    if (backendStatus.active !== "duckdb") {
      return null;
    }
    const rows = await queryDuckDbRows(backendStatus.duckdbPath, "SELECT 1 AS ok FROM ohlcv LIMIT 1");
    if (rows.length === 0) {
      return "OHLCV dataset is unavailable (duckdb table ohlcv is empty).";
    }
    return null;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return `OHLCV dataset is unavailable (${reason}).`;
  }
}

async function executeBacktest(payload: {
  symbol: string;
  strategyType: StrategyType;
  initialCapital: number;
  rawParams: Record<string, unknown>;
  rawConfig: BacktestConfigInput;
}) {
  let data: Awaited<ReturnType<typeof loadOHLCVForSymbol>>;
  try {
    data = await loadOHLCVForSymbol(payload.symbol);
  } catch {
    return NextResponse.json({ error: "OHLCV dataset is unavailable." }, { status: 503 });
  }

  const qualityError = getDataQualityError("ohlcv");
  if (qualityError) {
    return NextResponse.json({ error: qualityError }, { status: 503 });
  }

  if (data.length === 0) {
    const outageError = await getOhlcvOutageErrorForEmptyResult();
    if (outageError) {
      return NextResponse.json({ error: outageError }, { status: 503 });
    }
    return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
  }

  if (data.length < MIN_DATA_POINTS) {
    return NextResponse.json(
      { error: `Insufficient data for backtesting (minimum ${MIN_DATA_POINTS} data points required)` },
      { status: 400 }
    );
  }

  const paramIssues = validateStrategyParams(payload.strategyType, payload.rawParams);
  if (paramIssues.length > 0) {
    return NextResponse.json(
      { error: formatValidationError("Invalid strategy parameters", paramIssues), details: paramIssues },
      { status: 400 }
    );
  }

  const configIssues = validateBacktestConfigInput(payload.rawConfig);
  if (configIssues.length > 0) {
    return NextResponse.json(
      { error: formatValidationError("Invalid backtest configuration", configIssues), details: configIssues },
      { status: 400 }
    );
  }

  const strategyTemplate = STRATEGIES.find((s) => s.type === payload.strategyType);
  const strategyConfig: StrategyConfig = {
    name: strategyTemplate?.name ?? payload.strategyType,
    type: payload.strategyType,
    params: extractNumericParams(payload.rawParams),
  };

  const result = runBacktest(data, strategyConfig, payload.initialCapital, payload.rawConfig);
  if (result.diagnostics.usableRows < MIN_DATA_POINTS) {
    return NextResponse.json(
      { error: `Insufficient usable data for backtesting after cleaning (minimum ${MIN_DATA_POINTS} rows required)` },
      { status: 400 }
    );
  }

  return NextResponse.json({
    symbol: payload.symbol,
    strategy: strategyConfig.name,
    initialCapital: payload.initialCapital,
    ...result,
  });
}

function getRateLimitedResponse(request: Request, logger?: AppLogger): NextResponse | null {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/backtesting", clientId), RATE_LIMIT_MAX, 60000);
  if (rateLimit.allowed) return null;
  logger?.warn("rate_limit.blocked", {
    remaining: rateLimit.remaining,
    resetInMs: Math.max(0, rateLimit.resetTime - Date.now()),
  });

  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetTime - Date.now()) / 1000))) } }
  );
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const traceId = request.headers.get("x-trace-id")?.trim() || createTraceId("backtest");
  const logger = backtestingApiLogger.child({ traceId, method: "GET" });
  const limited = getRateLimitedResponse(request, logger);
  if (limited) return limited;

  let symbolForLog: string | null = null;
  let strategyForLog: string | null = null;
  try {
    const { searchParams } = new URL(request.url);

    const symbol = searchParams.get("symbol")?.trim().toUpperCase();
    symbolForLog = symbol ?? null;
    if (!symbol) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }
    if (!VALID_SYMBOL_REGEX.test(symbol)) {
      return NextResponse.json({ error: "Invalid symbol format. Must be 1-10 uppercase letters or digits." }, { status: 400 });
    }

    const strategyRaw = searchParams.get("strategy");
    strategyForLog = strategyRaw ?? null;
    if (!strategyRaw) {
      return NextResponse.json({ error: "Strategy is required" }, { status: 400 });
    }
    if (!isStrategyType(strategyRaw)) {
      return NextResponse.json(
        { error: `Invalid strategy. Valid options: ${STRATEGY_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const initialCapital = parseCapital(searchParams.get("capital") ?? DEFAULT_CAPITAL);
    if (initialCapital === null) {
      return NextResponse.json(
        { error: `Capital must be between ${MIN_CAPITAL} and ${MAX_CAPITAL.toExponential()}` },
        { status: 400 }
      );
    }

    const rawParams = parseStrategyParamsFromQuery(searchParams);
    const rawConfig: BacktestConfigInput = {
      executionModel: searchParams.get("executionModel") ?? undefined,
      feeBps: searchParams.get("feeBps") ?? undefined,
      sellTaxBps: searchParams.get("sellTaxBps") ?? undefined,
      slippageBps: searchParams.get("slippageBps") ?? undefined,
      lotSize: searchParams.get("lotSize") ?? undefined,
    };

    return await executeBacktest({
      symbol,
      strategyType: strategyRaw,
      initialCapital,
      rawParams,
      rawConfig,
    });
  } catch (error) {
    logger.error("request.failed", {
      ...toErrorMeta(error),
      durationMs: Date.now() - startedAt,
      symbol: symbolForLog,
      strategy: strategyForLog,
    });
    return NextResponse.json({ error: "Failed to run backtest" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const traceId = request.headers.get("x-trace-id")?.trim() || createTraceId("backtest");
  const logger = backtestingApiLogger.child({ traceId, method: "POST" });
  const limited = getRateLimitedResponse(request, logger);
  if (limited) return limited;

  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let symbolForLog: string | null = null;
  let strategyForLog: string | null = null;
  try {
    const symbolRaw = body.symbol;
    if (typeof symbolRaw !== "string" || symbolRaw.trim() === "") {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }
    const symbol = symbolRaw.trim().toUpperCase();
    symbolForLog = symbol;
    if (!VALID_SYMBOL_REGEX.test(symbol)) {
      return NextResponse.json({ error: "Invalid symbol format. Must be 1-10 uppercase letters or digits." }, { status: 400 });
    }

    const strategyRaw = body.strategy;
    strategyForLog = typeof strategyRaw === "string" ? strategyRaw : null;
    if (typeof strategyRaw !== "string" || strategyRaw.trim() === "") {
      return NextResponse.json({ error: "Strategy is required" }, { status: 400 });
    }
    if (!isStrategyType(strategyRaw)) {
      return NextResponse.json(
        { error: `Invalid strategy. Valid options: ${STRATEGY_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const initialCapital = parseCapital(body.capital ?? DEFAULT_CAPITAL);
    if (initialCapital === null) {
      return NextResponse.json(
        { error: `Capital must be between ${MIN_CAPITAL} and ${MAX_CAPITAL.toExponential()}` },
        { status: 400 }
      );
    }

    const rawParams = isRecord(body.params) ? body.params : parseStrategyParamsFromRecord(body);
    const rawConfig = parseConfigInput(body);

    return await executeBacktest({
      symbol,
      strategyType: strategyRaw,
      initialCapital,
      rawParams,
      rawConfig,
    });
  } catch (error) {
    logger.error("request.failed", {
      ...toErrorMeta(error),
      durationMs: Date.now() - startedAt,
      symbol: symbolForLog,
      strategy: strategyForLog,
    });
    return NextResponse.json({ error: "Failed to run backtest" }, { status: 500 });
  }
}
