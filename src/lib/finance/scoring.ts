import type { FinancialHealthResult, FundamentalAnalysisResult } from "@/lib/finance/contracts";
import { getLatestValue } from "@/lib/finance/ratios";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ratioScore(value: number | null, thresholds: { low: number; high: number; inverse?: boolean }): number {
  if (value === null) return 35;
  const normalized = (value - thresholds.low) / (thresholds.high - thresholds.low);
  const raw = thresholds.inverse ? 1 - normalized : normalized;
  return Math.round(clamp(raw, 0, 1) * 100);
}

export function buildFinancialHealthScore(input: FundamentalAnalysisResult): FinancialHealthResult {
  if (input.context?.isBankingLike || input.analysisMode === "banking_degraded") {
    return {
      symbol: input.symbol,
      score: 50,
      rating: "fair",
      components: [
        {
          name: "Banking Model Detected",
          score: 50,
          weight: 1,
          note:
            input.context?.note ??
            "Generic financial health scoring is suppressed for banking-like statements in baseline mode.",
        },
      ],
      warnings: [
        ...input.warnings,
        "Health score is baseline-only for banking symbols. Use bank-specific KPIs (CAR, NIM, NPL, CASA) for decisions.",
      ],
    };
  }

  const currentRatio = getLatestValue(input.liquidity.currentRatio);
  const debtToEquity = getLatestValue(input.leverage.debtToEquity);
  const netMargin = getLatestValue(input.profitability.netMargin);
  const ocfToNetIncome = getLatestValue(input.cashFlowQuality.ocfToNetIncome);
  const revenueYoY = getLatestValue(input.growth.revenueYoY);

  const components = [
    {
      name: "Liquidity",
      weight: 0.2,
      score: ratioScore(currentRatio, { low: 0.8, high: 2.0 }),
      note: "Current ratio trend and latest level.",
    },
    {
      name: "Leverage",
      weight: 0.25,
      score: ratioScore(debtToEquity, { low: 0.2, high: 2.2, inverse: true }),
      note: "Lower debt-to-equity improves score.",
    },
    {
      name: "Profitability",
      weight: 0.2,
      score: ratioScore(netMargin, { low: 0.02, high: 0.2 }),
      note: "Higher net margin improves score.",
    },
    {
      name: "Cash Quality",
      weight: 0.2,
      score: ratioScore(ocfToNetIncome, { low: 0.5, high: 1.2 }),
      note: "Operating cash support for accounting profit.",
    },
    {
      name: "Growth",
      weight: 0.15,
      score: ratioScore(revenueYoY, { low: -0.05, high: 0.2 }),
      note: "Recent revenue YoY growth momentum.",
    },
  ];

  const weighted = components.reduce((acc, item) => acc + item.score * item.weight, 0);
  const score = Math.round(clamp(weighted, 0, 100));
  const rating: FinancialHealthResult["rating"] =
    score >= 80 ? "excellent" : score >= 65 ? "good" : score >= 45 ? "fair" : "weak";

  return {
    symbol: input.symbol,
    score,
    rating,
    components,
    warnings: input.warnings,
  };
}
