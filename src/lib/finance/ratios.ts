import type {
  FundamentalAnalysisResult,
  FinancialPeriodStatements,
  RatioPoint,
} from "@/lib/finance/contracts";
import { getCoverage, readNumericByAliases, safeRatio, yoy } from "@/lib/finance/data";

const ALIASES = {
  revenue: ["net_sales", "sales", "revenue"],
  cogs: ["cost_of_sales"],
  netIncome: ["net_profit_for_the_year", "attributable_to_parent_company", "net_profit", "profit_after_tax"],
  currentAssets: ["current_assets"],
  cash: ["cash_and_cash_equivalents", "cash_and_cash_equivalents_at_the_end_of_period", "cash"],
  shortInvestments: ["short_term_investments", "trading_securities"],
  receivables: ["accounts_receivable"],
  inventories: ["net_inventories", "inventories_net"],
  totalAssets: ["total_assets"],
  totalLiabilities: ["liabilities", "total_liabilities"],
  currentLiabilities: ["current_liabilities"],
  longTermLiabilities: ["long_term_liabilities"],
  equity: ["owner_s_equity", "equity", "capital_and_reserves"],
  operatingCashFlow: [
    "net_cash_inflows_outflows_from_operating_activities",
    "net_cash_flows_from_operating_activities_before_bit",
  ],
  capex: ["purchase_of_fixed_assets"],
} as const;

function toPoint(period: string, value: number | null): RatioPoint {
  return { period, value };
}

const BANK_ALIASES = {
  netInterestIncome: ["net_interest_income"],
  totalOperatingRevenue: ["total_operating_revenue"],
  provisionForCreditLosses: ["provision_for_credit_losses"],
  profitBeforeTax: ["profit_before_tax"],
  totalAssets: ["total_assets_bn_vnd", "total_assets"],
  loansToCustomers: ["loans_and_advances_to_customers_net"],
  depositsFromCustomers: ["deposits_from_customers_", "deposits_from_customers"],
} as const;

function isBankingLike(rows: FinancialPeriodStatements[]): boolean {
  if (rows.length === 0) return false;
  const latest = rows[rows.length - 1];
  const bs = latest.bs;
  const income = latest.is;
  const hasLoans = readNumericByAliases(bs, [...BANK_ALIASES.loansToCustomers]) !== null;
  const hasDeposits = readNumericByAliases(bs, [...BANK_ALIASES.depositsFromCustomers]) !== null;
  const hasNetInterest = readNumericByAliases(income, [...BANK_ALIASES.netInterestIncome]) !== null;
  const signals = [hasLoans, hasDeposits, hasNetInterest].filter(Boolean).length;
  return signals >= 2;
}

function nullSeries(rows: FinancialPeriodStatements[]): RatioPoint[] {
  return rows.map((row) => toPoint(row.period, null));
}

function buildBankSummary(rows: FinancialPeriodStatements[]): FundamentalAnalysisResult["bankSummary"] {
  return {
    netInterestIncome: rows.map((row) =>
      toPoint(row.period, readNumericByAliases(row.is, [...BANK_ALIASES.netInterestIncome]))
    ),
    totalOperatingRevenue: rows.map((row) =>
      toPoint(row.period, readNumericByAliases(row.is, [...BANK_ALIASES.totalOperatingRevenue]))
    ),
    provisionForCreditLosses: rows.map((row) =>
      toPoint(row.period, readNumericByAliases(row.is, [...BANK_ALIASES.provisionForCreditLosses]))
    ),
    profitBeforeTax: rows.map((row) =>
      toPoint(row.period, readNumericByAliases(row.is, [...BANK_ALIASES.profitBeforeTax]))
    ),
    totalAssets: rows.map((row) =>
      toPoint(row.period, readNumericByAliases(row.bs, [...BANK_ALIASES.totalAssets]))
    ),
    loansToCustomers: rows.map((row) =>
      toPoint(row.period, readNumericByAliases(row.bs, [...BANK_ALIASES.loansToCustomers]))
    ),
    depositsFromCustomers: rows.map((row) =>
      toPoint(row.period, readNumericByAliases(row.bs, [...BANK_ALIASES.depositsFromCustomers]))
    ),
  };
}

export async function buildFundamentalAnalysis(
  symbol: string,
  rows: FinancialPeriodStatements[]
): Promise<FundamentalAnalysisResult> {
  const warnings: string[] = [];
  const coverage = await getCoverage(symbol, rows);
  if (rows.length === 0) {
    warnings.push("No financial periods available for this symbol.");
  }
  if (coverage.missingStatements.length > 0) {
    warnings.push(`Missing statement segments: ${coverage.missingStatements.length}.`);
  }

  const revenueSeries = rows.map((row) => ({
    period: row.period,
    value: readNumericByAliases(row.is, [...ALIASES.revenue]),
  }));
  const netIncomeSeries = rows.map((row) => ({
    period: row.period,
    value: readNumericByAliases(row.is, [...ALIASES.netIncome]),
  }));

  const bankingLike = isBankingLike(rows);
  if (bankingLike) {
    warnings.push(
      "Banking-like financial structure detected. Generic corporate ratios are suppressed; use bank summary metrics."
    );
    return {
      symbol: symbol.toUpperCase(),
      generatedAt: new Date().toISOString(),
      analysisMode: "banking_degraded",
      context: {
        isBankingLike: true,
        note: "Baseline mode: bank-specific summary is provided while generic ratios are disabled.",
      },
      bankSummary: buildBankSummary(rows),
      incomeStatement: {
        revenue: revenueSeries.map((item) => toPoint(item.period, item.value)),
        netIncome: netIncomeSeries.map((item) => toPoint(item.period, item.value)),
      },
      coverage,
      liquidity: {
        currentRatio: nullSeries(rows),
        quickRatio: nullSeries(rows),
        cashRatio: nullSeries(rows),
      },
      leverage: {
        debtToEquity: nullSeries(rows),
        debtToAssets: nullSeries(rows),
      },
      profitability: {
        netMargin: nullSeries(rows),
        roa: nullSeries(rows),
        roe: nullSeries(rows),
      },
      cashFlowQuality: {
        ocfToNetIncome: nullSeries(rows),
        fcf: nullSeries(rows),
      },
      growth: {
        revenueYoY: nullSeries(rows),
        netIncomeYoY: nullSeries(rows),
      },
      warnings,
    };
  }

  const liquidity = {
    currentRatio: rows.map((row) => {
      const currentAssets = readNumericByAliases(row.bs, [...ALIASES.currentAssets]);
      const currentLiabilities = readNumericByAliases(row.bs, [...ALIASES.currentLiabilities]);
      return toPoint(row.period, safeRatio(currentAssets, currentLiabilities));
    }),
    quickRatio: rows.map((row) => {
      const currentAssets = readNumericByAliases(row.bs, [...ALIASES.currentAssets]);
      const inventories = readNumericByAliases(row.bs, [...ALIASES.inventories]) ?? 0;
      const currentLiabilities = readNumericByAliases(row.bs, [...ALIASES.currentLiabilities]);
      return toPoint(row.period, safeRatio(currentAssets !== null ? currentAssets - inventories : null, currentLiabilities));
    }),
    cashRatio: rows.map((row) => {
      const cash = readNumericByAliases(row.bs, [...ALIASES.cash]) ?? 0;
      const shortInvestments = readNumericByAliases(row.bs, [...ALIASES.shortInvestments]) ?? 0;
      const currentLiabilities = readNumericByAliases(row.bs, [...ALIASES.currentLiabilities]);
      return toPoint(row.period, safeRatio(cash + shortInvestments, currentLiabilities));
    }),
  };

  const leverage = {
    debtToEquity: rows.map((row) => {
      const currentLiabilities = readNumericByAliases(row.bs, [...ALIASES.currentLiabilities]) ?? 0;
      const longTermLiabilities = readNumericByAliases(row.bs, [...ALIASES.longTermLiabilities]) ?? 0;
      const totalDebt = currentLiabilities + longTermLiabilities;
      const equity = readNumericByAliases(row.bs, [...ALIASES.equity]);
      return toPoint(row.period, safeRatio(totalDebt, equity));
    }),
    debtToAssets: rows.map((row) => {
      const totalLiabilities = readNumericByAliases(row.bs, [...ALIASES.totalLiabilities]);
      const totalAssets = readNumericByAliases(row.bs, [...ALIASES.totalAssets]);
      return toPoint(row.period, safeRatio(totalLiabilities, totalAssets));
    }),
  };

  const profitability = {
    netMargin: rows.map((row) => {
      const netIncome = readNumericByAliases(row.is, [...ALIASES.netIncome]);
      const revenue = readNumericByAliases(row.is, [...ALIASES.revenue]);
      return toPoint(row.period, safeRatio(netIncome, revenue));
    }),
    roa: rows.map((row) => {
      const netIncome = readNumericByAliases(row.is, [...ALIASES.netIncome]);
      const totalAssets = readNumericByAliases(row.bs, [...ALIASES.totalAssets]);
      return toPoint(row.period, safeRatio(netIncome, totalAssets));
    }),
    roe: rows.map((row) => {
      const netIncome = readNumericByAliases(row.is, [...ALIASES.netIncome]);
      const equity = readNumericByAliases(row.bs, [...ALIASES.equity]);
      return toPoint(row.period, safeRatio(netIncome, equity));
    }),
  };

  const cashFlowQuality = {
    ocfToNetIncome: rows.map((row) => {
      const ocf = readNumericByAliases(row.cf, [...ALIASES.operatingCashFlow]);
      const netIncome = readNumericByAliases(row.is, [...ALIASES.netIncome]);
      return toPoint(row.period, safeRatio(ocf, netIncome));
    }),
    fcf: rows.map((row) => {
      const ocf = readNumericByAliases(row.cf, [...ALIASES.operatingCashFlow]);
      const capex = readNumericByAliases(row.cf, [...ALIASES.capex]);
      const fcf = ocf !== null ? ocf - Math.abs(capex ?? 0) : null;
      return toPoint(row.period, fcf);
    }),
  };

  const growth = {
    revenueYoY: yoy(revenueSeries),
    netIncomeYoY: yoy(netIncomeSeries),
  };

  return {
    symbol: symbol.toUpperCase(),
    generatedAt: new Date().toISOString(),
    coverage,
    incomeStatement: {
      revenue: revenueSeries.map((item) => toPoint(item.period, item.value)),
      netIncome: netIncomeSeries.map((item) => toPoint(item.period, item.value)),
    },
    liquidity,
    leverage,
    profitability,
    cashFlowQuality,
    growth,
    warnings,
  };
}

export function getLatestValue(points: RatioPoint[]): number | null {
  if (points.length === 0) return null;
  return points[points.length - 1].value;
}
