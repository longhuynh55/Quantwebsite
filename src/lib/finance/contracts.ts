import type { FundamentalsStatement, FundamentalsValue } from "@/lib/fundamentals";

export type FinanceAnalysisType =
  | "fundamental"
  | "health"
  | "valuation"
  | "peer"
  | "sensitivity";

export interface FinancialPeriodStatements {
  period: string;
  bs: Record<string, FundamentalsValue> | null;
  is: Record<string, FundamentalsValue> | null;
  cf: Record<string, FundamentalsValue> | null;
}

export interface FinanceCoverage {
  symbol: string;
  periodsAvailable: string[];
  selectedPeriods: string[];
  missingStatements: Array<{ period: string; statement: FundamentalsStatement }>;
}

export interface RatioPoint {
  period: string;
  value: number | null;
}

export interface FundamentalAnalysisResult {
  symbol: string;
  generatedAt: string;
  coverage: FinanceCoverage;
  analysisMode?: "generic" | "banking_degraded";
  context?: {
    isBankingLike?: boolean;
    note?: string;
  };
  bankSummary?: {
    netInterestIncome: RatioPoint[];
    totalOperatingRevenue: RatioPoint[];
    provisionForCreditLosses: RatioPoint[];
    profitBeforeTax: RatioPoint[];
    totalAssets: RatioPoint[];
    loansToCustomers: RatioPoint[];
    depositsFromCustomers: RatioPoint[];
  };
  incomeStatement: {
    revenue: RatioPoint[];
    netIncome: RatioPoint[];
  };
  liquidity: {
    currentRatio: RatioPoint[];
    quickRatio: RatioPoint[];
    cashRatio: RatioPoint[];
  };
  leverage: {
    debtToEquity: RatioPoint[];
    debtToAssets: RatioPoint[];
  };
  profitability: {
    netMargin: RatioPoint[];
    roa: RatioPoint[];
    roe: RatioPoint[];
  };
  cashFlowQuality: {
    ocfToNetIncome: RatioPoint[];
    fcf: RatioPoint[];
  };
  growth: {
    revenueYoY: RatioPoint[];
    netIncomeYoY: RatioPoint[];
  };
  warnings: string[];
}

export interface FinancialHealthResult {
  symbol: string;
  score: number;
  rating: "excellent" | "good" | "fair" | "weak";
  components: Array<{ name: string; score: number; weight: number; note: string }>;
  warnings: string[];
}

export interface DcfAssumptions {
  forecastYears: number;
  revenueGrowth: number;
  fcfMargin: number;
  wacc: number;
  terminalGrowth: number;
  netDebt: number;
  sharesOutstanding: number;
}

export interface DcfProjectionPoint {
  year: number;
  revenue: number;
  fcf: number;
  discountFactor: number;
  discountedFcf: number;
}

export interface DcfResult {
  symbol: string;
  asOfPeriod: string;
  assumptions: DcfAssumptions;
  historical: {
    revenue: Array<{ period: string; value: number }>;
    fcf: Array<{ period: string; value: number }>;
  };
  projections: DcfProjectionPoint[];
  terminalValue: number;
  enterpriseValue: number;
  equityValue: number;
  fairValuePerShare: number;
  currentPrice: number | null;
  upsideDownsidePct: number | null;
  warnings: string[];
}

export interface SensitivityCell {
  wacc: number;
  terminalGrowth: number;
  fairValuePerShare: number;
}

export interface SensitivityResult {
  symbol: string;
  asOfPeriod: string;
  baseFairValuePerShare: number;
  cells: SensitivityCell[];
}

export interface PeerMultiplesRow {
  symbol: string;
  price: number | null;
  marketCapApprox: number | null;
  pe: number | null;
  pb: number | null;
}

export interface PeerMultiplesResult {
  symbol: string;
  peers: PeerMultiplesRow[];
  medianPe: number | null;
  medianPb: number | null;
  warnings: string[];
}
