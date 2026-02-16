import type { AssistantContextSnapshot, AssistantToolName } from "@/types/assistant";

export interface RequiredSignal {
  tool: AssistantToolName;
  endpoint: string;
}

const BANNED_SYMBOLS = new Set([
  "RSI",
  "EMA",
  "SMA",
  "MACD",
  "HOSE",
  "HNX",
  "UPCOM",
  "VNINDEX",
  "VN30",
  "VN100",
]);

const FUNDAMENTALS_KEYWORDS = [
  "fundamental",
  "fundamental analysis",
  "phan tich co ban",
  "co ban",
  "bao cao tai chinh",
  "eps",
  "revenue",
  "net income",
  "doanh thu",
  "loi nhuan",
  "balance sheet",
  "cash flow",
  "bctc",
];

const BACKTEST_KEYWORDS = [
  "backtest",
  "strategy",
  "chien luoc",
  "sma",
  "ema",
  "rsi",
  "bollinger",
  "net return",
  "total_trades",
];

const RISK_KEYWORDS = [
  "risk",
  "rui ro",
  "var",
  "cvar",
  "beta",
  "volatility",
  "drawdown",
];

const FACTOR_KEYWORDS = [
  "factor",
  "momentum factor",
  "value factor",
  "size factor",
  "volatility factor",
];

const MARKET_KEYWORDS = ["market", "thi truong", "vnindex", "gainer", "loser", "overview"];

const VALUATION_KEYWORDS = ["valuation", "dcf", "fair value", "intrinsic value", "wacc", "terminal growth"];
const SENSITIVITY_KEYWORDS = ["sensitivity", "scenario", "bull", "bear", "base case"];
const HEALTH_KEYWORDS = ["health score", "financial health", "red flag", "quality of earnings"];
const PEER_KEYWORDS = ["peer", "comparable", "multiple", "p/e", "p/b"];

export function collectRequiredSignals(input: {
  message: string;
  contextSnapshot?: AssistantContextSnapshot;
  baselineOnlyMode: boolean;
}): RequiredSignal[] {
  const messageLower = normalizeForKeywordMatch(input.message);
  const hasCandidateSymbol = hasResolvableSymbol(input.message, input.contextSnapshot);
  const signals: RequiredSignal[] = [];

  const pushUnique = (tool: AssistantToolName, endpoint: string) => {
    if (signals.some((item) => item.tool === tool && item.endpoint === endpoint)) return;
    signals.push({ tool, endpoint });
  };

  if (
    (input.contextSnapshot?.page === "backtesting" && hasCandidateSymbol)
    || hasAnyKeyword(messageLower, BACKTEST_KEYWORDS)
  ) {
    pushUnique("backtestSummary", "/api/backtesting");
  }

  if (
    (input.contextSnapshot?.page === "risk" && hasCandidateSymbol)
    || hasAnyKeyword(messageLower, RISK_KEYWORDS)
  ) {
    pushUnique("riskSnapshot", "/api/risk");
  }

  if (
    input.contextSnapshot?.page === "factors"
    || hasAnyKeyword(messageLower, FACTOR_KEYWORDS)
  ) {
    pushUnique("factorSnapshot", "/api/factors");
  }

  if (
    (input.contextSnapshot?.page === "charts" && hasCandidateSymbol)
    || hasAnyKeyword(messageLower, FUNDAMENTALS_KEYWORDS)
  ) {
    pushUnique("fundamentalSnapshot", "/api/fundamentals");
  }

  if (!input.baselineOnlyMode) {
    if (
      hasAnyKeyword(messageLower, VALUATION_KEYWORDS)
      || hasAnyKeyword(messageLower, SENSITIVITY_KEYWORDS)
    ) {
      pushUnique("valuationDcf", "/api/finance-analysis");
    }

    if (hasAnyKeyword(messageLower, HEALTH_KEYWORDS)) {
      pushUnique("financialHealthScore", "/api/finance-analysis");
    }

    if (hasAnyKeyword(messageLower, PEER_KEYWORDS)) {
      pushUnique("peerMultiples", "/api/finance-analysis");
    }

    if (hasAnyKeyword(messageLower, SENSITIVITY_KEYWORDS)) {
      pushUnique("scenarioSensitivity", "/api/finance-analysis");
    }
  }

  if (
    input.contextSnapshot?.page === "home"
    || hasAnyKeyword(messageLower, MARKET_KEYWORDS)
  ) {
    pushUnique("marketSnapshot", "/api/market-overview");
  }

  return signals;
}

export function hasResolvableSymbol(message: string, contextSnapshot: AssistantContextSnapshot | undefined): boolean {
  return getCandidateSymbols(message, contextSnapshot).length > 0;
}

export function getCandidateSymbols(message: string, contextSnapshot?: AssistantContextSnapshot): string[] {
  const symbols: string[] = [];
  if (contextSnapshot?.symbol) {
    symbols.push(normalizeSymbol(contextSnapshot.symbol));
  }
  if (Array.isArray(contextSnapshot?.symbols)) {
    for (const symbol of contextSnapshot.symbols) {
      symbols.push(normalizeSymbol(symbol));
    }
  }

  const matches = message.match(/\b[A-Z0-9]{3,5}\b/g) ?? [];
  for (const symbol of matches) {
    symbols.push(normalizeSymbol(symbol));
  }

  const unique = Array.from(new Set(symbols))
    .filter((symbol) => symbol.length >= 3 && symbol.length <= 5)
    .filter((symbol) => !BANNED_SYMBOLS.has(symbol));

  return unique.slice(0, 3);
}

export function hasAnyKeyword(value: string, keywords: string[]): boolean {
  const normalizedValue = normalizeForKeywordMatch(value);
  return keywords.some((keyword) => normalizedValue.includes(normalizeForKeywordMatch(keyword)));
}

export function normalizeForKeywordMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Ä‘/g, "d");
}

function normalizeSymbol(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase();
}
