import { NextResponse } from "next/server";
import { getDataQualityReport, hasSufficientDataQuality, loadOHLCVForSymbol } from "@/lib/data";
import { runBacktest, STRATEGIES, StrategyConfig } from "@/lib/quant/backtest";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";

// Valid symbol format: 1-10 uppercase letters
const VALID_SYMBOL_REGEX = /^[A-Z]{1,10}$/;
const MIN_CAPITAL = 1;
const MAX_CAPITAL = 1e12;  // 1 trillion
const DEFAULT_CAPITAL = 100000;
const RATE_LIMIT_MAX = 30; // 30 requests per minute (computationally expensive)
const MIN_DATA_QUALITY_RATIO = 0.95;

const VALID_STRATEGIES = ['sma_crossover', 'ema_crossover', 'rsi_mean_reversion', 'bollinger_bands', 'momentum'];

function getDataQualityError(dataset: "ohlcv"): string | null {
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

export async function GET(request: Request) {
  // Rate limiting check
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/backtesting", clientId), RATE_LIMIT_MAX, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const strategyType = searchParams.get("strategy");
  const capitalStr = searchParams.get("capital") || String(DEFAULT_CAPITAL);

  // Validate symbol
  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }
  if (!VALID_SYMBOL_REGEX.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol format. Must be 1-10 uppercase letters." }, { status: 400 });
  }

  // Validate strategy
  if (!strategyType) {
    return NextResponse.json({ error: "Strategy is required" }, { status: 400 });
  }
  if (!VALID_STRATEGIES.includes(strategyType)) {
    return NextResponse.json(
      { error: `Invalid strategy. Valid options: ${VALID_STRATEGIES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate capital
  const initialCapital = parseFloat(capitalStr);
  if (isNaN(initialCapital) || initialCapital < MIN_CAPITAL || initialCapital > MAX_CAPITAL) {
    return NextResponse.json(
      { error: `Capital must be between ${MIN_CAPITAL} and ${MAX_CAPITAL.toExponential()}` },
      { status: 400 }
    );
  }

  try {
    const data = await loadOHLCVForSymbol(symbol);
    const qualityError = getDataQualityError("ohlcv");
    if (qualityError) {
      return NextResponse.json({ error: qualityError }, { status: 503 });
    }

    if (data.length === 0) {
      return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
    }

    // Check minimum data points for backtesting
    if (data.length < 30) {
      return NextResponse.json(
        { error: "Insufficient data for backtesting (minimum 30 data points required)" },
        { status: 400 }
      );
    }

    const strategy = STRATEGIES.find((s) => s.type === strategyType);
    if (!strategy) {
      return NextResponse.json({ error: "Invalid strategy" }, { status: 400 });
    }

    const result = runBacktest(data, strategy, initialCapital);
    return NextResponse.json({ symbol, strategy: strategy.name, initialCapital, ...result });
  } catch (error) {
    console.error("Backtest API Error:", error);
    return NextResponse.json({ error: "Failed to run backtest" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Rate limiting check
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/backtesting", clientId), RATE_LIMIT_MAX, 60000);
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
    const { symbol, strategy, capital, params } = body;

    // Validate symbol
    if (!symbol) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!VALID_SYMBOL_REGEX.test(normalizedSymbol)) {
      return NextResponse.json({ error: "Invalid symbol format. Must be 1-10 uppercase letters." }, { status: 400 });
    }

    // Validate strategy
    if (!strategy) {
      return NextResponse.json({ error: "Strategy is required" }, { status: 400 });
    }
    if (!VALID_STRATEGIES.includes(strategy)) {
      return NextResponse.json(
        { error: `Invalid strategy. Valid options: ${VALID_STRATEGIES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate capital
    const initialCapital = capital ?? DEFAULT_CAPITAL;
    if (typeof initialCapital !== 'number' || isNaN(initialCapital) ||
        initialCapital < MIN_CAPITAL || initialCapital > MAX_CAPITAL) {
      return NextResponse.json(
        { error: `Capital must be between ${MIN_CAPITAL} and ${MAX_CAPITAL.toExponential()}` },
        { status: 400 }
      );
    }

    const data = await loadOHLCVForSymbol(normalizedSymbol);
    const qualityError = getDataQualityError("ohlcv");
    if (qualityError) {
      return NextResponse.json({ error: qualityError }, { status: 503 });
    }

    if (data.length === 0) {
      return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
    }

    // Check minimum data points for backtesting
    if (data.length < 30) {
      return NextResponse.json(
        { error: "Insufficient data for backtesting (minimum 30 data points required)" },
        { status: 400 }
      );
    }

    const strategyConfig: StrategyConfig = {
      name: strategy,
      type: strategy,
      params: params || {},
    };

    const result = runBacktest(data, strategyConfig, initialCapital);
    return NextResponse.json({
      symbol: normalizedSymbol,
      strategy: strategyConfig.name,
      initialCapital,
      ...result
    });
  } catch (error) {
    console.error("Backtest API Error:", error);
    return NextResponse.json({ error: "Failed to run backtest" }, { status: 500 });
  }
}
