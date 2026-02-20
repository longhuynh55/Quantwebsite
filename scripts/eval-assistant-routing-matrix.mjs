import {
  runSymbolCompareMetricOracleCheck,
  runTopKByDateOracleCheck,
} from "./oracle-helpers.mjs";
const baseUrl = process.env.ASSISTANT_EVAL_BASE_URL ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3010";
const timeoutMs = Number(process.env.ASSISTANT_EVAL_TIMEOUT_MS ?? 30000);
const oracleTimeoutMs = Number(process.env.ASSISTANT_EVAL_ORACLE_TIMEOUT_MS ?? Math.min(timeoutMs, 15000));
const reportPath = process.env.ASSISTANT_EVAL_REPORT_PATH ?? "artifacts/assistant-routing-matrix-report.json";
const evalAuthToken = String(process.env.ASSISTANT_EVAL_AUTH_TOKEN ?? "").trim();
const maxLatencyP95Ms = Number(process.env.ASSISTANT_EVAL_MAX_LATENCY_P95_MS ?? 25000);
const maxToolCallsPerTurn = Number(process.env.ASSISTANT_EVAL_MAX_TOOL_CALLS_PER_TURN ?? 3);
const maxRequestRetries = Number(process.env.ASSISTANT_EVAL_MAX_RETRIES ?? 2);
const retryBackoffMs = Number(process.env.ASSISTANT_EVAL_RETRY_BACKOFF_MS ?? 400);
const maxRetryDelayMs = Number(process.env.ASSISTANT_EVAL_MAX_RETRY_DELAY_MS ?? 5000);
const retryJitterMs = Number(process.env.ASSISTANT_EVAL_RETRY_JITTER_MS ?? 120);

const scenarios = [
  {
    id: "L1_A01_top_close_by_date",
    level: "L1",
    turns: [
      {
        message: "Cho toi top 10 co phieu gia dong cua cao nhat ngay 28/05/2024",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTool: { name: "stockSnapshot", status: "success" },
          endpointIncludes: ["/api/stocks"],
          intent: "stock_snapshot",
          rejectSuccessfulTools: ["marketSnapshot"],
          oracleTopKByDate: {
            source: "stocks",
            metric: "close",
            order: "desc",
            date: "28/05/2024",
            limit: 10,
            compareTopN: 7,
            minPrefixMatch: 5,
            requireExactOrderTopN: 3,
          },
        },
      },
    ],
  },
  {
    id: "L2_E02_followup_volume_same_scope",
    level: "L2",
    turns: [
      {
        message: "Cho toi top 10 co phieu gia dong cua cao nhat ngay 28/05/2024",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTool: { name: "stockSnapshot", status: "success" },
          endpointIncludes: ["/api/stocks"],
          intent: "stock_snapshot",
          rejectSuccessfulTools: ["marketSnapshot"],
        },
      },
      {
        message: "con theo volume thi sao",
        contextSnapshot: {
          page: "home",
          filters: { date: "28/05/2024", limit: 10, metric: "volume", exchange: "HOSE" },
        },
        expected: {
          requiredTool: { name: "stockSnapshot", status: "success" },
          endpointIncludes: ["/api/stocks"],
          intent: "stock_snapshot",
          rejectSuccessfulTools: ["marketSnapshot"],
          oracleTopKByDate: {
            source: "stocks",
            metric: "volume",
            order: "desc",
            date: "28/05/2024",
            limit: 10,
            compareTopN: 7,
            minPrefixMatch: 5,
            requireExactOrderTopN: 3,
          },
        },
      },
    ],
  },
  {
    id: "L1_A09_hose_date_ranking_variant",
    level: "L1",
    turns: [
      {
        message: "Top 10 co phieu gia dong cua cao nhat ngay 28/05/2024 tren HOSE",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTool: { name: "stockSnapshot", status: "success" },
          endpointIncludes: ["/api/stocks", "exchange=HOSE"],
          intent: "stock_snapshot",
          rejectSuccessfulTools: ["marketSnapshot"],
          oracleTopKByDate: {
            source: "stocks",
            metric: "close",
            order: "desc",
            date: "28/05/2024",
            exchange: "HOSE",
            limit: 10,
            compareTopN: 7,
            minPrefixMatch: 5,
            requireExactOrderTopN: 3,
          },
        },
      },
    ],
  },
  {
    id: "L1_B01_symbol_as_of",
    level: "L1",
    turns: [
      {
        message: "Gia dong cua FPT ngay 28/05/2024 la bao nhieu",
        contextSnapshot: { page: "charts", symbol: "FPT" },
        expected: {
          requiredTool: { name: "stockSnapshot", status: "success" },
          endpointIncludes: ["/api/stocks", "symbol=FPT"],
          intent: "stock_snapshot",
        },
      },
    ],
  },
  {
    id: "L1_smallcap_symbol_as_of",
    level: "L1",
    turns: [
      {
        message: "Gia dong cua DHA ngay 28/05/2024 la bao nhieu",
        contextSnapshot: { page: "charts", symbol: "DHA" },
        expected: {
          requiredTool: { name: "stockSnapshot", status: "success" },
          endpointIncludes: ["/api/stocks", "symbol=DHA"],
          intent: "stock_snapshot",
        },
      },
    ],
  },
  {
    id: "L2_ambiguous_metric_fallback",
    level: "L2",
    turns: [
      {
        message: "PE hien tai la bao nhieu?",
        contextSnapshot: { page: "home" },
        expected: {
          intent: "stock_snapshot",
          rejectSuccessfulTools: ["marketSnapshot"],
          allowedPolicyStatuses: ["ok", "fallback", "shadow_blocked"],
        },
      },
    ],
  },
  {
    id: "L2_C01_bctn_statement_mapping",
    level: "L2",
    turns: [
      {
        message: "Cho BCTN moi nhat cua VNM, chi tra doanh thu va loi nhuan sau thue.",
        contextSnapshot: { page: "charts", symbol: "VNM" },
        expected: {
          requiredTool: { name: "fundamentalSnapshot", status: "success" },
          endpointIncludes: ["/api/fundamentals", "statement=is"],
          intent: "fundamentals",
        },
      },
    ],
  },
  {
    id: "L3_D01_risk_metrics",
    level: "L3",
    turns: [
      {
        message: "Tinh beta va max drawdown cua FPT so voi VNINDEX",
        contextSnapshot: { page: "risk", symbol: "FPT" },
        expected: {
          requiredTool: { name: "riskSnapshot", status: "success" },
          endpointIncludes: ["/api/risk"],
          intent: "risk",
        },
      },
    ],
  },
  {
    id: "L3_valuation_ranking_icb",
    level: "L3",
    turns: [
      {
        message: "Trong nhom ngan hang HOSE ngay 31/12/2025, liet ke top 5 co phieu co P/E cao nhat.",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTool: { name: "valuationRanking", status: "success" },
          endpointIncludes: ["/api/analytics/valuation-rankings"],
          intent: "valuation_ranking",
          oracleTopKByDate: {
            source: "valuation",
            metric: "pe",
            order: "desc",
            date: "31/12/2025",
            exchange: "HOSE",
            icbLevel: 3,
            icb: "ngan hang",
            limit: 5,
            compareTopN: 5,
            minPrefixMatch: 3,
            requireExactOrderTopN: 2,
          },
        },
      },
    ],
  },
  {
    id: "L2_data_health_probe",
    level: "L2",
    turns: [
      {
        message: "Kiem tra data backend, missing data va manifest co san sang khong.",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTool: { name: "dataHealth", status: "success" },
          endpointIncludes: ["/api/health/data"],
          intent: "data_health",
        },
      },
    ],
  },
  {
    id: "L2_factor_snapshot",
    level: "L2",
    turns: [
      {
        message: "Top co phieu momentum yeu nhat hien tai",
        contextSnapshot: { page: "factors" },
        expected: {
          requiredTool: { name: "factorSnapshot", status: "success" },
          endpointIncludes: ["/api/factors"],
          intent: "factor",
        },
      },
    ],
  },
  {
    id: "L3_backtesting_symbol",
    level: "L3",
    turns: [
      {
        message: "Backtest SMA crossover cho VNM voi von 100000",
        contextSnapshot: { page: "backtesting", symbol: "VNM" },
        expected: {
          requiredTool: { name: "backtestSummary", status: "success" },
          endpointIncludes: ["/api/backtesting"],
          intent: "backtesting",
        },
      },
    ],
  },
  {
    id: "L4_noisy_typo_ranking",
    level: "L4",
    turns: [
      {
        message: "dm top 5 close 28-05-2024 nhanh",
        contextSnapshot: { page: "home", filters: { limit: 5 } },
        expected: {
          requiredTool: { name: "stockSnapshot", status: "success" },
          endpointIncludes: ["/api/stocks"],
          intent: "stock_snapshot",
          rejectSuccessfulTools: ["marketSnapshot"],
          oracleTopKByDate: {
            source: "stocks",
            metric: "close",
            order: "desc",
            date: "28/05/2024",
            exchange: "HOSE",
            limit: 5,
            compareTopN: 3,
            minPrefixMatch: 2,
          },
        },
      },
    ],
  },
  {
    id: "L4_non_hose_scope_guard",
    level: "L4",
    turns: [
      {
        message: "top 10 gia dong cua cao nhat ngay 28/05/2024 tren HNX",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTool: { name: "stockSnapshot", status: "success" },
          endpointIncludes: ["/api/stocks", "exchange=HOSE"],
          intent: "stock_snapshot",
          rejectSuccessfulTools: ["marketSnapshot"],
          allowedPolicyStatuses: ["shadow_blocked", "fallback", "ok"],
          messageIncludes: ["HOSE"],
          maxEvidenceCount: 1,
          disallowNumericClaims: true,
        },
      },
    ],
  },
  {
    id: "L4_non_hose_upcom_scope_guard",
    level: "L4",
    turns: [
      {
        message: "top 10 gia dong cua cao nhat ngay 28/05/2024 tren UPCOM",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTool: { name: "stockSnapshot", status: "success" },
          endpointIncludes: ["/api/stocks", "exchange=HOSE"],
          intent: "stock_snapshot",
          rejectSuccessfulTools: ["marketSnapshot"],
          allowedPolicyStatuses: ["shadow_blocked", "fallback", "ok"],
          messageIncludes: ["HOSE"],
          maxEvidenceCount: 1,
          disallowNumericClaims: true,
        },
      },
    ],
  },
  {
    id: "L4_future_date_numeric_guard",
    level: "L4",
    turns: [
      {
        message: "Cho toi top 10 gia dong cua cao nhat tren HOSE ngay 31/12/2099",
        contextSnapshot: { page: "home" },
        expected: {
          allowedPolicyStatuses: ["shadow_blocked", "fallback", "ok"],
          rejectSuccessfulTools: ["marketSnapshot"],
          messageIncludes: ["khong"],
          disallowNumericClaims: true,
        },
      },
    ],
  },
];

function hasToolStatus(usedTools, toolName, status) {
  if (!Array.isArray(usedTools)) return false;
  return usedTools.some((item) => item?.name === toolName && item?.status === status);
}

function hasAnyCitationEndpoint(citations, fragment) {
  if (!Array.isArray(citations)) return false;
  return citations.some(
    (item) => typeof item?.endpoint === "string" && item.endpoint.includes(fragment)
  );
}

function countExecutedToolCalls(usedTools) {
  if (!Array.isArray(usedTools)) return 0;
  return usedTools.filter((item) => item && item.status !== "skipped").length;
}

function normalizeForMatch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasMessageFragment(message, fragment) {
  const haystack = normalizeForMatch(message);
  const needle = normalizeForMatch(fragment);
  return needle.length > 0 && haystack.includes(needle);
}

function hasMetricLikeNumericClaim(message) {
  const normalized = normalizeForMatch(message)
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, " ")
    .replace(/\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/g, " ")
    .replace(/\btop\s*\d+\b/g, " ");
  const sentences = normalized.split(/[.!?\n]+/);
  const metricTokens = [
    "gia",
    "close",
    "open",
    "high",
    "low",
    "volume",
    "khoi luong",
    "pe",
    "pb",
    "ev/ebitda",
    "beta",
    "drawdown",
    "return",
    "sharpe",
  ];
  return sentences.some((sentence) => metricTokens.some((token) => sentence.includes(token)) && /\d/.test(sentence));
}

function computePercentile(samples, percentile) {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  return sorted[rank];
}

function summarizeTools(usedTools) {
  if (!Array.isArray(usedTools) || usedTools.length === 0) return "none";
  return usedTools
    .map((tool) => `${tool?.name ?? "unknown"}:${tool?.status ?? "unknown"}`)
    .join(",");
}

function getLevelBucket(levelMetrics, level) {
  if (!levelMetrics[level]) {
    levelMetrics[level] = { totalTurns: 0, passedTurns: 0 };
  }
  return levelMetrics[level];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isRetryableCallError(error) {
  const text = String(error instanceof Error ? error.message : error ?? "").toLowerCase();
  return (
    text.includes("aborted")
    || text.includes("timeout")
    || text.includes("timed out")
    || text.includes("fetch failed")
    || text.includes("network")
  );
}

function parseRetryAfterMs(response) {
  const raw = response?.headers?.get?.("retry-after");
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const seconds = Number(text);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const retryAt = Date.parse(text);
  if (!Number.isFinite(retryAt)) return null;
  const delta = retryAt - Date.now();
  return delta > 0 ? delta : 0;
}

function computeRetryDelayMs(attemptIndex, response = null) {
  const retryAfterMs = parseRetryAfterMs(response);
  const baseDelay = Number.isFinite(retryAfterMs)
    ? retryAfterMs
    : retryBackoffMs * (2 ** Math.max(0, attemptIndex));
  const jitter = retryJitterMs > 0 ? Math.floor(Math.random() * (retryJitterMs + 1)) : 0;
  return Math.min(maxRetryDelayMs, Math.max(0, Math.round(baseDelay + jitter)));
}

async function callAssistant({ message, contextSnapshot, conversationHistory }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}/api/assistant`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-assistant-eval": "true",
        ...(evalAuthToken ? { "x-assistant-eval-token": evalAuthToken } : {}),
      },
      body: JSON.stringify({
        message,
        conversationHistory,
        contextSnapshot,
        preferences: { language: "vi", detailLevel: "brief" },
      }),
      signal: controller.signal,
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return { response, data, latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

async function callAssistantWithRetry(input) {
  let lastError = null;
  for (let attempt = 0; attempt <= maxRequestRetries; attempt += 1) {
    try {
      const call = await callAssistant(input);
      if (isRetryableStatus(call.response?.status) && attempt < maxRequestRetries) {
        await sleep(computeRetryDelayMs(attempt, call.response));
        continue;
      }
      return {
        ...call,
        attempts: attempt + 1,
        error: null,
      };
    } catch (error) {
      lastError = error;
      if (attempt >= maxRequestRetries || !isRetryableCallError(error)) {
        throw error;
      }
      await sleep(computeRetryDelayMs(attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("assistant call failed");
}

async function evaluateExpectations(data, expected) {
  const failures = [];
  let toolChecks = 0;
  let toolChecksPassed = 0;
  let endpointChecks = 0;
  let endpointChecksPassed = 0;
  let intentChecks = 0;
  let intentChecksPassed = 0;
  let policyChecks = 0;
  let policyChecksPassed = 0;
  let messageChecks = 0;
  let messageChecksPassed = 0;
  let evidenceChecks = 0;
  let evidenceChecksPassed = 0;
  let oracleChecks = 0;
  let oracleChecksPassed = 0;

  if (expected?.requiredTool) {
    toolChecks += 1;
    const ok = hasToolStatus(data?.usedTools, expected.requiredTool.name, expected.requiredTool.status);
    if (ok) {
      toolChecksPassed += 1;
    } else {
      failures.push(`required tool mismatch: ${expected.requiredTool.name}:${expected.requiredTool.status}`);
    }
  }

  if (Array.isArray(expected?.endpointIncludes)) {
    for (const fragment of expected.endpointIncludes) {
      endpointChecks += 1;
      const ok = hasAnyCitationEndpoint(data?.citations, fragment);
      if (ok) {
        endpointChecksPassed += 1;
      } else {
        failures.push(`missing citation endpoint fragment: ${fragment}`);
      }
    }
  }

  if (typeof expected?.intent === "string" && expected.intent.length > 0) {
    intentChecks += 1;
    const actualIntent = String(data?.meta?.queryIntent ?? "").trim();
    const ok = actualIntent === expected.intent;
    if (ok) {
      intentChecksPassed += 1;
    } else {
      failures.push(`query intent mismatch: expected=${expected.intent}, actual=${actualIntent || "n/a"}`);
    }
  }

  if (Array.isArray(expected?.allowedPolicyStatuses) && expected.allowedPolicyStatuses.length > 0) {
    policyChecks += 1;
    const actualPolicy = String(data?.policyStatus ?? "");
    const ok = expected.allowedPolicyStatuses.includes(actualPolicy);
    if (ok) {
      policyChecksPassed += 1;
    } else {
      failures.push(`policy status mismatch: expected one of [${expected.allowedPolicyStatuses.join(",")}], actual=${actualPolicy || "n/a"}`);
    }
  }

  if (Array.isArray(expected?.messageIncludes)) {
    const message = String(data?.message ?? "");
    for (const fragment of expected.messageIncludes) {
      messageChecks += 1;
      const ok = hasMessageFragment(message, fragment);
      if (ok) {
        messageChecksPassed += 1;
      } else {
        failures.push(`missing message fragment: ${fragment}`);
      }
    }
  }

  if (typeof expected?.maxEvidenceCount === "number") {
    evidenceChecks += 1;
    const totalEvidence = Array.isArray(data?.usedTools)
      ? data.usedTools.reduce((acc, tool) => acc + Number(tool?.evidenceCount ?? 0), 0)
      : 0;
    const ok = totalEvidence <= expected.maxEvidenceCount;
    if (ok) {
      evidenceChecksPassed += 1;
    } else {
      failures.push(`evidence count exceeds max: max=${expected.maxEvidenceCount}, actual=${totalEvidence}`);
    }
  }

  if (expected?.disallowNumericClaims === true) {
    messageChecks += 1;
    const text = String(data?.message ?? "");
    const ok = !hasMetricLikeNumericClaim(text);
    if (ok) {
      messageChecksPassed += 1;
    } else {
      failures.push("numeric claim detected in guarded response");
    }
  }

  if (Array.isArray(expected?.rejectSuccessfulTools)) {
    for (const toolName of expected.rejectSuccessfulTools) {
      const unexpectedSuccess = hasToolStatus(data?.usedTools, toolName, "success");
      if (unexpectedSuccess) {
        failures.push(`unexpected successful tool: ${toolName}`);
      }
    }
  }

  if (expected?.oracleTopKByDate && data?.success === true) {
    oracleChecks += 1;
    const verdict = await runTopKByDateOracleCheck({
      baseUrl,
      assistant: data,
      spec: expected.oracleTopKByDate,
      timeoutMs: oracleTimeoutMs,
    });
    if (verdict.ok) {
      oracleChecksPassed += 1;
    } else {
      failures.push(verdict.reason);
    }
  }

  if (expected?.oracleSymbolCompare && data?.success === true) {
    oracleChecks += 1;
    const verdict = await runSymbolCompareMetricOracleCheck({
      baseUrl,
      assistant: data,
      spec: expected.oracleSymbolCompare,
      timeoutMs: oracleTimeoutMs,
    });
    if (verdict.ok) {
      oracleChecksPassed += 1;
    } else {
      failures.push(verdict.reason);
    }
  }

  return {
    failures,
    toolChecks,
    toolChecksPassed,
    endpointChecks,
    endpointChecksPassed,
    intentChecks,
    intentChecksPassed,
    policyChecks,
    policyChecksPassed,
    messageChecks,
    messageChecksPassed,
    evidenceChecks,
    evidenceChecksPassed,
    oracleChecks,
    oracleChecksPassed,
  };
}

async function writeReport(report) {
  if (!reportPath) return null;
  const fs = await import("node:fs");
  const path = await import("node:path");
  const absolutePath = path.resolve(reportPath);
  try {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return absolutePath;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code ?? "") : "";
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      console.warn(`WARN report_write_skipped path=${absolutePath} code=${code || "unknown"}`);
      return null;
    }
    throw error;
  }
}

async function run() {
  const startedAt = Date.now();
  const results = [];
  const levelMetrics = {};
  let totalTurns = 0;
  let passedTurns = 0;
  let toolChecks = 0;
  let toolChecksPassed = 0;
  let endpointChecks = 0;
  let endpointChecksPassed = 0;
  let intentChecks = 0;
  let intentChecksPassed = 0;
  let policyChecks = 0;
  let policyChecksPassed = 0;
  let messageChecks = 0;
  let messageChecksPassed = 0;
  let evidenceChecks = 0;
  let evidenceChecksPassed = 0;
  let oracleChecks = 0;
  let oracleChecksPassed = 0;
  let toolBudgetChecks = 0;
  let toolBudgetChecksPassed = 0;
  const latencySamples = [];
  const toolCallSamples = [];

  for (const scenario of scenarios) {
    const history = [];
    for (let turnIndex = 0; turnIndex < scenario.turns.length; turnIndex += 1) {
      const turn = scenario.turns[turnIndex];
      totalTurns += 1;
      const levelBucket = getLevelBucket(levelMetrics, scenario.level);
      levelBucket.totalTurns += 1;

      let turnResult;
      try {
        const call = await callAssistantWithRetry({
          message: turn.message,
          contextSnapshot: turn.contextSnapshot,
          conversationHistory: history,
        });

        const responseOk = call.response.ok && call.data?.success === true;
        const expectation = await evaluateExpectations(call.data, turn.expected);

        toolChecks += expectation.toolChecks;
        toolChecksPassed += expectation.toolChecksPassed;
        endpointChecks += expectation.endpointChecks;
        endpointChecksPassed += expectation.endpointChecksPassed;
        intentChecks += expectation.intentChecks;
        intentChecksPassed += expectation.intentChecksPassed;
        policyChecks += expectation.policyChecks;
        policyChecksPassed += expectation.policyChecksPassed;
        messageChecks += expectation.messageChecks;
        messageChecksPassed += expectation.messageChecksPassed;
        evidenceChecks += expectation.evidenceChecks;
        evidenceChecksPassed += expectation.evidenceChecksPassed;
        oracleChecks += expectation.oracleChecks;
        oracleChecksPassed += expectation.oracleChecksPassed;

        const toolCallCount = countExecutedToolCalls(call.data?.usedTools);
        toolCallSamples.push(toolCallCount);
        toolBudgetChecks += 1;
        if (toolCallCount <= maxToolCallsPerTurn) {
          toolBudgetChecksPassed += 1;
        } else {
          expectation.failures.push(`tool call count exceeds max: max=${maxToolCallsPerTurn}, actual=${toolCallCount}`);
        }
        if (typeof call.latencyMs === "number" && Number.isFinite(call.latencyMs)) {
          latencySamples.push(call.latencyMs);
        }

        const turnPassed = responseOk && expectation.failures.length === 0;
        if (turnPassed) {
          passedTurns += 1;
          levelBucket.passedTurns += 1;
        }

        turnResult = {
          scenarioId: scenario.id,
          level: scenario.level,
          turn: turnIndex + 1,
          pass: turnPassed,
          latencyMs: call.latencyMs,
          status: call.response.status,
          attempts: call.attempts ?? 1,
          policyStatus: call.data?.policyStatus ?? null,
          queryIntent: call.data?.meta?.queryIntent ?? null,
          queryPlanSummary: call.data?.meta?.queryPlanSummary ?? null,
          tools: summarizeTools(call.data?.usedTools),
          failures: responseOk ? expectation.failures : [`assistant HTTP/status failure: ${call.response.status}`],
        };

        if (call.data?.success === true && typeof call.data?.message === "string") {
          history.push({ role: "user", content: turn.message });
          history.push({ role: "assistant", content: call.data.message.slice(0, 1200) });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        turnResult = {
          scenarioId: scenario.id,
          level: scenario.level,
          turn: turnIndex + 1,
          pass: false,
          latencyMs: null,
          status: null,
          attempts: null,
          policyStatus: null,
          queryIntent: null,
          queryPlanSummary: null,
          tools: "none",
          failures: [`request failed: ${message}`],
        };
      }

      results.push(turnResult);
      const prefix = turnResult.pass ? "PASS" : "FAIL";
      const failureText = turnResult.pass ? "" : ` - ${turnResult.failures.join(" | ")}`;
      console.log(`${prefix} ${scenario.id}#${turnResult.turn}${failureText}`);
    }
  }

  const latencyP50 = computePercentile(latencySamples, 50);
  const latencyP95 = computePercentile(latencySamples, 95);
  const latencyMax = latencySamples.length > 0 ? Math.max(...latencySamples) : null;
  const latencyGatePassed = latencyP95 !== null ? latencyP95 <= maxLatencyP95Ms : false;
  if (!latencyGatePassed) {
    console.error(`FAIL latency gate - p95=${latencyP95 ?? "n/a"}ms threshold=${maxLatencyP95Ms}ms`);
  }
  const toolCallsP95 = computePercentile(toolCallSamples, 95);
  const toolCallsP50 = computePercentile(toolCallSamples, 50);
  const toolCallsMax = toolCallSamples.length > 0 ? Math.max(...toolCallSamples) : null;

  const report = {
    runAt: new Date().toISOString(),
    baseUrl,
    totalScenarios: scenarios.length,
    totalTurns,
    passedTurns,
    failedTurns: totalTurns - passedTurns,
    turnPassRate: totalTurns > 0 ? passedTurns / totalTurns : 0,
    routingChecks: {
      tool: {
        total: toolChecks,
        passed: toolChecksPassed,
        passRate: toolChecks > 0 ? toolChecksPassed / toolChecks : 0,
      },
      endpoint: {
        total: endpointChecks,
        passed: endpointChecksPassed,
        passRate: endpointChecks > 0 ? endpointChecksPassed / endpointChecks : 0,
      },
      intent: {
        total: intentChecks,
        passed: intentChecksPassed,
        passRate: intentChecks > 0 ? intentChecksPassed / intentChecks : 0,
      },
      policy: {
        total: policyChecks,
        passed: policyChecksPassed,
        passRate: policyChecks > 0 ? policyChecksPassed / policyChecks : 0,
      },
      message: {
        total: messageChecks,
        passed: messageChecksPassed,
        passRate: messageChecks > 0 ? messageChecksPassed / messageChecks : 0,
      },
      evidence: {
        total: evidenceChecks,
        passed: evidenceChecksPassed,
        passRate: evidenceChecks > 0 ? evidenceChecksPassed / evidenceChecks : 0,
      },
      oracle: {
        total: oracleChecks,
        passed: oracleChecksPassed,
        passRate: oracleChecks > 0 ? oracleChecksPassed / oracleChecks : 0,
      },
      toolBudget: {
        total: toolBudgetChecks,
        passed: toolBudgetChecksPassed,
        passRate: toolBudgetChecks > 0 ? toolBudgetChecksPassed / toolBudgetChecks : 0,
        maxPerTurn: maxToolCallsPerTurn,
      },
    },
    performance: {
      latencyMs: {
        samples: latencySamples.length,
        p50: latencyP50,
        p95: latencyP95,
        max: latencyMax,
        p95ThresholdMs: maxLatencyP95Ms,
        gatePass: latencyGatePassed,
      },
      toolCallsPerTurn: {
        samples: toolCallSamples.length,
        p50: toolCallsP50,
        p95: toolCallsP95,
        max: toolCallsMax,
        maxAllowedPerTurn: maxToolCallsPerTurn,
      },
      timeoutsMs: {
        assistant: timeoutMs,
        oracle: oracleTimeoutMs,
      },
    },
    levelMetrics,
    durationMs: Date.now() - startedAt,
    results,
  };

  const writtenPath = await writeReport(report);
  if (writtenPath) {
    console.log(`REPORT_PATH=${writtenPath}`);
  }
  console.log(JSON.stringify(report));

  if (report.failedTurns > 0 || !latencyGatePassed) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
