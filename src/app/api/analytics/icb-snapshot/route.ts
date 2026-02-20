import { NextResponse } from "next/server";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";
import { buildIcbSnapshot, parseFlexibleDate, parseIcbLevel, parsePositiveLimit } from "@/lib/analytics/universe";
import { toDateKey } from "@/lib/dataPolicy";

const RATE_LIMIT_MAX = 60;

function parseExchange(raw: string | null): string | null {
  const value = String(raw ?? "HOSE").trim().toUpperCase();
  if (!value) return "HOSE";
  if (!/^[A-Z0-9]{2,12}$/.test(value)) return null;
  return value;
}

function deriveConfidence(input: {
  pricedSymbols: number;
  exactDateMatchCount: number;
}): "high" | "medium" | "low" {
  if (input.pricedSymbols <= 0) return "low";
  const ratio = input.exactDateMatchCount / input.pricedSymbols;
  if (ratio >= 0.9) return "high";
  if (ratio >= 0.6) return "medium";
  return "low";
}

export async function GET(request: Request) {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/analytics/icb-snapshot", clientId), RATE_LIMIT_MAX, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const dateRaw = searchParams.get("date")?.trim() ?? "";
  const exchange = parseExchange(searchParams.get("exchange"));
  const icbLevel = parseIcbLevel(searchParams.get("icbLevel"));
  const limitRaw = searchParams.get("limit");
  const limitAll = String(limitRaw ?? "").trim().toLowerCase() === "all";
  const limit = limitAll ? 0 : parsePositiveLimit(limitRaw);
  const icbFilter = searchParams.get("icb")?.trim() ?? "";
  const parsedDate = dateRaw ? parseFlexibleDate(dateRaw) : null;

  if (!exchange) {
    return NextResponse.json({ error: "Invalid exchange format." }, { status: 400 });
  }
  if (exchange !== "HOSE") {
    return NextResponse.json(
      {
        error: "Unsupported exchange. Only HOSE is supported for this endpoint.",
        requestedExchange: exchange,
      },
      { status: 400 }
    );
  }
  if (!icbLevel) {
    return NextResponse.json({ error: 'Invalid icbLevel. Use "2", "3", or "4".' }, { status: 400 });
  }
  if (limit === null) {
    return NextResponse.json({ error: 'Invalid limit. Use a positive integer, "all", or omit it.' }, { status: 400 });
  }
  if (dateRaw && !parsedDate) {
    return NextResponse.json({ error: 'Invalid date. Use "YYYY-MM-DD" or "DD/MM/YYYY".' }, { status: 400 });
  }

  try {
    const result = await buildIcbSnapshot({
      asOfDateKey: parsedDate ? toDateKey(parsedDate) : undefined,
      requestedDate: dateRaw || undefined,
      exchange,
      icbLevel,
      icbFilter: icbFilter || undefined,
      limit,
    });

    return NextResponse.json({
      ...result,
      confidence: deriveConfidence(result),
      citations: [
        {
          id: `icb-snapshot-${result.asOfDate}`,
          sourceType: "dataset",
          title: "HOSE ICB snapshot",
          endpoint:
            `/api/analytics/icb-snapshot?exchange=${encodeURIComponent(exchange)}`
            + `${dateRaw ? `&date=${encodeURIComponent(dateRaw)}` : ""}`
            + `&icbLevel=${encodeURIComponent(icbLevel)}`
            + `${icbFilter ? `&icb=${encodeURIComponent(icbFilter)}` : ""}`,
          timestamp: new Date().toISOString(),
          confidence: 0.96,
          note: "Computed from local HOSE OHLCV + metadata datasets.",
        },
      ],
    });
  } catch (error) {
    console.error("ICB snapshot API error:", error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("DATASET_UNAVAILABLE:")) {
      const [, dataset, reason] = message.split(":");
      return NextResponse.json(
        {
          error: "ICB snapshot data source unavailable.",
          dataset,
          dataFailureReason: reason ?? "read_failure",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Failed to build ICB snapshot" }, { status: 500 });
  }
}
