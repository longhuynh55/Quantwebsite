const baseUrl = process.env.ASSISTANT_EVAL_BASE_URL ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3010";
const timeoutMs = Number(process.env.ASSISTANT_PERF_REL_TIMEOUT_MS ?? 45000);
const maxRetries = Number(process.env.ASSISTANT_PERF_REL_MAX_RETRIES ?? 1);
const retryBackoffMs = Number(process.env.ASSISTANT_PERF_REL_RETRY_BACKOFF_MS ?? 300);
const maxRetryDelayMs = Number(process.env.ASSISTANT_PERF_REL_MAX_RETRY_DELAY_MS ?? 5000);
const retryJitterMs = Number(process.env.ASSISTANT_PERF_REL_RETRY_JITTER_MS ?? 120);
const reportPath =
  process.env.ASSISTANT_PERF_REL_REPORT_PATH ?? "artifacts/assistant-perf-reliability-report.json";
const evalAuthToken = String(process.env.ASSISTANT_EVAL_AUTH_TOKEN ?? "").trim();

const gatesConfig = {
  minPassRate: Number(process.env.ASSISTANT_PERF_REL_MIN_PASS_RATE ?? 0.9),
  maxLatencyP95Ms: Number(process.env.ASSISTANT_PERF_REL_MAX_LATENCY_P95_MS ?? 30000),
  maxS1Failures: Number(process.env.ASSISTANT_PERF_REL_MAX_S1_FAILURES ?? 0),
};

const cases = [
  {
    testId: "PERF-API-01",
    severity: "S1",
    type: "api",
    method: "GET",
    endpoint: "/api/health/data?probe=true&includeFundamentals=false",
    expected: { allowedStatuses: [200], requireOkTrue: true },
  },
  {
    testId: "PERF-API-02",
    severity: "S2",
    type: "api",
    method: "GET",
    endpoint: "/api/health/data?refresh=true",
    expected: { allowedStatuses: [403, 503] },
  },
  {
    testId: "PERF-API-03",
    severity: "S2",
    type: "api",
    method: "GET",
    endpoint: "/api/stocks?limit=1",
    expected: { allowedStatuses: [200], requireNonEmptyPayload: true },
  },
  {
    testId: "PERF-API-04",
    severity: "S2",
    type: "api",
    method: "GET",
    endpoint: "/api/fundamentals?symbol=AAA&period=latest&statement=all",
    expected: { allowedStatuses: [200], requireNonEmptyPayload: true },
  },
  {
    testId: "PERF-API-05",
    severity: "S2",
    type: "api",
    method: "GET",
    endpoint: "/api/factors?factor=momentum&limit=10",
    expected: { allowedStatuses: [200], requireNonEmptyPayload: true },
  },
  {
    testId: "PERF-AST-01",
    severity: "S2",
    type: "assistant",
    message: "Tom tat nhanh thi truong hien tai va benchmark.",
    contextSnapshot: { page: "home" },
    expected: { requiredTool: ["marketSnapshot", "success"], allowedPolicyStatuses: ["ok"] },
  },
  {
    testId: "PERF-AST-02",
    severity: "S2",
    type: "assistant",
    message: "Cho toi doanh thu va loi nhuan sau thue moi nhat cua VNM.",
    contextSnapshot: { page: "charts", symbol: "VNM" },
    expected: { requiredTool: ["fundamentalSnapshot", "success"], allowedPolicyStatuses: ["ok"] },
  },
  {
    testId: "PERF-AST-03",
    severity: "S2",
    type: "assistant",
    message: "Backtest SMA crossover cho VNM voi von 100000, cho toi net return va sharpe.",
    contextSnapshot: { page: "backtesting", symbol: "VNM" },
    expected: { requiredTool: ["backtestSummary", "success"], allowedPolicyStatuses: ["ok"] },
  },
  {
    testId: "PERF-AST-04",
    severity: "S1",
    type: "assistant",
    message: "Top 10 gia dong cua cao nhat tren HNX ngay 28/05/2024",
    contextSnapshot: { page: "home" },
    expected: {
      requiredTool: ["stockSnapshot", "success"],
      allowedPolicyStatuses: ["shadow_blocked"],
      messageIncludesAny: ["hose", "scope", "supported", "khong ho tro"],
    },
  },
  {
    testId: "PERF-AST-05",
    severity: "S2",
    type: "assistant",
    message: "Kiem tra data backend, missing data va manifest co san sang khong.",
    contextSnapshot: { page: "home" },
    expected: { requiredTool: ["dataHealth", "success"], allowedPolicyStatuses: ["ok"] },
  },
];

function normalizeForMatch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasToolStatus(usedTools, name, status) {
  if (!Array.isArray(usedTools)) return false;
  return usedTools.some((item) => item?.name === name && item?.status === status);
}

function hasMessageFragment(message, fragment) {
  return normalizeForMatch(message).includes(normalizeForMatch(fragment));
}

function isRetryableStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isRetryableError(error) {
  const text = String(error instanceof Error ? error.message : error ?? "").toLowerCase();
  return text.includes("aborted") || text.includes("timeout") || text.includes("fetch failed") || text.includes("network");
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank];
}

function rate(passed, total) {
  return total > 0 ? passed / total : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function payloadIsNonEmpty(payload) {
  if (Array.isArray(payload)) return payload.length > 0;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.data)) return payload.data.length > 0;
    return Object.keys(payload).length > 0;
  }
  return false;
}

async function requestWithRetry({ method, endpoint, body }) {
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(evalAuthToken ? { "x-assistant-eval-token": evalAuthToken, "x-assistant-eval": "true" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      const latencyMs = Date.now() - startedAt;
      if (isRetryableStatus(response.status) && attempt < maxRetries) {
        await sleep(computeRetryDelayMs(attempt, response));
        continue;
      }
      return { response, data, latencyMs, attempts: attempt + 1, error: null };
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries || !isRetryableError(error)) {
        return {
          response: null,
          data: null,
          latencyMs: Date.now() - startedAt,
          attempts: attempt + 1,
          error: error instanceof Error ? error.message : String(error),
        };
      }
      await sleep(computeRetryDelayMs(attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    response: null,
    data: null,
    latencyMs: null,
    attempts: maxRetries + 1,
    error: lastError instanceof Error ? lastError.message : String(lastError ?? "unknown_error"),
  };
}

function evaluateApiCase(outcome, expected) {
  const failures = [];
  const status = outcome.response?.status ?? null;
  const statusOk = Array.isArray(expected.allowedStatuses) ? expected.allowedStatuses.includes(status) : Boolean(outcome.response?.ok);
  if (!statusOk) failures.push(`status_mismatch expected=[${(expected.allowedStatuses ?? []).join(",")}], actual=${status ?? "network"}`);
  if (expected.requireOkTrue === true && outcome.data?.ok !== true) failures.push("payload_ok_false");
  if (expected.requireNonEmptyPayload === true && !payloadIsNonEmpty(outcome.data)) failures.push("payload_empty");
  return failures;
}

function evaluateAssistantCase(outcome, expected) {
  const failures = [];
  const responseOk = Boolean(outcome.response?.ok && outcome.data?.success === true);
  if (!responseOk) failures.push(`assistant_response_failure status=${outcome.response?.status ?? "network"}`);

  if (Array.isArray(expected.requiredTool)) {
    const [name, status] = expected.requiredTool;
    if (!hasToolStatus(outcome.data?.usedTools, name, status)) {
      failures.push(`required_tool_missing ${name}:${status}`);
    }
  }

  if (Array.isArray(expected.allowedPolicyStatuses) && expected.allowedPolicyStatuses.length > 0) {
    const policyStatus = String(outcome.data?.policyStatus ?? "");
    if (!expected.allowedPolicyStatuses.includes(policyStatus)) {
      failures.push(`policy_status_mismatch expected=[${expected.allowedPolicyStatuses.join(",")}], actual=${policyStatus || "n/a"}`);
    }
  }

  if (Array.isArray(expected.messageIncludesAny) && expected.messageIncludesAny.length > 0) {
    const text = String(outcome.data?.message ?? "");
    const hasAny = expected.messageIncludesAny.some((fragment) => hasMessageFragment(text, fragment));
    if (!hasAny) failures.push(`missing_message_fragments [${expected.messageIncludesAny.join(",")}]`);
  }

  return failures;
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
  const latencySamples = [];
  let passed = 0;
  let s1Failures = 0;

  for (const testCase of cases) {
    const outcome =
      testCase.type === "assistant"
        ? await requestWithRetry({
            method: "POST",
            endpoint: "/api/assistant",
            body: {
              message: testCase.message,
              conversationHistory: [],
              contextSnapshot: testCase.contextSnapshot,
              preferences: { language: "vi", detailLevel: "brief" },
            },
          })
        : await requestWithRetry({
            method: testCase.method,
            endpoint: testCase.endpoint,
          });

    if (typeof outcome.latencyMs === "number" && Number.isFinite(outcome.latencyMs)) {
      latencySamples.push(outcome.latencyMs);
    }

    const failures =
      testCase.type === "assistant"
        ? evaluateAssistantCase(outcome, testCase.expected)
        : evaluateApiCase(outcome, testCase.expected);
    const pass = failures.length === 0;
    if (pass) passed += 1;
    if (!pass && testCase.severity === "S1") s1Failures += 1;

    const result = {
      testId: testCase.testId,
      type: testCase.type,
      severity: testCase.severity,
      pass,
      status: outcome.response?.status ?? null,
      latencyMs: outcome.latencyMs,
      attempts: outcome.attempts,
      policyStatus: outcome.data?.policyStatus ?? null,
      tools: summarizeTools(outcome.data?.usedTools),
      failures,
      error: outcome.error,
    };
    results.push(result);
    console.log(`${pass ? "PASS" : "FAIL"} ${testCase.testId}${pass ? "" : ` - ${failures.join(" | ")}`}`);
  }

  const passRate = rate(passed, cases.length) ?? 0;
  const latencyP95 = percentile(latencySamples, 95) ?? Number.POSITIVE_INFINITY;
  const gates = {
    passRate: {
      pass: passRate >= gatesConfig.minPassRate,
      actual: passRate,
      threshold: gatesConfig.minPassRate,
    },
    latencyP95: {
      pass: latencyP95 <= gatesConfig.maxLatencyP95Ms,
      actual: latencyP95,
      threshold: gatesConfig.maxLatencyP95Ms,
    },
    s1Failures: {
      pass: s1Failures <= gatesConfig.maxS1Failures,
      actual: s1Failures,
      threshold: gatesConfig.maxS1Failures,
    },
  };
  const allPass = Object.values(gates).every((item) => item.pass);

  const report = {
    schemaVersion: "assistant-perf-reliability-v1-2026-02-19",
    runAt: new Date().toISOString(),
    baseUrl,
    durationMs: Date.now() - startedAt,
    totalCases: cases.length,
    passedCases: passed,
    failedCases: cases.length - passed,
    passRate,
    s1Failures,
    latency: {
      p95Ms: Number.isFinite(latencyP95) ? latencyP95 : null,
      samples: latencySamples.length,
    },
    gatesConfig,
    retryConfig: {
      maxRetries,
      baseBackoffMs: retryBackoffMs,
      maxRetryDelayMs,
      retryJitterMs,
      timeoutMs,
    },
    gates,
    overallStatus: allPass ? "pass" : "fail",
    results,
  };

  const writtenPath = await writeReport(report);
  if (writtenPath) console.log(`REPORT_PATH=${writtenPath}`);
  console.log(
    `SUMMARY total=${cases.length} passed=${passed} pass_rate=${(passRate * 100).toFixed(2)}% latency_p95=${report.latency.p95Ms ?? "n/a"} s1_failures=${s1Failures}`
  );
  console.log(`GATES all=${allPass ? "PASS" : "FAIL"}`);
  if (!allPass) process.exit(1);
}

function summarizeTools(usedTools) {
  if (!Array.isArray(usedTools) || usedTools.length === 0) return "none";
  return usedTools.map((tool) => `${tool?.name ?? "unknown"}:${tool?.status ?? "unknown"}`).join(",");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
