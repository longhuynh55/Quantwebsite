import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.ASSISTANT_EVAL_BASE_URL ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3010";
const timeoutMs = Number(process.env.ASSISTANT_EVAL_TIMEOUT_MS ?? 120000);
const reportPath = process.env.ASSISTANT_EVAL_REPORT_PATH ?? "artifacts/assistant-ohlcv-combo-noise-report.json";
const evalAuthToken = String(process.env.ASSISTANT_EVAL_AUTH_TOKEN ?? "").trim();
const maxRequestRetries = Number(process.env.ASSISTANT_EVAL_MAX_RETRIES ?? 2);
const retryBackoffMs = Number(process.env.ASSISTANT_EVAL_RETRY_BACKOFF_MS ?? 400);

const scenarios = [
  {
    id: "COMBO-NOISE-01",
    category: "compound_conditions",
    turns: [
      {
        message: "Loc nganh ngan hang tren HOSE ngay 28/05/2024, chi lay ma co close > open, xep top 5 theo (high-low)/close.",
        contextSnapshot: { page: "analysis" },
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
    id: "COMBO-NOISE-02",
    category: "compound_conditions",
    turns: [
      {
        message: "Nhom bat dong san HOSE ngay 28-05-2024: top 5 ma volume lon hon trung vi nhom, uu tien high giam dan.",
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
    id: "COMBO-NOISE-03",
    category: "compound_conditions",
    turns: [
      {
        message: "Nhom ngan hang HOSE tu 02/01/2024 den 28/05/2024, top 5 theo turnover xap xi close*volume, bo ma bien dong <= 1%.",
        contextSnapshot: { page: "analysis" },
        expected: {
          requiredTools: [{ name: "stockSnapshot", status: "success" }],
          endpointIncludes: ["/api/stocks"],
          allowedPolicyStatuses: ["ok", "fallback"],
          minCitationCount: 1,
          mustHaveNumericEvidence: true,
        },
      },
    ],
  },
  {
    id: "COMBO-NOISE-04",
    category: "noisy_prompt",
    turns: [
      {
        message: "Bro loc giup toi bank HOSE 28-5-24 top 5 ma manh nhat theo close, tra nhanh nhung phai co nguon.",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTools: [{ name: "stockSnapshot", status: "success" }],
          endpointIncludes: ["/api/stocks"],
          allowedPolicyStatuses: ["ok", "fallback"],
          minCitationCount: 1,
          mustHaveNumericEvidence: true,
        },
      },
    ],
  },
  {
    id: "COMBO-NOISE-05",
    category: "icb_compound",
    turns: [
      {
        message: "Tong hop ICB cap 3 tren HOSE ngay 28/05/2024, top 5 nganh theo tong volume va kem so ma trong tung nganh.",
        contextSnapshot: { page: "analysis" },
        expected: {
          requiredTools: [{ name: "icbSnapshot", status: "success" }],
          endpointIncludes: ["/api/analytics/icb-snapshot", "date=2024-05-28", "icbLevel=3"],
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
          mustHaveNumericEvidence: true,
        },
      },
    ],
  },
  {
    id: "COMBO-NOISE-06",
    category: "multi_turn_refinement",
    turns: [
      {
        message: "Lay top 8 nganh ngan hang HOSE theo close ngay 28/05/2024.",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTools: [{ name: "stockSnapshot", status: "success" }],
          endpointIncludes: ["/api/stocks", "metric=close", "date=2024-05-28"],
          allowedPolicyStatuses: ["ok", "fallback"],
          minCitationCount: 1,
          mustHaveNumericEvidence: true,
        },
      },
      {
        message: "Giu nguyen bo loc, doi sang low tang dan va chi lay 3 ma dau.",
        contextSnapshot: { page: "home", filters: { metric: "low", order: "asc", limit: 3, date: "28/05/2024" } },
        expected: {
          requiredTools: [{ name: "stockSnapshot", status: "success" }],
          endpointIncludes: ["/api/stocks", "metric=low", "order=asc", "date=2024-05-28"],
          allowedPolicyStatuses: ["ok", "fallback"],
          minCitationCount: 1,
          mustHaveNumericEvidence: true,
        },
      },
      {
        message: "Backtest SMA crossover cho 3 ma vua neu, von 100000.",
        contextSnapshot: { page: "backtesting", strategy: "sma_crossover" },
        expected: {
          requiredTools: [{ name: "backtestSummary", status: "success" }],
          endpointIncludes: ["/api/backtesting"],
          allowedPolicyStatuses: ["ok", "fallback", "shadow_blocked"],
          minCitationCount: 1,
        },
      },
    ],
  },
  {
    id: "COMBO-NOISE-07",
    category: "guard_noise",
    turns: [
      {
        message: "HNX nhe: top 5 bank theo close ngay 28/05/2024, tra so lieu cu the.",
        contextSnapshot: { page: "home" },
        expected: {
          allowedPolicyStatuses: ["shadow_blocked", "fallback", "ok"],
          messageIncludes: ["HOSE"],
          disallowMetricNumericClaims: true,
        },
      },
    ],
  },
  {
    id: "COMBO-NOISE-08",
    category: "guard_noise",
    turns: [
      {
        message: "Ngan hang HOSE ngay 31/12/2099 top 5 volume, kem dieu kien close > open.",
        contextSnapshot: { page: "home" },
        expected: {
          allowedPolicyStatuses: ["shadow_blocked", "fallback", "ok"],
          disallowMetricNumericClaims: true,
        },
      },
    ],
  },
  {
    id: "COMBO-NOISE-09",
    category: "ambiguity_resolution",
    turns: [
      {
        message: "Lay top 5 va dong thoi bottom 5 nganh ban le HOSE ngay 28/05/2024 theo close; neu xung dot thi uu tien top 5.",
        contextSnapshot: { page: "analysis" },
        expected: {
          requiredTools: [{ name: "stockSnapshot", status: "success" }],
          endpointIncludes: ["/api/stocks", "metric=close", "date=2024-05-28"],
          allowedPolicyStatuses: ["ok", "fallback"],
          minCitationCount: 1,
          mustHaveNumericEvidence: true,
        },
      },
    ],
  },
];

function normalizeForMatch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseFragment(fragment) {
  const idx = String(fragment ?? "").indexOf("=");
  if (idx <= 0) return null;
  return {
    key: String(fragment).slice(0, idx).trim().toLowerCase(),
    value: String(fragment).slice(idx + 1).trim(),
  };
}

function normalizeDateValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text);
  if (iso) {
    const yyyy = Number(iso[1]);
    const mm = Number(iso[2]);
    const dd = Number(iso[3]);
    return `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/.exec(text);
  if (dmy) {
    const dd = Number(dmy[1]);
    const mm = Number(dmy[2]);
    const rawYear = Number(dmy[3]);
    const yyyy = rawYear < 100 ? 2000 + rawYear : rawYear;
    return `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  return null;
}

function normalizeScalar(value) {
  return String(value ?? "").trim().toLowerCase();
}

function expandEndpointFragmentVariants(fragment) {
  const base = String(fragment ?? "").trim();
  if (!base) return [base];
  const variants = new Set([base]);
  const dateMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(base);
  if (dateMatch) {
    const ddMmYyyy = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    variants.add(base.replace(dateMatch[0], ddMmYyyy));
  }
  return Array.from(variants);
}

function hasToolStatus(usedTools, toolName, status) {
  if (!Array.isArray(usedTools)) return false;
  return usedTools.some((item) => item?.name === toolName && item?.status === status);
}

function hasAnyCitationEndpoint(citations, fragment) {
  if (!Array.isArray(citations)) return false;
  const variants = expandEndpointFragmentVariants(fragment);
  return citations.some((item) => {
    if (typeof item?.endpoint !== "string") return false;
    return variants.some((candidate) => item.endpoint.includes(candidate));
  });
}

function hasEndpointEvidence(citations, usedTools, fragment) {
  if (hasAnyCitationEndpoint(citations, fragment)) return true;

  const parsed = parseFragment(fragment);
  if (!parsed) return false;
  const key = parsed.key;
  const valueNorm = normalizeScalar(parsed.value);
  const dateKeys = new Set(["date", "requesteddate", "asofdate", "fromdate", "todate", "startdate", "enddate"]);
  const safeTools = Array.isArray(usedTools) ? usedTools : [];

  for (const tool of safeTools) {
    const params = tool?.requestParams;
    if (!params || typeof params !== "object") continue;
    for (const [rawKey, rawValue] of Object.entries(params)) {
      const paramKey = normalizeScalar(rawKey);
      if (dateKeys.has(key) && dateKeys.has(paramKey)) {
        const a = normalizeDateValue(parsed.value);
        const b = normalizeDateValue(rawValue);
        if (a && b && a === b) return true;
      }
      if (paramKey === key) {
        if (Array.isArray(rawValue)) {
          if (rawValue.some((item) => normalizeScalar(item) === valueNorm)) return true;
        } else if (normalizeScalar(rawValue) === valueNorm) {
          return true;
        }
      }
    }
  }

  return false;
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
  const lines = normalized.split(/[.!?\n]+/);
  const metricTokens = [
    "gia",
    "close",
    "open",
    "high",
    "low",
    "volume",
    "khoi luong",
    "drawdown",
    "return",
    "sharpe",
    "pe",
    "pb",
  ];
  return lines.some((line) => metricTokens.some((token) => line.includes(token)) && /\d/.test(line));
}

function hasNumericEvidenceInTables(messageBlocks) {
  if (!Array.isArray(messageBlocks)) return false;
  for (const block of messageBlocks) {
    if (!block || block.type !== "table" || !Array.isArray(block.rows)) continue;
    for (const row of block.rows) {
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        if (typeof cell === "number" && Number.isFinite(cell)) return true;
        if (typeof cell === "string" && /\d/.test(cell)) return true;
      }
    }
  }
  return false;
}

function hasToolNumericEvidence(usedTools) {
  if (!Array.isArray(usedTools)) return false;
  return usedTools.some((tool) => Number(tool?.evidenceCount ?? 0) > 0);
}

function hasUserFacingNumericOutput(data) {
  return (
    hasMetricLikeNumericClaim(String(data?.message ?? ""))
    || hasNumericEvidenceInTables(data?.messageBlocks)
  );
}

function hasNumericEvidence(data) {
  return hasUserFacingNumericOutput(data) || hasToolNumericEvidence(data?.usedTools);
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

function evaluateExpectations(data, expected) {
  const failures = [];
  if (Array.isArray(expected?.requiredTools)) {
    for (const reqTool of expected.requiredTools) {
      const pass = hasToolStatus(data?.usedTools, reqTool.name, reqTool.status ?? "success");
      if (!pass) failures.push(`missing tool ${reqTool.name}:${reqTool.status ?? "success"}`);
    }
  }

  if (Array.isArray(expected?.endpointIncludes)) {
    for (const fragment of expected.endpointIncludes) {
      const pass = hasEndpointEvidence(data?.citations, data?.usedTools, fragment);
      if (!pass) failures.push(`missing endpoint evidence "${fragment}"`);
    }
  }

  if (Array.isArray(expected?.allowedPolicyStatuses)) {
    const policyStatus = String(data?.policyStatus ?? "unknown");
    if (!expected.allowedPolicyStatuses.includes(policyStatus)) {
      failures.push(`policyStatus=${policyStatus} not in [${expected.allowedPolicyStatuses.join(",")}]`);
    }
  }

  if (Number.isFinite(Number(expected?.minCitationCount))) {
    const citationsCount = Array.isArray(data?.citations) ? data.citations.length : 0;
    if (citationsCount < Number(expected.minCitationCount)) {
      failures.push(`citation count ${citationsCount} < ${expected.minCitationCount}`);
    }
  }

  if (expected?.mustHaveNumericEvidence) {
    const pass = hasNumericEvidence(data);
    if (!pass) failures.push("missing numeric evidence for numeric query");
  }

  if (expected?.disallowMetricNumericClaims) {
    const hasNumeric = hasUserFacingNumericOutput(data);
    if (hasNumeric) failures.push("unexpected numeric claim/evidence in guarded scenario");
  }

  if (Array.isArray(expected?.messageIncludes)) {
    for (const fragment of expected.messageIncludes) {
      const pass = hasMessageFragment(String(data?.message ?? ""), fragment);
      if (!pass) failures.push(`message missing fragment "${fragment}"`);
    }
  }

  return failures;
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
  let totalTurns = 0;
  let passedTurns = 0;

  for (const scenario of scenarios) {
    const history = [];
    for (let i = 0; i < scenario.turns.length; i += 1) {
      totalTurns += 1;
      const turn = scenario.turns[i];
      try {
        const call = await callAssistant({
          message: turn.message,
          contextSnapshot: turn.contextSnapshot,
          conversationHistory: history,
        });
        const responseOk = call.response.ok && call.data?.success === true && typeof call.data?.message === "string";
        const failures = responseOk ? evaluateExpectations(call.data, turn.expected ?? {}) : [`assistant HTTP/status failure: ${call.response.status}`];
        const pass = responseOk && failures.length === 0;
        if (pass) passedTurns += 1;

        const item = {
          scenarioId: scenario.id,
          category: scenario.category,
          turn: i + 1,
          pass,
          status: call.response.status,
          latencyMs: call.latencyMs,
          attempts: call.attempts ?? 1,
          policyStatus: call.data?.policyStatus ?? null,
          queryIntent: call.data?.meta?.queryIntent ?? null,
          queryPlanSummary: call.data?.meta?.queryPlanSummary ?? null,
          tools: Array.isArray(call.data?.usedTools)
            ? call.data.usedTools.map((tool) => `${tool?.name ?? "unknown"}:${tool?.status ?? "unknown"}`).join(",")
            : "none",
          failures,
        };
        results.push(item);

        if (call.data?.success === true && typeof call.data?.message === "string") {
          history.push({ role: "user", content: turn.message });
          history.push({ role: "assistant", content: call.data.message.slice(0, 1200) });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          scenarioId: scenario.id,
          category: scenario.category,
          turn: i + 1,
          pass: false,
          status: null,
          latencyMs: null,
          attempts: null,
          policyStatus: null,
          queryIntent: null,
          queryPlanSummary: null,
          tools: "none",
          failures: [`request failed: ${message}`],
        });
      }

      const last = results[results.length - 1];
      const prefix = last.pass ? "PASS" : "FAIL";
      const failureText = last.pass ? "" : ` - ${last.failures.join(" | ")}`;
      console.log(`${prefix} ${scenario.id}#${last.turn}${failureText}`);
    }
  }

  const failedTurns = totalTurns - passedTurns;
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    profile: "ohlcv-combo-noise-v1",
    totalScenarios: scenarios.length,
    totalTurns,
    passedTurns,
    failedTurns,
    turnPassRate: totalTurns > 0 ? passedTurns / totalTurns : 0,
    durationMs: Date.now() - startedAt,
    overallStatus: failedTurns === 0 ? "pass" : "fail",
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
