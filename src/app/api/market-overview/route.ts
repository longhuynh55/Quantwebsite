import { NextResponse } from "next/server";
import {
  getDataQualityReport,
  hasSufficientDataQuality,
  loadStockMetadata,
  loadOHLCVData,
  loadIndexData,
  OHLCV
} from "@/lib/data";
import { DEFAULT_BENCHMARK_SYMBOL, MAX_RECENCY_GAP_TRADING_DAYS, toDateKey } from "@/lib/dataPolicy";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";
import { createLogger, createTraceId, toErrorMeta } from "@/lib/logger";
import { isLowMemoryModeEnabled } from "@/lib/runtimeMode";

const RATE_LIMIT_MAX = 100;
const MIN_DATA_QUALITY_RATIO = 0.95;
const marketOverviewApiLogger = createLogger("api.market_overview");
const MARKET_OVERVIEW_CACHE_TTL_MS = 15_000;

type MarketOverviewCacheEntry = {
  key: "full" | "low_memory";
  expiresAt: number;
  payload: Record<string, unknown>;
};

let marketOverviewCache: MarketOverviewCacheEntry | null = null;

interface StockReturn {
  symbol: string;
  change: number;
}

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

/**
 * Calculate the percentage return between two prices
 */
function calculateReturn(latestClose: number, previousClose: number): number {
  if (previousClose === 0) return 0;
  return (latestClose - previousClose) / previousClose;
}

/**
 * Calculate month-to-date return from index data
 */
function calculateMTDReturn(indexData: OHLCV[]): number {
  if (indexData.length < 2) return 0;

  // Find the last trading day and first trading day of the month
  const sortedData = [...indexData].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Find first trading day of current month (or most recent month with data)
  let firstDayOfMonth: OHLCV | null = null;
  let lastTradingDay: OHLCV | null = null;

  for (let i = sortedData.length - 1; i >= 0; i--) {
    const data = sortedData[i];
    const dataDate = new Date(data.date);

    // Get the last trading day
    if (!lastTradingDay) {
      lastTradingDay = data;
    }

    // Check if this is the first day of the same month as the last trading day
    if (lastTradingDay) {
      const lastDate = new Date(lastTradingDay.date);
      if (dataDate.getMonth() === lastDate.getMonth() && dataDate.getFullYear() === lastDate.getFullYear()) {
        firstDayOfMonth = data;
      } else {
        break;
      }
    }
  }

  if (!firstDayOfMonth || !lastTradingDay) return 0;

  // Month-to-date return is typically measured close-to-close for daily data.
  return calculateReturn(lastTradingDay.close, firstDayOfMonth.close);
}

/**
 * Get the last N trading days from index data
 */
function getRecentMarketTrend(indexData: OHLCV[], days: number): { date: string; value: number }[] {
  if (indexData.length === 0) return [];

  const sortedData = [...indexData].sort((a, b) => a.date.getTime() - b.date.getTime());
  const recentData = sortedData.slice(-days);

  // Normalize to start at 100 for visualization
  const baseValue = recentData[0]?.close || 100;
  const baseIndex = baseValue;

  return recentData.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    }),
    value: (d.close / baseIndex) * 100,
  }));
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const traceId = request.headers.get("x-trace-id")?.trim() || createTraceId("market");
  const logger = marketOverviewApiLogger.child({ traceId });
  // Rate limiting check
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/market-overview", clientId), RATE_LIMIT_MAX, 60000);
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

  try {
    const lowMemoryMode = isLowMemoryModeEnabled();
    const cacheKey: MarketOverviewCacheEntry["key"] = lowMemoryMode ? "low_memory" : "full";
    const now = Date.now();

    if (marketOverviewCache && marketOverviewCache.key === cacheKey && marketOverviewCache.expiresAt > now) {
      logger.info("cache.hit", { key: cacheKey, ttlMs: marketOverviewCache.expiresAt - now });
      return NextResponse.json(marketOverviewCache.payload, {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
        },
      });
    }

    if (lowMemoryMode) {
      const [metadata, indexData] = await Promise.all([
        loadStockMetadata(),
        loadIndexData(),
      ]);

      const metadataQualityError = getDataQualityError("stockMetadata");
      if (metadataQualityError) {
        return NextResponse.json({ error: metadataQualityError }, { status: 503 });
      }

      const indexQualityError = getDataQualityError("index");
      if (indexQualityError) {
        return NextResponse.json({ error: indexQualityError }, { status: 503 });
      }

      const totalStocks = metadata.length;
      const avgVolume = totalStocks > 0
        ? metadata.reduce((sum, s) => sum + (s.avgVolume || 0), 0) / totalStocks
        : 0;
      const excludedInactiveCount = metadata.reduce(
        (count, stock) => count + (stock.status.toUpperCase() !== "ACTIVE" ? 1 : 0),
        0
      );

      const preferredBenchmarks = [DEFAULT_BENCHMARK_SYMBOL, "VN100", "VN30"];
      const benchmarkSymbol =
        preferredBenchmarks.find((symbol) => indexData.some((d) => d.symbol === symbol)) ??
        indexData[0]?.symbol ??
        DEFAULT_BENCHMARK_SYMBOL;
      const benchmarkSeries = indexData
        .filter((d) => d.symbol === benchmarkSymbol)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      if (benchmarkSeries.length === 0) {
        return NextResponse.json({ error: "No benchmark series available" }, { status: 503 });
      }

      const marketTrend = getRecentMarketTrend(benchmarkSeries, 30);
      const mtdReturn = calculateMTDReturn(benchmarkSeries);
      const currentIndex = benchmarkSeries[benchmarkSeries.length - 1].close;

      const payload = {
        totalStocks,
        avgVolume,
        benchmark: benchmarkSymbol,
        topGainers: [],
        topLosers: [],
        marketTrend,
        mtdReturn,
        currentIndex,
        eligibleStocks: 0,
        excludedStaleCount: 0,
        excludedInactiveCount,
        excludedMissingAsOfCount: 0,
        excludedMissingPrevCount: 0,
        degradedMode: "low_memory",
      } satisfies Record<string, unknown>;

      marketOverviewCache = {
        key: cacheKey,
        expiresAt: now + MARKET_OVERVIEW_CACHE_TTL_MS,
        payload,
      };

      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
        },
      });
    }

    // Load all data in parallel
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

    const totalStocks = metadata.length;
    const avgVolume = totalStocks > 0
      ? metadata.reduce((sum, s) => sum + (s.avgVolume || 0), 0) / totalStocks
      : 0;

    // Use one benchmark series consistently for all market-level metrics
    const preferredBenchmarks = [DEFAULT_BENCHMARK_SYMBOL, "VN100", "VN30"];
    const benchmarkSymbol =
      preferredBenchmarks.find((symbol) => indexData.some((d) => d.symbol === symbol)) ??
      indexData[0]?.symbol ??
      DEFAULT_BENCHMARK_SYMBOL;
    const benchmarkSeries = indexData
      .filter((d) => d.symbol === benchmarkSymbol)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (benchmarkSeries.length === 0) {
      return NextResponse.json({ error: "No benchmark series available" }, { status: 503 });
    }

    const benchmarkDateIndex = new Map<string, number>();
    for (let i = 0; i < benchmarkSeries.length; i++) {
      benchmarkDateIndex.set(toDateKey(benchmarkSeries[i].date), i);
    }
    const asOfIndex = benchmarkSeries.length - 1;
    if (asOfIndex < 1) {
      return NextResponse.json({ error: "Benchmark series must contain at least 2 trading days" }, { status: 503 });
    }

    const asOfKey = toDateKey(benchmarkSeries[asOfIndex].date);
    const prevKey = toDateKey(benchmarkSeries[asOfIndex - 1].date);

    // Calculate real returns for each eligible stock
    const stockReturns: StockReturn[] = [];
    let excludedStaleCount = 0;
    let excludedInactiveCount = 0;
    let excludedMissingAsOfCount = 0;
    let excludedMissingPrevCount = 0;

    for (const stock of metadata) {
      if (stock.status.toUpperCase() !== "ACTIVE") {
        excludedInactiveCount += 1;
        continue;
      }

      const ohlcv = ohlcvData.get(stock.symbol);
      if (!ohlcv || ohlcv.length < 2) continue;

      const latestPoint = ohlcv[ohlcv.length - 1];
      const lastBenchmarkIndex = benchmarkDateIndex.get(toDateKey(latestPoint.date));
      if (lastBenchmarkIndex === undefined) {
        excludedStaleCount += 1;
        continue;
      }

      const recencyGap = asOfIndex - lastBenchmarkIndex;
      if (recencyGap > MAX_RECENCY_GAP_TRADING_DAYS) {
        excludedStaleCount += 1;
        continue;
      }

      // Top gainers/losers should reflect the last benchmark trading day move.
      // If a stock did not trade on asOfKey or prevKey, we exclude it from daily movers.
      let asOfClose: number | undefined;
      let prevClose: number | undefined;
      for (let i = ohlcv.length - 1; i >= 0; i--) {
        const key = toDateKey(ohlcv[i].date);
        if (asOfClose === undefined && key === asOfKey) {
          asOfClose = ohlcv[i].close;
        } else if (prevClose === undefined && key === prevKey) {
          prevClose = ohlcv[i].close;
        }

        if (asOfClose !== undefined && prevClose !== undefined) break;
      }

      if (asOfClose === undefined) {
        excludedMissingAsOfCount += 1;
        continue;
      }
      if (prevClose === undefined) {
        excludedMissingPrevCount += 1;
        continue;
      }

      const dailyReturn = calculateReturn(asOfClose, prevClose);
      stockReturns.push({ symbol: stock.symbol, change: dailyReturn });
    }

    // Sort by return to find top gainers and losers
    stockReturns.sort((a, b) => b.change - a.change);

    const topGainers = stockReturns.slice(0, 5);
    const topLosers = stockReturns.slice(-5).reverse();

    // Get market trend from selected benchmark
    const marketTrend = getRecentMarketTrend(benchmarkSeries, 30);

    // Calculate MTD return
    const mtdReturn = calculateMTDReturn(benchmarkSeries);

    // Get current index value
    const currentIndex = benchmarkSeries[benchmarkSeries.length - 1].close;

    const payload = {
      totalStocks,
      avgVolume,
      benchmark: benchmarkSymbol,
      topGainers,
      topLosers,
      marketTrend,
      mtdReturn,
      currentIndex,
      eligibleStocks: stockReturns.length,
      excludedStaleCount,
      excludedInactiveCount,
      excludedMissingAsOfCount,
      excludedMissingPrevCount,
    } satisfies Record<string, unknown>;

    marketOverviewCache = {
      key: cacheKey,
      expiresAt: now + MARKET_OVERVIEW_CACHE_TTL_MS,
      payload,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    logger.error("request.failed", {
      ...toErrorMeta(error),
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Failed to load market data" }, { status: 500 });
  }
}
