import fs from "node:fs";
import path from "node:path";

const IS_DOCKER_RUNTIME = fs.existsSync("/.dockerenv");
const baseUrl =
  process.env.ASSISTANT_EVAL_BASE_URL
  ?? process.env.SMOKE_BASE_URL
  ?? (IS_DOCKER_RUNTIME ? "http://127.0.0.1:3000" : "http://localhost:3010");
const timeoutMs = Number(process.env.ASSISTANT_EVAL_TIMEOUT_MS ?? 120000);
const reportPath = process.env.ASSISTANT_EVAL_REPORT_PATH ?? "artifacts/assistant-metrics-stress-matrix-report.json";
const evalAuthToken = String(process.env.ASSISTANT_EVAL_AUTH_TOKEN ?? "").trim();
const maxRequestRetries = Number(process.env.ASSISTANT_EVAL_MAX_RETRIES ?? 2);
const retryBackoffMs = Number(process.env.ASSISTANT_EVAL_RETRY_BACKOFF_MS ?? 400);
const rounds = Math.max(1, Number(process.env.ASSISTANT_EVAL_ROUNDS ?? 1));
const maxScenarios = Math.max(0, Number(process.env.ASSISTANT_EVAL_MAX_SCENARIOS ?? 0));

const VALUATION_METRICS = [
  { id: "pe", label: "P/E", keyword: "pe" },
  { id: "pb", label: "P/B", keyword: "pb" },
  { id: "ev_ebitda", label: "EV/EBITDA", keyword: "ev_ebitda" },
];

const OHLCV_METRICS = [
  { id: "close", label: "gia dong cua", order: "desc" },
  { id: "open", label: "gia mo cua", order: "desc" },
  { id: "high", label: "gia cao nhat", order: "desc" },
  { id: "low", label: "gia thap nhat", order: "asc" },
  { id: "volume", label: "khoi luong", order: "desc" },
];

const SECTORS = ["ngan hang", "bat dong san", "ban le", "dau khi"];
const HOT_DATES = ["31/12/2025", "28/05/2024"];
const FUND_PERIODS = ["2024Q4", "2025Q4", "2025Q2", "2024Q3"];
const FUND_SYMBOLS = ["AAA", "ACB", "FPT", "VNM"];

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildValuationRankingScenarios() {
  const scenarios = [];
  for (const metric of VALUATION_METRICS) {
    for (const sector of SECTORS) {
      for (const order of ["desc", "asc"]) {
        const date = HOT_DATES[order === "desc" ? 0 : 1];
        const topWord = order === "desc" ? "cao nhat" : "thap nhat";
        const id = `MTR-VALRANK-${metric.id.toUpperCase()}-${slugify(sector)}-${order.toUpperCase()}`;
        const message =
          `Top 5 co phieu ${sector} tren HOSE ngay ${date} theo ${metric.label} ${topWord}, kem so lieu cu the.`;
        const metricAllowsSparseFallback = metric.id === "ev_ebitda";
        scenarios.push({
          id,
          category: "valuation_ranking_metric_filter",
          turns: [
            {
              message,
              contextSnapshot: { page: "analysis" },
              expected: {
                requiredTools: [{ name: "valuationRanking", status: "success" }],
                endpointIncludes: ["/api/analytics/valuation-rankings", `metric=${metric.keyword}`],
                allowedPolicyStatuses: metricAllowsSparseFallback ? ["ok", "fallback", "shadow_blocked"] : ["ok", "fallback"],
                minCitationCount: 1,
                mustHaveNumericEvidence: !metricAllowsSparseFallback,
              },
            },
          ],
        });
      }
    }
  }
  return scenarios;
}

function buildFundamentalMetricScenarios() {
  const templates = [
    {
      id: "REV_LNST",
      message: (symbol, period) => `Cho BCTC ${symbol} ${period}, tra doanh thu va LNST.`,
      statement: "all",
    },
    {
      id: "ROE_ROA",
      message: (symbol, period) => `BCTN ${symbol} ${period}, cho ROE va ROA.`,
      statement: "is",
    },
    {
      id: "DE_CURRENT",
      message: (symbol, period) => `BCDKT ${symbol} ${period}, lay D/E va current ratio.`,
      statement: "bs",
    },
    {
      id: "OCF_FCF",
      message: (symbol, period) => `LCTT ${symbol} ${period}, cho OCF va FCF.`,
      statement: "cf",
    },
    {
      id: "MARGIN_SET",
      message: (symbol, period) => `BCTN ${symbol} ${period}, net margin va gross margin.`,
      statement: "is",
    },
    {
      id: "EPS_PBT",
      message: (symbol, period) => `Bao cao ket qua kinh doanh ${symbol} ${period}: EPS va PBT.`,
      statement: "is",
    },
  ];

  const scenarios = [];
  for (let i = 0; i < FUND_SYMBOLS.length; i += 1) {
    const symbol = FUND_SYMBOLS[i];
    for (let j = 0; j < templates.length; j += 1) {
      const template = templates[j];
      const period = FUND_PERIODS[(i + j) % FUND_PERIODS.length];
      const id = `MTR-FUND-${template.id}-${symbol}-${period}`;
      scenarios.push({
        id,
        category: "fundamentals_metric_filter",
        turns: [
          {
            message: template.message(symbol, period),
            contextSnapshot: { page: "analysis", symbol },
            expected: {
              requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
              endpointIncludes: ["/api/fundamentals", `symbol=${symbol}`, `period=${period}`],
              allowedPolicyStatuses: ["ok", "fallback"],
              minCitationCount: 1,
              mustHaveNumericEvidence: true,
            },
          },
        ],
      });
    }
  }
  return scenarios;
}

function buildOhlcvMetricScenarios() {
  const ohlcvSectors = ["ngan hang", "bat dong san", "ban le"];
  const scenarios = [];
  for (const metric of OHLCV_METRICS) {
    for (const sector of ohlcvSectors) {
      const id = `MTR-OHLCV-${metric.id.toUpperCase()}-${slugify(sector)}`;
      const rankingWord = metric.order === "asc" ? "thap nhat" : "cao nhat";
      scenarios.push({
        id,
        category: "ohlcv_metric_filter",
        turns: [
          {
            message: `Top 5 co phieu ${sector} HOSE ngay 28/05/2024 theo ${metric.label} ${rankingWord}.`,
            contextSnapshot: { page: "screener" },
            expected: {
              requiredTools: [{ name: "stockSnapshot", status: "success" }],
              endpointIncludes: ["/api/stocks", "date=2024-05-28", `metric=${metric.id}`],
              allowedPolicyStatuses: ["ok", "fallback"],
              minCitationCount: 1,
              mustHaveNumericEvidence: true,
            },
          },
        ],
      });
    }
  }
  return scenarios;
}

function buildNoisyMetricScenarios() {
  return [
    {
      id: "MTR-NOISE-01",
      category: "noisy_metric_query",
      turns: [
        {
          message: "dm cho toi top 5 bank hose 28-5-24 theo pe cao nhat, tra nhanh",
          contextSnapshot: { page: "home" },
          expected: {
            requiredTools: [{ name: "valuationRanking", status: "success" }],
            endpointIncludes: ["/api/analytics/valuation-rankings", "metric=pe"],
            allowedPolicyStatuses: ["ok", "fallback"],
            minCitationCount: 1,
            mustHaveNumericEvidence: true,
          },
        },
      ],
    },
    {
      id: "MTR-NOISE-02",
      category: "noisy_metric_query",
      turns: [
        {
          message: "bctc aaa 2024q4 can roe+roa+lnst, viet gon",
          contextSnapshot: { page: "analysis" },
          expected: {
            requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
            endpointIncludes: ["/api/fundamentals", "symbol=AAA", "period=2024Q4"],
            allowedPolicyStatuses: ["ok", "fallback"],
            minCitationCount: 1,
            mustHaveNumericEvidence: true,
          },
        },
      ],
    },
    {
      id: "MTR-NOISE-03",
      category: "noisy_metric_query",
      turns: [
        {
          message: "acb 2025q2 d/e voi current ratio bn?",
          contextSnapshot: { page: "analysis" },
          expected: {
            requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
            endpointIncludes: ["/api/fundamentals", "symbol=ACB", "period=2025Q2"],
            allowedPolicyStatuses: ["ok", "fallback"],
            minCitationCount: 1,
            mustHaveNumericEvidence: true,
          },
        },
      ],
    },
    {
      id: "MTR-NOISE-04",
      category: "noisy_metric_query",
      turns: [
        {
          message: "loc bds hose 28/05/2024 top 5 theo volume + close",
          contextSnapshot: { page: "screener" },
          expected: {
            requiredTools: [{ name: "stockSnapshot", status: "success" }],
            endpointIncludes: ["/api/stocks", "date=2024-05-28"],
            allowedPolicyStatuses: ["ok", "fallback"],
            minCitationCount: 1,
            mustHaveNumericEvidence: true,
          },
        },
      ],
    },
    {
      id: "MTR-NOISE-05",
      category: "noisy_metric_query",
      turns: [
        {
          message: "fpt 2025q4 ocf fcf eps pbt di",
          contextSnapshot: { page: "analysis" },
          expected: {
            requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
            endpointIncludes: ["/api/fundamentals", "symbol=FPT", "period=2025Q4"],
            allowedPolicyStatuses: ["ok", "fallback"],
            minCitationCount: 1,
            mustHaveNumericEvidence: true,
          },
        },
      ],
    },
    {
      id: "MTR-NOISE-06",
      category: "noisy_metric_query",
      turns: [
        {
          message: "top 5 retail hose 31/12/2025 theo ev/ebitda thap nhat",
          contextSnapshot: { page: "home" },
          expected: {
            requiredTools: [{ name: "valuationRanking", status: "success" }],
            endpointIncludes: ["/api/analytics/valuation-rankings", "metric=ev_ebitda"],
            allowedPolicyStatuses: ["ok", "fallback", "shadow_blocked"],
            minCitationCount: 1,
            mustHaveNumericEvidence: false,
          },
        },
      ],
    },
    {
      id: "MTR-NOISE-07",
      category: "noisy_metric_query",
      turns: [
        {
          message: "vnm bctn 2024q3 net margin gross margin",
          contextSnapshot: { page: "analysis" },
          expected: {
            requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
            endpointIncludes: ["/api/fundamentals", "symbol=VNM", "period=2024Q3"],
            allowedPolicyStatuses: ["ok", "fallback"],
            minCitationCount: 1,
            mustHaveNumericEvidence: true,
          },
        },
      ],
    },
    {
      id: "MTR-NOISE-08",
      category: "noisy_metric_query",
      turns: [
        {
          message: "bank hose 28/05/2024 low thap nhat top 5",
          contextSnapshot: { page: "home" },
          expected: {
            requiredTools: [{ name: "stockSnapshot", status: "success" }],
            endpointIncludes: ["/api/stocks", "metric=low", "date=2024-05-28"],
            allowedPolicyStatuses: ["ok", "fallback"],
            minCitationCount: 1,
            mustHaveNumericEvidence: true,
          },
        },
      ],
    },
  ];
}

function buildGuardScenarios() {
  return [
    {
      id: "MTR-GUARD-01",
      category: "guard_scope_non_hose",
      turns: [
        {
          message: "Top 5 ngan hang HNX theo PE ngay 31/12/2025, cho so cu the.",
          contextSnapshot: { page: "home" },
          expected: {
            allowedPolicyStatuses: ["shadow_blocked", "fallback", "ok"],
            messageIncludesAny: ["HOSE", "hose"],
            disallowMetricNumericClaims: true,
          },
        },
      ],
    },
    {
      id: "MTR-GUARD-02",
      category: "guard_scope_non_hose",
      turns: [
        {
          message: "UPCOM top 5 co phieu theo PB ngay 28/05/2024.",
          contextSnapshot: { page: "home" },
          expected: {
            allowedPolicyStatuses: ["shadow_blocked", "fallback", "ok"],
            messageIncludesAny: ["HOSE", "hose"],
            disallowMetricNumericClaims: true,
          },
        },
      ],
    },
    {
      id: "MTR-GUARD-03",
      category: "guard_future_date",
      turns: [
        {
          message: "Top 10 HOSE theo EV/EBITDA ngay 31/12/2099.",
          contextSnapshot: { page: "home" },
          expected: {
            allowedPolicyStatuses: ["shadow_blocked", "fallback", "ok"],
            disallowMetricNumericClaims: true,
          },
        },
      ],
    },
    {
      id: "MTR-GUARD-04",
      category: "guard_future_date",
      turns: [
        {
          message: "BCTC AAA 2099Q4, cho ROE va ROA.",
          contextSnapshot: { page: "analysis" },
          expected: {
            allowedPolicyStatuses: ["shadow_blocked", "fallback", "ok"],
            disallowMetricNumericClaims: true,
          },
        },
      ],
    },
  ];
}

function buildMultiTurnMetricScenarios() {
  return [
    {
      id: "MTR-MULTI-01",
      category: "multi_turn_metric_refine",
      turns: [
        {
          message: "Top 10 ngan hang HOSE ngay 31/12/2025 theo PE cao nhat.",
          contextSnapshot: { page: "home" },
          expected: {
            requiredTools: [{ name: "valuationRanking", status: "success" }],
            endpointIncludes: ["/api/analytics/valuation-rankings", "metric=pe"],
            allowedPolicyStatuses: ["ok", "fallback"],
            minCitationCount: 1,
            mustHaveNumericEvidence: true,
          },
        },
        {
          message: "giu bo loc, doi sang PB va lay top 3.",
          contextSnapshot: { page: "home", filters: { metric: "pb", limit: 3, date: "31/12/2025" } },
          expected: {
            requiredTools: [{ name: "valuationRanking", status: "success" }],
            endpointIncludes: ["/api/analytics/valuation-rankings", "metric=pb"],
            allowedPolicyStatuses: ["ok", "fallback"],
            minCitationCount: 1,
            mustHaveNumericEvidence: true,
          },
        },
      ],
    },
    {
      id: "MTR-MULTI-02",
      category: "multi_turn_metric_refine",
      turns: [
        {
          message: "BCTC ACB 2024Q4: cho D/E, current ratio va ROE.",
          contextSnapshot: { page: "analysis", symbol: "ACB" },
          expected: {
            requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
            endpointIncludes: ["/api/fundamentals", "symbol=ACB", "period=2024Q4"],
            allowedPolicyStatuses: ["ok", "fallback"],
            minCitationCount: 1,
            mustHaveNumericEvidence: true,
          },
        },
        {
          message: "giu ky 2024Q4, doi bo metric sang OCF va FCF.",
          contextSnapshot: { page: "analysis", symbol: "ACB", filters: { statement: "cf", period: "2024Q4" } },
          expected: {
            requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
            endpointIncludes: ["/api/fundamentals", "symbol=ACB", "period=2024Q4"],
            allowedPolicyStatuses: ["ok", "fallback"],
            minCitationCount: 1,
            mustHaveNumericEvidence: true,
          },
        },
      ],
    },
  ];
}

function buildScenarioBank() {
  const scenarios = [
    ...buildValuationRankingScenarios(),
    ...buildFundamentalMetricScenarios(),
    ...buildOhlcvMetricScenarios(),
    ...buildNoisyMetricScenarios(),
    ...buildGuardScenarios(),
    ...buildMultiTurnMetricScenarios(),
  ];
  if (maxScenarios > 0) {
    return scenarios.slice(0, maxScenarios);
  }
  return scenarios;
}

const scenarios = buildScenarioBank();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableCallError(error) {
  const text = String(error?.message ?? "").toLowerCase();
  return (
    text.includes("aborted")
    || text.includes("timeout")
    || text.includes("timed out")
    || text.includes("fetch failed")
    || text.includes("failed to fetch")
    || text.includes("network")
  );
}

async function callAssistant({ message, contextSnapshot, conversationHistory }) {
  const endpoint = `${baseUrl}/api/assistant`;
  const payload = {
    message,
    conversationHistory,
    contextSnapshot,
    preferences: { language: "vi", detailLevel: "brief" },
  };

  const headers = {
    "content-type": "application/json",
    "x-assistant-eval": "true",
    ...(evalAuthToken ? { "x-assistant-eval-token": evalAuthToken } : {}),
  };

  for (let attempt = 0; attempt <= maxRequestRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const latencyMs = Date.now() - startedAt;
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      if (isRetryableStatus(response.status) && attempt < maxRequestRetries) {
        await sleep(retryBackoffMs * (attempt + 1));
        continue;
      }
      return { response, data, latencyMs, attempts: attempt + 1 };
    } catch (error) {
      if (attempt >= maxRequestRetries || !isRetryableCallError(error)) {
        throw error;
      }
      await sleep(retryBackoffMs * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("assistant call failed after retries");
}

function hasToolStatus(usedTools, name, status) {
  if (!Array.isArray(usedTools)) return false;
  return usedTools.some((tool) => tool?.name === name && String(tool?.status) === status);
}

function hasEndpointEvidence(citations, usedTools, fragment) {
  const normalizedFragment = String(fragment ?? "").toLowerCase();
  if (!normalizedFragment) return true;
  const fromCitations = Array.isArray(citations)
    ? citations.some((citation) => String(citation?.endpoint ?? "").toLowerCase().includes(normalizedFragment))
    : false;
  const fromToolRequest = Array.isArray(usedTools)
    ? usedTools.some((tool) => {
        const params = tool?.requestParams ?? {};
        return Object.entries(params).some(([key, value]) => `${String(key).toLowerCase()}=${String(value ?? "").toLowerCase()}`.includes(normalizedFragment));
      })
    : false;
  return fromCitations || fromToolRequest;
}

function hasMessageFragment(message, fragment) {
  return String(message ?? "").toLowerCase().includes(String(fragment ?? "").toLowerCase());
}

function hasNumericEvidence(data) {
  const tools = Array.isArray(data?.usedTools) ? data.usedTools : [];
  if (tools.some((tool) => Number(tool?.evidenceCount ?? 0) > 0)) return true;
  const message = String(data?.message ?? "");
  return /\b\d+([.,]\d+)?\b/.test(message);
}

function removeSafeNumericTokens(message) {
  return String(message ?? "")
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, " ")
    .replace(/\b\d{4}\s*q[1-4]\b/gi, " ")
    .replace(/\bq[1-4][\s/-]*\d{4}\b/gi, " ")
    .replace(/\btop\s*\d+\b/gi, " ")
    .replace(/\bbottom\s*\d+\b/gi, " ");
}

function hasUserFacingNumericOutput(data) {
  const cleanedMessage = removeSafeNumericTokens(data?.message);
  return /\b\d+([.,]\d+)?\b/.test(cleanedMessage);
}

function evaluateExpectations(data, expected) {
  const failures = [];
  const checks = {
    tool: { total: 0, passed: 0 },
    endpoint: { total: 0, passed: 0 },
    policy: { total: 0, passed: 0 },
    citation: { total: 0, passed: 0 },
    outputGuard: { total: 0, passed: 0 },
    message: { total: 0, passed: 0 },
  };

  if (Array.isArray(expected?.requiredTools)) {
    for (const reqTool of expected.requiredTools) {
      checks.tool.total += 1;
      const pass = hasToolStatus(data?.usedTools, reqTool.name, reqTool.status ?? "success");
      if (pass) checks.tool.passed += 1;
      else failures.push(`missing tool ${reqTool.name}:${reqTool.status ?? "success"}`);
    }
  }

  if (Array.isArray(expected?.endpointIncludes)) {
    for (const fragment of expected.endpointIncludes) {
      checks.endpoint.total += 1;
      const pass = hasEndpointEvidence(data?.citations, data?.usedTools, fragment);
      if (pass) checks.endpoint.passed += 1;
      else failures.push(`missing endpoint evidence "${fragment}"`);
    }
  }

  if (Array.isArray(expected?.allowedPolicyStatuses)) {
    checks.policy.total += 1;
    const policyStatus = String(data?.policyStatus ?? "unknown");
    if (expected.allowedPolicyStatuses.includes(policyStatus)) checks.policy.passed += 1;
    else failures.push(`policyStatus=${policyStatus} not in [${expected.allowedPolicyStatuses.join(",")}]`);
  }

  if (Number.isFinite(Number(expected?.minCitationCount))) {
    checks.citation.total += 1;
    const citationsCount = Array.isArray(data?.citations) ? data.citations.length : 0;
    if (citationsCount >= Number(expected.minCitationCount)) checks.citation.passed += 1;
    else failures.push(`citation count ${citationsCount} < ${expected.minCitationCount}`);
  }

  if (expected?.mustHaveNumericEvidence) {
    checks.outputGuard.total += 1;
    if (hasNumericEvidence(data)) checks.outputGuard.passed += 1;
    else failures.push("missing numeric evidence for numeric query");
  }

  if (expected?.disallowMetricNumericClaims) {
    checks.outputGuard.total += 1;
    const hasNumeric = hasUserFacingNumericOutput(data);
    if (hasNumeric) failures.push("unexpected numeric claim/evidence in guarded scenario");
    else checks.outputGuard.passed += 1;
  }

  if (Array.isArray(expected?.messageIncludesAny) && expected.messageIncludesAny.length > 0) {
    checks.message.total += 1;
    const pass = expected.messageIncludesAny.some((fragment) => hasMessageFragment(String(data?.message ?? ""), fragment));
    if (pass) checks.message.passed += 1;
    else failures.push(`missing any message fragment [${expected.messageIncludesAny.join(" | ")}]`);
  }

  const totalChecks = Object.values(checks).reduce((sum, section) => sum + section.total, 0);
  const passedChecks = Object.values(checks).reduce((sum, section) => sum + section.passed, 0);
  return { pass: failures.length === 0, failures, checks, totalChecks, passedChecks };
}

async function writeReport(report) {
  const absPath = path.resolve(reportPath);
  await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
  await fs.promises.writeFile(absPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return absPath;
}

async function run() {
  const startedAt = Date.now();
  const results = [];
  const categoryStats = {};
  const roundStats = [];
  const perCaseRound = {};

  let totalTurns = 0;
  let passedTurns = 0;

  for (let round = 1; round <= rounds; round += 1) {
    let roundTotal = 0;
    let roundPassed = 0;

    for (const scenario of scenarios) {
      const conversationHistory = [];
      for (let turnIndex = 0; turnIndex < scenario.turns.length; turnIndex += 1) {
        const turn = scenario.turns[turnIndex];
        roundTotal += 1;
        totalTurns += 1;

        const call = await callAssistant({
          message: turn.message,
          contextSnapshot: turn.contextSnapshot ?? { page: "home" },
          conversationHistory,
        });

        const evalResult = evaluateExpectations(call.data, turn.expected ?? {});
        if (evalResult.pass) {
          roundPassed += 1;
          passedTurns += 1;
        }

        const entry = {
          round,
          scenarioId: scenario.id,
          category: scenario.category,
          turn: turnIndex + 1,
          pass: evalResult.pass,
          failures: evalResult.failures,
          checks: evalResult.checks,
          statusCode: call.response?.status ?? null,
          latencyMs: call.latencyMs,
          attempts: call.attempts,
          policyStatus: String(call.data?.policyStatus ?? "unknown"),
          queryIntent: call.data?.meta?.queryIntent ?? null,
          queryPlanSummary: call.data?.meta?.queryPlanSummary ?? null,
          usedTools: Array.isArray(call.data?.usedTools) ? call.data.usedTools : [],
          citations: Array.isArray(call.data?.citations) ? call.data.citations : [],
          messagePreview: String(call.data?.message ?? "").slice(0, 220),
        };
        results.push(entry);

        if (!categoryStats[scenario.category]) {
          categoryStats[scenario.category] = { total: 0, passed: 0 };
        }
        categoryStats[scenario.category].total += 1;
        if (evalResult.pass) categoryStats[scenario.category].passed += 1;

        const caseKey = `${scenario.id}#${turnIndex + 1}`;
        if (!perCaseRound[caseKey]) {
          perCaseRound[caseKey] = { total: 0, passed: 0, failedRounds: [] };
        }
        perCaseRound[caseKey].total += 1;
        if (evalResult.pass) perCaseRound[caseKey].passed += 1;
        else perCaseRound[caseKey].failedRounds.push(round);

        const prefix = evalResult.pass ? "PASS" : "FAIL";
        const failureText = evalResult.pass ? "" : ` - ${evalResult.failures.join(" | ")}`;
        console.log(`R${round} ${prefix} ${scenario.id}#${turnIndex + 1}${failureText}`);

        conversationHistory.push({ role: "user", content: turn.message });
        if (call.data?.message) {
          conversationHistory.push({ role: "assistant", content: String(call.data.message).slice(0, 4000) });
        }
      }
    }

    roundStats.push({
      round,
      totalTurns: roundTotal,
      passedTurns: roundPassed,
      failedTurns: roundTotal - roundPassed,
      passRate: roundTotal > 0 ? roundPassed / roundTotal : 0,
    });
  }

  const failedTurns = totalTurns - passedTurns;
  const flakyCases = Object.entries(perCaseRound)
    .filter(([, value]) => value.passed > 0 && value.passed < value.total)
    .map(([caseId, value]) => ({
      caseId,
      passedRounds: value.passed,
      failedRounds: value.total - value.passed,
      failedRoundIndexes: value.failedRounds,
    }));

  const categoryMatrix = Object.entries(categoryStats)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, value]) => ({
      category,
      totalTurns: value.total,
      passedTurns: value.passed,
      failedTurns: value.total - value.passed,
      passRate: value.total > 0 ? value.passed / value.total : 0,
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    profile: "assistant-metrics-stress-matrix-v1",
    rounds,
    totalScenarios: scenarios.length,
    totalTurns,
    passedTurns,
    failedTurns,
    turnPassRate: totalTurns > 0 ? passedTurns / totalTurns : 0,
    flakeRate: Object.keys(perCaseRound).length > 0 ? flakyCases.length / Object.keys(perCaseRound).length : 0,
    durationMs: Date.now() - startedAt,
    overallStatus: failedTurns === 0 ? "pass" : "fail",
    roundStats,
    categoryMatrix,
    flakyCases,
    results,
  };

  const absReportPath = await writeReport(report);
  console.log(`REPORT_PATH=${absReportPath}`);
  console.log(JSON.stringify(report));

  if (failedTurns > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("EVAL_FATAL", error);
  process.exitCode = 1;
});
