import type { FinanceAnalysisType } from "@/lib/finance";
import { STRATEGY_TYPES, type StrategyType } from "@/lib/quant/backtest";
import {
  ASSISTANT_EXECUTE_TOOL_NAME_SET,
  buildPlanForExecuteTool,
  EXECUTE_ICB_LEVEL_SET,
  EXECUTE_MODEL_SET,
  EXECUTE_ORDER_SET,
  EXECUTE_RISK_BENCHMARK_SET,
  EXECUTE_STOCK_RANK_METRIC_SET,
  EXECUTE_VALUATION_METRIC_SET,
  type AssistantExecuteArgsByTool,
  type AssistantExecuteToolName,
  type BacktestRunArgs,
  type FinanceAnalysisArgs,
  type IcbSnapshotArgs,
  type InternalRequestPlan,
  type RiskMetricsArgs,
  type StockUniverseRankingArgs,
  type ValuationRankingArgs,
} from "@/lib/assistant/toolRegistry";

const VALID_SYMBOL_REGEX = /^[A-Z0-9]{1,10}$/;
const VALID_FINANCE_TASKS = new Set<FinanceAnalysisType>([
  "fundamental",
  "health",
  "valuation",
  "peer",
  "sensitivity",
]);

type ExecuteBody = {
  toolName?: unknown;
  arguments?: unknown;
  approvalToken?: unknown;
  symbol?: unknown;
  task?: unknown;
};
export type { AssistantExecuteToolName, AssistantExecuteArgsByTool };

export type AssistantExecuteValidationSuccess = {
  ok: true;
  approvalToken: string;
  toolName: AssistantExecuteToolName;
  args: AssistantExecuteArgsByTool[AssistantExecuteToolName];
};

export type AssistantExecuteValidationFailure = {
  ok: false;
  status: number;
  error: string;
};

export type AssistantExecuteValidationResult =
  | AssistantExecuteValidationSuccess
  | AssistantExecuteValidationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(input: Record<string, unknown>, allowedKeys: string[]): boolean {
  return Object.keys(input).every((key) => allowedKeys.includes(key));
}

function normalizeSymbol(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!VALID_SYMBOL_REGEX.test(normalized)) return null;
  return normalized;
}

function normalizeOptionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

function normalizeOptionalPositiveInteger(value: unknown, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  const integer = Math.trunc(parsed);
  if (integer > max) return undefined;
  return integer;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function parseLegacyToolNameAndArgs(body: ExecuteBody): {
  toolName: AssistantExecuteToolName;
  args: Record<string, unknown>;
} | null {
  const symbol = normalizeSymbol(body.symbol);
  const taskRaw = typeof body.task === "string" ? body.task.trim().toLowerCase() : "";
  if (!symbol || !taskRaw) return null;
  if (!VALID_FINANCE_TASKS.has(taskRaw as FinanceAnalysisType)) return null;
  return {
    toolName: "finance_analysis",
    args: {
      symbol,
      task: taskRaw,
    },
  };
}

function validateFinanceAnalysisArgs(raw: unknown): FinanceAnalysisArgs | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, ["symbol", "task"])) return null;
  const symbol = normalizeSymbol(raw.symbol);
  const taskRaw = typeof raw.task === "string" ? raw.task.trim().toLowerCase() : "";
  if (!symbol || !VALID_FINANCE_TASKS.has(taskRaw as FinanceAnalysisType)) return null;
  return {
    symbol,
    task: taskRaw as FinanceAnalysisType,
  };
}

function validateRiskArgs(raw: unknown): RiskMetricsArgs | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, ["symbol", "benchmark"])) return null;
  const symbol = normalizeSymbol(raw.symbol);
  if (!symbol) return null;
  const benchmarkRaw = typeof raw.benchmark === "string" ? raw.benchmark.trim().toUpperCase() : "";
  if (!benchmarkRaw) {
    return { symbol };
  }
  if (!EXECUTE_RISK_BENCHMARK_SET.has(benchmarkRaw)) return null;
  return { symbol, benchmark: benchmarkRaw as RiskMetricsArgs["benchmark"] };
}

function validateBacktestArgs(raw: unknown): BacktestRunArgs | null {
  const allowedKeys = [
    "symbol",
    "strategy",
    "capital",
    "params",
    "executionModel",
    "feeBps",
    "sellTaxBps",
    "slippageBps",
    "lotSize",
  ];
  if (!isRecord(raw) || !hasOnlyKeys(raw, allowedKeys)) return null;
  const symbol = normalizeSymbol(raw.symbol);
  const strategyRaw = typeof raw.strategy === "string" ? raw.strategy.trim() : "";
  if (!symbol || !STRATEGY_TYPES.includes(strategyRaw as StrategyType)) return null;
  const capital = normalizeOptionalNumber(raw.capital);
  if (raw.capital !== undefined && capital === undefined) return null;
  const params = isRecord(raw.params) ? raw.params : undefined;

  const result: BacktestRunArgs = {
    symbol,
    strategy: strategyRaw as StrategyType,
  };
  if (capital !== undefined) result.capital = capital;
  if (params) result.params = params;

  const executionModelRaw = typeof raw.executionModel === "string" ? raw.executionModel.trim().toLowerCase() : "";
  if (raw.executionModel !== undefined) {
    if (!executionModelRaw || !EXECUTE_MODEL_SET.has(executionModelRaw)) return null;
    result.executionModel = executionModelRaw as BacktestRunArgs["executionModel"];
  }

  const feeBps = normalizeOptionalNumber(raw.feeBps);
  if (raw.feeBps !== undefined && feeBps === undefined) return null;
  if (feeBps !== undefined) result.feeBps = feeBps;

  const sellTaxBps = normalizeOptionalNumber(raw.sellTaxBps);
  if (raw.sellTaxBps !== undefined && sellTaxBps === undefined) return null;
  if (sellTaxBps !== undefined) result.sellTaxBps = sellTaxBps;

  const slippageBps = normalizeOptionalNumber(raw.slippageBps);
  if (raw.slippageBps !== undefined && slippageBps === undefined) return null;
  if (slippageBps !== undefined) result.slippageBps = slippageBps;

  const lotSize = normalizeOptionalNumber(raw.lotSize);
  if (raw.lotSize !== undefined && lotSize === undefined) return null;
  if (lotSize !== undefined) result.lotSize = lotSize;

  return result;
}

function validateStockUniverseRankingArgs(raw: unknown): StockUniverseRankingArgs | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, ["metric", "order", "limit", "date", "icb", "icbLevel"])) return null;
  const metricRaw = typeof raw.metric === "string" ? raw.metric.trim().toLowerCase() : "";
  if (metricRaw && !EXECUTE_STOCK_RANK_METRIC_SET.has(metricRaw)) return null;
  const orderRaw = typeof raw.order === "string" ? raw.order.trim().toLowerCase() : "";
  if (orderRaw && !EXECUTE_ORDER_SET.has(orderRaw)) return null;
  const limit = normalizeOptionalPositiveInteger(raw.limit, 1000);
  if (raw.limit !== undefined && limit === undefined) return null;
  const date = normalizeOptionalText(raw.date, 20);
  if (raw.date !== undefined && !date) return null;
  const icb = normalizeOptionalText(raw.icb, 60);
  if (raw.icb !== undefined && !icb) return null;
  const icbLevelRaw = typeof raw.icbLevel === "string" ? raw.icbLevel.trim() : "";
  if (icbLevelRaw && !EXECUTE_ICB_LEVEL_SET.has(icbLevelRaw)) return null;

  return {
    ...(metricRaw ? { metric: metricRaw as StockUniverseRankingArgs["metric"] } : {}),
    ...(orderRaw ? { order: orderRaw as StockUniverseRankingArgs["order"] } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(date ? { date } : {}),
    ...(icb ? { icb } : {}),
    ...(icbLevelRaw ? { icbLevel: icbLevelRaw as StockUniverseRankingArgs["icbLevel"] } : {}),
  };
}

function validateValuationRankingArgs(raw: unknown): ValuationRankingArgs | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, ["metric", "order", "limit", "date", "icb", "icbLevel"])) return null;
  const metricRaw = typeof raw.metric === "string" ? raw.metric.trim().toLowerCase() : "";
  if (!EXECUTE_VALUATION_METRIC_SET.has(metricRaw)) return null;
  const orderRaw = typeof raw.order === "string" ? raw.order.trim().toLowerCase() : "";
  if (orderRaw && !EXECUTE_ORDER_SET.has(orderRaw)) return null;
  const limit = normalizeOptionalPositiveInteger(raw.limit, 1000);
  if (raw.limit !== undefined && limit === undefined) return null;
  const date = normalizeOptionalText(raw.date, 20);
  if (raw.date !== undefined && !date) return null;
  const icb = normalizeOptionalText(raw.icb, 60);
  if (raw.icb !== undefined && !icb) return null;
  const icbLevelRaw = typeof raw.icbLevel === "string" ? raw.icbLevel.trim() : "";
  if (icbLevelRaw && !EXECUTE_ICB_LEVEL_SET.has(icbLevelRaw)) return null;

  return {
    metric: metricRaw as ValuationRankingArgs["metric"],
    ...(orderRaw ? { order: orderRaw as ValuationRankingArgs["order"] } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(date ? { date } : {}),
    ...(icb ? { icb } : {}),
    ...(icbLevelRaw ? { icbLevel: icbLevelRaw as ValuationRankingArgs["icbLevel"] } : {}),
  };
}

function validateIcbSnapshotArgs(raw: unknown): IcbSnapshotArgs | null {
  if (!isRecord(raw) || !hasOnlyKeys(raw, ["date", "limit", "icb", "icbLevel"])) return null;
  const date = normalizeOptionalText(raw.date, 20);
  if (raw.date !== undefined && !date) return null;
  const limit = normalizeOptionalPositiveInteger(raw.limit, 1000);
  if (raw.limit !== undefined && limit === undefined) return null;
  const icb = normalizeOptionalText(raw.icb, 60);
  if (raw.icb !== undefined && !icb) return null;
  const icbLevelRaw = typeof raw.icbLevel === "string" ? raw.icbLevel.trim() : "";
  if (icbLevelRaw && !EXECUTE_ICB_LEVEL_SET.has(icbLevelRaw)) return null;
  return {
    ...(date ? { date } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(icb ? { icb } : {}),
    ...(icbLevelRaw ? { icbLevel: icbLevelRaw as IcbSnapshotArgs["icbLevel"] } : {}),
  };
}

export function validateAssistantExecuteRequest(rawBody: unknown): AssistantExecuteValidationResult {
  if (!isRecord(rawBody)) {
    return { ok: false, status: 400, error: "Invalid JSON body." };
  }

  const body = rawBody as ExecuteBody;
  const approvalToken = typeof body.approvalToken === "string" ? body.approvalToken.trim() : "";
  if (!approvalToken) {
    return {
      ok: false,
      status: 403,
      error: "approvalToken is required for human-in-loop execution.",
    };
  }

  const legacy = parseLegacyToolNameAndArgs(body);
  const toolNameRaw = typeof body.toolName === "string" ? body.toolName.trim() : "";
  const toolName = toolNameRaw || legacy?.toolName;
  if (!toolName || !ASSISTANT_EXECUTE_TOOL_NAME_SET.has(toolName as AssistantExecuteToolName)) {
    return {
      ok: false,
      status: 400,
      error:
        "Invalid toolName. Use one of: finance_analysis|risk_metrics|backtest_run|stock_universe_ranking|valuation_rankings|icb_snapshot.",
    };
  }

  const argsCandidate = body.arguments ?? legacy?.args ?? {};
  const normalizedToolName = toolName as AssistantExecuteToolName;
  const validatedArgs = validateAssistantExecuteArgs(normalizedToolName, argsCandidate);
  if (!validatedArgs) {
    return {
      ok: false,
      status: 400,
      error: `Invalid arguments for toolName=${normalizedToolName}.`,
    };
  }

  return {
    ok: true,
    approvalToken,
    toolName: normalizedToolName,
    args: validatedArgs as AssistantExecuteArgsByTool[AssistantExecuteToolName],
  };
}

function validateAssistantExecuteArgs(
  toolName: AssistantExecuteToolName,
  rawArgs: unknown
): AssistantExecuteArgsByTool[AssistantExecuteToolName] | null {
  switch (toolName) {
    case "finance_analysis":
      return validateFinanceAnalysisArgs(rawArgs);
    case "risk_metrics":
      return validateRiskArgs(rawArgs);
    case "backtest_run":
      return validateBacktestArgs(rawArgs);
    case "stock_universe_ranking":
      return validateStockUniverseRankingArgs(rawArgs);
    case "valuation_rankings":
      return validateValuationRankingArgs(rawArgs);
    case "icb_snapshot":
      return validateIcbSnapshotArgs(rawArgs);
    default:
      return null;
  }
}

export function buildAssistantExecutePlan(
  toolName: AssistantExecuteToolName,
  args: AssistantExecuteArgsByTool[AssistantExecuteToolName]
): InternalRequestPlan {
  return buildPlanForExecuteTool(toolName, args);
}
