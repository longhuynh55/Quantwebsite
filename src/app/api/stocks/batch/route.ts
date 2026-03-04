import { NextResponse } from "next/server";
import { getDatasetLoadStatus, loadOHLCVForSymbols } from "@/lib/data";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";
import { createLogger, createTraceId, toErrorMeta } from "@/lib/logger";

const TRACE_ID_HEADER = "x-trace-id";
const RATE_LIMIT_MAX = 100;
const MAX_SYMBOLS = 30;
const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 100;

// Valid symbol format: 1-10 uppercase letters or digits
const VALID_SYMBOL_REGEX = /^[A-Z0-9]{1,10}$/;

const stocksBatchLogger = createLogger("api.stocks.batch");

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

function parseSymbols(raw: string | null): { symbols: string[]; invalid: string[] } {
  const input = String(raw ?? "");
  const parts = input
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const seen = new Set<string>();
  const symbols: string[] = [];
  const invalid: string[] = [];

  for (const symbol of parts) {
    if (symbols.length >= MAX_SYMBOLS) break;
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    if (!VALID_SYMBOL_REGEX.test(symbol)) {
      invalid.push(symbol);
      continue;
    }
    symbols.push(symbol);
  }

  return { symbols, invalid };
}

function parseLimit(raw: string | null): number | null {
  if (raw === null || String(raw).trim() === "") return DEFAULT_LIMIT;
  const value = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(value)) return null;
  if (value < 1 || value > MAX_LIMIT) return null;
  return value;
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const traceId = request.headers.get(TRACE_ID_HEADER)?.trim() || createTraceId("stocks_batch");
  const logger = stocksBatchLogger.child({ traceId });

  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/stocks/batch", clientId), RATE_LIMIT_MAX, 60000);
  if (!rateLimit.allowed) {
    logger.warn("rate_limit.blocked", {
      remaining: rateLimit.remaining,
      resetInMs: Math.max(0, rateLimit.resetTime - Date.now()),
    });
    return jsonResponse(
      traceId,
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const { symbols, invalid } = parseSymbols(searchParams.get("symbols"));
  if (symbols.length === 0) {
    return jsonResponse(traceId, { error: '"symbols" is required (comma-separated list).' }, { status: 400 });
  }
  if (invalid.length > 0) {
    return jsonResponse(
      traceId,
      { error: "Invalid symbol format. Must be 1-10 uppercase letters or digits.", invalidSymbols: invalid },
      { status: 400 }
    );
  }

  const limit = parseLimit(searchParams.get("limit"));
  if (limit === null) {
    return jsonResponse(traceId, { error: `Invalid limit. Use 1-${MAX_LIMIT}.` }, { status: 400 });
  }

  try {
    const map = await loadOHLCVForSymbols(symbols);
    const hasAnySeries = symbols.some((symbol) => (map.get(symbol) ?? []).length > 0);
    if (!hasAnySeries) {
      const ohlcvStatus = getDatasetLoadStatus("ohlcv");
      if (ohlcvStatus.status === "error") {
        return jsonResponse(
          traceId,
          {
            error: "OHLCV dataset unavailable.",
            dataFailureReason: ohlcvStatus.reason ?? "read_failure",
            details: ohlcvStatus.message ?? undefined,
          },
          { status: 503 }
        );
      }
    }
    const data: Record<string, unknown[]> = {};

    for (const symbol of symbols) {
      const series = map.get(symbol) || [];
      data[symbol] = series.slice(-limit);
    }

    return jsonResponse(traceId, { data }, { status: 200 });
  } catch (error) {
    logger.error("request.failed", { ...toErrorMeta(error), durationMs: Date.now() - startedAt });
    return jsonResponse(traceId, { error: "Internal server error" }, { status: 500 });
  }
}
