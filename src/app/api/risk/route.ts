import { NextResponse } from "next/server";
import {
  getDataQualityReport,
  getDatasetLoadStatus,
  hasSufficientDataQuality,
  loadOHLCVForSymbol,
  loadIndexData,
} from "@/lib/data";
import { calculateRiskMetrics, calculateDrawdown, calculateRollingVolatility } from "@/lib/quant/risk";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";
import { createLogger, createTraceId, toErrorMeta } from "@/lib/logger";

// Valid symbol format: 1-10 uppercase letters or digits
const VALID_SYMBOL_REGEX = /^[A-Z0-9]{1,10}$/;
const VALID_BENCHMARKS = ["VNINDEX", "VN100", "VN30"];
const DEFAULT_BENCHMARK = "VNINDEX";
const RATE_LIMIT_MAX = 60; // 60 requests per minute
const MIN_DATA_QUALITY_RATIO = 0.95;
const riskApiLogger = createLogger("api.risk");

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDataQualityError(
  dataset: "ohlcv" | "index",
  options?: { allowUnknownReport?: boolean }
): string | null {
  if (hasSufficientDataQuality(dataset, MIN_DATA_QUALITY_RATIO)) {
    return null;
  }

  const report = getDataQualityReport(dataset);
  if (!report) {
    const loadStatus = getDatasetLoadStatus(dataset);
    if (loadStatus.status === "error") {
      return loadStatus.message
        ? `Data quality check failed for ${dataset}: ${loadStatus.message}`
        : `Data quality check failed for ${dataset}: load_status_error`;
    }
    if (options?.allowUnknownReport) {
      return null;
    }
    return `Data quality check failed for ${dataset}: report unavailable`;
  }

  return (
    `Data quality check failed for ${dataset}: accepted ${report.acceptedRows}/${report.totalRows} ` +
    `(${(report.acceptedRatio * 100).toFixed(2)}%), required >= ${(MIN_DATA_QUALITY_RATIO * 100).toFixed(0)}%`
  );
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const traceId = request.headers.get("x-trace-id")?.trim() || createTraceId("risk");
  const logger = riskApiLogger.child({ traceId });
  // Rate limiting check
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/risk", clientId), RATE_LIMIT_MAX, 60000);
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
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const benchmark = searchParams.get("benchmark")?.trim().toUpperCase() || DEFAULT_BENCHMARK;

  // Validate symbol
  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }
  if (!VALID_SYMBOL_REGEX.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol format. Must be 1-10 uppercase letters or digits." }, { status: 400 });
  }

  // Validate benchmark
  if (!VALID_BENCHMARKS.includes(benchmark)) {
    return NextResponse.json(
      { error: `Invalid benchmark. Valid options: ${VALID_BENCHMARKS.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const assetData = await loadOHLCVForSymbol(symbol);
    if (assetData.length === 0) {
      const ohlcvLoadStatus = getDatasetLoadStatus("ohlcv");
      if (ohlcvLoadStatus.status === "error") {
        return NextResponse.json(
          {
            error: ohlcvLoadStatus.message || "OHLCV dataset is unavailable",
            dataFailureReason: ohlcvLoadStatus.reason ?? null,
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
    }

    // Check minimum data points
    if (assetData.length < 30) {
      return NextResponse.json(
        { error: "Insufficient data for risk analysis (minimum 30 data points required)" },
        { status: 400 }
      );
    }

    const sortedAssetData = [...assetData].sort((a, b) => a.date.getTime() - b.date.getTime());
    const assetPrices = sortedAssetData.map((d) => d.close);

    const indexData = await loadIndexData();

    const ohlcvQualityError = getDataQualityError("ohlcv", { allowUnknownReport: true });
    if (ohlcvQualityError) {
      return NextResponse.json({ error: ohlcvQualityError }, { status: 503 });
    }

    const indexQualityError = getDataQualityError("index");
    if (indexQualityError) {
      return NextResponse.json({ error: indexQualityError }, { status: 503 });
    }

    const benchmarkData = indexData
      .filter((d) => d.symbol === benchmark)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Align asset and benchmark by date so beta/tracking/information are meaningful.
    const benchmarkByDate = new Map<string, number>();
    for (const point of benchmarkData) {
      benchmarkByDate.set(getDateKey(point.date), point.close);
    }

    const alignedAssetPrices: number[] = [];
    const alignedBenchmarkPrices: number[] = [];
    for (const point of sortedAssetData) {
      const key = getDateKey(point.date);
      const benchmarkClose = benchmarkByDate.get(key);
      if (benchmarkClose !== undefined) {
        alignedAssetPrices.push(point.close);
        alignedBenchmarkPrices.push(benchmarkClose);
      }
    }

    // Asset-only metrics should be computed on the full asset series (no benchmark alignment).
    // Benchmark alignment is only needed for beta / tracking error / information ratio.
    const assetMetrics = calculateRiskMetrics(assetPrices);
    let beta = 0;
    let trackingError = 0;
    let informationRatio = 0;
    if (alignedAssetPrices.length >= 2 && alignedBenchmarkPrices.length >= 2) {
      const alignedMetrics = calculateRiskMetrics(alignedAssetPrices, alignedBenchmarkPrices);
      beta = alignedMetrics.beta;
      trackingError = alignedMetrics.trackingError;
      informationRatio = alignedMetrics.informationRatio;
    }

    const riskMetrics = {
      ...assetMetrics,
      beta,
      trackingError,
      informationRatio,
    };

    const drawdownAnalysis = calculateDrawdown(assetPrices);
    const rollingVol = calculateRollingVolatility(assetPrices, 21);
    const latestDrawdown = drawdownAnalysis.drawdowns[drawdownAnalysis.drawdowns.length - 1] ?? {
      drawdown: 0,
      duration: 0,
    };

    // Safely build drawdown array
    const startIndex = Math.max(0, sortedAssetData.length - 252);
    const drawdowns = drawdownAnalysis.drawdowns.slice(-252).map((d, i) => ({
      date: sortedAssetData[startIndex + i]?.date || new Date(),
      drawdown: d.drawdown,
    }));

    // rollingVol is based on returns, so it aligns with price index i+1
    const volStartIndex = Math.max(0, rollingVol.length - 252);
    const rollingVolatility = rollingVol.slice(-252).map((v, i) => ({
      date: sortedAssetData[volStartIndex + i + 1]?.date || new Date(),
      volatility: v,
    }));

    return NextResponse.json({
      symbol,
      benchmark,
      metrics: riskMetrics,
      analysis: {
        currentDrawdown: latestDrawdown.drawdown,
        currentDrawdownDuration: latestDrawdown.duration,
        isUnderwater: latestDrawdown.drawdown > 0,
      },
      drawdowns,
      rollingVolatility,
    });
  } catch (error) {
    logger.error("request.failed", {
      ...toErrorMeta(error),
      durationMs: Date.now() - startedAt,
      symbol,
      benchmark,
    });
    return NextResponse.json({ error: "Failed to calculate risk metrics" }, { status: 500 });
  }
}
