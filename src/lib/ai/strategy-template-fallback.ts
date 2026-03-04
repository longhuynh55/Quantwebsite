import type { GeneratedStrategy } from "@/lib/ai/strategy-generator";

export type StrategyTemplateFallbackReason =
  | "timeout"
  | "schema_unavailable"
  | "parse"
  | "upstream"
  | "network"
  | "rate_limit";

const INDICATOR_KEYWORDS = [
  "RSI",
  "MACD",
  "EMA",
  "MA",
  "BOLLINGER",
  "ATR",
  "VOLUME",
  "BUY",
  "SELL",
  "STOP",
  "LOSS",
  "TAKE",
  "PROFIT",
  "MEAN",
  "REVERSION",
  "TREND",
  "FOLLOWING",
  "STRATEGY",
] as const;

const SYMBOL_STOPWORDS = [
  "TAO",
  "CHIEN",
  "LUOC",
  "BUILD",
  "FOR",
  "CHO",
  "MUA",
  "BAN",
  "KHI",
  "VOI",
  "THE",
  "AND",
  "WITH",
  "MEAN",
  "REVERSION",
  "TREND",
  "FOLLOWING",
  "BASELINE",
  "DEMO",
  "NGAN",
  "GON",
  "GIUP",
  "TOI",
  "MOT",
  "TIMEFRAME",
  "RSI",
  "MACD",
  "EMA",
  "MA",
] as const;

export function buildStrategyTemplateFallback(
  prompt: string,
  reason: StrategyTemplateFallbackReason
): GeneratedStrategy {
  const normalized = normalizePrompt(prompt);
  const symbol = extractPrimarySymbol(prompt);
  const timeframe = extractTimeframe(normalized);

  if (normalized.includes("rsi")) {
    return buildRsiTemplate(symbol, timeframe, reason);
  }
  if (normalized.includes("macd")) {
    return buildMacdTemplate(symbol, timeframe, reason);
  }
  if (normalized.includes("ema") || normalized.includes("moving average") || normalized.includes(" ma ")) {
    return buildEmaTemplate(symbol, timeframe, reason);
  }
  return buildMomentumTemplate(symbol, timeframe, reason);
}

function buildRsiTemplate(
  symbol: string,
  timeframe: "1d" | "1h" | "5m",
  reason: StrategyTemplateFallbackReason
): GeneratedStrategy {
  return {
    name: `${symbol} RSI Mean Reversion`,
    strategyType: "mean_reversion",
    riskLevel: "medium",
    explanation: buildFallbackExplanation(
      reason,
      "Using RSI(14): buy when RSI < 30 and sell when RSI > 70."
    ),
    nodes: [
      createDataSourceNode("n1", symbol, timeframe, { x: 80, y: 100 }),
      createIndicatorNode("n2", "RSI(14)", { indicatorType: "rsi", period: 14 }, { x: 360, y: 100 }),
      createSignalNode(
        "n3",
        "RSI Mean Reversion Signal",
        {
          signalType: "buy",
          condition: "Buy when RSI < 30; sell when RSI > 70",
          stopLoss: 5,
          takeProfit: 10,
        },
        { x: 660, y: 100 }
      ),
      createOutputNode("n4", { x: 980, y: 100 }),
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" },
    ],
  };
}

function buildMacdTemplate(
  symbol: string,
  timeframe: "1d" | "1h" | "5m",
  reason: StrategyTemplateFallbackReason
): GeneratedStrategy {
  return {
    name: `${symbol} MACD Trend Following`,
    strategyType: "trend_following",
    riskLevel: "medium",
    explanation: buildFallbackExplanation(
      reason,
      "Using MACD(12,26,9): buy on bullish crossover and exit on bearish crossover."
    ),
    nodes: [
      createDataSourceNode("n1", symbol, timeframe, { x: 80, y: 100 }),
      createIndicatorNode(
        "n2",
        "MACD(12,26,9)",
        {
          indicatorType: "macd",
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
        },
        { x: 360, y: 100 }
      ),
      createSignalNode(
        "n3",
        "MACD Crossover Signal",
        {
          signalType: "buy",
          condition: "Buy on MACD bullish crossover; sell on bearish crossover",
          stopLoss: 6,
          takeProfit: 12,
        },
        { x: 660, y: 100 }
      ),
      createOutputNode("n4", { x: 980, y: 100 }),
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" },
    ],
  };
}

function buildEmaTemplate(
  symbol: string,
  timeframe: "1d" | "1h" | "5m",
  reason: StrategyTemplateFallbackReason
): GeneratedStrategy {
  return {
    name: `${symbol} EMA Crossover`,
    strategyType: "trend_following",
    riskLevel: "medium",
    explanation: buildFallbackExplanation(
      reason,
      "Using EMA crossover: buy when EMA20 crosses above EMA50 and sell on opposite crossover."
    ),
    nodes: [
      createDataSourceNode("n1", symbol, timeframe, { x: 80, y: 100 }),
      createIndicatorNode(
        "n2",
        "EMA Crossover (20/50)",
        {
          indicatorType: "ema",
          fastPeriod: 20,
          slowPeriod: 50,
        },
        { x: 360, y: 100 }
      ),
      createSignalNode(
        "n3",
        "EMA Crossover Signal",
        {
          signalType: "buy",
          condition: "Buy EMA20 > EMA50; sell EMA20 < EMA50",
          stopLoss: 5,
          takeProfit: 12,
        },
        { x: 660, y: 100 }
      ),
      createOutputNode("n4", { x: 980, y: 100 }),
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" },
    ],
  };
}

function buildMomentumTemplate(
  symbol: string,
  timeframe: "1d" | "1h" | "5m",
  reason: StrategyTemplateFallbackReason
): GeneratedStrategy {
  return {
    name: `${symbol} Momentum Baseline`,
    strategyType: "momentum",
    riskLevel: "medium",
    explanation: buildFallbackExplanation(
      reason,
      "Using baseline momentum logic with MA(20) filter and signal rules."
    ),
    nodes: [
      createDataSourceNode("n1", symbol, timeframe, { x: 80, y: 100 }),
      createIndicatorNode("n2", "MA(20)", { indicatorType: "ma", period: 20 }, { x: 360, y: 100 }),
      createFilterNode(
        "n3",
        "Price Above MA20",
        {
          filterType: "price_above",
          value: 0,
          comparisonOperator: ">",
        },
        { x: 660, y: 100 }
      ),
      createSignalNode(
        "n4",
        "Momentum Signal",
        {
          signalType: "buy",
          condition: "Buy when price stays above MA20; sell when price breaks below MA20",
          stopLoss: 5,
          takeProfit: 10,
        },
        { x: 920, y: 100 }
      ),
      createOutputNode("n5", { x: 1180, y: 100 }),
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" },
      { id: "e4", source: "n4", target: "n5" },
    ],
  };
}

function createDataSourceNode(
  id: string,
  symbol: string,
  timeframe: "1d" | "1h" | "5m",
  position: { x: number; y: number }
): GeneratedStrategy["nodes"][number] {
  return {
    id,
    type: "dataSource",
    position,
    data: {
      type: "dataSource",
      label: "Market Data",
      config: {
        stocks: [symbol],
        timeframe,
      },
    },
  };
}

function createIndicatorNode(
  id: string,
  label: string,
  config: Record<string, unknown>,
  position: { x: number; y: number }
): GeneratedStrategy["nodes"][number] {
  return {
    id,
    type: "indicator",
    position,
    data: {
      type: "indicator",
      label,
      config,
    },
  };
}

function createFilterNode(
  id: string,
  label: string,
  config: Record<string, unknown>,
  position: { x: number; y: number }
): GeneratedStrategy["nodes"][number] {
  return {
    id,
    type: "filter",
    position,
    data: {
      type: "filter",
      label,
      config,
    },
  };
}

function createSignalNode(
  id: string,
  label: string,
  config: Record<string, unknown>,
  position: { x: number; y: number }
): GeneratedStrategy["nodes"][number] {
  return {
    id,
    type: "signal",
    position,
    data: {
      type: "signal",
      label,
      config,
    },
  };
}

function createOutputNode(id: string, position: { x: number; y: number }): GeneratedStrategy["nodes"][number] {
  return {
    id,
    type: "output",
    position,
    data: {
      type: "output",
      label: "Performance Output",
      config: {
        metrics: ["returns", "sharpe", "drawdown"],
      },
    },
  };
}

function normalizePrompt(prompt: string): string {
  return ` ${String(prompt ?? "").trim().toLowerCase()} `;
}

function extractTimeframe(normalizedPrompt: string): "1d" | "1h" | "5m" {
  if (normalizedPrompt.includes("5m") || normalizedPrompt.includes("5 phút")) return "5m";
  if (normalizedPrompt.includes("1h") || normalizedPrompt.includes("1 giờ")) return "1h";
  return "1d";
}

function extractPrimarySymbol(prompt: string): string {
  const uppercasePrompt = String(prompt ?? "").toUpperCase();
  const afterCho = /\b(?:CHO|FOR)\s+([A-Z]{3,4})\b/.exec(uppercasePrompt);
  if (afterCho && isValidSymbolToken(afterCho[1])) {
    return afterCho[1];
  }

  const matches = uppercasePrompt.match(/\b[A-Z]{3,4}\b/g);
  if (!matches || matches.length === 0) return "VNM";

  for (const token of matches) {
    if (!isValidSymbolToken(token)) continue;
    return token;
  }
  return "VNM";
}

function isValidSymbolToken(token: string): boolean {
  return (
    !INDICATOR_KEYWORDS.includes(token as (typeof INDICATOR_KEYWORDS)[number])
    && !SYMBOL_STOPWORDS.includes(token as (typeof SYMBOL_STOPWORDS)[number])
  );
}

function buildFallbackExplanation(reason: StrategyTemplateFallbackReason, coreRule: string): string {
  return [
    "Demo availability mode is enabled. The system returned a deterministic template because the LLM response path was degraded.",
    `Fallback reason: ${reason}.`,
    coreRule,
    "You can apply this graph immediately and fine-tune parameters in Strategy Builder.",
  ].join(" ");
}
