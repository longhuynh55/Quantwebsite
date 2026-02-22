import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { classifyFailureCause, summarizeFailureCategories } from "./eval-assistant-failure-taxonomy.mjs";

const baseRounds = readNumber(process.env.ASSISTANT_EVAL_STABILITY_ROUNDS, 3);
const baseMinPassRate = readNumber(process.env.ASSISTANT_EVAL_STABILITY_MIN_PASS_RATE, 1);
const baseMaxFlakeRate = readNumber(process.env.ASSISTANT_EVAL_STABILITY_MAX_FLAKE_RATE, 0);
const baseMinSuccessfulRounds = readNumber(
  process.env.ASSISTANT_EVAL_STABILITY_MIN_SUCCESSFUL_ROUNDS,
  baseRounds
);
const defaultReportPath = process.env.ASSISTANT_EVAL_STABILITY_REPORT_PATH ?? "artifacts/assistant-stability-report.json";
const ciMode = readBoolEnv(process.env.CI);
const allowDryRunInCi = readBoolEnv(process.env.ASSISTANT_EVAL_ALLOW_DRY_RUN_IN_CI);
const earlyStopEnabled = readBoolEnv(process.env.ASSISTANT_EVAL_STABILITY_EARLY_STOP ?? "true");

const suites = {
  routing: {
    id: "routing",
    scriptPath: "scripts/eval-assistant-routing-matrix.mjs",
    reportPathEnv: "ASSISTANT_EVAL_REPORT_PATH",
    defaultRoundReportPath: "artifacts/assistant-routing-matrix-report.json",
  },
  realworld: {
    id: "realworld",
    scriptPath: "scripts/eval-assistant-realworld.mjs",
    reportPathEnv: "ASSISTANT_EVAL_REPORT_PATH",
    defaultRoundReportPath: "artifacts/assistant-realworld-report.json",
  },
  "pr-gate": {
    id: "pr-gate",
    scriptPath: "scripts/eval-assistant-pr-gate.mjs",
    reportPathEnv: "ASSISTANT_PR_GATE_REPORT_PATH",
    defaultRoundReportPath: "artifacts/assistant-pr-gate-report.json",
  },
  "policy-matrix": {
    id: "policy-matrix",
    scriptPath: "scripts/eval-assistant-policy-matrix.mjs",
    reportPathEnv: "ASSISTANT_POLICY_MATRIX_REPORT_PATH",
    defaultRoundReportPath: "artifacts/assistant-policy-matrix-report.json",
  },
  "perf-reliability": {
    id: "perf-reliability",
    scriptPath: "scripts/eval-assistant-perf-reliability.mjs",
    reportPathEnv: "ASSISTANT_PERF_REL_REPORT_PATH",
    defaultRoundReportPath: "artifacts/assistant-perf-reliability-report.json",
  },
  "postcheck-anomaly": {
    id: "postcheck-anomaly",
    scriptPath: "scripts/eval-assistant-postcheck-anomaly-v1.mjs",
    reportPathEnv: "ASSISTANT_EVAL_REPORT_PATH",
    defaultRoundReportPath: "artifacts/assistant-postcheck-anomaly-v1-report.json",
  },
  full: {
    id: "full",
    scriptPath: "scripts/eval-assistant-comprehensive.mjs",
    reportPathEnv: "ASSISTANT_EVAL_REPORT_PATH",
    defaultRoundReportPath: "artifacts/assistant-eval-comprehensive-report.json",
  },
};

function readNumber(rawValue, fallback) {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolEnv(rawValue) {
  const normalized = String(rawValue ?? "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parseCli(argv) {
  const values = {};
  const flags = new Set();
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] ?? "");
    if (!token.startsWith("--")) continue;
    const raw = token.slice(2);
    const eqIndex = raw.indexOf("=");
    if (eqIndex > 0) {
      values[raw.slice(0, eqIndex)] = raw.slice(eqIndex + 1);
      continue;
    }
    const next = argv[i + 1];
    if (typeof next === "string" && !next.startsWith("--")) {
      values[raw] = next;
      i += 1;
      continue;
    }
    flags.add(raw);
  }
  return { values, flags };
}

function suiteToken(suiteId) {
  return String(suiteId ?? "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function parseSuites(rawSuite) {
  const normalized = String(rawSuite ?? "all").trim().toLowerCase();
  if (!normalized || normalized === "all") {
    return Object.keys(suites);
  }
  return normalized
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function resolveSuiteConfig(suiteId, cliValues) {
  const suite = suites[suiteId];
  if (!suite) {
    throw new Error(`Unknown suite: ${suiteId}`);
  }

  const token = suiteToken(suiteId);
  const rounds = Math.max(
    1,
    Math.floor(
      readNumber(
        cliValues.rounds ?? process.env[`ASSISTANT_EVAL_STABILITY_ROUNDS_${token}`],
        baseRounds
      )
    )
  );
  const minPassRate = readNumber(
    cliValues["min-pass-rate"] ?? process.env[`ASSISTANT_EVAL_STABILITY_MIN_PASS_RATE_${token}`],
    baseMinPassRate
  );
  const maxFlakeRate = readNumber(
    cliValues["max-flake-rate"] ?? process.env[`ASSISTANT_EVAL_STABILITY_MAX_FLAKE_RATE_${token}`],
    baseMaxFlakeRate
  );
  const minSuccessfulRounds = Math.max(
    1,
    Math.floor(
      readNumber(
        cliValues["min-successful-rounds"]
          ?? process.env[`ASSISTANT_EVAL_STABILITY_MIN_SUCCESSFUL_ROUNDS_${token}`],
        Math.min(rounds, baseMinSuccessfulRounds)
      )
    )
  );

  return {
    ...suite,
    rounds,
    minPassRate,
    maxFlakeRate,
    minSuccessfulRounds: Math.min(rounds, minSuccessfulRounds),
  };
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function extractPassRate(report) {
  const candidates = [
    report?.turnPassRate,
    report?.passRate,
    report?.totals?.turnPassRate,
    report?.rates?.turnPassRate,
    report?.metadata?.turnPassRate,
    report?.summary?.turnPassRate,
    report?.summary?.passRate,
  ];
  for (const value of candidates) {
    if (isFiniteNumber(value)) return value;
  }

  if (Array.isArray(report?.checks) && report.checks.length > 0) {
    const passedChecks = report.checks.filter((item) => String(item?.status ?? "") === "pass").length;
    return passedChecks / report.checks.length;
  }
  if (isFiniteNumber(report?.summary?.failures)) {
    const failures = Number(report.summary.failures);
    if (Array.isArray(report?.checks) && report.checks.length > 0) {
      return Math.max(0, (report.checks.length - failures) / report.checks.length);
    }
    return failures === 0 ? 1 : 0;
  }

  const totals = [
    [report?.passedTurns, report?.totalTurns],
    [report?.passedCases, report?.totalCases],
    [report?.totals?.passedTurns, report?.totals?.turns],
  ];
  for (const [passed, total] of totals) {
    if (isFiniteNumber(passed) && isFiniteNumber(total) && total > 0) {
      return passed / total;
    }
  }
  return null;
}

function extractRoundStatus(report) {
  if (typeof report?.overallStatus === "string") {
    const normalized = report.overallStatus.toLowerCase();
    if (normalized === "pass") return true;
    if (normalized === "fail") return false;
  }
  if (typeof report?.gates?.all?.pass === "boolean") {
    return report.gates.all.pass;
  }
  if (isFiniteNumber(report?.failedTurns)) {
    return report.failedTurns === 0;
  }
  if (isFiniteNumber(report?.failedCases)) {
    return report.failedCases === 0;
  }
  if (isFiniteNumber(report?.totals?.failedTurns)) {
    return report.totals.failedTurns === 0;
  }
  if (isFiniteNumber(report?.summary?.failures)) {
    return Number(report.summary.failures) === 0;
  }
  return null;
}

function extractDriftSignals(report) {
  if (!report || typeof report !== "object") return {};
  const candidates = {
    turnPassRate: extractPassRate(report),
    toolPassRate: report?.routingChecks?.tool?.passRate,
    endpointPassRate: report?.routingChecks?.endpoint?.passRate,
    intentPassRate: report?.routingChecks?.intent?.passRate,
    policyPassRate: report?.routingChecks?.policy?.passRate ?? report?.rates?.policyPassRate,
    citationPassRate:
      report?.routingChecks?.citation?.passRate
      ?? report?.rates?.citationPassRate
      ?? report?.citationCoverage?.coveragePercent,
    citationSanityPassRate: report?.routingChecks?.citationSanity?.passRate,
    toolBudgetPassRate: report?.routingChecks?.toolBudget?.passRate,
    budgetExceededTurnRate: report?.routingChecks?.runtimeGuards?.budgetExceededTurnRate,
    circuitOpenTurnRate: report?.routingChecks?.runtimeGuards?.circuitOpenTurnRate,
    numericSymbolPassRate: report?.metrics?.numericSymbolPassRate,
    numericRiskPassRate: report?.metrics?.numericRiskPassRate,
    numericValuationPassRate: report?.metrics?.numericValuationPassRate,
    numericFundamentalsPassRate: report?.metrics?.numericFundamentalsPassRate,
    unsupportedClaimRate: report?.metrics?.unsupportedClaimRate,
    supportedClaimPrecision: report?.metrics?.supportedClaimPrecision,
    overallClaimAccuracy: report?.metrics?.overallClaimAccuracy,
  };

  const normalized = {};
  for (const [key, value] of Object.entries(candidates)) {
    if (isFiniteNumber(value)) {
      normalized[key] = Number(value);
    }
  }
  return normalized;
}

function percentile(samples, p) {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[rank];
}

function summarizeDriftSignals(rounds) {
  const pools = {};
  for (const round of rounds) {
    if (!round || typeof round !== "object") continue;
    const signals = round.driftSignals ?? {};
    for (const [key, value] of Object.entries(signals)) {
      if (!isFiniteNumber(value)) continue;
      if (!pools[key]) pools[key] = [];
      pools[key].push(Number(value));
    }
  }

  const summary = {};
  for (const [metricId, samples] of Object.entries(pools)) {
    const count = samples.length;
    const sum = samples.reduce((acc, value) => acc + value, 0);
    summary[metricId] = {
      samples: count,
      first: samples[0],
      last: samples[count - 1],
      min: Math.min(...samples),
      max: Math.max(...samples),
      mean: count > 0 ? sum / count : null,
      p50: percentile(samples, 0.5),
      p90: percentile(samples, 0.9),
      driftFromFirst: count > 1 ? samples[count - 1] - samples[0] : 0,
    };
  }

  return summary;
}

function prefixLogs(prefix, raw) {
  const text = String(raw ?? "");
  if (!text) return;
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  for (const line of lines) {
    console.log(`${prefix} ${line}`);
  }
}

async function runNodeScript(scriptPath, env, logPrefix) {
  return await new Promise((resolve) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    const child = spawn(process.execPath, [scriptPath], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdoutChunks.push(text);
      prefixLogs(logPrefix, text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderrChunks.push(text);
      prefixLogs(`${logPrefix}[ERR]`, text);
    });

    child.on("close", (code, signal) => {
      resolve({
        exitCode: code ?? 1,
        signal: signal ?? null,
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
      });
    });
  });
}

function readJsonReport(filePath) {
  if (!fs.existsSync(filePath)) {
    return { report: null, errors: ["missing_report_file"] };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { report: null, errors: ["report_not_json_object"] };
    }
    return { report: parsed, errors: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { report: null, errors: [`malformed_report_json:${message}`] };
  }
}

function collectReportValidationErrors(report) {
  const errors = [];
  const reportStatus = extractRoundStatus(report);
  if (reportStatus === null) {
    errors.push("missing_round_status");
  }

  const passRate = extractPassRate(report);
  if (!isFiniteNumber(passRate)) {
    errors.push("missing_pass_rate");
  }

  const mode = String(report?.mode ?? "").trim().toLowerCase();
  if (mode === "dry-run" && ciMode && !allowDryRunInCi) {
    errors.push("dry_run_report_in_ci");
  }

  const skipped = report?.skipped === true || report?.summary?.skipped === true;
  if (skipped && ciMode) {
    errors.push("skipped_report_in_ci");
  }

  return errors;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function pickFailureReason(result) {
  if (result.exitCode === 0) return null;
  const stderr = String(result.stderr ?? "").trim();
  if (stderr) {
    const lines = stderr.split(/\r?\n/).filter((line) => line.length > 0);
    return lines[lines.length - 1];
  }
  return `exit_code_${result.exitCode}`;
}

function classifyRoundFailure(input) {
  const reason = String(input?.failureReason ?? "").trim();
  const failures = Array.isArray(input?.reportValidationErrors) ? input.reportValidationErrors : [];
  const status = Number.isFinite(input?.exitCode) ? input.exitCode : null;
  const classification = classifyFailureCause({
    status,
    reason,
    failures,
  });
  return {
    category: classification.category,
    code: classification.code,
    detail: classification.detail,
  };
}

function resolveStabilityOutputPath(suiteId, cliValue) {
  if (typeof cliValue === "string" && cliValue.trim().length > 0) {
    return path.resolve(cliValue.trim());
  }
  if (suiteId === "all") {
    return path.resolve(defaultReportPath);
  }
  return path.resolve(`artifacts/assistant-${suiteId}-stability-report.json`);
}

function evaluateEarlyStop(config, rounds) {
  if (!earlyStopEnabled || !Array.isArray(rounds) || rounds.length === 0) {
    return { shouldStop: false, reasons: [] };
  }

  const executedRounds = rounds.length;
  const successfulRounds = rounds.filter((item) => item.success).length;
  const failedRounds = executedRounds - successfulRounds;
  const remainingRounds = Math.max(0, config.rounds - executedRounds);
  const possibleSuccessfulRounds = successfulRounds + remainingRounds;
  const minPossibleFlakeRate = config.rounds > 0 ? failedRounds / config.rounds : 1;
  const passRates = rounds.map((item) => item.passRate).filter((value) => isFiniteNumber(value));
  const minObservedPassRate = passRates.length > 0 ? Math.min(...passRates) : null;
  const integrityFailed = rounds.some((item) => item.reportValidationErrors.length > 0);
  const reasons = [];

  if (possibleSuccessfulRounds < config.minSuccessfulRounds) {
    reasons.push("insufficient_remaining_rounds_for_success_threshold");
  }
  if (minPossibleFlakeRate > config.maxFlakeRate) {
    reasons.push("flake_rate_threshold_unreachable");
  }
  if (isFiniteNumber(minObservedPassRate) && minObservedPassRate < config.minPassRate) {
    reasons.push("min_pass_rate_already_below_threshold");
  }
  if (integrityFailed) {
    reasons.push("report_integrity_already_failed");
  }

  return {
    shouldStop: reasons.length > 0,
    reasons,
    executedRounds,
    remainingRounds,
    successfulRounds,
    failedRounds,
    minPossibleFlakeRate,
    minObservedPassRate,
  };
}

async function runSuiteStability(config) {
  const suiteStartedAt = Date.now();
  const suiteRoundDir = path.resolve("artifacts/stability", config.id);
  fs.mkdirSync(suiteRoundDir, { recursive: true });

  const rounds = [];
  let earlyStop = null;
  for (let round = 1; round <= config.rounds; round += 1) {
    const roundReportPath = path.resolve(suiteRoundDir, `${config.id}-round-${round}.json`);
    const roundStartedAt = Date.now();
    const env = {
      ...process.env,
      [config.reportPathEnv]: roundReportPath,
    };
    const logPrefix = `[${config.id}:R${round}]`;
    const execution = await runNodeScript(config.scriptPath, env, logPrefix);
    const loadedReport = readJsonReport(roundReportPath);
    const parsedReport = loadedReport.report;
    const reportValidationErrors = [
      ...loadedReport.errors,
      ...(parsedReport ? collectReportValidationErrors(parsedReport) : []),
    ];
    const passRate = extractPassRate(parsedReport);
    const reportStatus = extractRoundStatus(parsedReport);
    const driftSignals = extractDriftSignals(parsedReport);
    const success = execution.exitCode === 0 && reportStatus === true && reportValidationErrors.length === 0;
    const failureReason =
      success
        ? null
        : pickFailureReason(execution)
          ?? (reportValidationErrors.length > 0
            ? reportValidationErrors.join(",")
            : reportStatus === false
              ? "report_status_fail"
              : "round_failed");
    const failureClassification = success
      ? null
      : classifyRoundFailure({
        exitCode: execution.exitCode,
        failureReason,
        reportValidationErrors,
      });
    rounds.push({
      round,
      success,
      exitCode: execution.exitCode,
      signal: execution.signal,
      durationMs: Date.now() - roundStartedAt,
      reportPath: roundReportPath,
      passRate,
      reportStatus: parsedReport?.overallStatus ?? null,
      reportValidationErrors,
      failureReason,
      failureCategory: failureClassification?.category ?? null,
      failureCode: failureClassification?.code ?? null,
      failureDetail: failureClassification?.detail ?? null,
      driftSignals,
    });

    const earlyStopDecision = evaluateEarlyStop(config, rounds);
    if (earlyStopDecision.shouldStop) {
      earlyStop = {
        ...earlyStopDecision,
        atRound: round,
      };
      console.log(
        `STABILITY EARLY_STOP suite=${config.id} round=${round} reasons=${earlyStop.reasons.join(",")}`
      );
      break;
    }
  }

  const successfulRounds = rounds.filter((item) => item.success).length;
  const failedRounds = rounds.length - successfulRounds;
  const flakeRate = rounds.length > 0 ? failedRounds / rounds.length : 1;
  const passRates = rounds.map((item) => item.passRate).filter((value) => isFiniteNumber(value));
  const minObservedPassRate = passRates.length > 0 ? Math.min(...passRates) : null;
  const avgObservedPassRate =
    passRates.length > 0 ? passRates.reduce((acc, value) => acc + value, 0) / passRates.length : null;
  const driftBaselines = summarizeDriftSignals(rounds);

  const gates = {
    flakeRate: {
      pass: flakeRate <= config.maxFlakeRate,
      actual: flakeRate,
      threshold: config.maxFlakeRate,
      comparator: "lte",
    },
    successfulRounds: {
      pass: successfulRounds >= config.minSuccessfulRounds,
      actual: successfulRounds,
      threshold: config.minSuccessfulRounds,
      comparator: "gte",
    },
    minPassRate: {
      pass: isFiniteNumber(minObservedPassRate) && minObservedPassRate >= config.minPassRate,
      actual: minObservedPassRate,
      threshold: config.minPassRate,
      comparator: "gte",
    },
    reportIntegrity: {
      pass: rounds.every((item) => item.reportValidationErrors.length === 0),
      actual: rounds.filter((item) => item.reportValidationErrors.length > 0).length,
      threshold: 0,
      comparator: "lte",
    },
  };
  const gatePass =
    !earlyStop
    && gates.flakeRate.pass
    && gates.successfulRounds.pass
    && gates.minPassRate.pass
    && gates.reportIntegrity.pass;

  const preferredRound = rounds.findLast((item) => item.success) ?? null;
  if (preferredRound && fs.existsSync(preferredRound.reportPath)) {
    fs.mkdirSync(path.dirname(path.resolve(config.defaultRoundReportPath)), { recursive: true });
    fs.copyFileSync(preferredRound.reportPath, path.resolve(config.defaultRoundReportPath));
  }

  const report = {
    schemaVersion: "assistant-stability-gate-v1-2026-02-19",
    runAt: new Date().toISOString(),
    suite: config.id,
    scriptPath: config.scriptPath,
    thresholds: {
      rounds: config.rounds,
      minPassRate: config.minPassRate,
      maxFlakeRate: config.maxFlakeRate,
      minSuccessfulRounds: config.minSuccessfulRounds,
    },
    summary: {
      configuredRounds: config.rounds,
      executedRounds: rounds.length,
      successfulRounds,
      failedRounds,
      flakeRate,
      minObservedPassRate,
      avgObservedPassRate,
      gatePass,
      durationMs: Date.now() - suiteStartedAt,
      earlyStop,
      failureCategorySummary: summarizeFailureCategories(rounds),
      driftBaselines,
    },
    gates,
    rounds,
    driftBaselines,
    canonicalRoundReportPath: path.resolve(config.defaultRoundReportPath),
  };

  return { config, report, gatePass };
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  const selectedSuites = parseSuites(cli.values.suite);
  if (selectedSuites.length === 0) {
    throw new Error("No suites selected.");
  }

  const startedAt = Date.now();
  const suiteReports = [];
  let hasFailingSuite = false;

  for (const suiteId of selectedSuites) {
    const config = resolveSuiteConfig(suiteId, cli.values);
    console.log(
      `STABILITY START suite=${config.id} rounds=${config.rounds} min_pass_rate=${config.minPassRate} max_flake_rate=${config.maxFlakeRate} min_success_rounds=${config.minSuccessfulRounds}`
    );
    const result = await runSuiteStability(config);
    suiteReports.push(result.report);
    hasFailingSuite = hasFailingSuite || !result.gatePass;
    console.log(
      `STABILITY RESULT suite=${config.id} gate=${result.gatePass ? "PASS" : "FAIL"} flake_rate=${result.report.summary.flakeRate.toFixed(4)} min_pass_rate=${result.report.summary.minObservedPassRate ?? "n/a"} success_rounds=${result.report.summary.successfulRounds}/${config.rounds}`
    );
  }

  const outputPath = resolveStabilityOutputPath(
    selectedSuites.length === 1 ? selectedSuites[0] : "all",
    cli.values["report-path"]
  );
  const aggregateReport = {
    schemaVersion: "assistant-stability-gate-v1-2026-02-19",
    runAt: new Date().toISOString(),
    selectedSuites,
    durationMs: Date.now() - startedAt,
    overallStatus: hasFailingSuite ? "fail" : "pass",
    suites: suiteReports,
  };
  writeJson(outputPath, aggregateReport);
  console.log(`STABILITY_REPORT_PATH=${outputPath}`);

  if (hasFailingSuite) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
