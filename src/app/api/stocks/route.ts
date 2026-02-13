import { NextResponse } from "next/server";
import { loadStockMetadata, loadOHLCVForSymbol } from "@/lib/data";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";

// Valid symbol format: 1-10 uppercase letters
const VALID_SYMBOL_REGEX = /^[A-Z]{1,10}$/;
const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 100;
const RATE_LIMIT_MAX = 100; // 100 requests per minute

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
          { error: "Invalid symbol format. Must be 1-10 uppercase letters." },
          { status: 400 }
        );
      }

      const data = await loadOHLCVForSymbol(symbol);
      if (data.length === 0) {
        return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
      }

      const metadata = (await loadStockMetadata()).find((s) => s.symbol === symbol) ?? null;
      const slice = limitAll ? data : data.slice(-limit!);
      return NextResponse.json({ symbol, metadata, data: slice, total: data.length });
    }

    const metadata = await loadStockMetadata();

    if (search) {
      const normalized = search.replace(/[^A-Z]/g, "").slice(0, 10);
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
