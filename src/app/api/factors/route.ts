import { NextResponse } from "next/server";
import {
  getDataQualityReport,
  hasSufficientDataQuality,
  loadIndexData,
  loadOHLCVData,
  loadStockMetadata,
} from "@/lib/data";
import { DEFAULT_BENCHMARK_SYMBOL, MAX_RECENCY_GAP_TRADING_DAYS, toDateKey } from "@/lib/dataPolicy";
import { calculateFactorExposures, rankByFactor, FactorExposure } from "@/lib/quant/factors";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";
import { createLogger, createTraceId, toErrorMeta } from "@/lib/logger";
import { isLowMemoryModeEnabled } from "@/lib/runtimeMode";
import { ensureDataBackendReady } from "@/lib/dataBackend";
import { queryDuckDbRows } from "@/lib/duckdbClient";

const VALID_FACTORS = ["momentum", "value", "volatility", "size"] as const;
type ValidFactor = typeof VALID_FACTORS[number];

const DEFAULT_FACTOR: ValidFactor = "momentum";
const MIN_LIMIT = 1;
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;
const RATE_LIMIT_MAX = 30; // 30 requests per minute (computationally expensive)
const MIN_FACTOR_DATA_POINTS = 253; // Needed for 12-1 momentum (t-252 vs t-21)
const MIN_DATA_QUALITY_RATIO = 0.95;
const PREFERRED_BENCHMARKS = [DEFAULT_BENCHMARK_SYMBOL, "VN100", "VN30"];
const factorsApiLogger = createLogger("api.factors");

function getDataQualityError(dataset: "stockMetadata" | "ohlcv" | "index"): string | null {
  if (hasSufficientDataQuality(dataset, MIN_DATA_QUALITY_RATIO)) {
    return null;
  }

  const report = getDataQualityReport(dataset);
  if (!report) {
    return `Data quality check failed for ${dataset}: report unavailable`;
  }

  return (
    `Data quality check failed for ${dataset}: accepted ${report.acceptedRows}/${report.totalRows} ` +
    `(${(report.acceptedRatio * 100).toFixed(2)}%), required >= ${(MIN_DATA_QUALITY_RATIO * 100).toFixed(0)}%`
  );
}

function normalizeDuckDbNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeDuckDbDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value ?? "").trim();
  if (!text) return null;
  const candidate = text.length >= 10 ? text.slice(0, 10) : text;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function loadMomentumExposuresFromDuckDb(input: {
  duckdbPath: string;
  symbols: string[];
}): Promise<{ exposures: FactorExposure[]; asOfDate: Date | null }> {
  const normalizedSymbols = Array.from(
    new Set(input.symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))
  );
  const allowedSymbols = normalizedSymbols.length > 0 ? new Set(normalizedSymbols) : null;

  // Avoid large IN (...) prepared statements which can fail in some DuckDB node binding environments.
  const sql = `
    WITH base AS (
      SELECT
        symbol,
        try_cast(date AS DATE) AS date,
        try_cast(close AS DOUBLE) AS close,
        lag(try_cast(close AS DOUBLE), 21) OVER (PARTITION BY symbol ORDER BY try_cast(date AS DATE)) AS close_21,
        lag(try_cast(close AS DOUBLE), 252) OVER (PARTITION BY symbol ORDER BY try_cast(date AS DATE)) AS close_252,
        row_number() OVER (PARTITION BY symbol ORDER BY try_cast(date AS DATE) DESC) AS rdesc
      FROM ohlcv
    )
    SELECT
      symbol,
      date,
      CASE
        WHEN close_252 IS NULL OR close_252 = 0 OR close_21 IS NULL THEN NULL
        ELSE (close_21 - close_252) / close_252
      END AS momentum
    FROM base
    WHERE rdesc = 1
  `;
  const rows = await queryDuckDbRows(input.duckdbPath, sql, []);

  const exposures: FactorExposure[] = [];
  let asOfDate: Date | null = null;

  for (const raw of rows) {
    const symbol = String(raw?.symbol ?? "").trim().toUpperCase();
    const momentum = normalizeDuckDbNumber(raw?.momentum);
    const date = normalizeDuckDbDate(raw?.date);
    if (!symbol) continue;
    if (allowedSymbols && !allowedSymbols.has(symbol)) continue;
    if (momentum === null) continue;
    if (date && (!asOfDate || date.getTime() > asOfDate.getTime())) {
      asOfDate = date;
    }
    exposures.push({ symbol, momentum, value: 0, volatility: 0, size: 0, overall: momentum / 4 });
  }

  return { exposures, asOfDate };
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const traceId = request.headers.get("x-trace-id")?.trim() || createTraceId("factors");
  const logger = factorsApiLogger.child({ traceId });
  // Rate limiting check
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/factors", clientId), RATE_LIMIT_MAX, 60000);
  if (!rateLimit.allowed) {
    logger.warn("rate_limit.blocked", {
      remaining: rateLimit.remaining,
      resetInMs: Math.max(0, rateLimit.resetTime - Date.now()),
    });
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const factor = searchParams.get("factor")?.trim().toLowerCase() || DEFAULT_FACTOR;
  const limitStr = searchParams.get("limit") || String(DEFAULT_LIMIT);

  // Validate factor
  if (!VALID_FACTORS.includes(factor as ValidFactor)) {
    return NextResponse.json(
      { error: `Invalid factor. Valid options: ${VALID_FACTORS.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate limit
  const limit = parseInt(limitStr);
  if (isNaN(limit) || limit < MIN_LIMIT || limit > MAX_LIMIT) {
    return NextResponse.json(
      { error: `Limit must be between ${MIN_LIMIT} and ${MAX_LIMIT}` },
      { status: 400 }
    );
  }

  try {
    const backend = await ensureDataBackendReady("api/factors");
    const lowMemoryMode = isLowMemoryModeEnabled();
    if (lowMemoryMode && backend.active === "csv") {
      return NextResponse.json(
        { error: "Factor ranking is disabled in low-memory mode." },
        { status: 503 }
      );
    }

    if (backend.active === "duckdb" && factor === "momentum") {
      const metadata = await loadStockMetadata();
      const activeSymbols = metadata
        .filter((stock) => stock.status.toUpperCase() === "ACTIVE")
        .map((stock) => stock.symbol);

      const result = await loadMomentumExposuresFromDuckDb({
        duckdbPath: backend.duckdbPath,
        symbols: activeSymbols,
      });

      if (result.exposures.length === 0) {
        return NextResponse.json(
          { error: "No valid factor exposures could be calculated. Try increasing the limit or check data availability." },
          { status: 404 }
        );
      }

      const sorted = rankByFactor(result.exposures, "momentum");
      const sideLimit = Math.min(limit, Math.floor(sorted.length / 2));
      const topStocks = sideLimit > 0 ? sorted.slice(0, sideLimit) : sorted.slice(0, Math.min(limit, sorted.length));
      const bottomStocks = sideLimit > 0 ? sorted.slice(-sideLimit).reverse() : [];

      return NextResponse.json({
        factor,
        topStocks,
        bottomStocks,
        total: result.exposures.length,
        benchmark: "duckdb",
        asOfDate: result.asOfDate ?? new Date(),
        excludedInactiveCount: metadata.length - activeSymbols.length,
        excludedInsufficientDataCount: 0,
        excludedNotInBenchmarkCalendarCount: 0,
        excludedStaleCount: 0,
      });
    }

    const [metadata, ohlcvData, indexData] = await Promise.all([
      loadStockMetadata(),
      loadOHLCVData(),
      loadIndexData(),
    ]);

    const metadataQualityError = getDataQualityError("stockMetadata");
    if (metadataQualityError) {
      return NextResponse.json({ error: metadataQualityError }, { status: 503 });
    }

    const ohlcvQualityError = getDataQualityError("ohlcv");
    if (ohlcvQualityError) {
      return NextResponse.json({ error: ohlcvQualityError }, { status: 503 });
    }

    const indexQualityError = getDataQualityError("index");
    if (indexQualityError) {
      return NextResponse.json({ error: indexQualityError }, { status: 503 });
    }

    if (metadata.length === 0) {
      return NextResponse.json({ error: "No stock metadata available" }, { status: 500 });
    }

    const benchmarkSymbol =
      PREFERRED_BENCHMARKS.find((symbol) => indexData.some((item) => item.symbol === symbol)) ??
      indexData[0]?.symbol;
    if (!benchmarkSymbol) {
      return NextResponse.json({ error: "No benchmark data available for recency checks" }, { status: 503 });
    }

    const benchmarkSeries = indexData
      .filter((item) => item.symbol === benchmarkSymbol)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (benchmarkSeries.length === 0) {
      return NextResponse.json({ error: "Benchmark series is empty" }, { status: 503 });
    }

    const benchmarkDateIndex = new Map<string, number>();
    for (let i = 0; i < benchmarkSeries.length; i++) {
      benchmarkDateIndex.set(toDateKey(benchmarkSeries[i].date), i);
    }
    const asOfIndex = benchmarkSeries.length - 1;

    const exposures: FactorExposure[] = [];
    const sortedUniverse = [...metadata].sort((a, b) => a.symbol.localeCompare(b.symbol));

    let excludedInactiveCount = 0;
    let excludedInsufficientDataCount = 0;
    let excludedNotInBenchmarkCalendarCount = 0;
    let excludedStaleCount = 0;

    for (const stock of sortedUniverse) {
      if (stock.status.toUpperCase() !== "ACTIVE") {
        excludedInactiveCount += 1;
        continue;
      }

      const data = ohlcvData.get(stock.symbol);
      if (!data || data.length < MIN_FACTOR_DATA_POINTS) {
        excludedInsufficientDataCount += 1;
        continue;
      }

      const lastDateKey = toDateKey(data[data.length - 1].date);
      const lastBenchmarkIndex = benchmarkDateIndex.get(lastDateKey);
      if (lastBenchmarkIndex === undefined) {
        excludedNotInBenchmarkCalendarCount += 1;
        continue;
      }

      const recencyGap = asOfIndex - lastBenchmarkIndex;
      if (recencyGap > MAX_RECENCY_GAP_TRADING_DAYS) {
        excludedStaleCount += 1;
        continue;
      }

      exposures.push(calculateFactorExposures(stock.symbol, data));
    }

    if (exposures.length === 0) {
      return NextResponse.json(
        { error: "No valid factor exposures could be calculated. Try increasing the limit or check data availability." },
        { status: 404 }
      );
    }

    const sorted = rankByFactor(exposures, factor as keyof Omit<FactorExposure, "symbol" | "overall">);
    const sideLimit = Math.min(limit, Math.floor(sorted.length / 2));
    const topStocks = sideLimit > 0 ? sorted.slice(0, sideLimit) : sorted.slice(0, Math.min(limit, sorted.length));
    const bottomStocks = sideLimit > 0 ? sorted.slice(-sideLimit).reverse() : [];

    return NextResponse.json({
      factor,
      topStocks,
      bottomStocks,
      total: exposures.length,
      benchmark: benchmarkSymbol,
      asOfDate: benchmarkSeries[asOfIndex].date,
      excludedInactiveCount,
      excludedInsufficientDataCount,
      excludedNotInBenchmarkCalendarCount,
      excludedStaleCount,
    });
  } catch (error) {
    logger.error("request.failed", {
      ...toErrorMeta(error),
      durationMs: Date.now() - startedAt,
      factor,
      limit,
    });
    return NextResponse.json({ error: "Failed to calculate factors" }, { status: 500 });
  }
}
