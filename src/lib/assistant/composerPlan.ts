import type { AssistantContextSnapshot } from "@/types/assistant";
import {
  defaultArgsForExecuteTool,
  type AssistantExecuteToolName,
} from "@/lib/assistant/toolRegistry";

export type ComposerExecuteToolName = AssistantExecuteToolName;

export interface ComposerDraftPlan {
  toolName: ComposerExecuteToolName;
  arguments: Record<string, unknown>;
  summary: string;
}

const SYMBOL_REGEX = /^[A-Z0-9]{2,10}$/;
const DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/;
const SYMBOL_STOP_WORDS = new Set([
  "RUN",
  "BACKTEST",
  "ANALYZE",
  "ANALYSIS",
  "STOCK",
  "STOCKS",
  "TOP",
  "RISK",
  "WITH",
  "FOR",
  "AND",
  "THE",
  "PE",
  "PB",
  "EV",
  "EBITDA",
  "ICB",
  "HOSE",
]);

export function draftComposerPlan(
  objective: string,
  context?: AssistantContextSnapshot
): ComposerDraftPlan | null {
  const trimmed = objective.trim();
  if (!trimmed) return null;

  const normalized = normalizeText(trimmed);
  const symbol = resolveSymbol(trimmed, context);
  const date = resolveDate(trimmed, context);
  const icb = readOptionalContextText(context?.filters?.icb, 60);
  const icbLevel = normalizeIcbLevel(context?.filters?.icbLevel);
  const limit = resolveTopN(trimmed);

  if (containsAny(normalized, ["backtest", "backtesting", "sharpe", "drawdown", "sma"])) {
    return {
      toolName: "backtest_run",
      arguments: {
        symbol,
        strategy: "sma_crossover",
        executionModel: "next_open",
      },
      summary: `Backtest ${symbol} with SMA crossover to estimate return/risk metrics.`,
    };
  }

  if (containsAny(normalized, ["risk", "volatility", "beta", "var"])) {
    return {
      toolName: "risk_metrics",
      arguments: {
        symbol,
        benchmark: "VNINDEX",
      },
      summary: `Compute risk metrics for ${symbol} versus VNINDEX.`,
    };
  }

  if (containsAny(normalized, ["icb", "sector", "industry", "nganh"])) {
    return {
      toolName: "icb_snapshot",
      arguments: {
        ...(date ? { date } : {}),
        ...(limit ? { limit } : {}),
        ...(icb ? { icb } : {}),
        ...(icbLevel ? { icbLevel } : {}),
      },
      summary: "Fetch ICB grouped market snapshot for HOSE universe.",
    };
  }

  if (containsAny(normalized, ["ranking", "xep hang", "top", "volume", "thanh khoan"])) {
    if (containsAny(normalized, ["pe", "p/e", "pb", "p/b", "ev/ebitda", "valuation"])) {
      const metric = detectValuationMetric(normalized);
      return {
        toolName: "valuation_rankings",
        arguments: {
          metric,
          order: detectOrder(normalized),
          ...(limit ? { limit } : {}),
          ...(date ? { date } : {}),
          ...(icb ? { icb } : {}),
          ...(icbLevel ? { icbLevel } : {}),
        },
        summary: `Rank HOSE stocks by ${metric.toUpperCase()} valuation metric.`,
      };
    }

    return {
      toolName: "stock_universe_ranking",
      arguments: {
        metric: detectStockMetric(normalized),
        order: detectOrder(normalized),
        ...(limit ? { limit } : {}),
        ...(date ? { date } : {}),
        ...(icb ? { icb } : {}),
        ...(icbLevel ? { icbLevel } : {}),
      },
      summary: "Rank HOSE stock universe by selected market metric.",
    };
  }

  const task = detectFinanceTask(normalized);
  return {
    toolName: "finance_analysis",
    arguments: {
      symbol,
      task,
    },
    summary: `Run ${task} finance analysis for ${symbol}.`,
  };
}

export function defaultArgsForTool(
  toolName: ComposerExecuteToolName,
  context?: AssistantContextSnapshot
): Record<string, unknown> {
  return defaultArgsForExecuteTool(toolName, context);
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function containsAny(input: string, needles: string[]): boolean {
  return needles.some((needle) => input.includes(needle));
}

function resolveSymbol(input: string, context?: AssistantContextSnapshot): string {
  const explicitSymbol = String(input || "").match(/\b(?:symbol|ticker|ma)\s*[:=]?\s*([a-z0-9]{2,10})\b/i)?.[1];
  const fromExplicitSymbol = normalizeSymbol(explicitSymbol);
  if (fromExplicitSymbol && !SYMBOL_STOP_WORDS.has(fromExplicitSymbol)) return fromExplicitSymbol;

  const fromText = extractSymbolFromText(input);
  const fromContext = normalizeSymbol(context?.symbol);
  const fromList = Array.isArray(context?.symbols)
    ? context.symbols.map((item) => normalizeSymbol(item)).find(Boolean)
    : "";
  return fromText || fromContext || fromList || "VNM";
}

function resolveDate(input: string, context?: AssistantContextSnapshot): string | undefined {
  const textDate = String(input || "").match(DATE_PATTERN)?.[0];
  if (textDate) return textDate;
  const contextDate = readOptionalContextText(context?.filters?.date, 20);
  if (contextDate && DATE_PATTERN.test(contextDate)) return contextDate;
  return undefined;
}

function detectOrder(normalized: string): "asc" | "desc" {
  if (containsAny(normalized, ["lowest", "smallest", "thap nhat", "tang dan", "asc"])) {
    return "asc";
  }
  return "desc";
}

function detectStockMetric(normalized: string): "close" | "open" | "high" | "low" | "volume" {
  if (containsAny(normalized, ["close", "dong cua"])) return "close";
  if (containsAny(normalized, ["open", "mo cua"])) return "open";
  if (containsAny(normalized, ["high", "cao nhat"])) return "high";
  if (containsAny(normalized, ["low", "thap nhat"])) return "low";
  return "volume";
}

function detectValuationMetric(normalized: string): "pe" | "pb" | "ev_ebitda" {
  if (containsAny(normalized, ["pb", "p/b"])) return "pb";
  if (containsAny(normalized, ["ev/ebitda", "ev ebitda"])) return "ev_ebitda";
  return "pe";
}

function detectFinanceTask(
  normalized: string
): "fundamental" | "health" | "valuation" | "peer" | "sensitivity" {
  if (containsAny(normalized, ["health", "liquidity", "debt", "suc khoe"])) return "health";
  if (containsAny(normalized, ["valuation", "dcf", "dinh gia"])) return "valuation";
  if (containsAny(normalized, ["peer", "so sanh"])) return "peer";
  if (containsAny(normalized, ["sensitivity", "kich ban"])) return "sensitivity";
  return "fundamental";
}

function normalizeSymbol(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,10}$/.test(normalized)) return "";
  return normalized;
}

function extractSymbolFromText(input: string): string {
  const raw = String(input || "");
  const tokens = raw.match(/\b[A-Za-z0-9]{2,10}\b/g) ?? [];
  for (const token of tokens) {
    const hasUpperCase = /[A-Z]/.test(token);
    const hasDigit = /\d/.test(token);
    if (!hasUpperCase && !hasDigit) continue;

    const normalized = token.toUpperCase();
    if (!SYMBOL_REGEX.test(normalized)) continue;
    if (SYMBOL_STOP_WORDS.has(normalized)) continue;
    return normalized;
  }
  return "";
}

function resolveTopN(input: string): number | undefined {
  const topMatch = input.match(/\btop\s*(\d{1,3})\b/i);
  if (topMatch) {
    const parsed = Number.parseInt(topMatch[1], 10);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1000) return parsed;
  }
  const numberMatch = input.match(/\b(\d{1,3})\b/);
  if (numberMatch) {
    const parsed = Number.parseInt(numberMatch[1], 10);
    if (Number.isFinite(parsed) && parsed >= 3 && parsed <= 1000) return parsed;
  }
  return undefined;
}

function readOptionalContextText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeIcbLevel(value: unknown): "2" | "3" | "4" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized === "2" || normalized === "3" || normalized === "4") return normalized;
  return undefined;
}
