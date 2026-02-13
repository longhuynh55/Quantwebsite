import { NextResponse } from "next/server";
import {
  getDataQualityReport,
  hasSufficientDataQuality,
  loadIndexData,
  loadOHLCVData,
  loadStockMetadata,
  OHLCV,
} from "@/lib/data";
import {
  optimizePortfolio,
  PortfolioOptimizationError,
  ExcludedSymbol,
} from "@/lib/quant/portfolio";
import {
  DEFAULT_BENCHMARK_SYMBOL,
  MAX_RECENCY_GAP_TRADING_DAYS,
  MIN_HISTORY_DAYS_OPTIMIZE,
  MIN_OVERLAP_DAYS_OPTIMIZE,
  toDateKey,
} from "@/lib/dataPolicy";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";

// Valid symbol format: 1-10 uppercase letters
const VALID_SYMBOL_REGEX = /^[A-Z]{1,10}$/;
const MIN_SYMBOLS = 2;
const MAX_SYMBOLS = 50;

const ALLOWED_METHODS = ["mean_variance", "risk_parity", "equal_weight"];
const DEFAULT_METHOD = "mean_variance";
const RATE_LIMIT_MAX = 30; // 30 requests per minute (computationally expensive)
const MIN_DATA_QUALITY_RATIO = 0.95;
const PREFERRED_BENCHMARKS = [DEFAULT_BENCHMARK_SYMBOL, "VN100", "VN30"];

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

function mergeExcludedSymbols(base: ExcludedSymbol[], extra: ExcludedSymbol[]): ExcludedSymbol[] {
  const merged = [...base];
  const seen = new Set(base.map((item) => `${item.symbol}:${item.reason}`));
  for (const item of extra) {
    const key = `${item.symbol}:${item.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

export async function POST(request: Request) {
  // Rate limiting check
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/optimize", clientId), RATE_LIMIT_MAX, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
    );
  }

  // Validate Content-Type
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
  }

  // Parse JSON body with error handling
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  try {
    const { symbols, method } = body;

    // Validate symbols is an array
    if (!Array.isArray(symbols)) {
      return NextResponse.json({ error: "Symbols must be an array" }, { status: 400 });
    }

    // Validate array length
    if (symbols.length < MIN_SYMBOLS) {
      return NextResponse.json({ error: `At least ${MIN_SYMBOLS} symbols are required` }, { status: 400 });
    }
    if (symbols.length > MAX_SYMBOLS) {
      return NextResponse.json({ error: `Maximum ${MAX_SYMBOLS} symbols allowed` }, { status: 400 });
    }

    // Validate and normalize each symbol
    const normalizedSymbols: string[] = [];
    for (const sym of symbols) {
      if (typeof sym !== 'string') {
        return NextResponse.json({ error: `Invalid symbol type: ${typeof sym}` }, { status: 400 });
      }
      const normalized = sym.trim().toUpperCase();
      if (!VALID_SYMBOL_REGEX.test(normalized)) {
        return NextResponse.json({ error: `Invalid symbol format: ${sym}` }, { status: 400 });
      }
      normalizedSymbols.push(normalized);
    }

    // Check for duplicates
    const uniqueSymbols = new Set(normalizedSymbols);
    if (uniqueSymbols.size !== normalizedSymbols.length) {
      return NextResponse.json({ error: "Duplicate symbols are not allowed" }, { status: 400 });
    }

    // Validate method
    const optimizationMethod = method || DEFAULT_METHOD;
    if (typeof optimizationMethod !== 'string' || !ALLOWED_METHODS.includes(optimizationMethod)) {
      return NextResponse.json(
        { error: `Invalid optimization method. Valid options: ${ALLOWED_METHODS.join(", ")}` },
        { status: 400 }
      );
    }

    const [allData, metadata, indexData] = await Promise.all([
      loadOHLCVData(),
      loadStockMetadata(),
      loadIndexData(),
    ]);

    const stockMetadataQualityError = getDataQualityError("stockMetadata");
    if (stockMetadataQualityError) {
      return NextResponse.json({ error: stockMetadataQualityError }, { status: 503 });
    }

    const ohlcvQualityError = getDataQualityError("ohlcv");
    if (ohlcvQualityError) {
      return NextResponse.json({ error: ohlcvQualityError }, { status: 503 });
    }

    const indexQualityError = getDataQualityError("index");
    if (indexQualityError) {
      return NextResponse.json({ error: indexQualityError }, { status: 503 });
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
    const metadataBySymbol = new Map(metadata.map((item) => [item.symbol.toUpperCase(), item]));

    const preExcludedSymbols: ExcludedSymbol[] = [];
    const prefilteredSymbols: string[] = [];

    for (const symbol of normalizedSymbols) {
      const series = allData.get(symbol);
      if (!series || series.length < 2) {
        preExcludedSymbols.push({ symbol, reason: "insufficient_price_points" });
        continue;
      }

      const stockMetadata = metadataBySymbol.get(symbol);
      if (!stockMetadata) {
        preExcludedSymbols.push({ symbol, reason: "metadata_missing" });
        continue;
      }

      if (stockMetadata.status.toUpperCase() !== "ACTIVE") {
        preExcludedSymbols.push({ symbol, reason: `inactive_status_${stockMetadata.status.toUpperCase()}` });
        continue;
      }

      // Align semantics with the optimizer: MIN_HISTORY_DAYS_OPTIMIZE is expressed in return observations.
      // A price series of length N has at most N-1 daily return observations.
      const returnObservations = Math.max(0, series.length - 1);
      if (returnObservations < MIN_HISTORY_DAYS_OPTIMIZE) {
        preExcludedSymbols.push({
          symbol,
          reason: `insufficient_history_${returnObservations}_lt_${MIN_HISTORY_DAYS_OPTIMIZE}`,
        });
        continue;
      }

      const lastDateKey = toDateKey(series[series.length - 1].date);
      const lastBenchmarkIndex = benchmarkDateIndex.get(lastDateKey);
      if (lastBenchmarkIndex === undefined) {
        preExcludedSymbols.push({ symbol, reason: "not_in_benchmark_calendar" });
        continue;
      }

      const recencyGap = asOfIndex - lastBenchmarkIndex;
      if (recencyGap > MAX_RECENCY_GAP_TRADING_DAYS) {
        preExcludedSymbols.push({ symbol, reason: `stale_${recencyGap}_trading_days` });
        continue;
      }

      prefilteredSymbols.push(symbol);
    }

    if (prefilteredSymbols.length < MIN_SYMBOLS) {
      return NextResponse.json(
        {
          error: "Not enough eligible symbols after timeline and quality filtering",
          excludedSymbols: preExcludedSymbols,
          effectiveUniverse: prefilteredSymbols,
          minRequired: MIN_SYMBOLS,
        },
        { status: 400 }
      );
    }

    // Convert Map to plain object for the optimizePortfolio function
    const dataRecord: Record<string, OHLCV[]> = {};
    for (const symbol of prefilteredSymbols) {
      const series = allData.get(symbol);
      if (series) dataRecord[symbol] = series;
    }

    try {
      const result = optimizePortfolio(
        dataRecord,
        prefilteredSymbols,
        optimizationMethod,
        {
          minHistoryDays: MIN_HISTORY_DAYS_OPTIMIZE,
          minOverlapDays: MIN_OVERLAP_DAYS_OPTIMIZE,
        }
      );

      const combinedExcluded = mergeExcludedSymbols(preExcludedSymbols, result.excludedSymbols);
      return NextResponse.json({
        ...result,
        excludedSymbols: combinedExcluded,
        benchmark: benchmarkSymbol,
        asOfDate: benchmarkSeries[asOfIndex].date,
      });
    } catch (error) {
      if (error instanceof PortfolioOptimizationError) {
        const combinedExcluded = mergeExcludedSymbols(preExcludedSymbols, error.excludedSymbols);
        return NextResponse.json(
          {
            error: error.message,
            excludedSymbols: combinedExcluded,
            effectiveUniverse: error.effectiveUniverse,
            minOverlapDays: MIN_OVERLAP_DAYS_OPTIMIZE,
          },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Optimize API Error:", error);
    return NextResponse.json({ error: "Failed to optimize portfolio" }, { status: 500 });
  }
}
