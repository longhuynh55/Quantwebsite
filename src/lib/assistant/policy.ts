import type { AssistantContextSnapshot, AssistantToolName, AssistantToolUsage } from "@/types/assistant";
import type { GroundingResult } from "@/lib/assistant/tools";
import { collectRequiredSignals, type RequiredSignal } from "@/lib/assistant/signals";

export type AssistantPolicyMode = "shadow" | "enforce_high_risk" | "enforce_all";
export type AssistantPolicyStatus = "ok" | "fallback" | "shadow_blocked";
export type AssistantConfidence = "high" | "medium" | "low";

type PolicyReasonCode =
  | "insufficient_grounding"
  | "required_tool_failed"
  | "missing_citation"
  | "no_numeric_evidence";

interface PolicyEvaluationInput {
  message: string;
  contextSnapshot?: AssistantContextSnapshot;
  grounding: GroundingResult;
}

export interface PolicyEvaluationResult {
  mode: AssistantPolicyMode;
  status: AssistantPolicyStatus;
  reasonCode?: PolicyReasonCode;
  reason?: string;
  dataConfidence: AssistantConfidence;
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

export function evaluateAssistantPolicy(input: PolicyEvaluationInput): PolicyEvaluationResult {
  const mode = getPolicyMode();
  const normalizedMessage = normalizeForKeywordMatch(input.message);
  const requiredSignals = collectRequiredSignals({
    message: input.message,
    contextSnapshot: input.contextSnapshot,
    baselineOnlyMode: BASELINE_ONLY_MODE,
  });
  const numericIntent = isNumericIntent(normalizedMessage, input.contextSnapshot, requiredSignals);

  const enforcementApplies = shouldApplyEnforcement(mode, numericIntent, input.contextSnapshot, requiredSignals);
  if (!numericIntent) {
    return {
      mode,
      status: "ok",
      dataConfidence: "medium",
      shouldBypassLlm: false,
      shadowBlocked: false,
    };
  }

  const failure = evaluateGrounding(requiredSignals, input.grounding);
  if (!failure) {
    return {
      mode,
      status: "ok",
      dataConfidence: "high",
      shouldBypassLlm: false,
      shadowBlocked: false,
    };
  }

  if (isSoftNumericFailure(failure.reasonCode, failure.reason, input.grounding)) {
    return {
      mode,
      status: "ok",
      reasonCode: failure.reasonCode,
      reason: failure.reason,
      dataConfidence: "medium",
      shouldBypassLlm: false,
      shadowBlocked: false,
    };
  }

  const fallbackMessage = buildFallbackMessage(failure.reasonCode, failure.reason);
  if (!enforcementApplies) {
    return {
      mode,
      status: "shadow_blocked",
      reasonCode: failure.reasonCode,
      reason: failure.reason,
      dataConfidence: "low",
      shouldBypassLlm: true,
      shadowBlocked: true,
      responseMessage: fallbackMessage,
    };
  }

  return {
    mode,
    status: "fallback",
    reasonCode: failure.reasonCode,
    reason: failure.reason,
    dataConfidence: "low",
    shouldBypassLlm: true,
    responseMessage: fallbackMessage,
    shadowBlocked: false,
  };
}

function getPolicyMode(): AssistantPolicyMode {
  const raw = String(process.env.ASSISTANT_POLICY_MODE ?? "enforce_high_risk").trim().toLowerCase();
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
      return {
        reasonCode: "required_tool_failed",
        reason: toolError?.error
          ? `Required tool ${signal.tool} failed: ${toolError.error}`
          : `Required tool ${signal.tool} was not successful.`,
      };
    }
    if ((successTool.evidenceCount ?? 0) <= 0) {
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
    .replace(/đ/g, "d");
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
  } else if (reasonCode === "missing_citation") {
    guidance.unshift("The response is blocked because required source citations are missing.");
  } else if (reasonCode === "no_numeric_evidence") {
    guidance.unshift("Grounded data exists, but required numeric values are missing.");
  }

  return [title, reasonLine, ...guidance].join("\n");
}
