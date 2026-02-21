import fs from "node:fs";
import path from "node:path";
import {
  createAssistantEvalReport,
  createCategoryResult,
  createFailureExample,
  createPolicyStatus,
  createToolRecord,
} from "./assistant-eval-report-schema.mjs";
import {
  postcheckAnomalyBankV1,
  POSTCHECK_ANOMALY_BANK_V1_VERSION,
} from "./assistant-postcheck-anomaly-bank-v1.mjs";

const baseUrl = process.env.ASSISTANT_EVAL_BASE_URL ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3010";
const timeoutMs = Number(process.env.ASSISTANT_EVAL_TIMEOUT_MS ?? 120000);
const reportPath = process.env.ASSISTANT_EVAL_REPORT_PATH ?? "artifacts/assistant-postcheck-anomaly-v1-report.json";
const evalAuthToken = String(process.env.ASSISTANT_EVAL_AUTH_TOKEN ?? "").trim();
const maxRequestRetries = Number(process.env.ASSISTANT_EVAL_MAX_RETRIES ?? 2);
const retryBackoffMs = Number(process.env.ASSISTANT_EVAL_RETRY_BACKOFF_MS ?? 400);

function normalizeForMatch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

function hasNumericEvidence(data) {
  return (
    hasMetricLikeNumericClaim(String(data?.message ?? ""))
    || hasNumericEvidenceInTables(data?.messageBlocks)
    || hasToolNumericEvidence(data?.usedTools)
  );
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

function summarizeTools(usedTools) {
  if (!Array.isArray(usedTools) || usedTools.length === 0) return "none";
  return usedTools.map((tool) => `${tool?.name ?? "unknown"}:${tool?.status ?? "unknown"}`).join(",");
}

function getBucket(map, key) {
  if (!map[key]) {
    map[key] = { totalTurns: 0, passedTurns: 0 };
  }
  return map[key];
}

function calcPercentile(latencies, percentile) {
  if (!Array.isArray(latencies) || latencies.length === 0) return null;
  const sorted = [...latencies].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  return sorted[rank];
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

function normalizeScenarioTurns(scenario) {
  if (scenario.mode === "multi_turn") {
    const turns = Array.isArray(scenario.turns) ? scenario.turns : [];
    return turns.map((turn) => ({
      message: String(turn?.prompt ?? ""),
      contextSnapshot: turn?.contextSnapshot ?? scenario.contextSnapshot ?? { page: "home" },
      expected: turn?.expected ?? {},
    }));
  }
  return [
    {
      message: String(scenario.prompt ?? ""),
      contextSnapshot: scenario.contextSnapshot ?? { page: "home" },
      expected: scenario.expected ?? {},
    },
  ];
}

function hasAnyTable(messageBlocks) {
  return Array.isArray(messageBlocks) && messageBlocks.some((block) => block?.type === "table");
}

function findFirstTable(messageBlocks) {
  if (!Array.isArray(messageBlocks)) return null;
  return messageBlocks.find((block) => block?.type === "table") ?? null;
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
        await sleep(retryBackoffMs * (attempt + 1));
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
      await sleep(retryBackoffMs * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("assistant call failed");
}

function evaluateNumericRule(data, numericRule) {
  const checks = { total: 0, passed: 0 };
  const failures = [];
  if (!numericRule || typeof numericRule !== "object") {
    return { checks, failures };
  }

  const mode = String(numericRule.mode ?? "").toLowerCase();
  const message = String(data?.message ?? "");
  const citations = Array.isArray(data?.citations) ? data.citations : [];
  const minCitationCount = Number(numericRule.minCitationCount ?? 0);
  const hasMetricNumericClaim = hasMetricLikeNumericClaim(message);
  const hasNumeric = hasNumericEvidence(data);
  const policyStatus = String(data?.policyStatus ?? "");

  checks.total += 1;
  if (minCitationCount > 0) {
    const ok = citations.length >= minCitationCount;
    if (!ok && mode !== "forbidden") {
      failures.push(`numeric_rule citation_count_below_min expected>=${minCitationCount}, actual=${citations.length}`);
    } else {
      checks.passed += 1;
    }
  } else {
    checks.passed += 1;
  }

  checks.total += 1;
  if (mode === "required") {
    if (hasNumeric) {
      checks.passed += 1;
    } else {
      failures.push("numeric_rule required_numeric_claim_missing");
    }
  } else if (mode === "forbidden") {
    if (hasMetricNumericClaim) {
      failures.push("numeric_rule forbidden_numeric_claim_detected");
    } else {
      checks.passed += 1;
    }
  } else {
    checks.passed += 1;
  }

  if (mode === "forbidden" && numericRule.requireInsufficientDataPhrase === true) {
    checks.total += 1;
    const fragments = ["insufficient_data", "khong", "khong the", "khong du du lieu", "unsupported"];
    const hasPhrase = fragments.some((fragment) => hasMessageFragment(message, fragment));
    const isFallbackStatus = policyStatus === "fallback" || policyStatus === "shadow_blocked";
    const ok = hasPhrase || (isFallbackStatus && !hasMetricNumericClaim);
    if (ok) {
      checks.passed += 1;
    } else {
      failures.push("numeric_rule insufficient_data_phrase_missing");
    }
  }

  return { checks, failures };
}

function evaluateOutputContract(data, outputContract) {
  const checks = { total: 0, passed: 0 };
  const failures = [];
  if (!outputContract || typeof outputContract !== "object") {
    return { checks, failures };
  }

  const message = String(data?.message ?? "");
  const messageBlocks = Array.isArray(data?.messageBlocks) ? data.messageBlocks : [];
  const citations = Array.isArray(data?.citations) ? data.citations : [];
  const policyStatus = String(data?.policyStatus ?? "");

  if (outputContract.tablePreferred === true) {
    checks.total += 1;
    if (hasAnyTable(messageBlocks)) checks.passed += 1;
    else failures.push("output_contract table_preferred_missing");
  }

  if (Array.isArray(outputContract.requiredColumns) && outputContract.requiredColumns.length > 0) {
    checks.total += 1;
    const table = findFirstTable(messageBlocks);
    const columns = Array.isArray(table?.columns) ? table.columns.map((col) => normalizeForMatch(col)) : [];
    const ok = outputContract.requiredColumns.every((col) => {
      const needle = normalizeForMatch(col);
      return columns.some((item) => item.includes(needle));
    });
    if (ok) checks.passed += 1;
    else failures.push(`output_contract missing_required_columns:${outputContract.requiredColumns.join("|")}`);
  }

  if (outputContract.mustMentionHoseOnly === true) {
    checks.total += 1;
    if (hasMessageFragment(message, "hose")) checks.passed += 1;
    else failures.push("output_contract hose_only_notice_missing");
  }

  if (outputContract.mustMentionFutureDateUnsupported === true) {
    checks.total += 1;
    const ok =
      hasMessageFragment(message, "tuong lai")
      || hasMessageFragment(message, "future")
      || hasMessageFragment(message, "khong the");
    if (ok) checks.passed += 1;
    else failures.push("output_contract future_date_notice_missing");
  }

  if (outputContract.mustRefuseFabrication === true) {
    checks.total += 1;
    const ok =
      hasMessageFragment(message, "insufficient_data")
      || hasMessageFragment(message, "khong the")
      || hasMessageFragment(message, "grounded");
    if (ok) checks.passed += 1;
    else failures.push("output_contract fabrication_refusal_missing");
  }

  if (outputContract.mustRejectInvalidTicker === true) {
    checks.total += 1;
    const ok =
      hasMessageFragment(message, "invalid")
      || hasMessageFragment(message, "khong")
      || hasMessageFragment(message, "khong ton tai");
    if (ok) checks.passed += 1;
    else failures.push("output_contract invalid_ticker_notice_missing");
  }

  if (typeof outputContract.minCitationCount === "number") {
    checks.total += 1;
    if (citations.length >= outputContract.minCitationCount) checks.passed += 1;
    else failures.push(`output_contract citation_count_below_min expected>=${outputContract.minCitationCount}, actual=${citations.length}`);
  }

  if (typeof outputContract.mustContainEndpoint === "string" && outputContract.mustContainEndpoint.length > 0) {
    checks.total += 1;
    const ok = citations.some((item) => String(item?.endpoint ?? "").includes(outputContract.mustContainEndpoint));
    if (ok) checks.passed += 1;
    else failures.push(`output_contract endpoint_missing:${outputContract.mustContainEndpoint}`);
  }

  if (outputContract.forbidNumericInFallback === true) {
    checks.total += 1;
    const isFallbackStatus = policyStatus === "fallback" || policyStatus === "shadow_blocked";
    const hasNumeric = hasMetricLikeNumericClaim(message);
    const ok = !isFallbackStatus || !hasNumeric;
    if (ok) checks.passed += 1;
    else failures.push("output_contract numeric_claim_in_fallback");
  }

  if (outputContract.mustRecordProviderFallbackMeta === true) {
    checks.total += 1;
    const hasMeta = data?.meta && typeof data.meta === "object";
    if (hasMeta && ("providerUsed" in data.meta || "fallbackUsed" in data.meta)) checks.passed += 1;
    else failures.push("output_contract provider_meta_missing");
  }

  return { checks, failures };
}

async function evaluateExpectations(data, expected) {
  const failures = [];
  const checks = {
    tool: { total: 0, passed: 0 },
    endpoint: { total: 0, passed: 0 },
    policy: { total: 0, passed: 0 },
    numericRule: { total: 0, passed: 0 },
    outputContract: { total: 0, passed: 0 },
  };

  if (Array.isArray(expected?.requiredTools)) {
    for (const item of expected.requiredTools) {
      checks.tool.total += 1;
      const ok = hasToolStatus(data?.usedTools, item.name, item.status);
      if (ok) checks.tool.passed += 1;
      else failures.push(`required tool mismatch: ${item.name}:${item.status}`);
    }
  } else if (expected?.requiredTool) {
    checks.tool.total += 1;
    const ok = hasToolStatus(data?.usedTools, expected.requiredTool.name, expected.requiredTool.status);
    if (ok) checks.tool.passed += 1;
    else failures.push(`required tool mismatch: ${expected.requiredTool.name}:${expected.requiredTool.status}`);
  }

  if (Array.isArray(expected?.endpointIncludes)) {
    for (const fragment of expected.endpointIncludes) {
      checks.endpoint.total += 1;
      const ok = hasAnyCitationEndpoint(data?.citations, fragment);
      if (ok) checks.endpoint.passed += 1;
      else failures.push(`missing citation endpoint fragment: ${fragment}`);
    }
  }

  if (Array.isArray(expected?.allowedPolicyStatuses) && expected.allowedPolicyStatuses.length > 0) {
    checks.policy.total += 1;
    const actualPolicy = String(data?.policyStatus ?? "");
    const ok = expected.allowedPolicyStatuses.includes(actualPolicy);
    if (ok) checks.policy.passed += 1;
    else failures.push(`policy status mismatch: expected one of [${expected.allowedPolicyStatuses.join(",")}], actual=${actualPolicy || "n/a"}`);
  }

  const numericResult = evaluateNumericRule(data, expected?.numericRule);
  checks.numericRule.total += numericResult.checks.total;
  checks.numericRule.passed += numericResult.checks.passed;
  failures.push(...numericResult.failures);

  const outputResult = evaluateOutputContract(data, expected?.outputContract);
  checks.outputContract.total += outputResult.checks.total;
  checks.outputContract.passed += outputResult.checks.passed;
  failures.push(...outputResult.failures);

  return { failures, checks };
}

async function writeReport(report) {
  if (!reportPath) return null;
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
  const scenarios = Array.isArray(postcheckAnomalyBankV1) ? postcheckAnomalyBankV1 : [];
  const results = [];
  const levelMetrics = {};
  const categoryMetrics = {};
  const phaseMetrics = {};
  const policyStatusCounts = {};
  const checkTotals = {
    tool: { total: 0, passed: 0 },
    endpoint: { total: 0, passed: 0 },
    policy: { total: 0, passed: 0 },
    numericRule: { total: 0, passed: 0 },
    outputContract: { total: 0, passed: 0 },
  };
  const toolDistribution = new Map();
  const latencies = [];
  const failureExamples = [];

  let totalTurns = 0;
  let passedTurns = 0;

  for (const scenario of scenarios) {
    const turns = normalizeScenarioTurns(scenario);
    const history = [];
    const level = String(scenario.severity ?? "unknown");
    const category = String(scenario.category ?? "unknown");
    const phase = String(scenario.phase ?? "unknown");

    for (let turnIndex = 0; turnIndex < turns.length; turnIndex += 1) {
      const turn = turns[turnIndex];
      totalTurns += 1;

      const levelBucket = getBucket(levelMetrics, level);
      const categoryBucket = getBucket(categoryMetrics, category);
      const phaseBucket = getBucket(phaseMetrics, phase);
      levelBucket.totalTurns += 1;
      categoryBucket.totalTurns += 1;
      phaseBucket.totalTurns += 1;

      let turnResult;
      try {
        const call = await callAssistantWithRetry({
          message: turn.message,
          contextSnapshot: turn.contextSnapshot,
          conversationHistory: history,
        });

        if (typeof call.latencyMs === "number" && Number.isFinite(call.latencyMs)) {
          latencies.push(call.latencyMs);
        }

        const responseOk = call.response.ok && call.data?.success === true;
        const expectation = await evaluateExpectations(call.data, turn.expected);

        for (const key of Object.keys(checkTotals)) {
          checkTotals[key].total += expectation.checks[key].total;
          checkTotals[key].passed += expectation.checks[key].passed;
        }

        const policyStatus = String(call.data?.policyStatus ?? "unknown");
        policyStatusCounts[policyStatus] = (policyStatusCounts[policyStatus] ?? 0) + 1;

        if (Array.isArray(call.data?.usedTools)) {
          for (const item of call.data.usedTools) {
            const name = String(item?.name ?? "unknown");
            const stat = toolDistribution.get(name) ?? {
              totalCalls: 0,
              successCount: 0,
              errorCount: 0,
              latencyTotalMs: 0,
              latencySamples: 0,
            };
            stat.totalCalls += 1;
            if (item?.status === "success") stat.successCount += 1;
            if (item?.status === "error") stat.errorCount += 1;
            if (typeof item?.latencyMs === "number" && Number.isFinite(item.latencyMs)) {
              stat.latencyTotalMs += item.latencyMs;
              stat.latencySamples += 1;
            }
            toolDistribution.set(name, stat);
          }
        }

        const turnPassed = responseOk && expectation.failures.length === 0;
        if (turnPassed) {
          passedTurns += 1;
          levelBucket.passedTurns += 1;
          categoryBucket.passedTurns += 1;
          phaseBucket.passedTurns += 1;
        }

        turnResult = {
          scenarioId: scenario.id,
          category,
          level,
          phase,
          mode: scenario.mode,
          turn: turnIndex + 1,
          pass: turnPassed,
          latencyMs: call.latencyMs,
          status: call.response.status,
          attempts: call.attempts ?? 1,
          policyStatus,
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
          category,
          level,
          phase,
          mode: scenario.mode,
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
      if (!turnResult.pass && failureExamples.length < 20) {
        failureExamples.push(
          createFailureExample(
            `${turnResult.scenarioId}#${turnResult.turn}`,
            turnResult.category,
            `level=${turnResult.level}, phase=${turnResult.phase}, policy=${String(turnResult.policyStatus ?? "n/a")}`,
            turnResult.failures.join(" | "),
            []
          )
        );
      }

      const prefix = turnResult.pass ? "PASS" : "FAIL";
      const failureText = turnResult.pass ? "" : ` - ${turnResult.failures.join(" | ")}`;
      console.log(`${prefix} ${scenario.id}#${turnResult.turn}${failureText}`);
    }
  }

  const failedTurns = totalTurns - passedTurns;
  const latencyPercentiles = {
    p50Ms: calcPercentile(latencies, 50),
    p90Ms: calcPercentile(latencies, 90),
    p99Ms: calcPercentile(latencies, 99),
  };

  const categoryResults = Object.entries(categoryMetrics)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, stats]) =>
      createCategoryResult(
        name,
        stats.totalTurns > 0 && stats.passedTurns === stats.totalTurns,
        `passed=${stats.passedTurns}/${stats.totalTurns}`,
        [{ key: "turnPassRate", value: stats.totalTurns > 0 ? stats.passedTurns / stats.totalTurns : 0 }]
      )
    );

  const policyStatuses = Object.entries(policyStatusCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([status, count]) => createPolicyStatus("routing", status, `count=${count}`));

  const toolRecords = Array.from(toolDistribution.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, stat]) =>
      createToolRecord(
        name,
        stat.successCount,
        stat.errorCount,
        stat.latencySamples > 0 ? Number((stat.latencyTotalMs / stat.latencySamples).toFixed(2)) : null
      )
    );

  const finalReport = createAssistantEvalReport({
    overallStatus: failedTurns === 0 ? "pass" : "fail",
    categories: categoryResults,
    latencyPercentiles,
    policyStatuses,
    toolDistribution: {
      totalCalls: toolRecords.reduce((acc, item) => acc + item.successCount + item.errorCount, 0),
      successCount: toolRecords.reduce((acc, item) => acc + item.successCount, 0),
      errorCount: toolRecords.reduce((acc, item) => acc + item.errorCount, 0),
      tools: toolRecords,
    },
    falseFallbacks: {
      totalSessions: null,
      falseFallbacks: null,
      sampledExamples: [],
    },
    citationCoverage: {
      candidateClaims: null,
      citedClaims: null,
      coveragePercent: null,
      missingSources: results.filter((item) => !item.pass).slice(0, 12).map((item) => `${item.scenarioId}#${item.turn}`),
    },
    failureExemplars: failureExamples,
    metadata: {
      runId: new Date().toISOString(),
      assistantVersion: null,
      evalProfile: "postcheck-edge-anomaly-v1",
      questionBankVersion: POSTCHECK_ANOMALY_BANK_V1_VERSION,
      baseUrl,
      totalScenarios: scenarios.length,
      totalTurns,
      passedTurns,
      failedTurns,
      turnPassRate: totalTurns > 0 ? passedTurns / totalTurns : 0,
      checkTotals,
      levelMetrics,
      categoryMetrics,
      phaseMetrics,
      durationMs: Date.now() - startedAt,
    },
    runAt: new Date().toISOString(),
    baseUrl,
    totalScenarios: scenarios.length,
    totalTurns,
    passedTurns,
    failedTurns,
    turnPassRate: totalTurns > 0 ? passedTurns / totalTurns : 0,
    routingChecks: {
      tool: {
        total: checkTotals.tool.total,
        passed: checkTotals.tool.passed,
        passRate: checkTotals.tool.total > 0 ? checkTotals.tool.passed / checkTotals.tool.total : 0,
      },
      endpoint: {
        total: checkTotals.endpoint.total,
        passed: checkTotals.endpoint.passed,
        passRate: checkTotals.endpoint.total > 0 ? checkTotals.endpoint.passed / checkTotals.endpoint.total : 0,
      },
      policy: {
        total: checkTotals.policy.total,
        passed: checkTotals.policy.passed,
        passRate: checkTotals.policy.total > 0 ? checkTotals.policy.passed / checkTotals.policy.total : 0,
      },
      numericRule: {
        total: checkTotals.numericRule.total,
        passed: checkTotals.numericRule.passed,
        passRate: checkTotals.numericRule.total > 0 ? checkTotals.numericRule.passed / checkTotals.numericRule.total : 0,
      },
      outputContract: {
        total: checkTotals.outputContract.total,
        passed: checkTotals.outputContract.passed,
        passRate: checkTotals.outputContract.total > 0 ? checkTotals.outputContract.passed / checkTotals.outputContract.total : 0,
      },
    },
    levelMetrics,
    categoryMetrics,
    phaseMetrics,
    durationMs: Date.now() - startedAt,
    results,
  });

  const writtenPath = await writeReport(finalReport);
  if (writtenPath) {
    console.log(`REPORT_PATH=${writtenPath}`);
  }
  console.log(JSON.stringify(finalReport));

  if (failedTurns > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
