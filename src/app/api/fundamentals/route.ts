import { NextResponse } from "next/server";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";
import {
  getAvailablePeriods,
  getFundamentalsLoadDiagnostics,
  getFundamentalsSourceFiles,
  getStatementSnapshot,
  resolveLatestPeriod,
  type FundamentalsStatement,
} from "@/lib/fundamentals";

const RATE_LIMIT_MAX = 60;
const VALID_SYMBOL_REGEX = /^[A-Z][A-Z0-9]{0,9}$/;
const VALID_PERIOD_REGEX = /^\d{4}Q[1-4]$/;

type StatementParam = "all" | FundamentalsStatement;
type DataConfidence = "high" | "medium" | "low";
type StatementAvailability = Record<FundamentalsStatement, boolean>;

function parseStatement(raw: string | null): StatementParam | null {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (normalized === "bs" || normalized === "is" || normalized === "cf") return normalized;
  if (normalized === "all" || normalized === "") return "all";
  return null;
}

function parsePeriod(raw: string | null): string | null {
  const period = (raw ?? "latest").trim();
  if (period.toLowerCase() === "latest") return "latest";
  const normalized = period.toUpperCase();
  if (!VALID_PERIOD_REGEX.test(normalized)) return null;
  return normalized;
}

function getRequestedStatements(statement: StatementParam): FundamentalsStatement[] {
  if (statement === "all") return ["bs", "is", "cf"];
  return [statement];
}

function deriveConfidence(
  coverageRatio: number,
  availablePeriodsCount: number,
  warningCount: number
): DataConfidence {
  let score = 0;
  if (coverageRatio >= 1) score += 2;
  else if (coverageRatio >= 0.5) score += 1;

  if (availablePeriodsCount >= 6) score += 1;
  else if (availablePeriodsCount <= 1) score -= 1;

  if (warningCount >= 2) score -= 1;

  if (score >= 3) return "high";
  if (score >= 1) return "medium";
  return "low";
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
  const period = parsePeriod(searchParams.get("period"));

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }
  if (!VALID_SYMBOL_REGEX.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol format. Must be 1-10 uppercase letters or digits." }, { status: 400 });
  }
  if (!statement) {
    return NextResponse.json({ error: 'Invalid statement. Use "all", "bs", "is", or "cf".' }, { status: 400 });
  }
  if (!period) {
    return NextResponse.json({ error: 'Invalid period. Use "latest" or "YYYYQn" (e.g., 2025Q4).' }, { status: 400 });
  }

  try {
    const availablePeriods = await getAvailablePeriods(symbol);
    if (availablePeriods.length === 0) {
      return NextResponse.json({ error: "No fundamentals available for this symbol" }, { status: 404 });
    }

    const resolvedPeriod = period === "latest" ? await resolveLatestPeriod(symbol, statement) : period;
    if (!resolvedPeriod) {
      return NextResponse.json({ error: "No fundamentals period available for this request" }, { status: 404 });
    }

    const [sourceFiles, diagnostics, bsSnapshot, isSnapshot, cfSnapshot] = await Promise.all([
      getFundamentalsSourceFiles(),
      getFundamentalsLoadDiagnostics(),
      getStatementSnapshot(symbol, "bs", resolvedPeriod),
      getStatementSnapshot(symbol, "is", resolvedPeriod),
      getStatementSnapshot(symbol, "cf", resolvedPeriod),
    ]);

    const statementAvailability: StatementAvailability = {
      bs: Boolean(bsSnapshot),
      is: Boolean(isSnapshot),
      cf: Boolean(cfSnapshot),
    };
    const requestedStatements = getRequestedStatements(statement);
    const missingRequestedStatements = requestedStatements.filter((item) => !statementAvailability[item]);
    const coverageRatio =
      requestedStatements.length > 0
        ? (requestedStatements.length - missingRequestedStatements.length) / requestedStatements.length
        : 1;

    const warnings: string[] = [];
    if (missingRequestedStatements.length > 0) {
      warnings.push(
        `Missing requested statements for ${resolvedPeriod}: ${missingRequestedStatements.join(", ")}.`
      );
    }
    if (availablePeriods.length < 4) {
      warnings.push(`Only ${availablePeriods.length} fundamentals period(s) available for this symbol.`);
    }
    for (const requested of requestedStatements) {
      const detail = diagnostics[requested];
      if (!detail) continue;
      if (detail.skippedRows > 0 || detail.duplicatePeriodRows > 0) {
        warnings.push(
          `Data quality notice (${requested}): skipped=${detail.skippedRows}, duplicate_periods=${detail.duplicatePeriodRows}.`
        );
      }
    }

    const confidence = deriveConfidence(coverageRatio, availablePeriods.length, warnings.length);

    const balanceSheet = statement === "all" || statement === "bs" ? bsSnapshot : null;
    const incomeStatement = statement === "all" || statement === "is" ? isSnapshot : null;
    const cashFlow = statement === "all" || statement === "cf" ? cfSnapshot : null;

    return NextResponse.json({
      symbol,
      period: resolvedPeriod,
      availablePeriods,
      balanceSheet,
      incomeStatement,
      cashFlow,
      coverage: {
        requestedStatements,
        missingRequestedStatements,
        statementAvailability,
        availablePeriodsCount: availablePeriods.length,
        coverageRatio,
      },
      confidence,
      warnings,
      meta: {
        sourceFiles,
        diagnostics,
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
