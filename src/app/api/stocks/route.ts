import { NextResponse } from "next/server";
import { loadStockMetadata, loadOHLCVForSymbol, type OHLCV, type StockMetadata } from "@/lib/data";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";

// Valid symbol format: 1-10 uppercase letters or digits
const VALID_SYMBOL_REGEX = /^[A-Z0-9]{1,10}$/;
const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 100;
const RATE_LIMIT_MAX = 100; // 100 requests per minute

function buildSeriesStats(series: OHLCV[]) {
  if (series.length === 0) {
    return {
      dataRows: 0,
      firstDate: null as Date | null,
      lastDate: null as Date | null,
      totalTradingDays: 0,
      avgVolume: 0,
    };
  }

  const totalVolume = series.reduce((sum, row) => sum + row.volume, 0);
  return {
    dataRows: series.length,
    firstDate: series[0].date,
    lastDate: series[series.length - 1].date,
    totalTradingDays: series.length,
    avgVolume: totalVolume / series.length,
  };
}

function mergeMetadataWithSeries(
  symbol: string,
  metadata: StockMetadata | null,
  series: OHLCV[]
): StockMetadata {
  const stats = buildSeriesStats(series);
  const base: StockMetadata =
    metadata ??
    ({
      symbol,
      exchange: "HOSE",
      status: "UNKNOWN",
      dataRows: 0,
      source: "ohlcv_runtime",
      firstDate: new Date(0),
      lastDate: new Date(0),
      totalTradingDays: 0,
      avgVolume: 0,
      listingPhase: "UNKNOWN",
    } as StockMetadata);

  return {
    ...base,
    symbol,
    dataRows: stats.dataRows,
    totalTradingDays: stats.totalTradingDays,
    avgVolume: stats.avgVolume,
    firstDate: stats.firstDate ?? base.firstDate,
    lastDate: stats.lastDate ?? base.lastDate,
  };
}

export async function GET(request: Request) {
  // Rate limiting check
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/stocks", clientId), RATE_LIMIT_MAX, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const search = searchParams.get("search")?.trim().toUpperCase();
  const limitStrRaw = searchParams.get("limit") ?? String(DEFAULT_LIMIT);
  const limitStr = String(limitStrRaw).trim();
  const limitAll = limitStr.toLowerCase() === "all";

  // Validate limit
  let limit: number | null = null;
  if (!limitAll) {
    limit = parseInt(limitStr, 10);
    if (!Number.isFinite(limit) || limit <= 0 || limit > MAX_LIMIT) {
      return NextResponse.json(
        { error: `Limit must be between 1 and ${MAX_LIMIT}, or "all"` },
        { status: 400 }
      );
    }
  }

  try {
    if (symbol) {
      // Validate symbol format
      if (!VALID_SYMBOL_REGEX.test(symbol)) {
        return NextResponse.json(
          { error: "Invalid symbol format. Must be 1-10 uppercase letters or digits." },
          { status: 400 }
        );
      }

      const data = await loadOHLCVForSymbol(symbol);
      if (data.length === 0) {
        return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
      }

      const metadata = (await loadStockMetadata()).find((s) => s.symbol === symbol) ?? null;
      const runtimeMetadata = mergeMetadataWithSeries(symbol, metadata, data);
      const slice = limitAll ? data : data.slice(-limit!);
      return NextResponse.json({ symbol, metadata: runtimeMetadata, data: slice, total: data.length });
    }

    const metadata = await loadStockMetadata();

    if (search) {
      const normalized = search.replace(/[^A-Z0-9]/g, "").slice(0, 10);
      if (!normalized) {
        return NextResponse.json({ stocks: [], total: 0 });
      }
      const filtered = metadata.filter((s) => s.symbol.includes(normalized));
      const slice = limitAll ? filtered : filtered.slice(0, limit!);
      return NextResponse.json({ stocks: slice, total: filtered.length });
    }

    const slice = limitAll ? metadata : metadata.slice(0, limit!);
    return NextResponse.json({ stocks: slice, total: metadata.length });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Failed to load stock data" }, { status: 500 });
  }
}
