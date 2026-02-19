import { NextResponse } from "next/server";
import {
  getDatasetLoadStatus,
  loadOHLCVData,
  loadOHLCVForSymbol,
  loadStockMetadata,
  type OHLCV,
  type StockMetadata,
} from "@/lib/data";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";
import { toDateKey } from "@/lib/dataPolicy";
import { buildIcbSnapshot, parseFlexibleDate, parseIcbLevel } from "@/lib/analytics/universe";
import { createLogger, createTraceId, toErrorMeta } from "@/lib/logger";

// Valid symbol format: 1-10 uppercase letters or digits
const VALID_SYMBOL_REGEX = /^[A-Z0-9]{1,10}$/;
const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 100;
const RATE_LIMIT_MAX = 100; // 100 requests per minute
const HOSE_EXCHANGE = "HOSE";
const ONLY_HOSE_ERROR = 'Only "HOSE" exchange is supported.';
const TRACE_ID_HEADER = "x-trace-id";
const UNIVERSE_RANKING_METRICS = new Set(["close", "open", "high", "low", "volume"]);
const UNIVERSE_RANKING_ORDERS = new Set(["asc", "desc"]);
const stocksApiLogger = createLogger("api.stocks");

type UniverseRankingMetric = "close" | "open" | "high" | "low" | "volume";
type UniverseRankingOrder = "asc" | "desc";

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

function parseExchange(raw: string | null): { value: string; provided: boolean } {
  const provided = raw !== null;
  const value = String(raw ?? HOSE_EXCHANGE).trim().toUpperCase();
  if (!value) {
    return { value: HOSE_EXCHANGE, provided };
  }
  return { value, provided };
}

function parseUniverseRankingMetric(raw: string | null): UniverseRankingMetric | null {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return null;
  if (!UNIVERSE_RANKING_METRICS.has(value)) return null;
  return value as UniverseRankingMetric;
}

function parseUniverseRankingOrder(raw: string | null): UniverseRankingOrder | null {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return null;
  if (!UNIVERSE_RANKING_ORDERS.has(value)) return null;
  return value as UniverseRankingOrder;
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .trim();
}

function resolveIcbValue(stock: StockMetadata, level: "2" | "3" | "4"): string {
  if (level === "2") return `${stock.icbCode2 ?? ""}|${stock.icbName2 ?? ""}`;
  if (level === "3") return `${stock.icbCode3 ?? ""}|${stock.icbName3 ?? ""}`;
  return `${stock.icbCode4 ?? ""}|${stock.icbName4 ?? ""}`;
}

function matchesIcbFilter(stock: StockMetadata, icbFilter: string | undefined, level: "2" | "3" | "4"): boolean {
  if (!icbFilter) return true;
  const query = normalizeForMatch(icbFilter);
  if (!query) return true;

  const value = normalizeForMatch(resolveIcbValue(stock, level));
  return value.includes(query);
}

function findSeriesPointAsOf(series: OHLCV[], asOfDateKey: string): { row: OHLCV; exactDateMatch: boolean } | null {
  for (let index = series.length - 1; index >= 0; index -= 1) {
    const row = series[index];
    const rowDateKey = toDateKey(row.date);
    if (rowDateKey > asOfDateKey) continue;
    return { row, exactDateMatch: rowDateKey === asOfDateKey };
  }
  return null;
}

function filterSeriesByRange(series: OHLCV[], fromDateKey?: string, toDateKeyValue?: string): OHLCV[] {
  return series.filter((row) => {
    const key = toDateKey(row.date);
    if (fromDateKey && key < fromDateKey) return false;
    if (toDateKeyValue && key > toDateKeyValue) return false;
    return true;
  });
}

function resolveLatestAsOfDateKey(universe: StockMetadata[], ohlcvMap: Map<string, OHLCV[]>): string | null {
  let latest = "";
  for (const stock of universe) {
    if (!(stock.lastDate instanceof Date) || Number.isNaN(stock.lastDate.getTime())) continue;
    const key = toDateKey(stock.lastDate);
    if (key > latest) latest = key;
  }

  for (const stock of universe) {
    const series = ohlcvMap.get(stock.symbol);
    if (!series || series.length === 0) continue;
    const key = toDateKey(series[series.length - 1].date);
    if (key > latest) latest = key;
  }

  return latest || null;
}

function jsonResponse(
  traceId: string,
  body: unknown,
  init?: Omit<ResponseInit, "headers"> & { headers?: HeadersInit }
) {
  const headers = new Headers(init?.headers);
  headers.set(TRACE_ID_HEADER, traceId);
  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const traceId = request.headers.get("x-trace-id")?.trim() || createTraceId("stocks");
  const logger = stocksApiLogger.child({ traceId });
  // Rate limiting check
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/stocks", clientId), RATE_LIMIT_MAX, 60000);
  if (!rateLimit.allowed) {
    logger.warn("rate_limit.blocked", {
      remaining: rateLimit.remaining,
      resetInMs: Math.max(0, rateLimit.resetTime - Date.now()),
    });
    return jsonResponse(traceId, 
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const search = searchParams.get("search")?.trim().toUpperCase();
  const dateRaw = searchParams.get("date")?.trim() ?? "";
  const fromRaw = searchParams.get("from")?.trim() ?? "";
  const toRaw = searchParams.get("to")?.trim() ?? "";
  const groupBy = (searchParams.get("groupBy") ?? "").trim().toLowerCase();
  const exchangeInput = parseExchange(searchParams.get("exchange"));
  const exchange = exchangeInput.value;
  const icb = searchParams.get("icb")?.trim();
  const icbLevel = parseIcbLevel(searchParams.get("icbLevel"));
  const rankingRequested = searchParams.has("metric") || searchParams.has("order");
  const rankingMetric = parseUniverseRankingMetric(searchParams.get("metric"));
  const rankingOrder = parseUniverseRankingOrder(searchParams.get("order"));
  const limitStrRaw = searchParams.get("limit") ?? String(DEFAULT_LIMIT);
  const limitStr = String(limitStrRaw).trim();
  const limitAll = limitStr.toLowerCase() === "all";
  const requestedDate = dateRaw ? parseFlexibleDate(dateRaw) : null;
  const fromDate = fromRaw ? parseFlexibleDate(fromRaw) : null;
  const toDate = toRaw ? parseFlexibleDate(toRaw) : null;

  // Validate limit
  let limit: number | null = null;
  if (!limitAll) {
    limit = parseInt(limitStr, 10);
    if (!Number.isFinite(limit) || limit <= 0 || limit > MAX_LIMIT) {
      return jsonResponse(traceId, 
        { error: `Limit must be between 1 and ${MAX_LIMIT}, or "all"` },
        { status: 400 }
      );
    }
  }
  if (exchangeInput.provided && exchange !== HOSE_EXCHANGE) {
    return jsonResponse(traceId, { error: ONLY_HOSE_ERROR }, { status: 400 });
  }
  if (searchParams.has("metric") && !rankingMetric) {
    return jsonResponse(traceId, 
      { error: 'Invalid metric. Use one of: "close", "open", "high", "low", "volume".' },
      { status: 400 }
    );
  }
  if (searchParams.has("order") && !rankingOrder) {
    return jsonResponse(traceId, { error: 'Invalid order. Use "asc" or "desc".' }, { status: 400 });
  }
  if (!icbLevel) {
    return jsonResponse(traceId, { error: 'Invalid icbLevel. Use "2", "3", or "4".' }, { status: 400 });
  }
  if (groupBy && groupBy !== "icb") {
    return jsonResponse(traceId, { error: 'Invalid groupBy. Only "icb" is supported.' }, { status: 400 });
  }
  if (dateRaw && !requestedDate) {
    return jsonResponse(traceId, { error: 'Invalid date. Use "YYYY-MM-DD" or "DD/MM/YYYY".' }, { status: 400 });
  }
  if (fromRaw && !fromDate) {
    return jsonResponse(traceId, { error: 'Invalid from date. Use "YYYY-MM-DD" or "DD/MM/YYYY".' }, { status: 400 });
  }
  if (toRaw && !toDate) {
    return jsonResponse(traceId, { error: 'Invalid to date. Use "YYYY-MM-DD" or "DD/MM/YYYY".' }, { status: 400 });
  }
  if (requestedDate && (fromDate || toDate)) {
    return jsonResponse(traceId, { error: 'Cannot combine "date" with "from/to".' }, { status: 400 });
  }
  if ((fromDate || toDate) && !symbol) {
    return jsonResponse(traceId, { error: '"from/to" filters require "symbol".' }, { status: 400 });
  }
  if (fromDate && toDate && toDate.getTime() < fromDate.getTime()) {
    return jsonResponse(traceId, { error: '"to" must be greater than or equal to "from".' }, { status: 400 });
  }

  try {
    if (groupBy === "icb") {
      const grouped = await buildIcbSnapshot({
        asOfDateKey: requestedDate ? toDateKey(requestedDate) : undefined,
        requestedDate: dateRaw || undefined,
        exchange,
        icbLevel,
        icbFilter: icb || undefined,
        limit: limitAll ? 0 : (limit ?? undefined),
      });
      return jsonResponse(traceId, {
        groupBy: "icb",
        ...grouped,
      });
    }

    if (symbol) {
      // Validate symbol format
      if (!VALID_SYMBOL_REGEX.test(symbol)) {
        return jsonResponse(traceId, 
          { error: "Invalid symbol format. Must be 1-10 uppercase letters or digits." },
          { status: 400 }
        );
      }

      const data = await loadOHLCVForSymbol(symbol);
      if (data.length === 0) {
        const ohlcvStatus = getDatasetLoadStatus("ohlcv");
        if (ohlcvStatus.status === "error") {
          return jsonResponse(traceId, 
            {
              error: "OHLCV dataset unavailable.",
              dataFailureReason: ohlcvStatus.reason ?? "read_failure",
              details: ohlcvStatus.message ?? undefined,
            },
            { status: 503 }
          );
        }
        return jsonResponse(traceId, { error: "Symbol not found" }, { status: 404 });
      }

      const metadata = (await loadStockMetadata()).find((s) => s.symbol === symbol) ?? null;
      const runtimeMetadata = mergeMetadataWithSeries(symbol, metadata, data);

      if (requestedDate) {
        const asOfDateKey = toDateKey(requestedDate);
        const point = findSeriesPointAsOf(data, asOfDateKey);
        if (!point) {
          return jsonResponse(traceId, { error: "No OHLCV data available on or before requested date." }, { status: 404 });
        }

        return jsonResponse(traceId, {
          symbol,
          metadata: runtimeMetadata,
          requestedDate: dateRaw,
          asOfDate: toDateKey(point.row.date),
          exactDateMatch: point.exactDateMatch,
          data: [point.row],
          total: data.length,
        });
      }

      if (fromDate || toDate) {
        const fromKey = fromDate ? toDateKey(fromDate) : undefined;
        const toKey = toDate ? toDateKey(toDate) : undefined;
        const filtered = filterSeriesByRange(data, fromKey, toKey);
        if (filtered.length === 0) {
          return jsonResponse(traceId, { error: "No OHLCV rows found for the requested range." }, { status: 404 });
        }

        const slice = limitAll ? filtered : filtered.slice(-limit!);
        return jsonResponse(traceId, {
          symbol,
          metadata: runtimeMetadata,
          from: fromKey,
          to: toKey,
          data: slice,
          total: filtered.length,
        });
      }

      const slice = limitAll ? data : data.slice(-limit!);
      return jsonResponse(traceId, { symbol, metadata: runtimeMetadata, data: slice, total: data.length });
    }

    const metadata = await loadStockMetadata();
    if (metadata.length === 0) {
      const metadataStatus = getDatasetLoadStatus("stockMetadata");
      if (metadataStatus.status === "error") {
        return jsonResponse(traceId, 
          {
            error: "Stock metadata dataset unavailable.",
            dataFailureReason: metadataStatus.reason ?? "read_failure",
            details: metadataStatus.message ?? undefined,
          },
          { status: 503 }
        );
      }
    }

    if (search) {
      const normalized = search.replace(/[^A-Z0-9]/g, "").slice(0, 10);
      if (!normalized) {
        return jsonResponse(traceId, { stocks: [], total: 0 });
      }
      const filtered = metadata.filter((s) => s.symbol.includes(normalized));
      const slice = limitAll ? filtered : filtered.slice(0, limit!);
      return jsonResponse(traceId, { stocks: slice, total: filtered.length });
    }

    if (dateRaw || searchParams.has("exchange") || searchParams.has("icb")) {
      const universe = metadata
        .filter((stock) => stock.exchange.toUpperCase() === exchange)
        .filter((stock) => stock.status.toUpperCase() === "ACTIVE")
        .filter((stock) => matchesIcbFilter(stock, icb || undefined, icbLevel));
      const ohlcvMap = await loadOHLCVData();
      if (ohlcvMap.size === 0) {
        const ohlcvStatus = getDatasetLoadStatus("ohlcv");
        if (ohlcvStatus.status === "error") {
          return jsonResponse(traceId, 
            {
              error: "OHLCV dataset unavailable.",
              dataFailureReason: ohlcvStatus.reason ?? "read_failure",
              details: ohlcvStatus.message ?? undefined,
            },
            { status: 503 }
          );
        }
      }
      const asOfDateKey = requestedDate ? toDateKey(requestedDate) : resolveLatestAsOfDateKey(universe, ohlcvMap);
      if (!asOfDateKey) {
        return jsonResponse(traceId, { error: "Unable to determine as-of date for market snapshot." }, { status: 503 });
      }

      const stockRows: Array<{
        symbol: string;
        date: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        exactDateMatch: boolean;
        icbCode2?: string;
        icbCode3?: string;
        icbCode4?: string;
        icbName2?: string;
        icbName3?: string;
        icbName4?: string;
      }> = [];
      let exactDateMatchCount = 0;

      for (const stock of universe) {
        const series = ohlcvMap.get(stock.symbol);
        if (!series || series.length === 0) continue;

        const point = findSeriesPointAsOf(series, asOfDateKey);
        if (!point) continue;
        if (point.exactDateMatch) exactDateMatchCount += 1;

        stockRows.push({
          symbol: stock.symbol,
          date: toDateKey(point.row.date),
          open: point.row.open,
          high: point.row.high,
          low: point.row.low,
          close: point.row.close,
          volume: point.row.volume,
          exactDateMatch: point.exactDateMatch,
          icbCode2: stock.icbCode2,
          icbCode3: stock.icbCode3,
          icbCode4: stock.icbCode4,
          icbName2: stock.icbName2,
          icbName3: stock.icbName3,
          icbName4: stock.icbName4,
        });
      }

      const effectiveMetric: UniverseRankingMetric = rankingMetric ?? "close";
      const effectiveOrder: UniverseRankingOrder = rankingOrder ?? "desc";
      if (rankingRequested) {
        stockRows.sort((a, b) => {
          const metricDiff = effectiveOrder === "asc"
            ? a[effectiveMetric] - b[effectiveMetric]
            : b[effectiveMetric] - a[effectiveMetric];
          if (metricDiff !== 0) return metricDiff;
          return a.symbol.localeCompare(b.symbol);
        });
      } else {
        stockRows.sort((a, b) => a.symbol.localeCompare(b.symbol));
      }

      const slice = limitAll ? stockRows : stockRows.slice(0, limit!);
      return jsonResponse(traceId, {
        exchange,
        requestedDate: dateRaw || undefined,
        asOfDate: asOfDateKey,
        totalSymbols: universe.length,
        pricedSymbols: stockRows.length,
        exactDateMatchCount,
        metric: rankingRequested ? effectiveMetric : undefined,
        order: rankingRequested ? effectiveOrder : undefined,
        stocks: slice,
        total: stockRows.length,
      });
    }

    const slice = limitAll ? metadata : metadata.slice(0, limit!);
    return jsonResponse(traceId, { stocks: slice, total: metadata.length });
  } catch (error) {
    logger.error("request.failed", {
      ...toErrorMeta(error),
      durationMs: Date.now() - startedAt,
      symbol: symbol ?? null,
      search: search ?? null,
      exchange,
      date: dateRaw || null,
      from: fromRaw || null,
      to: toRaw || null,
      groupBy: groupBy || null,
      rankingRequested,
    });
    return jsonResponse(traceId, { error: "Failed to load stock data" }, { status: 500 });
  }
}
