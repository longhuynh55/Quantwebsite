import type { AssistantContextSnapshot, AssistantToolName, AssistantToolUsage } from "@/types/assistant";
import type { GroundingResult } from "@/lib/assistant/tools";
import { collectRequiredSignals, getCandidateSymbols, isFabricationDirective, type RequiredSignal } from "@/lib/assistant/signals";
import type { AssistantQueryPlan } from "@/lib/assistant/planner";

export type AssistantPolicyMode = "shadow" | "enforce_high_risk" | "enforce_all";
export type AssistantPolicyStatus = "ok" | "fallback" | "shadow_blocked";
export type AssistantConfidence = "high" | "medium" | "low";
export type PolicyReasonCode =
  | "insufficient_grounding"
  | "required_tool_failed"
  | "required_tool_skipped"
  | "missing_citation"
  | "no_numeric_evidence"
  | "missing_symbol_grounding"
  | "invalid_date_not_supported"
  | "future_date_not_supported"
  | "fabrication_directive_blocked"
  | "ambiguous_symbol_not_supported";

interface PolicyEvaluationInput {
  message: string;
  contextSnapshot?: AssistantContextSnapshot;
  conversationHistory?: string;
  queryPlan?: AssistantQueryPlan;
  grounding: GroundingResult;
}

export interface PolicyEvaluationResult {
  mode: AssistantPolicyMode;
  status: AssistantPolicyStatus;
  reasonCode?: PolicyReasonCode;
  reason?: string;
  dataConfidence: AssistantConfidence;
  groundingRequired: boolean;
  groundingSatisfied: boolean;
  shouldBypassLlm: boolean;
  responseMessage?: string;
  shadowBlocked: boolean;
}

const HIGH_RISK_PAGES = new Set<AssistantContextSnapshot["page"]>([
  "backtesting",
  "risk",
  "factors",
  "charts",
  "portfolio",
]);
const HIGH_RISK_TOOLS = new Set<AssistantToolName>([
  "fundamentalSnapshot",
  "fundamentalAnalysis",
  "financialHealthScore",
  "valuationDcf",
  "peerMultiples",
  "valuationRanking",
  "icbSnapshot",
  "scenarioSensitivity",
  "riskSnapshot",
  "backtestSummary",
  "factorSnapshot",
]);

const BASELINE_ONLY_MODE =
  String(process.env.ASSISTANT_BASELINE_ONLY ?? "false").trim().toLowerCase() === "true";

const NUMERIC_KEYWORDS = [
  "net return",
  "return",
  "sharpe",
  "sortino",
  "drawdown",
  "max drawdown",
  "volatility",
  "beta",
  "var",
  "cvar",
  "profit factor",
  "turnover",
  "cagr",
  "exposure",
  "metrics",
  "valuation",
  "dcf",
  "fair value",
  "intrinsic value",
  "wacc",
  "terminal growth",
  "health score",
  "p/e",
  "p/b",
  "ev/ebitda",
  "bctc",
  "bctn",
  "kqkd",
  "bcdkt",
  "lctt",
  "bao cao tai chinh",
  "bao cao ket qua kinh doanh",
  "bang can doi ke toan",
  "bao cao luu chuyen tien te",
  "doanh thu",
  "loi nhuan",
  "tong tai san",
  "so lieu",
  "ti le",
  "phan tram",
];
const RECOMMENDATION_KEYWORDS = [
  "khuyen nghi",
  "goi y",
  "nen mua",
  "nen ban",
  "nen giu",
  "de xuat",
  "recommend",
  "recommendation",
  "actionable",
  "allocate",
  "rebalance",
  "entry",
  "exit",
  "stoploss",
  "take profit",
];
const INVALID_TICKER_TOKENS = new Set(["API", "JSON", "HTTP", "HTTPS", "CSV", "OHLC", "OHLCV"]);
const NON_SYMBOL_POLICY_TOKENS = new Set([
  "BCTC",
  "BCTN",
  "LCTT",
  "BCDKT",
  "KQKD",
  "LNST",
  "EPS",
  "PBT",
  "OCF",
  "CFO",
  "FCF",
  "ROE",
  "ROA",
  "PE",
  "PB",
]);
const PRICE_METRIC_HINTS = [
  "close",
  "open",
  "high",
  "low",
  "volume",
  "gia dong cua",
  "gia mo cua",
  "khoi luong",
];

export function evaluateAssistantPolicy(input: PolicyEvaluationInput): PolicyEvaluationResult {
  const mode = getPolicyMode();
  const normalizedMessage = normalizeForKeywordMatch(input.message);
  const fabricationViolation = detectFabricationDirectiveViolation(input.message, input.contextSnapshot);
  if (fabricationViolation) {
    const fallbackMessage = buildFallbackMessage("fabrication_directive_blocked", fabricationViolation.reason);
    const shadowBlocked = mode === "shadow";
    return {
      mode,
      status: shadowBlocked ? "shadow_blocked" : "fallback",
      reasonCode: "fabrication_directive_blocked",
      reason: fabricationViolation.reason,
      dataConfidence: "low",
      groundingRequired: false,
      groundingSatisfied: false,
      shouldBypassLlm: true,
      responseMessage: fallbackMessage,
      shadowBlocked,
    };
  }
  const ambiguousSymbolViolation = detectAmbiguousSymbolViolation(input.message, input.contextSnapshot);
  if (ambiguousSymbolViolation) {
    const fallbackMessage = buildFallbackMessage("ambiguous_symbol_not_supported", ambiguousSymbolViolation.reason);
    return {
      mode,
      status: "fallback",
      reasonCode: "ambiguous_symbol_not_supported",
      reason: ambiguousSymbolViolation.reason,
      dataConfidence: "low",
      groundingRequired: false,
      groundingSatisfied: false,
      shouldBypassLlm: true,
      responseMessage: fallbackMessage,
      shadowBlocked: false,
    };
  }
  const futureDateViolation = detectFutureDateViolation(input.message, input.contextSnapshot);
  if (futureDateViolation) {
    const reason = `Requested date ${futureDateViolation.requestedDate} is in the future and unsupported for grounded market data.`;
    const fallbackMessage = buildFallbackMessage("future_date_not_supported", reason);
    const shadowBlocked = mode === "shadow";
    return {
      mode,
      status: shadowBlocked ? "shadow_blocked" : "fallback",
      reasonCode: "future_date_not_supported",
      reason,
      dataConfidence: "low",
      groundingRequired: false,
      groundingSatisfied: false,
      shouldBypassLlm: true,
      responseMessage: fallbackMessage,
      shadowBlocked,
    };
  }
  const invalidDateViolation = detectInvalidDateViolation(input.message, input.contextSnapshot);
  if (invalidDateViolation) {
    const reason = `Requested date ${invalidDateViolation.invalidDate} is invalid and unsupported for grounded market data.`;
    const fallbackMessage = buildFallbackMessage("invalid_date_not_supported", reason);
    const shadowBlocked = mode === "shadow";
    return {
      mode,
      status: shadowBlocked ? "shadow_blocked" : "fallback",
      reasonCode: "invalid_date_not_supported",
      reason,
      dataConfidence: "low",
      groundingRequired: false,
      groundingSatisfied: false,
      shouldBypassLlm: true,
      responseMessage: fallbackMessage,
      shadowBlocked,
    };
  }
  const requiredSignals = resolveRequiredSignals(input);
  const numericIntent = isNumericIntent(normalizedMessage, input.contextSnapshot, requiredSignals);
  const recommendationIntent = isRecommendationIntent(normalizedMessage, input.queryPlan);
  const strictGroundingIntent = numericIntent || recommendationIntent;

  const enforcementApplies = shouldApplyEnforcement(mode, strictGroundingIntent, input.contextSnapshot, requiredSignals);
  if (!strictGroundingIntent) {
    return {
      mode,
      status: "ok",
      dataConfidence: "medium",
      groundingRequired: false,
      groundingSatisfied: false,
      shouldBypassLlm: false,
      shadowBlocked: false,
    };
  }

  const failure = evaluateGrounding(requiredSignals, input.grounding);
  const symbolCoverageFailure = evaluateMultiSymbolGrounding(
    resolveRequestedSymbols(input),
    input.grounding
  );
  const effectiveFailure = failure ?? symbolCoverageFailure;

  if (!effectiveFailure) {
    return {
      mode,
      status: "ok",
      dataConfidence: "high",
      groundingRequired: true,
      groundingSatisfied: true,
      shouldBypassLlm: false,
      shadowBlocked: false,
    };
  }

  if (recommendationIntent) {
    const fallbackMessage = buildFallbackMessage(effectiveFailure.reasonCode, effectiveFailure.reason);
    return {
      mode,
      status: "fallback",
      reasonCode: effectiveFailure.reasonCode,
      reason: effectiveFailure.reason,
      dataConfidence: "low",
      groundingRequired: true,
      groundingSatisfied: false,
      shouldBypassLlm: true,
      responseMessage: fallbackMessage,
      shadowBlocked: false,
    };
  }

  if (effectiveFailure.reasonCode === "missing_symbol_grounding") {
    const fallbackMessage = buildFallbackMessage(effectiveFailure.reasonCode, effectiveFailure.reason);
    return {
      mode,
      status: "fallback",
      reasonCode: effectiveFailure.reasonCode,
      reason: effectiveFailure.reason,
      dataConfidence: "low",
      groundingRequired: true,
      groundingSatisfied: false,
      shouldBypassLlm: true,
      responseMessage: fallbackMessage,
      shadowBlocked: false,
    };
  }

  if (isSoftNumericFailure(effectiveFailure.reasonCode, effectiveFailure.reason, input.grounding)) {
    const fallbackMessage = buildFallbackMessage(effectiveFailure.reasonCode, effectiveFailure.reason);
    return {
      mode,
      status: "fallback",
      reasonCode: effectiveFailure.reasonCode,
      reason: effectiveFailure.reason,
      dataConfidence: "low",
      groundingRequired: true,
      groundingSatisfied: false,
      shouldBypassLlm: true,
      responseMessage: fallbackMessage,
      shadowBlocked: false,
    };
  }

  if (!enforcementApplies) {
    const isShadowMode = mode === "shadow";
    const fallbackMessage = isShadowMode
      ? buildFallbackMessage(effectiveFailure.reasonCode, effectiveFailure.reason)
      : undefined;
    return {
      mode,
      status: isShadowMode ? "shadow_blocked" : "ok",
      reasonCode: effectiveFailure.reasonCode,
      reason: effectiveFailure.reason,
      dataConfidence: isShadowMode ? "low" : "medium",
      groundingRequired: true,
      groundingSatisfied: false,
      shouldBypassLlm: isShadowMode,
      responseMessage: fallbackMessage,
      shadowBlocked: isShadowMode,
    };
  }

  const fallbackMessage = buildFallbackMessage(effectiveFailure.reasonCode, effectiveFailure.reason);
  return {
    mode,
    status: "fallback",
    reasonCode: effectiveFailure.reasonCode,
    reason: effectiveFailure.reason,
    dataConfidence: "low",
    groundingRequired: true,
    groundingSatisfied: false,
    shouldBypassLlm: true,
    responseMessage: fallbackMessage,
    shadowBlocked: false,
  };
}

function resolveRequiredSignals(input: PolicyEvaluationInput): RequiredSignal[] {
  if (input.queryPlan && Array.isArray(input.queryPlan.steps) && input.queryPlan.steps.length > 0) {
    const plannedSignals = input.queryPlan.steps.map((step) => ({ tool: step.tool, endpoint: step.endpoint }));
    const requiredPlanSignals = input.queryPlan.steps
      .filter((step) => step.required === true)
      .map((step) => ({ tool: step.tool, endpoint: step.endpoint }));
    if (requiredPlanSignals.length > 0) {
      return requiredPlanSignals;
    }
    if (plannedSignals.length > 0) {
      return plannedSignals;
    }
  }

  return collectRequiredSignals({
    message: input.message,
    contextSnapshot: input.contextSnapshot,
    conversationHistory: input.conversationHistory,
    baselineOnlyMode: BASELINE_ONLY_MODE,
  });
}

function resolveRequestedSymbols(input: PolicyEvaluationInput): string[] {
  const planSymbols = Array.isArray(input.queryPlan?.symbols)
    ? input.queryPlan.symbols
        .map((symbol) => normalizeSymbolToken(symbol))
        .filter((symbol): symbol is string => Boolean(symbol))
    : [];
  if (planSymbols.length > 0) {
    return planSymbols;
  }
  return getCandidateSymbols(input.message, input.contextSnapshot, input.conversationHistory);
}

function getPolicyMode(): AssistantPolicyMode {
  const raw = String(process.env.ASSISTANT_POLICY_MODE ?? "shadow").trim().toLowerCase();
  if (raw === "enforce_all") return "enforce_all";
  if (raw === "enforce_high_risk") return "enforce_high_risk";
  return "shadow";
}

function isNumericIntent(
  messageLower: string,
  contextSnapshot: AssistantContextSnapshot | undefined,
  requiredSignals: RequiredSignal[]
): boolean {
  if (requiredSignals.length > 0) return true;
  if (hasNumericFilterHints(contextSnapshot?.filters)) return true;
  if (NUMERIC_KEYWORDS.some((keyword) => messageLower.includes(keyword))) return true;
  if (/%|\b\d+(\.\d+)?\b/.test(messageLower) && HIGH_RISK_PAGES.has(contextSnapshot?.page ?? "home")) return true;
  return false;
}

function shouldApplyEnforcement(
  mode: AssistantPolicyMode,
  numericIntent: boolean,
  contextSnapshot: AssistantContextSnapshot | undefined,
  requiredSignals: RequiredSignal[]
): boolean {
  if (!numericIntent) return false;
  if (mode === "enforce_all") return true;
  if (mode === "enforce_high_risk") {
    if (requiredSignals.some((signal) => HIGH_RISK_TOOLS.has(signal.tool))) return true;
    return HIGH_RISK_PAGES.has(contextSnapshot?.page ?? "home");
  }
  return false;
}

function isRecommendationIntent(
  messageLower: string,
  queryPlan: AssistantQueryPlan | undefined
): boolean {
  if (RECOMMENDATION_KEYWORDS.some((keyword) => messageLower.includes(keyword))) return true;
  const riskyIntent = queryPlan?.intent;
  return riskyIntent === "valuation"
    || riskyIntent === "valuation_ranking"
    || riskyIntent === "risk"
    || riskyIntent === "backtesting"
    || riskyIntent === "factor";
}

function evaluateGrounding(requiredSignals: RequiredSignal[], grounding: GroundingResult): { reasonCode: PolicyReasonCode; reason: string } | null {
  const successByTool = new Map<AssistantToolName, AssistantToolUsage>();
  for (const tool of grounding.usedTools) {
    if (tool.status === "success") {
      successByTool.set(tool.name, tool);
    }
  }

  const errorByTool = new Map<AssistantToolName, AssistantToolUsage>();
  for (const tool of grounding.usedTools) {
    if (tool.status === "error") {
      errorByTool.set(tool.name, tool);
    }
  }
  const skippedByTool = new Map<AssistantToolName, AssistantToolUsage>();
  for (const tool of grounding.usedTools) {
    if (tool.status === "skipped") {
      skippedByTool.set(tool.name, tool);
    }
  }

  const citationEndpoints = new Set(
    grounding.citations.map((citation) => String(citation.endpoint ?? "")).filter(Boolean)
  );

  if (requiredSignals.length === 0) {
    const totalEvidence = grounding.usedTools
      .filter((tool) => tool.status === "success")
      .reduce((acc, tool) => acc + (tool.evidenceCount ?? 0), 0);
    if (successByTool.size === 0 || grounding.citations.length === 0) {
      return {
        reasonCode: "insufficient_grounding",
        reason: "No successful grounding tools or citations were available for numeric output.",
      };
    }
    if (totalEvidence <= 0) {
      return {
        reasonCode: "no_numeric_evidence",
        reason: "Grounding tools returned no numeric evidence for the requested metric.",
      };
    }
    return null;
  }

  for (const signal of requiredSignals) {
    const successTool = successByTool.get(signal.tool);
    if (!successTool) {
      const toolError = errorByTool.get(signal.tool);
      const skippedTool = skippedByTool.get(signal.tool);
      if (skippedTool) {
        return {
          reasonCode: "required_tool_skipped",
          reason: skippedTool.error
            ? `Required tool ${signal.tool} was skipped: ${skippedTool.error}`
            : `Required tool ${signal.tool} was skipped.`,
        };
      }
      return {
        reasonCode: "required_tool_failed",
        reason: toolError?.error
          ? `Required tool ${signal.tool} failed: ${toolError.error}`
          : `Required tool ${signal.tool} was not successful.`,
      };
    }
    if ((successTool.evidenceCount ?? 0) <= 0) {
      if (signal.tool === "fundamentalSnapshot") {
        const analysisTool = successByTool.get("fundamentalAnalysis");
        const analysisHasEvidence = (analysisTool?.evidenceCount ?? 0) > 0;
        const analysisHasCitation = hasMatchingEndpoint(citationEndpoints, "/api/finance-analysis");
        if (analysisHasEvidence && analysisHasCitation) {
          continue;
        }
      }
      return {
        reasonCode: "no_numeric_evidence",
        reason: `Required tool ${signal.tool} returned no numeric evidence.`,
      };
    }
    if (!hasMatchingEndpoint(citationEndpoints, signal.endpoint)) {
      return {
        reasonCode: "missing_citation",
        reason: `Missing citation for required endpoint ${signal.endpoint}.`,
      };
    }
  }

  return null;
}

function evaluateMultiSymbolGrounding(
  requestedSymbols: string[],
  grounding: GroundingResult
): { reasonCode: PolicyReasonCode; reason: string } | null {
  const normalizedRequested = Array.from(
    new Set(
      requestedSymbols
        .map((symbol) => normalizeSymbolToken(symbol))
        .filter((symbol): symbol is string => Boolean(symbol))
    )
  );
  if (normalizedRequested.length < 2) return null;

  const groundedSymbols = new Set<string>();
  for (const citation of grounding.citations) {
    const citationSymbol = normalizeSymbolToken(citation.symbol);
    if (citationSymbol) groundedSymbols.add(citationSymbol);
  }
  for (const tool of grounding.usedTools) {
    if (tool.status !== "success") continue;
    if ((tool.evidenceCount ?? 0) <= 0) continue;
    const symbol = normalizeSymbolToken(tool.requestParams?.symbol);
    if (symbol) groundedSymbols.add(symbol);
  }

  const missing = normalizedRequested.filter((symbol) => !groundedSymbols.has(symbol));
  if (missing.length === 0) return null;

  return {
    reasonCode: "missing_symbol_grounding",
    reason: `Missing grounded evidence for symbols: ${missing.join(", ")}.`,
  };
}

function isSoftNumericFailure(
  reasonCode: PolicyReasonCode,
  reason: string,
  grounding: GroundingResult
): boolean {
  if (reasonCode !== "no_numeric_evidence") return false;
  if (/required tool/i.test(reason)) return false;
  const hasSuccessfulNumericTool = grounding.usedTools.some(
    (tool) => tool.status === "success" && (tool.evidenceCount ?? 0) > 0
  );
  if (!hasSuccessfulNumericTool) return false;
  if (grounding.citations.length > 0) return true;
  return grounding.facts.length > 0;
}

function hasMatchingEndpoint(endpoints: Set<string>, requiredEndpoint: string): boolean {
  for (const endpoint of endpoints) {
    if (endpoint.includes(requiredEndpoint)) return true;
  }
  return false;
}

function normalizeForKeywordMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d");
}

function hasNumericFilterHints(filters: unknown): boolean {
  if (!isRecord(filters)) return false;
  const values = [
    filters.metric,
    filters.valuationMetric,
    filters.statement,
    filters.statementType,
    filters.reportType,
    filters.top,
    filters.limit,
    filters.date,
    filters.asOfDate,
    filters.as_of_date,
    filters.icb,
    filters.icbLevel,
    filters.icb_level,
    filters.exchange,
  ]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => normalizeForKeywordMatch(String(value)));

  if (values.length === 0) return false;
  return values.some((value) =>
    [
      "pe",
      "p/e",
      "pb",
      "p/b",
      "ev/ebitda",
      "ev_ebitda",
      "bctc",
      "bctn",
      "kqkd",
      "bcdkt",
      "lctt",
      "top",
      "icb",
      "hose",
    ].some((keyword) => value.includes(keyword))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function detectFutureDateViolation(
  message: string,
  contextSnapshot?: AssistantContextSnapshot
): { requestedDate: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const normalizedMessage = normalizeForKeywordMatch(message);
  if (
    normalizedMessage.includes("ngay mai")
    || normalizedMessage.includes("tomorrow")
    || normalizedMessage.includes("next trading day")
  ) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return { requestedDate: formatIsoDate(tomorrow) };
  }
  const candidates = collectDateLikeCandidates(message, contextSnapshot);
  for (const candidate of candidates) {
    const parsed = parseDateLike(candidate);
    if (!parsed) continue;
    if (parsed.getTime() > today.getTime()) {
      return { requestedDate: formatIsoDate(parsed) };
    }
  }

  return null;
}

function detectInvalidDateViolation(
  message: string,
  contextSnapshot?: AssistantContextSnapshot
): { invalidDate: string } | null {
  const candidates = collectDateLikeCandidates(message, contextSnapshot);
  for (const candidate of candidates) {
    if (!isDateLikeToken(candidate)) continue;
    const parsed = parseDateLike(candidate);
    if (!parsed) {
      return { invalidDate: candidate };
    }
  }
  return null;
}

function collectDateLikeCandidates(
  message: string,
  contextSnapshot?: AssistantContextSnapshot
): string[] {
  const candidates = new Set<string>();
  const filters = isRecord(contextSnapshot?.filters) ? contextSnapshot.filters : undefined;
  const filterDateValues = [
    filters?.date,
    filters?.asOfDate,
    filters?.as_of_date,
    filters?.day,
    filters?.to,
    filters?.from,
  ];
  for (const value of filterDateValues) {
    if (typeof value !== "string" || value.trim().length === 0) continue;
    const trimmed = value.trim();
    if (isDateLikeToken(trimmed)) {
      candidates.add(trimmed);
    }
  }

  const numericMatches = message.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b20\d{2}[/-]\d{1,2}[/-]\d{1,2}\b/g) ?? [];
  for (const candidate of numericMatches) {
    candidates.add(candidate);
  }
  const naturalMatches = normalizeForKeywordMatch(message)
    .match(/\b(?:ngay\s*)?\d{1,2}\s*thang\s*\d{1,2}\s*(?:nam\s*)?\d{4}\b/g) ?? [];
  for (const candidate of naturalMatches) {
    candidates.add(candidate);
  }
  return Array.from(candidates);
}

function isDateLikeToken(value: string): boolean {
  const normalized = normalizeForKeywordMatch(String(value ?? "").trim());
  if (!normalized) return false;
  if (/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b20\d{2}[/-]\d{1,2}[/-]\d{1,2}\b/.test(normalized)) return true;
  if (/\b(?:ngay\s*)?\d{1,2}\s*thang\s*\d{1,2}\s*(?:nam\s*)?\d{4}\b/.test(normalized)) return true;
  return false;
}

function parseDateLike(value: string): Date | null {
  const input = normalizeForKeywordMatch(String(value ?? "").trim());
  if (!input) return null;

  const isoLike = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(input);
  if (isoLike) {
    return buildDate(Number(isoLike[1]), Number(isoLike[2]), Number(isoLike[3]));
  }

  const dayFirst = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/.exec(input);
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = Number(dayFirst[2]);
    const yearRaw = Number(dayFirst[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    return buildDate(year, month, day);
  }

  const natural = /^(?:ngay\s*)?(\d{1,2})\s*thang\s*(\d{1,2})\s*(?:nam\s*)?(\d{4})$/.exec(input);
  if (natural) {
    const day = Number(natural[1]);
    const month = Number(natural[2]);
    const year = Number(natural[3]);
    return buildDate(year, month, day);
  }

  return null;
}

function buildDate(year: number, month: number, day: number): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 1900 || year > 2200) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeSymbolToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(normalized)) return null;
  if (NON_SYMBOL_POLICY_TOKENS.has(normalized)) return null;
  if (/^Q[1-4]?$/.test(normalized)) return null;
  if (/^FY\d{2,4}$/.test(normalized)) return null;
  return normalized;
}

function detectFabricationDirectiveViolation(
  message: string,
  contextSnapshot?: AssistantContextSnapshot
): { reason: string } | null {
  const normalized = normalizeForKeywordMatch(message);
  const fabricationForced =
    isFabricationDirective(normalized)
    || normalized.includes("ignore rules")
    || normalized.includes("uoc luong")
    || normalized.includes("estimate")
    || normalized.includes("gia vo")
    || normalized.includes("gia dinh so lieu")
    || normalized.includes("tu bo sung so lieu");
  if (!fabricationForced) return null;

  const hasSymbol = getCandidateSymbols(message, contextSnapshot).length > 0;
  const hasDelistedHint =
    normalized.includes("huy niem yet")
    || normalized.includes("delisted")
    || normalized.includes("treo giao dich")
    || normalized.includes("suspended");
  const hasFutureHint =
    normalized.includes("ngay mai")
    || normalized.includes("tomorrow")
    || normalized.includes("hom nay")
    || normalized.includes("today");

  if (!hasSymbol && !hasDelistedHint && !hasFutureHint) {
    return {
      reason: "Fabrication directive detected without grounded symbol scope.",
    };
  }

  return {
    reason: "Fabrication or estimation directive conflicts with grounded-only numeric policy.",
  };
}

function detectAmbiguousSymbolViolation(
  message: string,
  contextSnapshot?: AssistantContextSnapshot
): { reason: string } | null {
  const normalized = normalizeForKeywordMatch(message);
  const symbolCandidates = getCandidateSymbols(message, contextSnapshot);
  const invalidTickerTokens = extractInvalidTickerTokens(message);
  const shortTickerMention = /\b(?:ma|ticker|symbol)\s*[=:]?\s*[a-z0-9]{1,2}\b/i.test(normalized);
  const explicitAmbiguity =
    normalized.includes("khong ro")
    || normalized.includes("ko ro")
    || normalized.includes("ambiguous")
    || normalized.includes("khong chac");
  const asksPriceMetric = PRICE_METRIC_HINTS.some((keyword) => normalized.includes(keyword));
  const asksCompareIntent =
    normalized.includes("so sanh")
    || normalized.includes("compare")
    || normalized.includes("versus")
    || /\bvs\b/.test(normalized);
  const asksFinanceStatement =
    normalized.includes("bctc")
    || normalized.includes("bao cao tai chinh")
    || normalized.includes("income statement")
    || normalized.includes("balance sheet")
    || normalized.includes("cash flow");

  if (invalidTickerTokens.length > 0 && asksPriceMetric && (asksCompareIntent || symbolCandidates.length === 0)) {
    return {
      reason: `Invalid ticker token detected: ${invalidTickerTokens.join(", ")}. Please provide a valid HOSE symbol.`,
    };
  }

  if (shortTickerMention && asksFinanceStatement) {
    return {
      reason: "Ticker is too short/ambiguous for grounded financial-statement retrieval.",
    };
  }
  if (explicitAmbiguity && asksFinanceStatement && symbolCandidates.length <= 1) {
    return {
      reason: "Ambiguous symbol prompt requires explicit ticker disambiguation before numeric output.",
    };
  }
  return null;
}

function extractInvalidTickerTokens(message: string): string[] {
  const matches = message.match(/\b[A-Z][A-Z0-9]{2,6}\b/g) ?? [];
  const invalid = new Set<string>();
  for (const token of matches) {
    if (INVALID_TICKER_TOKENS.has(token)) {
      invalid.add(token);
    }
  }
  return Array.from(invalid);
}

function buildFallbackMessage(reasonCode: PolicyReasonCode, reason: string): string {
  const title = "INSUFFICIENT_DATA";

  // Some CI/eval prompts require an INSUFFICIENT_DATA response with no numeric claims.
  // Also, tool errors may include HTTP codes; strip digits to avoid leaking numbers in fallback mode.
  const safeReason = String(reason ?? "")
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const reasonLine = safeReason ? `Reason: ${safeReason}` : "Reason: data unavailable";
  const guidance = [
    "I cannot provide numeric financial claims without verified grounded data.",
    "Please try again with: symbol + metric + timeframe (example: VNM Sharpe last two years).",
  ];

  if (reasonCode === "required_tool_failed") {
    guidance.unshift("A required financial data tool is temporarily unavailable.");
  } else if (reasonCode === "required_tool_skipped") {
    guidance.unshift("A required grounding tool was skipped and did not execute.");
  } else if (reasonCode === "missing_citation") {
    guidance.unshift("The response is blocked because required source citations are missing.");
  } else if (reasonCode === "no_numeric_evidence") {
    guidance.unshift("Grounded data exists, but required numeric values are missing.");
  } else if (reasonCode === "missing_symbol_grounding") {
    guidance.unshift("Grounded symbol coverage is incomplete for the requested multi-symbol comparison.");
  } else if (reasonCode === "invalid_date_not_supported") {
    guidance.unshift("Requested date is not a valid calendar date in grounded HOSE datasets.");
    guidance.unshift("Ngay yeu cau khong hop le theo lich du lieu.");
  } else if (reasonCode === "future_date_not_supported") {
    guidance.unshift("Future-date market data is not available in grounded HOSE datasets.");
    guidance.unshift("Khong the cung cap so lieu dinh luong cho ngay trong tuong lai.");
  } else if (reasonCode === "fabrication_directive_blocked") {
    guidance.unshift("The request asked for fabricated/estimated numeric data outside grounded evidence.");
  } else if (reasonCode === "ambiguous_symbol_not_supported") {
    guidance.unshift("Khong the tra ve so lieu cho ma co phieu mo hoac khong ton tai.");
    guidance.unshift("The ticker is ambiguous; please provide a valid HOSE symbol before numeric analysis.");
  }

  return [title, reasonLine, ...guidance].join("\n");
}
