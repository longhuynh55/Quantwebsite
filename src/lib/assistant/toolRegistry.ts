import type { FinanceAnalysisType } from "@/lib/finance";
import type { StrategyType } from "@/lib/quant/backtest";
import type { AssistantContextSnapshot } from "@/types/assistant";

export const ASSISTANT_EXECUTE_TOOL_NAMES = [
  "finance_analysis",
  "risk_metrics",
  "backtest_run",
  "stock_universe_ranking",
  "valuation_rankings",
  "icb_snapshot",
] as const;

export type AssistantExecuteToolName = (typeof ASSISTANT_EXECUTE_TOOL_NAMES)[number];
export const ASSISTANT_EXECUTE_TOOL_NAME_SET = new Set<AssistantExecuteToolName>(
  ASSISTANT_EXECUTE_TOOL_NAMES
);

export const EXECUTE_RISK_BENCHMARKS = ["VNINDEX", "VN100", "VN30"] as const;
export const EXECUTE_STOCK_RANK_METRICS = ["close", "open", "high", "low", "volume"] as const;
export const EXECUTE_VALUATION_METRICS = ["pe", "pb", "ev_ebitda"] as const;
export const EXECUTE_ORDER_VALUES = ["asc", "desc"] as const;
export const EXECUTE_ICB_LEVELS = ["2", "3", "4"] as const;
export const EXECUTE_MODELS = ["next_open", "same_close"] as const;

export const EXECUTE_RISK_BENCHMARK_SET = new Set<string>(EXECUTE_RISK_BENCHMARKS);
export const EXECUTE_STOCK_RANK_METRIC_SET = new Set<string>(EXECUTE_STOCK_RANK_METRICS);
export const EXECUTE_VALUATION_METRIC_SET = new Set<string>(EXECUTE_VALUATION_METRICS);
export const EXECUTE_ORDER_SET = new Set<string>(EXECUTE_ORDER_VALUES);
export const EXECUTE_ICB_LEVEL_SET = new Set<string>(EXECUTE_ICB_LEVELS);
export const EXECUTE_MODEL_SET = new Set<string>(EXECUTE_MODELS);

export type FinanceAnalysisArgs = {
  symbol: string;
  task: FinanceAnalysisType;
};

export type RiskMetricsArgs = {
  symbol: string;
  benchmark?: "VNINDEX" | "VN100" | "VN30";
};

export type BacktestRunArgs = {
  symbol: string;
  strategy: StrategyType;
  capital?: number;
  params?: Record<string, unknown>;
  executionModel?: "next_open" | "same_close";
  feeBps?: number;
  sellTaxBps?: number;
  slippageBps?: number;
  lotSize?: number;
};

export type StockUniverseRankingArgs = {
  metric?: "close" | "open" | "high" | "low" | "volume";
  order?: "asc" | "desc";
  limit?: number;
  date?: string;
  icb?: string;
  icbLevel?: "2" | "3" | "4";
};

export type ValuationRankingArgs = {
  metric: "pe" | "pb" | "ev_ebitda";
  order?: "asc" | "desc";
  limit?: number;
  date?: string;
  icb?: string;
  icbLevel?: "2" | "3" | "4";
};

export type IcbSnapshotArgs = {
  date?: string;
  limit?: number;
  icb?: string;
  icbLevel?: "2" | "3" | "4";
};

export type AssistantExecuteArgsByTool = {
  finance_analysis: FinanceAnalysisArgs;
  risk_metrics: RiskMetricsArgs;
  backtest_run: BacktestRunArgs;
  stock_universe_ranking: StockUniverseRankingArgs;
  valuation_rankings: ValuationRankingArgs;
  icb_snapshot: IcbSnapshotArgs;
};

export type InternalRequestPlan = {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
};

const CONTEXT_SYMBOL_REGEX = /^[A-Z0-9]{1,10}$/;

function normalizeContextSymbol(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toUpperCase();
  if (!CONTEXT_SYMBOL_REGEX.test(normalized)) return "";
  return normalized;
}

function resolveContextSymbol(context?: AssistantContextSnapshot): string {
  const direct = normalizeContextSymbol(context?.symbol);
  if (direct) return direct;
  if (Array.isArray(context?.symbols)) {
    for (const candidate of context.symbols) {
      const normalized = normalizeContextSymbol(candidate);
      if (normalized) return normalized;
    }
  }
  return "VNM";
}

export function defaultArgsForExecuteTool(
  toolName: AssistantExecuteToolName,
  context?: AssistantContextSnapshot
): Record<string, unknown> {
  const symbol = resolveContextSymbol(context);
  switch (toolName) {
    case "finance_analysis":
      return { symbol, task: "fundamental" };
    case "risk_metrics":
      return { symbol, benchmark: "VNINDEX" };
    case "backtest_run":
      return { symbol, strategy: "sma_crossover", executionModel: "next_open" };
    case "stock_universe_ranking":
      return { metric: "volume", order: "desc", limit: 10 };
    case "valuation_rankings":
      return { metric: "pe", order: "desc", limit: 10 };
    case "icb_snapshot":
      return { limit: 10 };
    default:
      return {};
  }
}

export function buildPlanForExecuteTool(
  toolName: AssistantExecuteToolName,
  args: AssistantExecuteArgsByTool[AssistantExecuteToolName]
): InternalRequestPlan {
  switch (toolName) {
    case "finance_analysis": {
      const typed = args as FinanceAnalysisArgs;
      return {
        method: "GET",
        path: "/api/finance-analysis",
        query: {
          symbol: typed.symbol,
          type: typed.task,
        },
      };
    }
    case "risk_metrics": {
      const typed = args as RiskMetricsArgs;
      return {
        method: "GET",
        path: "/api/risk",
        query: {
          symbol: typed.symbol,
          ...(typed.benchmark ? { benchmark: typed.benchmark } : {}),
        },
      };
    }
    case "backtest_run": {
      const typed = args as BacktestRunArgs;
      return {
        method: "POST",
        path: "/api/backtesting",
        body: {
          symbol: typed.symbol,
          strategy: typed.strategy,
          ...(typed.capital !== undefined ? { capital: typed.capital } : {}),
          ...(typed.params ? { params: typed.params } : {}),
          ...(typed.executionModel ? { executionModel: typed.executionModel } : {}),
          ...(typed.feeBps !== undefined ? { feeBps: typed.feeBps } : {}),
          ...(typed.sellTaxBps !== undefined ? { sellTaxBps: typed.sellTaxBps } : {}),
          ...(typed.slippageBps !== undefined ? { slippageBps: typed.slippageBps } : {}),
          ...(typed.lotSize !== undefined ? { lotSize: typed.lotSize } : {}),
        },
      };
    }
    case "stock_universe_ranking": {
      const typed = args as StockUniverseRankingArgs;
      return {
        method: "GET",
        path: "/api/stocks",
        query: {
          exchange: "HOSE",
          ...(typed.metric ? { metric: typed.metric } : {}),
          ...(typed.order ? { order: typed.order } : {}),
          ...(typed.limit !== undefined ? { limit: String(typed.limit) } : {}),
          ...(typed.date ? { date: typed.date } : {}),
          ...(typed.icb ? { icb: typed.icb } : {}),
          ...(typed.icbLevel ? { icbLevel: typed.icbLevel } : {}),
        },
      };
    }
    case "valuation_rankings": {
      const typed = args as ValuationRankingArgs;
      return {
        method: "GET",
        path: "/api/analytics/valuation-rankings",
        query: {
          exchange: "HOSE",
          metric: typed.metric,
          ...(typed.order ? { order: typed.order } : {}),
          ...(typed.limit !== undefined ? { limit: String(typed.limit) } : {}),
          ...(typed.date ? { date: typed.date } : {}),
          ...(typed.icb ? { icb: typed.icb } : {}),
          ...(typed.icbLevel ? { icbLevel: typed.icbLevel } : {}),
        },
      };
    }
    case "icb_snapshot": {
      const typed = args as IcbSnapshotArgs;
      return {
        method: "GET",
        path: "/api/stocks",
        query: {
          groupBy: "icb",
          exchange: "HOSE",
          ...(typed.date ? { date: typed.date } : {}),
          ...(typed.limit !== undefined ? { limit: String(typed.limit) } : {}),
          ...(typed.icb ? { icb: typed.icb } : {}),
          ...(typed.icbLevel ? { icbLevel: typed.icbLevel } : {}),
        },
      };
    }
    default:
      return {
        method: "GET",
        path: "/api/health",
      };
  }
}
