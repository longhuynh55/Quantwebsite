import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const defaultCriteriaPath = "artifacts/assistant-realworld-scenario-criteria-v1.json";
const defaultStabilityReportPath = "artifacts/assistant-stability-report.json";
const defaultMonitorReportPath = "artifacts/assistant-governance-monitor-report.json";
const defaultMonitorSummaryPath = "artifacts/assistant-governance-monitor-summary.md";

const suiteCanonicalReportHints = {
  routing: "artifacts/assistant-routing-matrix-report.json",
  realworld: "artifacts/assistant-realworld-report.json",
  "pr-gate": "artifacts/assistant-pr-gate-report.json",
  "policy-matrix": "artifacts/assistant-policy-matrix-report.json",
  "perf-reliability": "artifacts/assistant-perf-reliability-report.json",
  full: "artifacts/assistant-eval-comprehensive-report.json",
};

function parseCli(argv) {
  const flags = new Set();
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] ?? "");
    if (!token.startsWith("--")) continue;
    const raw = token.slice(2);
    const eqIndex = raw.indexOf("=");
    if (eqIndex > 0) {
      values[raw.slice(0, eqIndex)] = raw.slice(eqIndex + 1);
      continue;
    }
    const next = argv[index + 1];
    if (typeof next === "string" && !next.startsWith("--")) {
      values[raw] = next;
      index += 1;
      continue;
    }
    flags.add(raw);
  }
  return { flags, values };
}

function readJsonFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const content = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(content);
}

function tryReadJsonFile(filePath) {
  try {
    return readJsonFile(filePath);
  } catch {
    return null;
  }
}

function writeJsonFile(filePath, value) {
  const absolutePath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return absolutePath;
}

function writeTextFile(filePath, value) {
  const absolutePath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, value, "utf8");
  return absolutePath;
}

function toNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && value.trim().length === 0) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function suiteToken(suiteId) {
  return String(suiteId ?? "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function compareMetric(actual, threshold, comparator) {
  if (actual === null || threshold === null) return null;
  if (comparator === "lte") return actual <= threshold;
  return actual >= threshold;
}

function createMetricResult({ id, label, actual, threshold, comparator = "gte", required = true, source }) {
  const normalizedActual = toNumber(actual);
  const normalizedThreshold = toNumber(threshold);
  const pass = compareMetric(normalizedActual, normalizedThreshold, comparator);
  const status = pass === null ? "not_measured" : pass ? "pass" : "fail";
  return {
    id,
    label,
    actual: normalizedActual,
    threshold: normalizedThreshold,
    comparator,
    status,
    required,
    source,
  };
}

function extractPassRateCandidate(primary, fallback = null) {
  const first = toNumber(primary);
  if (first !== null) return first;
  return toNumber(fallback);
}

function pickCanonicalReportPath(stabilitySuite) {
  const candidate = String(stabilitySuite?.canonicalRoundReportPath ?? "").trim();
  if (candidate.length > 0 && fs.existsSync(candidate)) return candidate;
  const hint = suiteCanonicalReportHints[stabilitySuite?.suite];
  if (hint && fs.existsSync(path.resolve(hint))) return path.resolve(hint);
  return null;
}

async function runNodeCommand({ scriptPath, args = [], env = {} }) {
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("close", (code, signal) => {
      resolve({
        exitCode: code ?? 1,
        signal: signal ?? null,
      });
    });
  });
}

function buildStabilityEnv({ criteria, roundsOverride }) {
  const stability = criteria?.stabilityThresholds ?? {};
  const env = {};

  const rounds = toNumber(roundsOverride) ?? toNumber(stability.defaultRounds);
  if (rounds !== null) {
    env.ASSISTANT_EVAL_STABILITY_ROUNDS = String(Math.max(1, Math.floor(rounds)));
  }

  const maxFlakeRate = toNumber(stability.maxFlakeRate);
  if (maxFlakeRate !== null) {
    env.ASSISTANT_EVAL_STABILITY_MAX_FLAKE_RATE = String(maxFlakeRate);
  }

  const minSuccessfulRounds = toNumber(stability.minSuccessfulRounds);
  if (minSuccessfulRounds !== null) {
    env.ASSISTANT_EVAL_STABILITY_MIN_SUCCESSFUL_ROUNDS = String(Math.max(1, Math.floor(minSuccessfulRounds)));
  }

  const suiteOverrides = stability.suiteOverrides ?? {};
  for (const [suiteId, override] of Object.entries(suiteOverrides)) {
    const token = suiteToken(suiteId);
    const minPassRate = toNumber(override?.minPassRate);
    const suiteMaxFlakeRate = toNumber(override?.maxFlakeRate);
    if (minPassRate !== null) {
      env[`ASSISTANT_EVAL_STABILITY_MIN_PASS_RATE_${token}`] = String(minPassRate);
    }
    if (suiteMaxFlakeRate !== null) {
      env[`ASSISTANT_EVAL_STABILITY_MAX_FLAKE_RATE_${token}`] = String(suiteMaxFlakeRate);
    }
  }

  return env;
}

function renderMarkdownReport(report) {
  const lines = [];
  lines.push("# Assistant Governance Monitor Report");
  lines.push("");
  lines.push(`- Run at: ${report.runAt}`);
  lines.push(`- Overall status: **${String(report.overallStatus).toUpperCase()}**`);
  lines.push(`- Criteria: \`${report.criteriaPath}\``);
  lines.push(`- Stability report: \`${report.stabilityReportPath}\``);
  lines.push("");
  lines.push("## Stage Gates");
  for (const gate of report.stageGates) {
    lines.push(`- ${gate.name}: ${gate.pass ? "PASS" : "FAIL"} (${gate.detail})`);
  }
  lines.push("");
  lines.push("## Metrics");
  for (const metric of report.metrics) {
    const thresholdText =
      metric.threshold === null
        ? "n/a"
        : `${metric.comparator === "lte" ? "<=" : ">="} ${metric.threshold}`;
    const actualText = metric.actual === null ? "n/a" : String(metric.actual);
    lines.push(
      `- ${metric.id}: ${metric.status.toUpperCase()} (actual=${actualText}, threshold=${thresholdText}, source=${metric.source})`
    );
  }
  lines.push("");
  lines.push("## Suites");
  for (const suite of report.suites) {
    lines.push(
      `- ${suite.name}: ${suite.gatePass ? "PASS" : "FAIL"} (rounds=${suite.successfulRounds}/${suite.roundsConfigured}, flake=${suite.flakeRate})`
    );
  }
  lines.push("");
  lines.push("## Notes");
  if (report.notes.length === 0) {
    lines.push("- No additional notes.");
  } else {
    for (const note of report.notes) {
      lines.push(`- ${note}`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  const criteriaPath = cli.values.criteria ?? defaultCriteriaPath;
  const stabilityReportPath = cli.values["stability-report"] ?? defaultStabilityReportPath;
  const monitorReportPath = cli.values["report-path"] ?? defaultMonitorReportPath;
  const monitorSummaryPath = cli.values["summary-path"] ?? defaultMonitorSummaryPath;
  const skipStabilityRun = cli.flags.has("skip-stability-run");
  const enforceUnsupportedClaim = cli.flags.has("enforce-unsupported-claim");
  const roundsOverride = cli.values.rounds ?? process.env.ASSISTANT_EVAL_MONITOR_ROUNDS ?? null;

  const criteria = readJsonFile(criteriaPath);
  const nightlySuites = Array.isArray(criteria?.stageGates?.nightly?.requiredSuites)
    ? criteria.stageGates.nightly.requiredSuites
    : ["routing", "realworld", "pr-gate", "policy-matrix", "perf-reliability"];
  const nightlySuiteArg = nightlySuites.join(",");

  const notes = [];
  const startedAt = Date.now();
  let stabilityExecution = null;

  if (!skipStabilityRun) {
    const stabilityEnv = buildStabilityEnv({ criteria, roundsOverride });
    stabilityExecution = await runNodeCommand({
      scriptPath: "scripts/eval-assistant-stability-gate.mjs",
      args: ["--suite", nightlySuiteArg, "--report-path", stabilityReportPath],
      env: stabilityEnv,
    });
  } else {
    notes.push("Skipped stability execution and reused existing reports.");
  }

  const stabilityReport = readJsonFile(stabilityReportPath);
  const suites = Array.isArray(stabilityReport?.suites) ? stabilityReport.suites : [];

  const suiteResults = suites.map((suite) => {
    const roundsConfigured = toNumber(suite?.thresholds?.rounds) ?? null;
    const successfulRounds = toNumber(suite?.summary?.successfulRounds) ?? 0;
    const flakeRate = toNumber(suite?.summary?.flakeRate);
    const gatePass = Boolean(suite?.summary?.gatePass);
    const canonicalReportPath = pickCanonicalReportPath(suite);
    const canonicalReport = canonicalReportPath ? tryReadJsonFile(canonicalReportPath) : null;
    return {
      name: suite?.suite ?? "unknown",
      gatePass,
      roundsConfigured,
      successfulRounds,
      flakeRate,
      canonicalReportPath,
      canonicalReport,
    };
  });

  const suiteByName = Object.fromEntries(suiteResults.map((item) => [item.name, item]));
  const routingReport = suiteByName.routing?.canonicalReport ?? null;
  const realworldReport = suiteByName.realworld?.canonicalReport ?? null;
  const prGateReport = suiteByName["pr-gate"]?.canonicalReport ?? null;
  const policyMatrixReport = suiteByName["policy-matrix"]?.canonicalReport ?? null;
  const perfReport = suiteByName["perf-reliability"]?.canonicalReport ?? null;
  const comprehensiveReport = tryReadJsonFile("artifacts/assistant-eval-comprehensive-report.json");

  const criteriaThresholds = criteria?.metricsThresholds ?? {};
  const policySafetyActual = (() => {
    const values = [
      toNumber(prGateReport?.QA?.policySafetyChecks?.aggregate?.passRate),
      toNumber(policyMatrixReport?.rates?.policyPassRate),
    ].filter((value) => value !== null);
    if (values.length === 0) return null;
    return Math.min(...values);
  })();

  const s1FailuresActual = (() => {
    const values = [
      toNumber(prGateReport?.totals?.s1Failures),
      toNumber(policyMatrixReport?.s1Failures),
      toNumber(perfReport?.s1Failures),
    ].filter((value) => value !== null);
    if (values.length === 0) return null;
    return Math.max(...values);
  })();

  const metrics = [
    createMetricResult({
      id: "toolRoutingAccuracy",
      label: "Tool routing accuracy",
      actual: extractPassRateCandidate(routingReport?.routingChecks?.tool?.passRate),
      threshold: criteriaThresholds.toolRoutingAccuracy,
      comparator: "gte",
      source: "routing.routingChecks.tool.passRate",
    }),
    createMetricResult({
      id: "endpointGroundingAccuracy",
      label: "Endpoint grounding accuracy",
      actual: extractPassRateCandidate(routingReport?.routingChecks?.endpoint?.passRate),
      threshold: criteriaThresholds.endpointGroundingAccuracy,
      comparator: "gte",
      source: "routing.routingChecks.endpoint.passRate",
    }),
    createMetricResult({
      id: "intentAccuracy",
      label: "Intent accuracy",
      actual: extractPassRateCandidate(routingReport?.routingChecks?.intent?.passRate),
      threshold: criteriaThresholds.intentAccuracy,
      comparator: "gte",
      source: "routing.routingChecks.intent.passRate",
    }),
    createMetricResult({
      id: "citationCoverage",
      label: "Citation coverage",
      actual: extractPassRateCandidate(realworldReport?.citationCoverage?.coveragePercent),
      threshold: criteriaThresholds.citationCoverage,
      comparator: "gte",
      source: "realworld.citationCoverage.coveragePercent",
    }),
    createMetricResult({
      id: "formatCompliance",
      label: "Format compliance",
      actual: extractPassRateCandidate(prGateReport?.UX?.trustChecks?.format?.passRate),
      threshold: criteriaThresholds.formatCompliance,
      comparator: "gte",
      source: "pr-gate.UX.trustChecks.format.passRate",
    }),
    createMetricResult({
      id: "contextCarryAccuracy",
      label: "Context carry accuracy",
      actual: extractPassRateCandidate(prGateReport?.UX?.contextCarry?.passRate),
      threshold: criteriaThresholds.contextCarryAccuracy,
      comparator: "gte",
      source: "pr-gate.UX.contextCarry.passRate",
    }),
    createMetricResult({
      id: "policySafetyRate",
      label: "Policy safety rate",
      actual: policySafetyActual,
      threshold: criteriaThresholds.policySafetyRate,
      comparator: "gte",
      source: "min(pr-gate policySafety, policy-matrix policyPassRate)",
    }),
    createMetricResult({
      id: "unsupportedClaimRate",
      label: "Unsupported claim rate",
      actual: toNumber(comprehensiveReport?.metrics?.unsupportedClaimRate),
      threshold: criteriaThresholds.unsupportedClaimRateMax,
      comparator: "lte",
      required: enforceUnsupportedClaim,
      source: "comprehensive.metrics.unsupportedClaimRate",
    }),
    createMetricResult({
      id: "s1Failures",
      label: "S1 failures",
      actual: s1FailuresActual,
      threshold: criteriaThresholds.s1FailuresMax,
      comparator: "lte",
      source: "max(pr-gate, policy-matrix, perf-reliability)",
    }),
  ];

  const requiredMetricFailures = metrics.filter((metric) => metric.required && metric.status === "fail");
  const missingRequiredMetrics = metrics.filter((metric) => metric.required && metric.status === "not_measured");

  const nightlyMinimumRounds = Math.max(
    1,
    Math.floor(toNumber(criteria?.stageGates?.nightly?.minimumRounds) ?? 3)
  );
  const missingSuites = nightlySuites.filter((suiteName) => !suiteByName[suiteName]);
  const suiteGateFailures = nightlySuites.filter((suiteName) => {
    const suite = suiteByName[suiteName];
    if (!suite) return true;
    return !suite.gatePass;
  });
  const insufficientRounds = nightlySuites.filter((suiteName) => {
    const suite = suiteByName[suiteName];
    if (!suite) return true;
    return (suite.roundsConfigured ?? 0) < nightlyMinimumRounds;
  });

  const stageGates = [
    {
      name: "nightly_required_suites_present",
      pass: missingSuites.length === 0,
      detail: missingSuites.length === 0 ? "all present" : `missing: ${missingSuites.join(",")}`,
    },
    {
      name: "nightly_suite_gate_pass",
      pass: suiteGateFailures.length === 0,
      detail: suiteGateFailures.length === 0 ? "all pass" : `failed: ${suiteGateFailures.join(",")}`,
    },
    {
      name: "nightly_min_rounds",
      pass: insufficientRounds.length === 0,
      detail:
        insufficientRounds.length === 0
          ? `all >= ${nightlyMinimumRounds}`
          : `below min rounds: ${insufficientRounds.join(",")}`,
    },
    {
      name: "metrics_required",
      pass: requiredMetricFailures.length === 0 && missingRequiredMetrics.length === 0,
      detail:
        requiredMetricFailures.length === 0 && missingRequiredMetrics.length === 0
          ? "all required metrics pass"
          : `failed=${requiredMetricFailures.map((item) => item.id).join(",")} missing=${missingRequiredMetrics.map((item) => item.id).join(",")}`,
    },
  ];

  if (metrics.some((metric) => metric.id === "unsupportedClaimRate" && metric.status === "not_measured")) {
    notes.push("unsupportedClaimRate is not measured from current suite outputs; enable --enforce-unsupported-claim to hard-fail this condition.");
  }
  if (stabilityExecution && stabilityExecution.exitCode !== 0) {
    notes.push(`stability gate process exited with code ${stabilityExecution.exitCode}.`);
  }

  const overallPass = stageGates.every((gate) => gate.pass);

  const report = {
    schemaVersion: "assistant-governance-monitor-v1-2026-02-19",
    runAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    overallStatus: overallPass ? "pass" : "fail",
    criteriaPath: path.resolve(criteriaPath),
    stabilityReportPath: path.resolve(stabilityReportPath),
    stabilityExecution: stabilityExecution ?? { skipped: true },
    suites: suiteResults.map((suite) => ({
      name: suite.name,
      gatePass: suite.gatePass,
      roundsConfigured: suite.roundsConfigured,
      successfulRounds: suite.successfulRounds,
      flakeRate: suite.flakeRate,
      canonicalReportPath: suite.canonicalReportPath,
    })),
    metrics,
    stageGates,
    notes,
  };

  const reportOutputPath = writeJsonFile(monitorReportPath, report);
  const summaryOutputPath = writeTextFile(monitorSummaryPath, renderMarkdownReport(report));

  console.log(`MONITOR_REPORT_PATH=${reportOutputPath}`);
  console.log(`MONITOR_SUMMARY_PATH=${summaryOutputPath}`);
  console.log(`MONITOR_STATUS=${overallPass ? "PASS" : "FAIL"}`);

  if (!overallPass) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
