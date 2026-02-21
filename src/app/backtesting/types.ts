export interface BacktestMetrics {
  totalReturn: number;
  netReturn: number;
  grossReturn: number;
  cagr: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  avgReturn: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  sortinoRatio: number;
  maxDrawdownDuration: number;
  turnover: number;
  exposureRatio: number;
}

export interface BacktestResult {
  symbol: string;
  strategy: string;
  initialCapital: number;
  metrics: BacktestMetrics;
  equityCurve: { date: Date; equity: number }[];
  configApplied: {
    executionModel: "next_open" | "same_close";
    costs: { feeBps: number; sellTaxBps: number; slippageBps: number };
    positionSizing: { mode: "all_in"; lotSize: number };
  };
  diagnostics: {
    coverageRatio: number;
    largestGapDays: number;
    droppedRows: number;
    usableRows: number;
    warnings: string[];
  };
  trades?: import("@/lib/quant/backtest").Trade[];
}

export interface EquityPointApi {
  date: string;
  equity: number;
}

export interface StrategyConfig extends Record<string, string | number | boolean> {
  executionModel: "next_open" | "same_close";
  feeBps: string;
  sellTaxBps: string;
  slippageBps: string;
  lotSize: string;
}

export interface AdvancedConfigPreset {
  key: "low_cost" | "realistic" | "stress";
  label: string;
  executionModel: "next_open" | "same_close";
  feeBps: string;
  sellTaxBps: string;
  slippageBps: string;
  lotSize: string;
}

export interface StrategyOption {
  value: string;
  label: string;
}
