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
  "ROE",
  "ROA",
  "OCF",
  "CFO",
  "FCF",
  "NET",
  "DCF",
  "EV",
  "EBIT",
  "EBITDA",
  "WACC",
  "CAPM",
  "FCFF",
  "FCFE",
  "TTM",
  "YOY",
  "QOQ",
  "MOM",
  "YTD",
  "MTD",
  "ROIC",
  "ROCE",
  "IRR",
  "NPV",
  "CAGR",
  "EPS",
  "BVPS",
  "NAV",
  "NOPAT",
  "PAT",
  "PBT",
  "API",
  "HTTP",
  "HTTPS",
  "JSON",
  "CSV",
  "OHLC",
  "OHLCV",
  "LC",
  "TOP",
  "PEER",
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
  "CN",
  "T2",
  "T3",
  "T4",
  "T5",
  "T6",
  "T7",
]);
const COMPARE_INTENT_KEYWORDS = ["so sanh", "compare", "vs", "versus"];
const COMPARE_NON_SYMBOL_TOKENS = new Set([
  "SO",
  "SANH",
  "VOI",
  "VA",
  "GIUA",
  "COMPARE",
  "VS",
  "VERSUS",
  "AND",
]);
const SYMBOL_TOKEN_PATTERN = /^[A-Z][A-Z0-9]{1,3}$/;
const UPPERCASE_SYMBOL_TOKEN_REGEX = /\b[A-Z][A-Z0-9]{1,3}\b/g;

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
  "roe",
  "return on equity",
  "ebitda",
  "debt/equity",
  "debt to equity",
  "d/e",
  "de ratio",
  "profit margin",
  "gross margin",
  "operating margin",
  "net margin",
  "bien loi nhuan",
  "bien gop",
  "bien hoat dong",
  "bien rong",
  "yoy",
  "year over year",
  "tang truong yoy",
];
const FUNDAMENTAL_RATIO_KEYWORDS = [
  "ocf",
  "cfo",
  "fcf",
  "lnst",
  "net margin",
  "profit margin",
  "de",
  "d/e",
  "debt/equity",
  "debt to equity",
  "accrual",
  "quality of earnings",
  "chat luong loi nhuan",
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
const MARKET_OVERVIEW_GUARD_KEYWORDS = [
  "market overview",
  "tong quan thi truong",
  "thi truong",
  "vnindex",
  "overview",
  "market",
];
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
  "thanh khoan",
];
const OHLCV_KEYWORDS = [
  "ohlcv",
  "ohlc",
  "open high low close",
  "candlestick",
  "candle",
  "nen",
  "nen nhat",
  "nen gia",
];
const AMBIGUOUS_METRIC_KEYWORDS = [
  ...NUMERIC_MARKET_KEYWORDS,
  "pe",
  "p/e",
  "pb",
  "p/b",
  "ev/ebitda",
  "ev ebitda",
  "valuation",
  "dinh gia",
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
const HOSE_KEYWORDS = ["hose", "hsx", "ho chi minh", "co phieu hose", "san hose", "san hsx"];
const EXCHANGE_UNIVERSE_KEYWORDS = [
  "hose",
  "hsx",
  "hnx",
  "ha noi",
  "upcom",
  "up com",
  "san hose",
  "san hsx",
  "san hnx",
  "san upcom",
  "ho chi minh",
];
const STOCK_UNIVERSE_SPECIFIC_HINT_KEYWORDS = ["co phieu", "stock", "stocks", "ticker", "ma co phieu"];
const ICB_KEYWORDS = ["icb", "industry", "sector", "nganh", "nhom nganh", "phan nhom", "linh vuc"];
const RANKING_KEYWORDS = [
  "top",
  "ranking",
  "xep hang",
  "bang xep hang",
  "cao nhat",
  "thap nhat",
  "lon nhat",
  "nho nhat",
  "dan dau",
  "dung dau",
];
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
  const asksUniverseFilters = hasDateFilter || hasIcbFilter || hasHoseFilter;
  const hasCandidateSymbol = hasResolvableSymbol(input.message, input.contextSnapshot);
  const asksIcb = hasAnyKeyword(messageLower, ICB_KEYWORDS);
  const asksHoseUniverse = hasAnyKeyword(messageLower, HOSE_KEYWORDS);
  const asksRanking = hasAnyKeyword(messageLower, RANKING_KEYWORDS);
  const asksDataDebug = hasAnyKeyword(messageLower, DATA_DEBUG_KEYWORDS);
  const asksMarket = hasAnyKeyword(messageLower, MARKET_KEYWORDS);
  const asksNumericMarketData = hasAnyKeyword(messageLower, NUMERIC_MARKET_KEYWORDS);
  const asksFundamentalRatios = hasAnyKeyword(messageLower, FUNDAMENTAL_RATIO_KEYWORDS);
  const asksFundamentalShorthand = hasFundamentalShorthandSignal(messageLower);
  const asksGenericStatementKeyword = /\bstatement\b/i.test(messageLower);
  const asksFundamentals =
    hasAnyKeyword(messageLower, FUNDAMENTALS_KEYWORDS)
    || asksFundamentalRatios
    || asksFundamentalShorthand
    || (asksGenericStatementKeyword && hasCandidateSymbol);
  const asksValuationSignal =
    hasAnyKeyword(messageLower, VALUATION_KEYWORDS)
    || hasAnyKeyword(messageLower, PEER_KEYWORDS)
    || hasAnyKeyword(messageLower, VALUATION_RANKING_KEYWORDS)
    || hasValuationMetricFilter;
  const asksStockUniverseRanking = isStockUniverseRankingIntent(input.message, input.contextSnapshot);
  const hasDateLikeInMessage =
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(messageLower)
    || /\b20\d{2}[/-]\d{1,2}[/-]\d{1,2}\b/.test(messageLower);
  const asksOhlcvSeries = hasAnyKeyword(messageLower, OHLCV_KEYWORDS);
  const asksAmbiguousMetricKeyword = hasAnyKeyword(messageLower, AMBIGUOUS_METRIC_KEYWORDS);
  const hasStrongIntentSignal =
    asksRanking
    || asksIcb
    || asksHoseUniverse
    || asksStockUniverseRanking
    || asksFundamentals
    || asksDataDebug
    || asksMarket
    || hasAnyKeyword(messageLower, BACKTEST_KEYWORDS)
    || hasAnyKeyword(messageLower, RISK_KEYWORDS)
    || hasAnyKeyword(messageLower, FACTOR_KEYWORDS);
  const ambiguousMetricFallback =
    !hasCandidateSymbol
    && asksAmbiguousMetricKeyword
    && !hasStrongIntentSignal
    && !asksUniverseFilters
    && !hasDateLikeInMessage;
  const prefersSymbolScopedStockSnapshot =
    hasCandidateSymbol
    && (
      asksNumericMarketData
      || asksOhlcvSeries
      || hasDateLikeInMessage
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

  if (ambiguousMetricFallback) {
    // Ambiguous metric query without symbol/scope: prefer stock-route fallback over broad market route.
    pushUnique("stockSnapshot", "/api/stocks");
  }

  if (prefersSymbolScopedStockSnapshot || asksStockUniverseRanking) {
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
    || ((asksFundamentals || hasStatementFilter || asksFundamentalRatios || asksFundamentalShorthand) && hasCandidateSymbol)
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
    !ambiguousMetricFallback
    && !prefersSymbolScopedStockSnapshot
    && (
      input.contextSnapshot?.page === "home"
      || asksMarket
    )
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

export function isStockUniverseRankingIntent(
  message: string,
  contextSnapshot?: AssistantContextSnapshot
): boolean {
  const normalized = normalizeForKeywordMatch(message);
  const contextSymbolCandidates: string[] = [];
  const pushContextSymbol = (candidate: unknown) => {
    const normalizedSymbol = normalizeSymbol(candidate);
    if (normalizedSymbol) contextSymbolCandidates.push(normalizedSymbol);
  };
  if (contextSnapshot?.symbol) {
    pushContextSymbol(contextSnapshot.symbol);
  }
  if (Array.isArray(contextSnapshot?.symbols)) {
    for (const symbol of contextSnapshot.symbols) {
      pushContextSymbol(symbol);
    }
  }
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot.filters : undefined;
  if (filters) {
    const filterCandidates = [filters.symbol, filters.ticker, filters.stock, filters.code, filters.ma];
    for (const candidate of filterCandidates) {
      pushContextSymbol(candidate);
    }
  }
  const explicitSymbols = [
    ...extractExplicitSymbolHints(message),
    ...extractCompareSymbolHints(message),
  ].map((item) => normalizeSymbol(item));
  const hasExplicitSymbol = [...contextSymbolCandidates, ...explicitSymbols].some((item) => isLikelySymbolToken(item));
  const hasDateFilter = hasFilterValue(filters, ["date", "asOfDate", "as_of_date", "day", "from", "to"]);
  const hasIcbFilter = hasFilterValue(filters, ["icb", "industry", "sector", "icbLevel", "icb_level"]);
  const hasHoseFilter = hasFilterKeyword(filters, ["exchange", "market", "san"], ["hose", "hsx", "ho chi minh"]);
  const hasRankingFilter =
    hasFilterValue(filters, ["top", "limit", "n", "size"])
    || hasFilterKeyword(filters, ["sort", "order", "direction"], ["asc", "desc", "top", "bottom"]);
  const hasValuationMetricFilter = hasFilterKeyword(
    filters,
    ["metric", "ratio", "valuationMetric", "valuation"],
    ["pe", "p/e", "pb", "p/b", "ev/ebitda", "ev_ebitda"]
  );
  const asksIcb = hasAnyKeyword(normalized, ICB_KEYWORDS);
  const asksHoseUniverse = hasAnyKeyword(normalized, HOSE_KEYWORDS);
  const asksExchangeUniverse = hasAnyKeyword(normalized, EXCHANGE_UNIVERSE_KEYWORDS);
  const asksRanking = hasAnyKeyword(normalized, RANKING_KEYWORDS);
  const asksFabricationDirective = isFabricationDirective(normalized);
  const asksFabricationRanking = asksFabricationDirective && (
    asksRanking
    || hasRankingFilter
    || /\btop\s*\d{1,2}\b/.test(normalized)
  );
  const asksNumericMarketData = hasAnyKeyword(normalized, NUMERIC_MARKET_KEYWORDS);
  const asksStockRankingAction = hasAnyKeyword(normalized, STOCK_RANKING_ACTION_KEYWORDS);
  const asksSpecificStockUniverseHint = hasAnyKeyword(normalized, STOCK_UNIVERSE_SPECIFIC_HINT_KEYWORDS);
  const asksBroadMarketOverview = hasAnyKeyword(normalized, MARKET_OVERVIEW_GUARD_KEYWORDS);
  const asksValuationSignal =
    hasAnyKeyword(normalized, VALUATION_KEYWORDS)
    || hasAnyKeyword(normalized, PEER_KEYWORDS)
    || hasAnyKeyword(normalized, VALUATION_RANKING_KEYWORDS)
    || hasValuationMetricFilter;
  const asksUniverseFilters = hasDateFilter || hasIcbFilter || hasHoseFilter;
  const hasUniverseScope =
    asksSpecificStockUniverseHint
    || asksHoseUniverse
    || asksExchangeUniverse
    || asksUniverseFilters
    || hasRankingFilter
    || (asksRanking && asksNumericMarketData);

  // Broad market-overview queries (VNINDEX/gainer/loser context) should route to market snapshot,
  // not stock-universe ranking unless explicit stock-universe scope is present.
  if (
    asksBroadMarketOverview
    && !asksSpecificStockUniverseHint
    && !asksHoseUniverse
    && !asksExchangeUniverse
    && !asksUniverseFilters
    && !hasRankingFilter
    && !asksIcb
    && !hasIcbFilter
  ) {
    return false;
  }

  // Symbol-scoped requests (from message or context) should not be treated as stock-universe ranking.
  if (hasExplicitSymbol) {
    return false;
  }

  return (
    !asksIcb
    && !hasIcbFilter
    && (
      asksFabricationRanking
      || (
        (asksRanking || hasRankingFilter || asksStockRankingAction)
        && hasUniverseScope
        && (asksNumericMarketData || asksStockRankingAction || !asksValuationSignal)
      )
    )
  );
}

export function getCandidateSymbols(message: string, contextSnapshot?: AssistantContextSnapshot): string[] {
  const contextSymbols: string[] = [];
  const pushContextSymbol = (candidate: unknown) => {
    const normalized = normalizeSymbol(candidate);
    if (!normalized) return;
    contextSymbols.push(normalized);
  };
  if (contextSnapshot?.symbol) {
    pushContextSymbol(contextSnapshot.symbol);
  }
  if (Array.isArray(contextSnapshot?.symbols)) {
    for (const symbol of contextSnapshot.symbols) {
      pushContextSymbol(symbol);
    }
  }
  if (isRecord(contextSnapshot?.filters)) {
    const filter = contextSnapshot.filters;
    const candidates = [filter.symbol, filter.ticker, filter.stock, filter.code, filter.ma];
    for (const candidate of candidates) {
      pushContextSymbol(candidate);
    }
    const groupedCandidates = [filter.symbols, filter.tickers, filter.codes, filter.maList];
    for (const grouped of groupedCandidates) {
      if (Array.isArray(grouped)) {
        for (const item of grouped) {
          pushContextSymbol(item);
        }
        continue;
      }
      if (typeof grouped === "string") {
        const tokens = grouped.split(/[,\s;|]+/);
        for (const token of tokens) {
          pushContextSymbol(token);
        }
      }
    }
  }

  const explicitMessageSymbols = extractExplicitSymbolHints(message);
  const compareMessageSymbols = extractCompareSymbolHints(message);
  if (
    looksLikeUniverseStockRanking(message, contextSnapshot)
    && contextSymbols.length === 0
    && explicitMessageSymbols.length === 0
    && compareMessageSymbols.length === 0
  ) {
    return [];
  }

  const messageUppercaseTokens = extractUppercaseSymbolTokens(message);
  const unique = Array.from(
    new Set([
      ...contextSymbols,
      ...explicitMessageSymbols,
      ...compareMessageSymbols,
      ...messageUppercaseTokens,
    ])
  )
    .filter((symbol) => isLikelySymbolToken(symbol));

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
  const matches = message.match(UPPERCASE_SYMBOL_TOKEN_REGEX) ?? [];
  return matches.map(normalizeSymbol);
}

function extractExplicitSymbolHints(message: string): string[] {
  const normalized = normalizeForKeywordMatch(message);
  const hints: string[] = [];
  const patterns = [
    /\b(?:ma|mck|ticker|symbol|cp|code)\b\s*[:=-]?\s*(?!co\b|chung\b|ck\b)([a-z0-9]{2,4})\b/g,
    /\bma\s+(?:co\s+phieu|chung\s+khoan|ck)\s*[:=-]?\s*([a-z0-9]{2,4})\b/g,
    /\$([a-z0-9]{2,4})\b/g,
  ];
  for (const pattern of patterns) {
    let match = pattern.exec(normalized);
    while (match) {
      hints.push(normalizeSymbol(match[1]));
      match = pattern.exec(normalized);
    }
  }
  return hints;
}

function extractCompareSymbolHints(message: string): string[] {
  const normalized = normalizeForKeywordMatch(message);
  if (!hasAnyKeyword(normalized, COMPARE_INTENT_KEYWORDS)) {
    return [];
  }

  const hints: string[] = [];
  const pushHint = (candidate: string) => {
    const normalizedCandidate = normalizeSymbol(candidate);
    if (!normalizedCandidate) return;
    if (!isLikelyCompareSymbolToken(normalizedCandidate, message)) return;
    hints.push(normalizedCandidate);
  };

  const pairPatterns = [
    /\b([a-z0-9]{2,4})\s*(?:vs|versus|\/)\s*([a-z0-9]{2,4})\b/g,
    /\b(?:so sanh|compare)\s+(?:giua\s+)?([a-z0-9]{2,4})\s*(?:va|voi|and|&|vs|versus|\/|,)\s*([a-z0-9]{2,4})\b/g,
  ];
  for (const pattern of pairPatterns) {
    let match = pattern.exec(normalized);
    while (match) {
      pushHint(match[1]);
      pushHint(match[2]);
      match = pattern.exec(normalized);
    }
  }

  return hints;
}

function looksLikeUniverseStockRanking(message: string, contextSnapshot?: AssistantContextSnapshot): boolean {
  return isStockUniverseRankingIntent(message, contextSnapshot);
}

function isLikelySymbolToken(symbol: string): boolean {
  if (!SYMBOL_TOKEN_PATTERN.test(symbol)) return false;
  if (BANNED_SYMBOLS.has(symbol)) return false;
  if (COMMON_NON_SYMBOL_TOKENS.has(symbol)) return false;
  if (COMPARE_NON_SYMBOL_TOKENS.has(symbol)) return false;
  return true;
}

function isLikelyCompareSymbolToken(symbol: string, message: string): boolean {
  if (!isLikelySymbolToken(symbol)) return false;
  if (symbol.length <= 3 || /\d/.test(symbol)) return true;
  return appearsAsUppercaseToken(message, symbol);
}

function appearsAsUppercaseToken(message: string, token: string): boolean {
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenPattern = new RegExp(`\\b${escapedToken}\\b`);
  return tokenPattern.test(message);
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

function hasFundamentalShorthandSignal(normalized: string): boolean {
  if (!normalized) return false;
  const shorthandPatterns: RegExp[] = [
    /\bis\s*[+\/,|&-]\s*bs\s*[+\/,|&-]\s*cf\b/i,
    /\bbs\s*[+\/,|&-]\s*is\s*[+\/,|&-]\s*cf\b/i,
    /\bcf\s*[+\/,|&-]\s*is\s*[+\/,|&-]\s*bs\b/i,
    /\b(?:income\s*statement|balance\s*sheet|cash\s*flow)\b.*\b(?:income\s*statement|balance\s*sheet|cash\s*flow)\b/i,
    /\b(?:bctc|bctn|bcdkt|lctt|kqkd)\b/i,
    /\b(?:ocf|cfo|fcf|lnst)\b/i,
    /\b(?:d\/e|debt\/equity|debt to equity)\b/i,
    /\b(?:accrual|quality of earnings)\b/i,
    /\b(?:statement\s+all|all\s+statement|3\s*statement)\b/i,
  ];
  return shorthandPatterns.some((pattern) => pattern.test(normalized));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

