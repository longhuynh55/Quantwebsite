import { NextResponse } from "next/server";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";
import {
  getAvailablePeriods,
  getFundamentalsSourceFiles,
  getStatementSnapshot,
  resolveLatestPeriod,
  type FundamentalsStatement,
} from "@/lib/fundamentals";

const RATE_LIMIT_MAX = 60;
const VALID_SYMBOL_REGEX = /^[A-Z]{1,10}$/;
const VALID_PERIOD_REGEX = /^\d{4}Q[1-4]$/;

type StatementParam = "all" | FundamentalsStatement;

function parseStatement(raw: string | null): StatementParam {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (normalized === "bs" || normalized === "is" || normalized === "cf") return normalized;
  if (normalized === "all" || normalized === "") return "all";
  return "all";
}

export async function GET(request: Request) {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/fundamentals", clientId), RATE_LIMIT_MAX, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const statement = parseStatement(searchParams.get("statement"));
  const periodRaw = (searchParams.get("period") ?? "latest").trim();

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }
  if (!VALID_SYMBOL_REGEX.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol format. Must be 1-10 uppercase letters." }, { status: 400 });
  }
  if (periodRaw.toLowerCase() !== "latest" && !VALID_PERIOD_REGEX.test(periodRaw)) {
    return NextResponse.json({ error: 'Invalid period. Use "latest" or "YYYYQn" (e.g., 2025Q4).' }, { status: 400 });
  }

  try {
    const availablePeriods = await getAvailablePeriods(symbol);
    if (availablePeriods.length === 0) {
      return NextResponse.json({ error: "No fundamentals available for this symbol" }, { status: 404 });
    }

    const resolvedPeriod =
      periodRaw.toLowerCase() === "latest"
        ? await resolveLatestPeriod(symbol, statement)
        : periodRaw;
    if (!resolvedPeriod) {
      return NextResponse.json({ error: "No fundamentals period available for this request" }, { status: 404 });
    }

    const [sourceFiles, balanceSheet, incomeStatement, cashFlow] = await Promise.all([
      getFundamentalsSourceFiles(),
      statement === "all" || statement === "bs" ? getStatementSnapshot(symbol, "bs", resolvedPeriod) : Promise.resolve(null),
      statement === "all" || statement === "is" ? getStatementSnapshot(symbol, "is", resolvedPeriod) : Promise.resolve(null),
      statement === "all" || statement === "cf" ? getStatementSnapshot(symbol, "cf", resolvedPeriod) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      symbol,
      period: resolvedPeriod,
      availablePeriods,
      balanceSheet,
      incomeStatement,
      cashFlow,
      meta: {
        sourceFiles,
        fieldNotes: "Keys are normalized from CSV headers; values are number|null|string.",
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    const message = error instanceof Error ? error.message : "Failed to load fundamentals";
    // Missing file / dataset -> service unavailable
    if (String(message).toLowerCase().includes("file not found")) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to load fundamentals" }, { status: 500 });
  }
}
