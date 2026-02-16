import { NextResponse } from "next/server";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";
import {
  buildDcfValuation,
  buildFinancialHealthScore,
  buildFundamentalAnalysis,
  buildPeerMultiples,
  buildSensitivityMatrix,
  loadFinancialPeriods,
  type FinanceAnalysisType,
} from "@/lib/finance";
import { getCoverage } from "@/lib/finance/data";

const VALID_SYMBOL_REGEX = /^[A-Z0-9]{1,10}$/;
const RATE_LIMIT_MAX = 45;

const TYPE_SET = new Set<FinanceAnalysisType>([
  "fundamental",
  "health",
  "valuation",
  "peer",
  "sensitivity",
]);
type DataConfidence = "high" | "medium" | "low";

function parseType(raw: string | null): FinanceAnalysisType | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "") return "fundamental";
  if (TYPE_SET.has(value as FinanceAnalysisType)) return value as FinanceAnalysisType;
  return null;
}

function buildCitations(symbol: string, type: FinanceAnalysisType) {
  return [
    {
      id: `finance-${type}-${symbol}`,
      sourceType: "dataset" as const,
      title: `Finance ${type} analysis (${symbol})`,
      endpoint: `/api/finance-analysis?symbol=${encodeURIComponent(symbol)}&type=${type}`,
      symbol,
      note: "Computed from local datasets in DATA_DIR / data folder.",
      timestamp: new Date().toISOString(),
      confidence: 0.97,
    },
  ];
}

function extractWarnings(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const maybeWarnings = (value as { warnings?: unknown }).warnings;
  if (!Array.isArray(maybeWarnings)) return [];
  return maybeWarnings.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function dedupeWarnings(warnings: string[]): string[] {
  return Array.from(new Set(warnings.map((item) => item.trim()).filter(Boolean)));
}

function deriveConfidence(
  selectedPeriodsCount: number,
  coverageRatio: number,
  warningCount: number
): DataConfidence {
  let score = 0;
  if (coverageRatio >= 0.9) score += 2;
  else if (coverageRatio >= 0.6) score += 1;

  if (selectedPeriodsCount >= 6) score += 1;
  else if (selectedPeriodsCount <= 1) score -= 1;

  if (warningCount >= 2) score -= 1;

  if (score >= 3) return "high";
  if (score >= 1) return "medium";
  return "low";
}

export async function GET(request: Request) {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/finance-analysis", clientId), RATE_LIMIT_MAX, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const type = parseType(searchParams.get("type"));

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }
  if (!VALID_SYMBOL_REGEX.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol format. Must be 1-10 uppercase letters or digits." }, { status: 400 });
  }
  if (!type) {
    return NextResponse.json(
      { error: 'Invalid type. Use "fundamental", "health", "valuation", "peer", or "sensitivity".' },
      { status: 400 }
    );
  }

  try {
    const rows = await loadFinancialPeriods(symbol, 8);
    if (rows.length === 0) {
      return NextResponse.json({ error: "No financial data available for this symbol" }, { status: 404 });
    }
    const coverage = await getCoverage(symbol, rows);
    const totalStatementSlots = coverage.selectedPeriods.length * 3;
    const coverageRatio =
      totalStatementSlots > 0
        ? (totalStatementSlots - coverage.missingStatements.length) / totalStatementSlots
        : 0;
    const coverageWarnings: string[] = [];
    if (coverage.missingStatements.length > 0) {
      coverageWarnings.push(
        `Missing statement segments in selected periods: ${coverage.missingStatements.length}.`
      );
    }
    if (coverage.selectedPeriods.length < 4) {
      coverageWarnings.push(`Only ${coverage.selectedPeriods.length} period(s) available for analysis.`);
    }

    if (type === "fundamental") {
      const data = await buildFundamentalAnalysis(symbol, rows);
      const warnings = dedupeWarnings([...coverageWarnings, ...extractWarnings(data)]);
      const confidence =
        data.analysisMode === "banking_degraded"
          ? "low"
          : deriveConfidence(coverage.selectedPeriods.length, coverageRatio, warnings.length);
      return NextResponse.json({
        symbol,
        type,
        data,
        coverage: {
          ...coverage,
          coverageRatio,
        },
        confidence,
        warnings,
        citations: buildCitations(symbol, type),
      });
    }

    if (type === "health") {
      const fundamental = await buildFundamentalAnalysis(symbol, rows);
      const data = buildFinancialHealthScore(fundamental);
      const warnings = dedupeWarnings([...coverageWarnings, ...extractWarnings(data)]);
      const confidence =
        fundamental.analysisMode === "banking_degraded"
          ? "low"
          : deriveConfidence(coverage.selectedPeriods.length, coverageRatio, warnings.length);
      return NextResponse.json({
        symbol,
        type,
        data,
        coverage: {
          ...coverage,
          coverageRatio,
        },
        confidence,
        warnings,
        citations: buildCitations(symbol, type),
      });
    }

    if (type === "valuation") {
      const data = await buildDcfValuation(symbol);
      const warnings = dedupeWarnings([...coverageWarnings, ...extractWarnings(data)]);
      const confidence = deriveConfidence(coverage.selectedPeriods.length, coverageRatio, warnings.length);
      return NextResponse.json({
        symbol,
        type,
        data,
        coverage: {
          ...coverage,
          coverageRatio,
        },
        confidence,
        warnings,
        citations: buildCitations(symbol, type),
      });
    }

    if (type === "peer") {
      const data = await buildPeerMultiples(symbol);
      const warnings = dedupeWarnings([...coverageWarnings, ...extractWarnings(data)]);
      const confidence = deriveConfidence(coverage.selectedPeriods.length, coverageRatio, warnings.length);
      return NextResponse.json({
        symbol,
        type,
        data,
        coverage: {
          ...coverage,
          coverageRatio,
        },
        confidence,
        warnings,
        citations: buildCitations(symbol, type),
      });
    }

    const data = await buildSensitivityMatrix(symbol);
    const warnings = dedupeWarnings([...coverageWarnings, ...extractWarnings(data)]);
    const confidence = deriveConfidence(coverage.selectedPeriods.length, coverageRatio, warnings.length);
    return NextResponse.json({
      symbol,
      type,
      data,
      coverage: {
        ...coverage,
        coverageRatio,
      },
      confidence,
      warnings,
      citations: buildCitations(symbol, type),
    });
  } catch (error) {
    console.error("Finance analysis API error:", error);
    const message = error instanceof Error ? error.message : "Failed to run finance analysis";
    if (String(message).toLowerCase().includes("file not found")) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to run finance analysis" }, { status: 500 });
  }
}
