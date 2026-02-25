import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.ASSISTANT_EVAL_BASE_URL ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3010";
const timeoutMs = Number(process.env.ASSISTANT_EVAL_TIMEOUT_MS ?? 120000);
const reportPath =
  process.env.ASSISTANT_EVAL_REPORT_PATH ?? "artifacts/assistant-fundamentals-hyper-noise-matrix-report.json";
const evalAuthToken = String(process.env.ASSISTANT_EVAL_AUTH_TOKEN ?? "").trim();
const maxRequestRetries = Number(process.env.ASSISTANT_EVAL_MAX_RETRIES ?? 2);
const retryBackoffMs = Number(process.env.ASSISTANT_EVAL_RETRY_BACKOFF_MS ?? 400);
const rounds = Math.max(1, Number(process.env.ASSISTANT_EVAL_ROUNDS ?? 3));

const scenarios = [
  {
    id: "FNM-YEAR-01",
    category: "year_mapping",
    turns: [
      {
        message: "BCTC AAA 2024, cho toi doanh thu va LNST.",
        contextSnapshot: { page: "analysis" },
        expected: {
          requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
          endpointIncludes: ["/api/fundamentals", "period=2024Q4"],
          allowedPolicyStatuses: ["ok", "fallback"],
          minCitationCount: 1,
          mustHaveNumericEvidence: true,
        },
      },
    ],
  },
  {
    id: "FNM-YEAR-02",
    category: "year_mapping",
    turns: [
      {
        message: "Cho toi BCTN AAA FY2025 va loi nhuan truoc thue.",
        contextSnapshot: { page: "analysis" },
        expected: {
          requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
          endpointIncludes: ["/api/fundamentals", "period=2025Q4"],
          allowedPolicyStatuses: ["ok", "fallback"],
          minCitationCount: 1,
          mustHaveNumericEvidence: true,
        },
      },
    ],
  },
  {
    id: "FNM-QUARTER-01",
    category: "quarter_parse",
    turns: [
      {
        message: "LCTT AAA Q3/2024, lay dong tien hoat dong va capex.",
        contextSnapshot: { page: "analysis" },
        expected: {
          requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
          endpointIncludes: ["/api/fundamentals", "period=2024Q3"],
          allowedPolicyStatuses: ["ok", "fallback"],
          minCitationCount: 1,
          mustHaveNumericEvidence: true,
        },
      },
    ],
  },
  {
    id: "FNM-QUARTER-02",
    category: "quarter_parse",
    turns: [
      {
        message: "balance sheet AAA 2025Q2, total assets vs liabilities.",
        contextSnapshot: { page: "analysis" },
        expected: {
          requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
          endpointIncludes: ["/api/fundamentals", "period=2025Q2"],
          allowedPolicyStatuses: ["ok", "fallback"],
          minCitationCount: 1,
          mustHaveNumericEvidence: true,
        },
      },
    ],
  },
  {
    id: "FNM-METRIC-01",
    category: "metric_disambiguation",
    turns: [
      {
        message: "AAA 2024, loi nhuan truoc thue (PBT) trong BCTN.",
        contextSnapshot: { page: "analysis" },
        expected: {
          requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
          endpointIncludes: ["/api/fundamentals"],
          allowedPolicyStatuses: ["ok", "fallback"],
          minCitationCount: 1,
          mustHaveNumericEvidence: true,
        },
      },
    ],
  },
  {
    id: "FNM-METRIC-02",
    category: "metric_disambiguation",
    turns: [
      {
        message: "AAA nam 2024 cho toi LNST va EPS.",
        contextSnapshot: { page: "analysis" },
        expected: {
          requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
          endpointIncludes: ["/api/fundamentals"],
          messageIncludesAny: ["Net Income", "LNST", "lợi nhuận sau thuế"],
          allowedPolicyStatuses: ["ok", "fallback"],
          minCitationCount: 1,
          mustHaveNumericEvidence: true,
        },
      },
    ],
  },
  {
    id: "FNM-METRIC-03",
    category: "metric_disambiguation",
    turns: [
      {
        message: "dong tien hoat dong AAA 2025, ko can doanh thu.",
        contextSnapshot: { page: "analysis" },
        expected: {
          requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
          endpointIncludes: ["/api/fundamentals"],
          allowedPolicyStatuses: ["ok", "fallback"],
          minCitationCount: 1,
          mustHaveNumericEvidence: true,
        },
      },
    ],
  },
  {
    id: "FNM-UNIT-01",
    category: "unit_rendering",
    turns: [
      {
        message: "BCTC AAA 2025Q4, show doanh thu theo don vi de doc.",
        contextSnapshot: { page: "analysis" },
        expected: {
          requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
          endpointIncludes: ["/api/fundamentals"],
          messageIncludesAny: ["Bn VND", "bn vnd", "tỷ vnd", "ty vnd", "VND"],
          allowedPolicyStatuses: ["ok", "fallback"],
          minCitationCount: 1,
          mustHaveNumericEvidence: true,
        },
      },
    ],
  },
  {
    id: "FNM-NOISE-01",
    category: "noisy_prompt",
    turns: [
      {
        message: "dm cho toi bctc aaa 2024, uu tien lnst + dong tien hddd, viet ngan gon",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
          endpointIncludes: ["/api/fundamentals", "period=2024Q4"],
          allowedPolicyStatuses: ["ok", "fallback"],
          minCitationCount: 1,
          mustHaveNumericEvidence: true,
        },
      },
    ],
  },
  {
    id: "FNM-NOISE-02",
    category: "noisy_prompt",
    turns: [
      {
        message: "bank acb nam 2024, can bctn + bcdkt, nhin pbt voi tai san truoc",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
          endpointIncludes: ["/api/fundamentals", "period=2024Q4"],
          allowedPolicyStatuses: ["ok", "fallback"],
          minCitationCount: 1,
          mustHaveNumericEvidence: true,
        },
      },
    ],
  },
];

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
  const fromTools = Array.isArray(usedTools)
    ? usedTools.some((tool) => String(tool?.endpoint ?? "").toLowerCase().includes(normalizedFragment))
    : false;
  return fromCitations || fromTools;
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

function hasUserFacingNumericOutput(data) {
  const message = String(data?.message ?? "");
  return /\b\d+([.,]\d+)?\b/.test(message);
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

  if (Array.isArray(expected?.messageIncludes)) {
    for (const fragment of expected.messageIncludes) {
      checks.message.total += 1;
      const pass = hasMessageFragment(String(data?.message ?? ""), fragment);
      if (pass) checks.message.passed += 1;
      else failures.push(`missing message fragment "${fragment}"`);
    }
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
          usedTools: Array.isArray(call.data?.usedTools) ? call.data.usedTools : [],
          citations: Array.isArray(call.data?.citations) ? call.data.citations : [],
          messagePreview: String(call.data?.message ?? "").slice(0, 240),
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
    profile: "fundamentals-hyper-noise-matrix-v1",
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
