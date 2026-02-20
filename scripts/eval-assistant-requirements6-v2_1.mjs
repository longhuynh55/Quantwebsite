import fs from "node:fs";
import path from "node:path";
import { questionBankV21 } from "./assistant-question-bank-v2_1.mjs";

const baseUrl =
  process.env.ASSISTANT_REQ6_V21_BASE_URL
  || process.env.ASSISTANT_REQ6_V2_BASE_URL
  || process.env.ASSISTANT_EVAL_BASE_URL
  || process.env.SMOKE_BASE_URL
  || "http://localhost:3010";

const reportPath =
  process.env.ASSISTANT_REQ6_V21_REPORT_PATH
  || "artifacts/assistant-requirements6-v2_1-e2e-report.json";

const timeoutMs = Number(process.env.ASSISTANT_REQ6_V21_TIMEOUT_MS ?? 30000);
const maxRetries = Number(process.env.ASSISTANT_REQ6_V21_MAX_RETRIES ?? 2);
const retryBackoffMs = Number(process.env.ASSISTANT_REQ6_V21_RETRY_BACKOFF_MS ?? 350);
const delayMs = Number(process.env.ASSISTANT_REQ6_V21_DELAY_MS ?? 120);
const stabilityRounds = Math.max(1, Number(process.env.ASSISTANT_REQ6_V21_STABILITY_ROUNDS ?? 1));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isRetryableError(error) {
  const text = String(error instanceof Error ? error.message : error ?? "").toLowerCase();
  return (
    text.includes("timeout")
    || text.includes("aborted")
    || text.includes("fetch")
    || text.includes("network")
    || text.includes("socket")
    || text.includes("connect")
  );
}

async function fetchJson(endpoint, options = {}) {
  const method = options.method ?? "GET";
  const body = options.body ?? null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (isRetryableStatus(response.status) && attempt < maxRetries) {
        await sleep(retryBackoffMs * (attempt + 1));
        continue;
      }

      return { ok: response.ok, status: response.status, data, text };
    } catch (error) {
      if (attempt >= maxRetries || !isRetryableError(error)) {
        throw error;
      }
      await sleep(retryBackoffMs * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`request failed: ${endpoint}`);
}

async function callAssistant(message, contextSnapshot = { page: "home" }, conversationHistory = []) {
  return fetchJson("/api/assistant", {
    method: "POST",
    body: {
      message,
      conversationHistory,
      contextSnapshot,
      preferences: {
        language: "vi",
        detailLevel: "brief",
      },
    },
  });
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d");
}

function hasMetricNumericClaim(text) {
  const normalized = normalizeText(text)
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, " ")
    .replace(/\b20\d{2}[/-]\d{1,2}[/-]\d{1,2}\b/g, " ")
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
    "pe",
    "pb",
    "roe",
    "roa",
    "margin",
    "drawdown",
    "return",
    "sharpe",
    "yoy",
    "ocf",
    "lnst",
    "doanh thu",
  ];
  return lines.some((line) => metricTokens.some((token) => line.includes(token)) && /\d/.test(line));
}

function hasStructuredNumericEvidence(messageBlocks) {
  if (!Array.isArray(messageBlocks)) return false;
  for (const block of messageBlocks) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "table" && Array.isArray(block.rows) && block.rows.length > 0) return true;
    if (block.type === "chart" && Array.isArray(block.points) && block.points.length > 0) return true;
  }
  return false;
}

function hasToolNumericEvidence(usedTools) {
  if (!Array.isArray(usedTools)) return false;
  return usedTools.some((tool) => tool?.status === "success" && Number(tool?.evidenceCount ?? 0) > 0);
}

function hasCitationBackedToolEvidence(citations, usedTools) {
  if (!Array.isArray(citations) || citations.length === 0) return false;
  if (!Array.isArray(usedTools) || usedTools.length === 0) return false;

  const citationEndpoints = citations
    .map((item) => String(item?.endpoint ?? ""))
    .filter((endpoint) => endpoint.length > 0);

  if (citationEndpoints.length === 0) return false;

  return usedTools.some((tool) => {
    if (tool?.status !== "success") return false;
    if (Number(tool?.evidenceCount ?? 0) > 0) return true;

    const hints = toolEndpointHints[String(tool?.name ?? "")] ?? [];
    if (hints.length === 0) return false;

    return hints.some((hint) => citationEndpoints.some((endpoint) => endpoint.includes(hint)));
  });
}

function hasTool(usedTools, name, status) {
  if (!Array.isArray(usedTools)) return false;
  return usedTools.some((item) => item?.name === name && item?.status === status);
}

const toolEndpointHints = {
  stockSnapshot: ["/api/stocks"],
  fundamentalSnapshot: ["/api/fundamentals"],
  fundamentalAnalysis: ["/api/finance-analysis"],
  financialHealthScore: ["/api/finance-analysis"],
  valuationDcf: ["/api/finance-analysis"],
  peerMultiples: ["/api/finance-analysis"],
  scenarioSensitivity: ["/api/finance-analysis"],
  riskSnapshot: ["/api/risk"],
  backtestSummary: ["/api/backtesting"],
  factorSnapshot: ["/api/factors"],
  marketSnapshot: ["/api/market-overview"],
  valuationRanking: ["/api/analytics/valuation-rankings"],
  icbSnapshot: ["/api/analytics/icb-snapshot"],
};

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

function parseFragment(fragment) {
  const idx = fragment.indexOf("=");
  if (idx <= 0) return null;
  return {
    key: fragment.slice(0, idx).trim().toLowerCase(),
    value: fragment.slice(idx + 1).trim(),
  };
}

function hasEndpoint(citations, usedTools, fragment) {
  const safeCitations = Array.isArray(citations) ? citations : [];
  const safeTools = Array.isArray(usedTools) ? usedTools : [];

  if (safeCitations.some((item) => String(item?.endpoint ?? "").includes(fragment))) {
    return true;
  }

  if (fragment.startsWith("/api/")) {
    for (const tool of safeTools) {
      if (tool?.status !== "success") continue;
      const hints = toolEndpointHints[String(tool?.name ?? "")] ?? [];
      if (hints.some((hint) => hint.includes(fragment) || fragment.includes(hint))) return true;
    }
  }

  const parsed = parseFragment(fragment);
  if (!parsed) return false;

  const key = parsed.key;
  const value = parsed.value;
  const valueNorm = normalizeScalar(value);

  // Check citation endpoint query-string fragment with date normalization support.
  for (const citation of safeCitations) {
    const endpoint = String(citation?.endpoint ?? "");
    if (!endpoint) continue;
    if (endpoint.includes(`${key}=${value}`)) return true;
    if (key === "date") {
      const endpointDateCandidates = endpoint.match(/\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/g) ?? [];
      const targetDate = normalizeDateValue(value);
      if (targetDate && endpointDateCandidates.some((candidate) => normalizeDateValue(candidate) === targetDate)) {
        return true;
      }
    }
  }

  // Check requestParams emitted by tools.
  const dateKeys = new Set(["date", "requesteddate", "asofdate", "fromdate", "todate", "startdate", "enddate"]);
  for (const tool of safeTools) {
    const params = tool?.requestParams;
    if (!params || typeof params !== "object") continue;
    const entries = Object.entries(params);
    for (const [rawParamKey, rawParamValue] of entries) {
      const paramKey = normalizeScalar(rawParamKey);
      if (dateKeys.has(key) && dateKeys.has(paramKey)) {
        const a = normalizeDateValue(value);
        const b = normalizeDateValue(rawParamValue);
        if (a && b && a === b) return true;
      }
      if (paramKey === key) {
        if (Array.isArray(rawParamValue)) {
          if (rawParamValue.some((item) => normalizeScalar(item) === valueNorm)) return true;
        } else if (normalizeScalar(rawParamValue) === valueNorm) {
          return true;
        }
      }
      if (key === "symbol" && paramKey === "symbols" && Array.isArray(rawParamValue)) {
        if (rawParamValue.some((item) => normalizeScalar(item) === valueNorm)) return true;
      }
    }
  }

  return false;
}

function evaluateCaseResponse(scenario, response) {
  const failures = [];
  const checks = [];

  const data = response?.data ?? {};
  const usedTools = Array.isArray(data?.usedTools) ? data.usedTools : [];
  const citations = Array.isArray(data?.citations) ? data.citations : [];
  const messageBlocks = Array.isArray(data?.messageBlocks) ? data.messageBlocks : [];
  const message = String(data?.message ?? "");
  const policyStatus = String(data?.policyStatus ?? "");

  const expect = scenario.expected ?? {};
  const numericMode = String(expect?.numericRule?.mode ?? "conditional");
  const hasNumeric = hasMetricNumericClaim(message);
  const hasStructuredNumeric = hasStructuredNumericEvidence(messageBlocks) || hasToolNumericEvidence(usedTools);
  const minCitationCount = Number(expect?.numericRule?.minCitationCount ?? 0);
  const citationCountPass = citations.length >= minCitationCount;
  const citationBackedToolEvidence = hasCitationBackedToolEvidence(citations, usedTools);
  let requiredToolChecksPass = true;
  let endpointChecksPass = true;

  checks.push({ name: "response.ok", pass: response.ok === true, detail: `HTTP ${response.status}` });
  if (!response.ok) failures.push(`HTTP ${response.status}`);

  const successFieldPass = data?.success === true;
  checks.push({ name: "response.success", pass: successFieldPass, detail: `success=${String(data?.success)}` });
  if (!successFieldPass) failures.push("response.success=false");

  if (Array.isArray(expect.allowedPolicyStatuses) && expect.allowedPolicyStatuses.length > 0) {
    const policyPassRaw = expect.allowedPolicyStatuses.includes(policyStatus);
    const policyPass = policyPassRaw || (numericMode === "forbidden" && !hasNumeric);
    checks.push({
      name: "policyStatus",
      pass: policyPass,
      detail: `actual=${policyStatus || "n/a"}, allowed=${expect.allowedPolicyStatuses.join(",")}`,
    });
    if (!policyPass) failures.push(`policyStatus=${policyStatus || "n/a"}`);
  }

  for (const item of expect.requiredTools ?? []) {
    const pass = hasTool(usedTools, item.name, item.status);
    checks.push({ name: `tool:${item.name}:${item.status}`, pass, detail: pass ? "ok" : "missing" });
    if (!pass) {
      requiredToolChecksPass = false;
      failures.push(`missing_tool=${item.name}:${item.status}`);
    }
  }

  for (const fragment of expect.endpointIncludes ?? []) {
    const pass = hasEndpoint(citations, usedTools, fragment);
    checks.push({ name: `endpoint:${fragment}`, pass, detail: pass ? "ok" : "missing" });
    if (!pass) {
      endpointChecksPass = false;
      failures.push(`missing_endpoint=${fragment}`);
    }
  }

  const maxTools = Number(expect?.numericRule?.maxToolCallsPerTurn ?? 3);
  if (Number.isFinite(maxTools)) {
    const successTools = usedTools.filter((item) => item?.status === "success");
    const effectiveToolCalls = successTools.length;
    const pass = effectiveToolCalls <= (maxTools + 2);
    checks.push({
      name: "tool_budget",
      pass,
      detail: `used_success=${effectiveToolCalls}, max=${maxTools}, tolerance=+2`,
    });
    if (!pass) failures.push(`tool_budget_exceeded=${effectiveToolCalls}>${maxTools}+2`);
  }

  if (numericMode === "forbidden") {
    const pass = !hasNumeric;
    checks.push({ name: "numeric.forbidden", pass, detail: `hasNumeric=${hasNumeric}` });
    if (!pass) failures.push("numeric_claim_detected_in_forbidden_mode");
  } else if (numericMode === "required") {
    const antiFlakeGroundedPass =
      citationCountPass
      && citationBackedToolEvidence
      && requiredToolChecksPass
      && endpointChecksPass;
    const pass = citationCountPass && (hasNumeric || hasStructuredNumeric || antiFlakeGroundedPass);
    checks.push({
      name: "numeric.required",
      pass,
      detail: `hasNumeric=${hasNumeric}, hasStructuredNumeric=${hasStructuredNumeric}, antiFlakeGroundedPass=${antiFlakeGroundedPass}, citations=${citations.length}`,
    });
    if (!pass) failures.push("required_numeric_or_citation_missing");
  } else {
    const pass = !hasNumeric || citationCountPass;
    checks.push({ name: "numeric.conditional", pass, detail: `hasNumeric=${hasNumeric}, citations=${citations.length}` });
    if (!pass) failures.push("conditional_numeric_without_citation");
  }

  const msgPass = message.trim().length > 0;
  checks.push({ name: "message.non_empty", pass: msgPass, detail: `length=${message.length}` });
  if (!msgPass) failures.push("empty_message");

  const pass = failures.length === 0;

  return {
    pass,
    failures,
    checks,
    telemetry: {
      policyStatus,
      queryIntent: data?.meta?.queryIntent ?? null,
      usedTools,
      citationCount: citations.length,
      messageLength: message.length,
      oracleType: scenario?.expected?.oracle?.type ?? null,
    },
  };
}

function summarize(results) {
  const total = results.length;
  const passed = results.filter((item) => item.pass).length;
  const failed = total - passed;
  const byLevel = new Map();

  for (const item of results) {
    const level = String(item.level ?? "unknown");
    const bucket = byLevel.get(level) ?? { total: 0, passed: 0, failed: 0 };
    bucket.total += 1;
    if (item.pass) bucket.passed += 1;
    else bucket.failed += 1;
    byLevel.set(level, bucket);
  }

  const byLevelObject = {};
  for (const [key, value] of byLevel.entries()) byLevelObject[key] = value;

  return {
    total,
    passed,
    failed,
    passRate: total > 0 ? passed / total : 0,
    overallStatus: failed === 0 ? "pass" : "fail",
    byLevel: byLevelObject,
  };
}

async function writeReport(report) {
  const absolutePath = path.resolve(reportPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return absolutePath;
}

async function main() {
  const startedAt = new Date().toISOString();
  const scenarios = Array.isArray(questionBankV21) ? questionBankV21 : [];

  if (scenarios.length === 0) {
    throw new Error("question bank empty");
  }

  const preflight = await fetchJson("/api/health/data");
  if (!preflight.ok) {
    throw new Error(`preflight /api/health/data failed: HTTP ${preflight.status}`);
  }

  const rounds = [];
  for (let round = 1; round <= stabilityRounds; round += 1) {
    const results = [];
    for (const scenario of scenarios) {
      const response = await callAssistant(
        scenario.prompt,
        scenario.contextSnapshot ?? { page: "home" },
        []
      );
      const verdict = evaluateCaseResponse(scenario, response);
      results.push({
        round,
        id: scenario.id,
        level: scenario.level,
        prompt: scenario.prompt,
        pass: verdict.pass,
        failures: verdict.failures,
        checks: verdict.checks,
        telemetry: verdict.telemetry,
      });
      if (delayMs > 0) await sleep(delayMs);
    }
    rounds.push({
      round,
      summary: summarize(results),
      results,
    });
  }

  const merged = rounds.flatMap((item) => item.results);
  const finalSummary = summarize(merged);

  const report = {
    schemaVersion: "assistant-req6-v2.1-e2e-2026-02-19",
    generatedAt: new Date().toISOString(),
    startedAt,
    endedAt: new Date().toISOString(),
    baseUrl,
    config: {
      timeoutMs,
      maxRetries,
      retryBackoffMs,
      delayMs,
      stabilityRounds,
      scenarioCount: scenarios.length,
    },
    preflight: {
      endpoint: "/api/health/data",
      status: preflight.status,
      ok: preflight.ok,
    },
    summary: finalSummary,
    rounds,
  };

  const written = await writeReport(report);

  for (const item of rounds) {
    const roundSummary = item.summary;
    console.log(`ROUND ${item.round}: ${roundSummary.passed}/${roundSummary.total} pass (${(roundSummary.passRate * 100).toFixed(2)}%)`);
  }

  console.log(`REPORT_PATH=${written}`);
  console.log(`SUMMARY total=${finalSummary.total} passed=${finalSummary.passed} failed=${finalSummary.failed} overall=${finalSummary.overallStatus.toUpperCase()}`);

  if (finalSummary.overallStatus !== "pass") process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

