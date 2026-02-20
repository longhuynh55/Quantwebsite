const baseSchemaVersion = "assistant-eval-schema-2026-02-18";

const DEFAULT_LATENCY_PERCENTILES = {
  p50Ms: null,
  p90Ms: null,
  p99Ms: null,
};

const DEFAULT_POLICY_STATUSES = [
  { category: "content", status: "unknown", detail: "" },
  { category: "usage", status: "unknown", detail: "" },
  { category: "security", status: "unknown", detail: "" },
];

const DEFAULT_TOOL_DISTRIBUTION = {
  totalCalls: 0,
  successCount: 0,
  errorCount: 0,
  tools: [],
};

const DEFAULT_FALSE_FALLBACKS = {
  totalSessions: 0,
  falseFallbacks: 0,
  sampledExamples: [],
};

const DEFAULT_CITATION_COVERAGE = {
  candidateClaims: 0,
  citedClaims: 0,
  coveragePercent: null,
  missingSources: [],
};

const DEFAULT_FAILURE_EXEMPLARS = [];
const DEFAULT_STABILITY = {
  roundsConfigured: 1,
  totalRounds: 1,
  successfulRounds: 1,
  flakeRate: 0,
  gatePass: true,
  roundSummaries: [],
};

function createCategoryResult(name, didPass, summary = "", checks = []) {
  return {
    name,
    status: didPass ? "pass" : "fail",
    summary,
    checks,
  };
}

function createPolicyStatus(category, status, detail = "") {
  return {
    category,
    status,
    detail,
  };
}

function createToolRecord(toolName, successCount = 0, errorCount = 0, avgLatencyMs = null) {
  return {
    name: toolName,
    successCount,
    errorCount,
    avgLatencyMs,
  };
}

function createFailureExample(id, category, context, failureReason, citationDiscrepancies = []) {
  return {
    id,
    category,
    context,
    failureReason,
    citationDiscrepancies,
  };
}

function createAssistantEvalReport(overrides = {}) {
  const now = new Date().toISOString();
  const baseReport = {
    schemaVersion: baseSchemaVersion,
    generatedAt: now,
    overallStatus: "unknown",
    categories: [],
    latencyPercentiles: { ...DEFAULT_LATENCY_PERCENTILES },
    policyStatuses: [...DEFAULT_POLICY_STATUSES],
    toolDistribution: { ...DEFAULT_TOOL_DISTRIBUTION },
    falseFallbacks: { ...DEFAULT_FALSE_FALLBACKS },
    citationCoverage: { ...DEFAULT_CITATION_COVERAGE },
    failureExemplars: [...DEFAULT_FAILURE_EXEMPLARS],
    stability: { ...DEFAULT_STABILITY },
    metadata: {
      runId: null,
      assistantVersion: null,
      evalProfile: null,
    },
  };
  return {
    ...baseReport,
    ...overrides,
  };
}

export {
  DEFAULT_LATENCY_PERCENTILES,
  DEFAULT_POLICY_STATUSES,
  DEFAULT_TOOL_DISTRIBUTION,
  DEFAULT_FALSE_FALLBACKS,
  DEFAULT_CITATION_COVERAGE,
  DEFAULT_FAILURE_EXEMPLARS,
  DEFAULT_STABILITY,
  createCategoryResult,
  createPolicyStatus,
  createToolRecord,
  createFailureExample,
  createAssistantEvalReport,
};
