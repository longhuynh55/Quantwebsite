import { NextResponse } from "next/server";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";
import {
  buildValuationRankings,
  parseFlexibleDate,
  parseIcbLevel,
  parsePositiveLimit,
  parseRankingOrder,
  parseValuationMetric,
} from "@/lib/analytics/universe";
import { toDateKey } from "@/lib/dataPolicy";

const RATE_LIMIT_MAX = 45;

function parseExchange(raw: string | null): string | null {
  const value = String(raw ?? "HOSE").trim().toUpperCase();
  if (!value) return "HOSE";
  if (!/^[A-Z0-9]{2,12}$/.test(value)) return null;
  return value;
}

function deriveConfidence(input: {
  eligibleRanked: number;
  pricedCandidates: number;
}): "high" | "medium" | "low" {
  if (input.eligibleRanked <= 0) return "low";
  const ratio = input.pricedCandidates > 0 ? input.eligibleRanked / input.pricedCandidates : 0;
  if (ratio >= 0.8) return "high";
  if (ratio >= 0.45) return "medium";
  return "low";
}

export async function GET(request: Request) {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/analytics/valuation-rankings", clientId), RATE_LIMIT_MAX, 60000);
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
  const metric = parseValuationMetric(searchParams.get("metric"));
  const order = parseRankingOrder(searchParams.get("order"));
  const limit = parsePositiveLimit(searchParams.get("limit"));
  const icbFilter = searchParams.get("icb")?.trim() ?? "";
  const parsedDate = dateRaw ? parseFlexibleDate(dateRaw) : null;

  if (!exchange) {
    return NextResponse.json({ error: "Invalid exchange format." }, { status: 400 });
  }
  if (!icbLevel) {
    return NextResponse.json({ error: 'Invalid icbLevel. Use "2", "3", or "4".' }, { status: 400 });
  }
  if (!metric) {
    return NextResponse.json({ error: 'Invalid metric. Use "pe", "pb", or "ev_ebitda".' }, { status: 400 });
  }
  if (!order) {
    return NextResponse.json({ error: 'Invalid order. Use "desc" or "asc".' }, { status: 400 });
  }
  if (limit === null) {
    return NextResponse.json({ error: 'Invalid limit. Use a positive integer or omit it.' }, { status: 400 });
  }
  if (dateRaw && !parsedDate) {
    return NextResponse.json({ error: 'Invalid date. Use "YYYY-MM-DD" or "DD/MM/YYYY".' }, { status: 400 });
  }

  try {
    const result = await buildValuationRankings({
      asOfDateKey: parsedDate ? toDateKey(parsedDate) : undefined,
      requestedDate: dateRaw || undefined,
      exchange,
      icbLevel,
      icbFilter: icbFilter || undefined,
      metric,
      order,
      limit,
    });

    return NextResponse.json({
      ...result,
      confidence: deriveConfidence(result),
      citations: [
        {
          id: `valuation-ranking-${result.metric}-${result.asOfDate}`,
          sourceType: "dataset",
          title: `HOSE valuation ranking (${result.metric})`,
          endpoint:
            `/api/analytics/valuation-rankings?exchange=${encodeURIComponent(exchange)}`
            + `${dateRaw ? `&date=${encodeURIComponent(dateRaw)}` : ""}`
            + `&metric=${encodeURIComponent(result.metric)}`
            + `&order=${encodeURIComponent(result.order)}`
            + `&icbLevel=${encodeURIComponent(result.icbLevel ?? icbLevel)}`
            + `${icbFilter ? `&icb=${encodeURIComponent(icbFilter)}` : ""}`,
          timestamp: new Date().toISOString(),
          confidence: 0.95,
          note: "Computed from local HOSE OHLCV + fundamentals datasets.",
        },
      ],
    });
  } catch (error) {
    console.error("Valuation rankings API error:", error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("DATASET_UNAVAILABLE:")) {
      const [, dataset, reason] = message.split(":");
      return NextResponse.json(
        {
          error: "Valuation ranking data source unavailable.",
          dataset,
          dataFailureReason: reason ?? "read_failure",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Failed to build valuation rankings" }, { status: 500 });
  }
}
