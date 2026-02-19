import type { AssistantContextSnapshot, AssistantToolName } from "@/types/assistant";
import {
  collectRequiredSignals,
  getCandidateSymbols,
  hasAnyKeyword,
  isFabricationDirective,
  normalizeForKeywordMatch,
} from "@/lib/assistant/signals";

export type AssistantQueryIntent =
  | "data_health"
  | "valuation_ranking"
  | "icb_snapshot"
  | "fundamentals"
  | "valuation"
  | "risk"
  | "backtesting"
  | "factor"
  | "market"
  | "stock_snapshot"
  | "mixed";

export interface AssistantQueryPlanFilters {
  date?: string;
  from?: string;
  to?: string;
  icb?: string;
  icbLevel?: "2" | "3" | "4";
  statement?: "all" | "bs" | "is" | "cf";
  metric?: "pe" | "pb" | "ev_ebitda";
  order?: "asc" | "desc";
  limit?: number;
}

export interface AssistantQueryPlanStep {
  tool: AssistantToolName;
  endpoint: string;
  reason: string;
  required: boolean;
}

export interface AssistantQueryPlan {
  intent: AssistantQueryIntent;
  confidence: "high" | "medium" | "low";
  symbols: string[];
  filters: AssistantQueryPlanFilters;
  steps: AssistantQueryPlanStep[];
  summary: string;
}

interface BuildAssistantQueryPlanInput {
  message: string;
  contextSnapshot?: AssistantContextSnapshot;
  baselineOnlyMode: boolean;
}

const TOOL_ENDPOINTS: Record<AssistantToolName, string> = {
  dataHealth: "/api/health/data",
  stockSnapshot: "/api/stocks",
  fundamentalSnapshot: "/api/fundamentals",
  fundamentalAnalysis: "/api/finance-analysis",
  financialHealthScore: "/api/finance-analysis",
  valuationDcf: "/api/finance-analysis",
  peerMultiples: "/api/finance-analysis",
  scenarioSensitivity: "/api/finance-analysis",
  riskSnapshot: "/api/risk",
  backtestSummary: "/api/backtesting",
  factorSnapshot: "/api/factors",
  marketSnapshot: "/api/market-overview",
  icbSnapshot: "/api/analytics/icb-snapshot",
  valuationRanking: "/api/analytics/valuation-rankings",
};

const STEP_PRIORITY: AssistantToolName[] = [
  "dataHealth",
  "stockSnapshot",
  "fundamentalSnapshot",
  "fundamentalAnalysis",
  "financialHealthScore",
  "valuationDcf",
  "peerMultiples",
  "scenarioSensitivity",
  "riskSnapshot",
  "backtestSummary",
  "factorSnapshot",
  "marketSnapshot",
  "icbSnapshot",
  "valuationRanking",
];

const ICB_KEYWORDS = ["icb", "industry", "sector", "nhom nganh", "phan nhom"];
const RANKING_KEYWORDS = ["top", "ranking", "xep hang", "cao nhat", "thap nhat", "lon nhat", "nho nhat"];
const VALUATION_KEYWORDS = ["valuation", "dcf", "p/e", "p/b", "pe", "pb", "ev/ebitda", "dinh gia"];
const MARKET_KEYWORDS = ["market", "thi truong", "vnindex", "gainer", "loser", "overview"];
const FUNDAMENTAL_KEYWORDS = [
  "fundamental",
  "co ban",
  "bao cao tai chinh",
  "bctc",
  "bctn",
  "kqkd",
  "bcdkt",
  "lctt",
  "income statement",
  "balance sheet",
  "cash flow",
  "doanh thu",
  "loi nhuan",
  "tai san",
];
const STOCK_UNIVERSE_HINT_KEYWORDS = ["co phieu", "stock", "stocks", "ticker", "ma co phieu", "hose", "hnx", "upcom", "thi truong"];
const STOCK_UNIVERSE_SPECIFIC_HINT_KEYWORDS = ["co phieu", "stock", "stocks", "ticker", "ma co phieu"];
const MARKET_OVERVIEW_KEYWORDS = ["market", "vnindex", "overview", "gainer", "loser"];
const NUMERIC_STOCK_METRIC_KEYWORDS = [
  "price",
  "close",
  "open",
  "high",
  "low",
  "volume",
  "gia",
  "gia dong cua",
  "dong cua",
  "gia mo cua",
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
const DATA_DEBUG_KEYWORDS = [
  "missing data",
  "no data",
  "dataset unavailable",
  "data unavailable",
  "data backend",
  "manifest",
  "khong co du lieu",
  "thieu du lieu",
  "khong truy cap",
  "cannot access",
];

export function buildAssistantQueryPlan(input: BuildAssistantQueryPlanInput): AssistantQueryPlan {
  const requiredSignals = collectRequiredSignals({
    message: input.message,
    contextSnapshot: input.contextSnapshot,
    baselineOnlyMode: input.baselineOnlyMode,
  });
  const symbols = getCandidateSymbols(input.message, input.contextSnapshot);
  const filters = extractFilters(input.message, input.contextSnapshot);
  const intent = inferIntent(input.message, input.contextSnapshot, requiredSignals.map((item) => item.tool), symbols);
  const steps = buildSteps(requiredSignals.map((item) => item.tool), intent, symbols);
  const confidence = resolvePlanConfidence(requiredSignals.length, symbols.length, filters);
  const summary = buildSummary(intent, symbols, filters, steps);

  return {
    intent,
    confidence,
    symbols,
    filters,
    steps,
    summary,
  };
}

function buildSteps(
  requiredTools: AssistantToolName[],
  intent: AssistantQueryIntent,
  symbols: string[]
): AssistantQueryPlanStep[] {
  const desiredTools = new Set<AssistantToolName>(requiredTools);

  if (intent === "valuation_ranking") {
    desiredTools.add("valuationRanking");
    desiredTools.add("icbSnapshot");
  } else if (intent === "icb_snapshot") {
    desiredTools.add("icbSnapshot");
  } else if (intent === "fundamentals") {
    desiredTools.add("fundamentalSnapshot");
    desiredTools.add("fundamentalAnalysis");
  } else if (intent === "valuation") {
    desiredTools.add("valuationDcf");
  } else if (intent === "risk") {
    desiredTools.add("riskSnapshot");
  } else if (intent === "backtesting") {
    desiredTools.add("backtestSummary");
  } else if (intent === "factor") {
    desiredTools.add("factorSnapshot");
  } else if (intent === "market") {
    desiredTools.add("marketSnapshot");
  } else if (intent === "stock_snapshot") {
    desiredTools.delete("marketSnapshot");
    desiredTools.add("stockSnapshot");
  }

  if (desiredTools.size === 0) {
    desiredTools.add(symbols.length > 0 ? "stockSnapshot" : "marketSnapshot");
  }

  const requiredSet = new Set(requiredTools);
  const orderedTools = STEP_PRIORITY.filter((tool) => desiredTools.has(tool));
  return orderedTools.map((tool) => ({
    tool,
    endpoint: TOOL_ENDPOINTS[tool],
    required: requiredSet.has(tool),
    reason: describeToolReason(tool, intent),
  }));
}

function describeToolReason(tool: AssistantToolName, intent: AssistantQueryIntent): string {
  if (tool === "valuationRanking") return "Cross-sectional valuation ranking by metric/date/ICB.";
  if (tool === "icbSnapshot") return "ICB grouped market snapshot for sector-level aggregation.";
  if (tool === "fundamentalSnapshot") return "Raw statement grounding for BCTC/BCTN/LCTT metrics.";
  if (tool === "fundamentalAnalysis") return "Deterministic financial ratios and coverage diagnostics.";
  if (tool === "stockSnapshot") return "Symbol OHLCV as-of or time-window grounding.";
  if (tool === "dataHealth") return "Dataset/backend readiness diagnostics for missing-data claims.";
  if (tool === "marketSnapshot") return "Broad market context snapshot.";
  if (tool === "valuationDcf") return "Deterministic valuation output for symbol-focused requests.";
  return `Grounding tool selected for intent ${intent}.`;
}

function inferIntent(
  message: string,
  contextSnapshot: AssistantContextSnapshot | undefined,
  requiredTools: AssistantToolName[],
  symbols: string[]
): AssistantQueryIntent {
  const normalized = normalizeForKeywordMatch(message);
  const asksFundamentals = hasAnyKeyword(normalized, FUNDAMENTAL_KEYWORDS);
  const likelyUniverseStockSnapshot = isLikelyUniverseStockSnapshotQuery(normalized, contextSnapshot);
  if (requiredTools.includes("dataHealth")) return "data_health";
  if (requiredTools.includes("valuationRanking")) return "valuation_ranking";
  if (requiredTools.includes("icbSnapshot")) return "icb_snapshot";
  if (requiredTools.includes("valuationDcf") || requiredTools.includes("peerMultiples")) return "valuation";
  if (requiredTools.includes("backtestSummary")) return "backtesting";
  if (requiredTools.includes("riskSnapshot")) return "risk";
  if (requiredTools.includes("factorSnapshot")) return "factor";
  if (likelyUniverseStockSnapshot && !asksFundamentals) return "stock_snapshot";
  if (requiredTools.includes("stockSnapshot") && likelyUniverseStockSnapshot) return "stock_snapshot";
  if (requiredTools.includes("stockSnapshot") && !asksFundamentals) return "stock_snapshot";
  if (requiredTools.includes("fundamentalSnapshot") || requiredTools.includes("fundamentalAnalysis")) return "fundamentals";
  if (requiredTools.includes("stockSnapshot")) return "stock_snapshot";
  if (requiredTools.includes("marketSnapshot") && !requiredTools.includes("stockSnapshot")) return "market";
  if (requiredTools.includes("marketSnapshot")) return "market";

  if (likelyUniverseStockSnapshot) return "stock_snapshot";
  if (hasAnyKeyword(normalized, DATA_DEBUG_KEYWORDS)) return "data_health";
  if (hasAnyKeyword(normalized, ICB_KEYWORDS) && hasAnyKeyword(normalized, RANKING_KEYWORDS)) return "icb_snapshot";
  if (hasAnyKeyword(normalized, VALUATION_KEYWORDS) && hasAnyKeyword(normalized, RANKING_KEYWORDS)) return "valuation_ranking";
  if (hasAnyKeyword(normalized, MARKET_KEYWORDS)) return "market";
  if (symbols.length > 0) return "stock_snapshot";

  if (contextSnapshot?.page === "factors") return "factor";
  if (contextSnapshot?.page === "risk") return "risk";
  if (contextSnapshot?.page === "backtesting") return "backtesting";

  return "mixed";
}

function isLikelyUniverseStockSnapshotQuery(
  normalizedMessage: string,
  contextSnapshot: AssistantContextSnapshot | undefined
): boolean {
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot.filters : undefined;
  const metricHint = normalizeForKeywordMatch(
    String(filters?.metric ?? filters?.sortBy ?? filters?.field ?? filters?.valueField ?? "")
  );
  const rankingHint = `${metricHint} ${normalizedMessage}`.trim();
  const hasRanking =
    hasAnyKeyword(normalizedMessage, RANKING_KEYWORDS)
    || hasNumericFilterValue(filters?.top)
    || hasNumericFilterValue(filters?.limit)
    || hasNumericFilterValue(filters?.n);
  const asksFabricationRanking = isFabricationDirective(normalizedMessage) && hasRanking;
  const hasStockMetric = hasAnyKeyword(rankingHint, NUMERIC_STOCK_METRIC_KEYWORDS);
  const hasRankingAction = hasAnyKeyword(normalizedMessage, STOCK_RANKING_ACTION_KEYWORDS);
  const asksIcb = hasAnyKeyword(normalizedMessage, ICB_KEYWORDS);
  const asksBroadMarketOverview = hasAnyKeyword(normalizedMessage, MARKET_OVERVIEW_KEYWORDS);
  const hasSpecificUniverseHint = hasAnyKeyword(normalizedMessage, STOCK_UNIVERSE_SPECIFIC_HINT_KEYWORDS);
  const hasUniverseHint =
    hasAnyKeyword(normalizedMessage, STOCK_UNIVERSE_HINT_KEYWORDS)
    || typeof filters?.exchange === "string"
    || typeof filters?.market === "string"
    || typeof filters?.icb === "string"
    || normalizeDateLike(filters?.date) !== null
    || normalizeDateLike(filters?.asOfDate) !== null
    || normalizeDateLike(filters?.as_of_date) !== null
    || extractDateInMessage(normalizedMessage) !== null
    || (hasRanking && hasStockMetric);
  const hasStructuredUniverseScope =
    typeof filters?.exchange === "string"
    || typeof filters?.market === "string"
    || normalizeDateLike(filters?.date) !== null
    || normalizeDateLike(filters?.asOfDate) !== null
    || normalizeDateLike(filters?.as_of_date) !== null
    || extractDateInMessage(normalizedMessage) !== null;
  if (asksIcb) return false;
  if (asksFabricationRanking) return true;
  if (asksBroadMarketOverview && !hasSpecificUniverseHint && !hasStructuredUniverseScope) return false;
  return hasRanking
    && hasUniverseHint
    && (hasStockMetric || hasRankingAction || !hasAnyKeyword(normalizedMessage, VALUATION_KEYWORDS));
}

function hasNumericFilterValue(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0;
  }
  return false;
}

function resolvePlanConfidence(
  requiredSignalCount: number,
  symbolCount: number,
  filters: AssistantQueryPlanFilters
): "high" | "medium" | "low" {
  const filterSignals = [
    filters.date,
    filters.from,
    filters.to,
    filters.icb,
    filters.metric,
    filters.statement,
    filters.limit,
  ].filter((value) => value !== undefined && value !== null).length;
  if (requiredSignalCount >= 2 || (requiredSignalCount >= 1 && (symbolCount > 0 || filterSignals > 0))) {
    return "high";
  }
  if (requiredSignalCount > 0 || symbolCount > 0 || filterSignals > 0) {
    return "medium";
  }
  return "low";
}

function buildSummary(
  intent: AssistantQueryIntent,
  symbols: string[],
  filters: AssistantQueryPlanFilters,
  steps: AssistantQueryPlanStep[]
): string {
  const parts: string[] = [`intent=${intent}`];
  if (symbols.length > 0) {
    parts.push(`symbols=${symbols.join(",")}`);
  }

  const filterTokens: string[] = [];
  if (filters.date) filterTokens.push(`date=${filters.date}`);
  if (filters.from) filterTokens.push(`from=${filters.from}`);
  if (filters.to) filterTokens.push(`to=${filters.to}`);
  if (filters.icb) filterTokens.push(`icb=${filters.icb}`);
  if (filters.icbLevel) filterTokens.push(`icbLevel=${filters.icbLevel}`);
  if (filters.statement) filterTokens.push(`statement=${filters.statement}`);
  if (filters.metric) filterTokens.push(`metric=${filters.metric}`);
  if (filters.order) filterTokens.push(`order=${filters.order}`);
  if (typeof filters.limit === "number") filterTokens.push(`limit=${filters.limit}`);
  if (filterTokens.length > 0) {
    parts.push(`filters{${filterTokens.join(",")}}`);
  }

  if (steps.length > 0) {
    parts.push(`tools=${steps.map((step) => step.tool).join(">")}`);
  }
  return parts.join(" | ");
}

function extractFilters(message: string, contextSnapshot?: AssistantContextSnapshot): AssistantQueryPlanFilters {
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot.filters : undefined;
  const normalizedMessage = normalizeForKeywordMatch(message);

  const date = normalizeDateLike(
    filters?.date ?? filters?.asOfDate ?? filters?.as_of_date ?? filters?.day ?? extractDateInMessage(message)
  );
  const from = normalizeDateLike(filters?.from);
  const to = normalizeDateLike(filters?.to);
  const icbRaw = String(filters?.icb ?? filters?.industry ?? filters?.sector ?? "").trim();
  const icb = icbRaw.length > 0 ? icbRaw.slice(0, 80) : inferIcbHint(normalizedMessage);
  const icbLevel = extractIcbLevel(filters, normalizedMessage);
  const statement = extractStatement(filters, normalizedMessage);
  const metric = extractMetric(filters, normalizedMessage);
  const order = extractOrder(filters, normalizedMessage);
  const limit = extractLimit(filters, message);

  return {
    date: date || undefined,
    from: from || undefined,
    to: to || undefined,
    icb: icb || undefined,
    icbLevel,
    statement,
    metric,
    order,
    limit: limit ?? undefined,
  };
}

function extractDateInMessage(message: string): string | null {
  const match = message.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/);
  if (!match) return null;
  return match[1];
}

function normalizeDateLike(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(trimmed)) return trimmed.replace(/\//g, "-");
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(trimmed)) return trimmed.replace(/\//g, "-");
  return null;
}

function inferIcbHint(normalizedMessage: string): string | null {
  const hints: Array<{ keywords: string[]; value: string }> = [
    { keywords: ["ngan hang", "bank"], value: "ngan hang" },
    { keywords: ["bat dong san", "real estate", "property"], value: "bat dong san" },
    { keywords: ["chung khoan", "securities"], value: "chung khoan" },
    { keywords: ["dau khi", "oil", "gas"], value: "dau khi" },
    { keywords: ["ban le", "retail"], value: "ban le" },
  ];
  for (const hint of hints) {
    if (hint.keywords.some((keyword) => normalizedMessage.includes(keyword))) {
      return hint.value;
    }
  }
  return null;
}

function extractIcbLevel(
  filters: Record<string, unknown> | undefined,
  normalizedMessage: string
): "2" | "3" | "4" | undefined {
  const fromFilter = String(filters?.icbLevel ?? filters?.icb_level ?? "").trim();
  if (fromFilter === "2" || fromFilter === "3" || fromFilter === "4") return fromFilter;

  const messageMatch = /\bicb\s*([234])\b/.exec(normalizedMessage);
  if (messageMatch && (messageMatch[1] === "2" || messageMatch[1] === "3" || messageMatch[1] === "4")) {
    return messageMatch[1];
  }
  return undefined;
}

function extractStatement(
  filters: Record<string, unknown> | undefined,
  normalizedMessage: string
): "all" | "bs" | "is" | "cf" | undefined {
  const rawFilter = normalizeForKeywordMatch(
    String(filters?.statement ?? filters?.statementType ?? filters?.reportType ?? filters?.baoCao ?? "")
  );
  if (["all", "bctc"].includes(rawFilter)) return "all";
  if (["bs", "bcdkt", "bang can doi ke toan", "can doi ke toan"].includes(rawFilter)) return "bs";
  if (["is", "bctn", "kqkd", "bao cao ket qua kinh doanh", "income statement"].includes(rawFilter)) return "is";
  if (["cf", "lctt", "bao cao luu chuyen tien te", "cash flow"].includes(rawFilter)) return "cf";

  if (
    normalizedMessage.includes("bcdkt")
    || normalizedMessage.includes("balance sheet")
    || normalizedMessage.includes("can doi ke toan")
  ) {
    return "bs";
  }
  if (
    normalizedMessage.includes("bctn")
    || normalizedMessage.includes("kqkd")
    || normalizedMessage.includes("income statement")
    || normalizedMessage.includes("bao cao ket qua kinh doanh")
  ) {
    return "is";
  }
  if (
    normalizedMessage.includes("lctt")
    || normalizedMessage.includes("cash flow")
    || normalizedMessage.includes("bao cao luu chuyen tien te")
  ) {
    return "cf";
  }
  if (normalizedMessage.includes("bctc") || normalizedMessage.includes("bao cao tai chinh")) {
    return "all";
  }
  return undefined;
}

function extractMetric(
  filters: Record<string, unknown> | undefined,
  normalizedMessage: string
): "pe" | "pb" | "ev_ebitda" | undefined {
  const metric = normalizeForKeywordMatch(String(filters?.metric ?? filters?.ratio ?? filters?.valuationMetric ?? ""));
  if (metric.includes("ev/ebitda") || metric.includes("ev_ebitda") || metric.includes("ev ebitda")) return "ev_ebitda";
  if (metric === "pb" || metric === "p/b") return "pb";
  if (metric === "pe" || metric === "p/e") return "pe";

  if (normalizedMessage.includes("ev/ebitda") || normalizedMessage.includes("ev ebitda")) return "ev_ebitda";
  if (normalizedMessage.includes("p/b") || /\bpb\b/.test(normalizedMessage)) return "pb";
  if (normalizedMessage.includes("p/e") || /\bpe\b/.test(normalizedMessage)) return "pe";
  return undefined;
}

function extractOrder(
  filters: Record<string, unknown> | undefined,
  normalizedMessage: string
): "asc" | "desc" | undefined {
  const fromFilter = normalizeForKeywordMatch(String(filters?.order ?? filters?.sort ?? filters?.direction ?? ""));
  if (["asc", "ascending", "bottom", "lowest", "thap nhat"].some((key) => fromFilter.includes(key))) return "asc";
  if (["desc", "descending", "top", "highest", "cao nhat"].some((key) => fromFilter.includes(key))) return "desc";

  if (
    normalizedMessage.includes("thap nhat")
    || normalizedMessage.includes("lowest")
    || normalizedMessage.includes("smallest")
    || normalizedMessage.includes("bottom")
  ) {
    return "asc";
  }
  if (
    normalizedMessage.includes("cao nhat")
    || normalizedMessage.includes("highest")
    || normalizedMessage.includes("top")
  ) {
    return "desc";
  }
  return undefined;
}

function extractLimit(filters: Record<string, unknown> | undefined, message: string): number | null {
  const filterLimit =
    parsePositiveInt(filters?.limit, 1, 50)
    ?? parsePositiveInt(filters?.top, 1, 50)
    ?? parsePositiveInt(filters?.n, 1, 50);
  if (filterLimit !== null) return filterLimit;

  const topMatch = message.toLowerCase().match(/\btop\s*(\d{1,2})\b/);
  if (!topMatch) return null;
  const parsed = Number.parseInt(topMatch[1], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(50, parsed);
}

function parsePositiveInt(value: unknown, min: number, max: number): number | null {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < min) return null;
  return Math.min(max, parsed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
