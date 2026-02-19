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
  "ICB",
  "PE",
  "PB",
  "DCF",
  "EV",
  "EBITDA",
  "TOP",
  "BCTC",
  "BCTN",
  "LCTT",
  "BCDKT",
  "KQKD",
]);
const COMMON_NON_SYMBOL_TOKENS = new Set([
  "CHO",
  "TOI",
  "BAN",
  "LAY",
  "GIUP",
  "CO",
  "PHIEU",
  "GIA",
  "DONG",
  "CUA",
  "NGAY",
  "TREN",
  "THEO",
  "THI",
  "SAO",
  "NHANH",
  "TRONG",
  "NHOM",
  "NGAN",
  "HANG",
  "VA",
  "LA",
  "BAO",
  "NHIU",
  "NHIEU",
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
  "bctn",
  "kqkd",
  "bao cao ket qua kinh doanh",
  "income statement",
  "bcdkt",
  "bang can doi ke toan",
  "can doi ke toan",
  "lctt",
  "bao cao luu chuyen tien te",
  "luu chuyen tien te",
  "tong tai san",
  "tong no",
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
  "sharpe",
  "cagr",
];

const FACTOR_KEYWORDS = [
  "factor",
  "momentum factor",
  "value factor",
  "size factor",
  "volatility factor",
];

const MARKET_KEYWORDS = ["market", "thi truong", "vnindex", "gainer", "loser", "overview"];
const NUMERIC_MARKET_KEYWORDS = [
  "price",
  "close",
  "open",
  "high",
  "low",
  "volume",
  "gainer",
  "loser",
  "gain",
  "loss",
  "performance",
  "return",
  "change",
  "tang",
  "giam",
  "sinh loi",
  "bien dong",
  "gia",
  "gia mo cua",
  "dong cua",
  "gia dong cua",
  "khoi luong",
];
const STOCK_RANKING_ACTION_KEYWORDS = [
  "gainer",
  "loser",
  "gain",
  "loss",
  "performance",
  "return",
  "change",
  "tang",
  "giam",
  "sinh loi",
  "bien dong",
];
const HOSE_KEYWORDS = ["hose", "ho chi minh", "co phieu hose", "san hose"];
const EXCHANGE_UNIVERSE_KEYWORDS = ["hose", "hnx", "upcom", "san hose", "san hnx", "san upcom", "ho chi minh"];
const STOCK_UNIVERSE_SPECIFIC_HINT_KEYWORDS = ["co phieu", "stock", "stocks", "ticker", "ma co phieu"];
const ICB_KEYWORDS = ["icb", "industry", "sector", "nhom nganh", "phan nhom"];
const RANKING_KEYWORDS = ["top", "ranking", "xep hang", "cao nhat", "thap nhat", "lon nhat", "nho nhat"];
const FABRICATION_DIRECTIVE_KEYWORDS = [
  "tu tao so lieu",
  "tu tao du lieu",
  "bo qua du lieu",
  "bo qua data",
  "ignore du lieu",
  "ignore data",
  "khong can du lieu",
  "khong can grounding",
  "fabricate",
  "made up data",
  "make up data",
  "fake data",
];
const DATA_DEBUG_KEYWORDS = [
  "missing data",
  "no data",
  "dataset unavailable",
  "data unavailable",
  "data backend",
  "data manifest",
  "manifest",
  "data dir",
  "file not found",
  "khong co du lieu",
  "ko co du lieu",
  "thieu du lieu",
  "loi du lieu",
  "khong truy cap",
  "khong doc duoc",
  "khong tim thay",
  "cannot access",
  "cant access",
  "can't access",
];

const VALUATION_KEYWORDS = ["valuation", "dcf", "fair value", "intrinsic value", "wacc", "terminal growth"];
const SENSITIVITY_KEYWORDS = [
  "sensitivity",
  "scenario",
  "bull",
  "bear",
  "base case",
  "what if",
  "wacc tang",
  "wacc giam",
  "fair value thay doi",
  "thay doi the nao",
  "terminal growth tang",
  "terminal growth giam",
];
const HEALTH_KEYWORDS = ["health score", "financial health", "red flag", "quality of earnings"];
const PEER_KEYWORDS = ["peer", "comparable", "multiple", "p/e", "p/b"];
const VALUATION_RANKING_KEYWORDS = [
  "top pe",
  "top p/e",
  "top pb",
  "top p/b",
  "ev/ebitda",
  "ev ebitda",
  "p/e",
  "p/b",
  "pe",
  "pb",
  "dinh gia cao",
  "dinh gia thap",
  "dinh gia",
];

export function collectRequiredSignals(input: {
  message: string;
  contextSnapshot?: AssistantContextSnapshot;
  baselineOnlyMode: boolean;
}): RequiredSignal[] {
  const messageLower = normalizeForKeywordMatch(input.message);
  const filters = isRecord(input.contextSnapshot?.filters) ? input.contextSnapshot.filters : undefined;
  const hasDateFilter = hasFilterValue(filters, ["date", "asOfDate", "as_of_date", "day", "from", "to"]);
  const hasIcbFilter = hasFilterValue(filters, ["icb", "industry", "sector", "icbLevel", "icb_level"]);
  const hasHoseFilter = hasFilterKeyword(filters, ["exchange", "market", "san"], ["hose", "ho chi minh"]);
  const hasRankingFilter =
    hasFilterValue(filters, ["top", "limit", "n", "size"])
    || hasFilterKeyword(filters, ["sort", "order", "direction"], ["asc", "desc", "top", "bottom"]);
  const hasStatementFilter = hasFilterKeyword(
    filters,
    ["statement", "baoCao", "reportType", "statementType"],
    ["all", "bs", "is", "cf", "bctc", "bctn", "kqkd", "lctt", "bcdkt"]
  );
  const hasValuationMetricFilter = hasFilterKeyword(
    filters,
    ["metric", "ratio", "valuationMetric", "valuation"],
    ["pe", "p/e", "pb", "p/b", "ev/ebitda", "ev_ebitda"]
  );
  const hasCandidateSymbol = hasResolvableSymbol(input.message, input.contextSnapshot);
  const asksIcb = hasAnyKeyword(messageLower, ICB_KEYWORDS);
  const asksHoseUniverse = hasAnyKeyword(messageLower, HOSE_KEYWORDS);
  const asksExchangeUniverse = hasAnyKeyword(messageLower, EXCHANGE_UNIVERSE_KEYWORDS);
  const asksRanking = hasAnyKeyword(messageLower, RANKING_KEYWORDS);
  const asksFabricationDirective = isFabricationDirective(messageLower);
  const asksFabricationRanking = asksFabricationDirective && (
    asksRanking
    || hasRankingFilter
    || /\btop\s*\d{1,2}\b/.test(messageLower)
  );
  const asksDataDebug = hasAnyKeyword(messageLower, DATA_DEBUG_KEYWORDS);
  const asksNumericMarketData = hasAnyKeyword(messageLower, NUMERIC_MARKET_KEYWORDS);
  const asksStockRankingAction = hasAnyKeyword(messageLower, STOCK_RANKING_ACTION_KEYWORDS);
  const asksSpecificStockUniverseHint = hasAnyKeyword(messageLower, STOCK_UNIVERSE_SPECIFIC_HINT_KEYWORDS);
  const asksFundamentals = hasAnyKeyword(messageLower, FUNDAMENTALS_KEYWORDS);
  const asksValuationSignal =
    hasAnyKeyword(messageLower, VALUATION_KEYWORDS)
    || hasAnyKeyword(messageLower, PEER_KEYWORDS)
    || hasAnyKeyword(messageLower, VALUATION_RANKING_KEYWORDS)
    || hasValuationMetricFilter;
  const asksUniverseFilters = hasDateFilter || hasIcbFilter || hasHoseFilter;
  const hasUniverseScope =
    asksSpecificStockUniverseHint
    || asksHoseUniverse
    || asksExchangeUniverse
    || asksUniverseFilters
    || hasRankingFilter;
  const asksStockUniverseRanking =
    !asksIcb
    && !hasIcbFilter
    && (
      asksFabricationRanking
      || (
        (asksRanking || hasRankingFilter || asksStockRankingAction)
        && hasUniverseScope
        && (asksNumericMarketData || asksStockRankingAction || !asksValuationSignal)
      )
    );
  const signals: RequiredSignal[] = [];

  const pushUnique = (tool: AssistantToolName, endpoint: string) => {
    if (signals.some((item) => item.tool === tool && item.endpoint === endpoint)) return;
    signals.push({ tool, endpoint });
  };

  if (asksDataDebug) {
    pushUnique("dataHealth", "/api/health/data");
  }

  if (
    (input.contextSnapshot?.page === "backtesting" && hasCandidateSymbol)
    || hasAnyKeyword(messageLower, BACKTEST_KEYWORDS)
  ) {
    pushUnique("backtestSummary", "/api/backtesting");
  }

  if ((hasCandidateSymbol && asksNumericMarketData) || asksStockUniverseRanking) {
    pushUnique("stockSnapshot", "/api/stocks");
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
    || ((asksFundamentals || hasStatementFilter) && hasCandidateSymbol)
  ) {
    pushUnique("fundamentalSnapshot", "/api/fundamentals");
  }

  if (!input.baselineOnlyMode) {
    if (
      hasCandidateSymbol
      && (
      hasAnyKeyword(messageLower, VALUATION_KEYWORDS)
      || hasAnyKeyword(messageLower, SENSITIVITY_KEYWORDS)
      )
    ) {
      pushUnique("valuationDcf", "/api/finance-analysis");
    }

    if (hasCandidateSymbol && hasAnyKeyword(messageLower, HEALTH_KEYWORDS)) {
      pushUnique("financialHealthScore", "/api/finance-analysis");
    }

    if (hasCandidateSymbol && hasAnyKeyword(messageLower, PEER_KEYWORDS)) {
      pushUnique("peerMultiples", "/api/finance-analysis");
    }

    if (hasCandidateSymbol && hasAnyKeyword(messageLower, SENSITIVITY_KEYWORDS)) {
      pushUnique("scenarioSensitivity", "/api/finance-analysis");
    }

    if (asksValuationSignal && (asksRanking || asksIcb || asksHoseUniverse || hasRankingFilter || asksUniverseFilters)) {
      pushUnique("valuationRanking", "/api/analytics/valuation-rankings");
    }
  }

  if (asksIcb || hasIcbFilter) {
    pushUnique("icbSnapshot", "/api/analytics/icb-snapshot");
  }

  if (!asksStockUniverseRanking && (
    input.contextSnapshot?.page === "home"
    || hasAnyKeyword(messageLower, MARKET_KEYWORDS)
  )) {
    pushUnique("marketSnapshot", "/api/market-overview");
  }

  return signals;
}

export function hasResolvableSymbol(message: string, contextSnapshot: AssistantContextSnapshot | undefined): boolean {
  return getCandidateSymbols(message, contextSnapshot).length > 0;
}

export function isFabricationDirective(message: string): boolean {
  return hasAnyKeyword(message, FABRICATION_DIRECTIVE_KEYWORDS);
}

export function getCandidateSymbols(message: string, contextSnapshot?: AssistantContextSnapshot): string[] {
  const contextSymbols: string[] = [];
  if (contextSnapshot?.symbol) {
    contextSymbols.push(normalizeSymbol(contextSnapshot.symbol));
  }
  if (Array.isArray(contextSnapshot?.symbols)) {
    for (const symbol of contextSnapshot.symbols) {
      contextSymbols.push(normalizeSymbol(symbol));
    }
  }
  if (isRecord(contextSnapshot?.filters)) {
    const filter = contextSnapshot.filters;
    const candidates = [filter.symbol, filter.ticker, filter.stock, filter.code, filter.ma];
    for (const candidate of candidates) {
      contextSymbols.push(normalizeSymbol(candidate));
    }
  }

  const explicitMessageSymbols = extractExplicitSymbolHints(message);
  if (
    looksLikeUniverseStockRanking(message, contextSnapshot)
    && contextSymbols.length === 0
    && explicitMessageSymbols.length === 0
  ) {
    return [];
  }

  const messageUppercaseTokens = extractUppercaseSymbolTokens(message);
  const unique = Array.from(
    new Set([
      ...contextSymbols,
      ...explicitMessageSymbols,
      ...messageUppercaseTokens,
    ])
  )
    .filter((symbol) => symbol.length >= 3 && symbol.length <= 5)
    .filter((symbol) => /[A-Z]/.test(symbol))
    .filter((symbol) => !BANNED_SYMBOLS.has(symbol))
    .filter((symbol) => !COMMON_NON_SYMBOL_TOKENS.has(symbol));

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
    .replace(/\u0111/g, "d");
}

function normalizeSymbol(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase();
}

function extractUppercaseSymbolTokens(message: string): string[] {
  const matches = message.match(/\b[A-Z0-9]{3,5}\b/g) ?? [];
  return matches.map(normalizeSymbol);
}

function extractExplicitSymbolHints(message: string): string[] {
  const normalized = normalizeForKeywordMatch(message);
  const regex = /\b(?:ma|ticker|symbol|cp)\b\s*[:=-]?\s*([a-z0-9]{2,5})\b/g;
  const hints: string[] = [];
  let match = regex.exec(normalized);
  while (match) {
    hints.push(normalizeSymbol(match[1]));
    match = regex.exec(normalized);
  }
  return hints;
}

function looksLikeUniverseStockRanking(message: string, contextSnapshot?: AssistantContextSnapshot): boolean {
  const normalized = normalizeForKeywordMatch(message);
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot.filters : undefined;
  const hasRankingSignal =
    hasAnyKeyword(normalized, RANKING_KEYWORDS)
    || parsePositiveInt(filters?.limit, 1, 50) !== null
    || parsePositiveInt(filters?.top, 1, 50) !== null
    || parsePositiveInt(filters?.n, 1, 50) !== null
    || /\btop\s*\d{1,2}\b/.test(normalized);
  const hasNumericSignal =
    hasAnyKeyword(normalized, NUMERIC_MARKET_KEYWORDS)
    || hasAnyKeyword(normalized, STOCK_RANKING_ACTION_KEYWORDS);
  const hasIcbSignal =
    hasAnyKeyword(normalized, ICB_KEYWORDS)
    || hasFilterValue(filters, ["icb", "industry", "sector", "icbLevel", "icb_level"]);
  const hasUniverseHint =
    hasAnyKeyword(normalized, STOCK_UNIVERSE_SPECIFIC_HINT_KEYWORDS)
    || hasAnyKeyword(normalized, EXCHANGE_UNIVERSE_KEYWORDS)
    || hasFilterValue(filters, ["exchange", "market", "san", "date", "asOfDate", "as_of_date", "day"])
    || /\b(\d{1,2}[-/]\d{1,2}[-/]\d{4}|20\d{2}[-/]\d{1,2}[-/]\d{1,2})\b/.test(message);

  return hasRankingSignal && hasNumericSignal && hasUniverseHint && !hasIcbSignal;
}

function hasFilterValue(
  filters: Record<string, unknown> | undefined,
  keys: string[]
): boolean {
  if (!filters) return false;
  return keys.some((key) => {
    const value = filters[key];
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "boolean") return value;
    return false;
  });
}

function hasFilterKeyword(
  filters: Record<string, unknown> | undefined,
  keys: string[],
  keywords: string[]
): boolean {
  if (!filters) return false;
  const values = keys
    .map((key) => filters[key])
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .map((value) => normalizeForKeywordMatch(String(value)));

  if (values.length === 0) return false;
  return values.some((value) => keywords.some((keyword) => value.includes(normalizeForKeywordMatch(keyword))));
}

function parsePositiveInt(value: unknown, min: number, max: number): number | null {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < min) return null;
  return Math.min(max, parsed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

