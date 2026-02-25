import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

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

function toAbsolutePath(candidate) {
  const resolved = path.resolve(String(candidate ?? "").trim());
  return resolved;
}

function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(2)}%`;
}

function clampTail(buffer, line, maxLines = 80) {
  buffer.push(line);
  if (buffer.length > maxLines) {
    buffer.splice(0, buffer.length - maxLines);
  }
}

function splitLines(chunk) {
  return String(chunk ?? "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

function computePercentFromCounts(passed, total) {
  if (!Number.isFinite(passed) || !Number.isFinite(total) || total <= 0) return null;
  return passed / total;
}

function pickFiniteNumber(values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function inferTotalAndPassed(report) {
  if (!report || typeof report !== "object") return { total: null, passed: null };

  const total = pickFiniteNumber([
    report.totalTurns,
    report.totalTests,
    report.totals?.turns,
    report.totals?.totalTurns,
    report.numTotalTests,
    report.results?.length,
  ]);
  const passed = pickFiniteNumber([
    report.passedTurns,
    report.totals?.passedTurns,
    report.numPassedTests,
  ]);
  return { total, passed };
}

function inferPassRate(report, total, passed) {
  const direct = pickFiniteNumber([
    report.turnPassRate,
    report.passRate,
    report.totals?.turnPassRate,
    report.totals?.passRate,
    report.summary?.turnPassRate,
    report.summary?.passRate,
  ]);
  if (Number.isFinite(direct)) return direct;
  return computePercentFromCounts(passed, total);
}

function inferOverallStatus(report, exitCode) {
  const status = String(
    report?.overallStatus
    ?? report?.status
    ?? report?.result
    ?? (report?.success === true ? "pass" : report?.success === false ? "fail" : "")
  ).toLowerCase();
  if (status === "pass" || status === "ok" || status === "success") return "pass";
  if (status === "fail" || status === "error" || status === "failed") return "fail";
  if (exitCode === 0) return "pass";
  return "fail";
}

function countNumbersNotInDataViolations(report) {
  const results = Array.isArray(report?.results) ? report.results : [];
  let violations = 0;
  for (const item of results) {
    const failures = Array.isArray(item?.failures) ? item.failures : [];
    for (const failure of failures) {
      const text = String(failure ?? "").toLowerCase();
      if (text.includes("unexpected numeric claim/evidence in guarded scenario")) {
        violations += 1;
      }
    }
  }
  return violations;
}

function extractSuiteMetrics(report, exitCode) {
  const { total, passed } = inferTotalAndPassed(report);
  const passRate = inferPassRate(report, total, passed);
  const failed = Number.isFinite(total) && Number.isFinite(passed) ? total - passed : null;

  const endpointPassRate = pickFiniteNumber([
    report?.routingChecks?.endpoint?.passRate,
  ]);
  const toolPassRate = pickFiniteNumber([
    report?.routingChecks?.tool?.passRate,
  ]);
  const outputGuardPassRate = pickFiniteNumber([
    report?.routingChecks?.outputGuard?.passRate,
  ]);
  const latencyP95Ms = pickFiniteNumber([
    report?.performance?.latencyMs?.p95,
    report?.latencyPercentiles?.p95Ms,
  ]);

  const gatesPass = typeof report?.gates?.allPass === "boolean" ? report.gates.allPass : null;
  const overallStatus = inferOverallStatus(report, exitCode);
  const numberLeakViolations = countNumbersNotInDataViolations(report);

  return {
    total,
    passed,
    failed,
    passRate,
    endpointPassRate,
    toolPassRate,
    outputGuardPassRate,
    latencyP95Ms,
    gatesPass,
    overallStatus,
    numberLeakViolations,
  };
}

async function runCommand(command, args, env) {
  const stdoutTail = [];
  const stderrTail = [];
  const startedAt = Date.now();

  return await new Promise((resolve) => {
    let child = null;
    try {
      child = spawn(command, args, {
        env,
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      });
    } catch (error) {
      clampTail(stderrTail, String(error?.message ?? error));
      resolve({
        exitCode: 1,
        durationMs: Date.now() - startedAt,
        stdoutTail,
        stderrTail,
      });
      return;
    }

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      for (const line of splitLines(chunk)) {
        clampTail(stdoutTail, line);
      }
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      for (const line of splitLines(chunk)) {
        clampTail(stderrTail, line);
      }
    });

    child.on("error", (error) => {
      clampTail(stderrTail, String(error?.message ?? error));
      resolve({
        exitCode: 1,
        durationMs: Date.now() - startedAt,
        stdoutTail,
        stderrTail,
      });
    });

    child.on("close", (exitCode) => {
      resolve({
        exitCode: Number(exitCode ?? 1),
        durationMs: Date.now() - startedAt,
        stdoutTail,
        stderrTail,
      });
    });
  });
}

function resolveBackendActive(healthPayload) {
  if (!healthPayload || typeof healthPayload !== "object") return null;
  const candidates = [
    healthPayload.backend?.active,
    healthPayload.backendActive,
    healthPayload.status?.backend?.active,
  ];
  for (const value of candidates) {
    const text = String(value ?? "").trim().toLowerCase();
    if (text === "duckdb" || text === "csv") return text;
  }
  return null;
}

async function fetchHealth(baseUrl, timeoutMs = 10000) {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/health/data?probe=true&includeFundamentals=false`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return {
      endpoint,
      reachable: response.ok,
      status: response.status,
      backendActive: resolveBackendActive(data),
      payload: data,
    };
  } catch (error) {
    return {
      endpoint,
      reachable: false,
      status: null,
      backendActive: null,
      payload: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function aggregateStressPassRate(suiteMap, suiteIds) {
  let total = 0;
  let passed = 0;
  for (const id of suiteIds) {
    const suite = suiteMap.get(id);
    if (!suite) continue;
    if (Number.isFinite(suite.metrics.total) && Number.isFinite(suite.metrics.passed)) {
      total += suite.metrics.total;
      passed += suite.metrics.passed;
    }
  }
  return {
    total,
    passed,
    passRate: total > 0 ? passed / total : null,
  };
}

function toCriterion(name, pass, actual, threshold, detail) {
  return { name, status: pass ? "pass" : "fail", actual, threshold, detail };
}

function buildMarkdownReport(input) {
  const lines = [];
  lines.push("# Assistant Criteria Evaluation v1");
  lines.push("");
  lines.push(`- generatedAt: ${input.generatedAt}`);
  lines.push(`- baseUrl: ${input.baseUrl}`);
  lines.push(`- backendActive: ${input.health.backendActive ?? "unknown"}`);
  lines.push(`- overallStatus: ${input.overallStatus}`);
  lines.push("");
  lines.push("## Criteria");
  lines.push("");
  lines.push("| Criterion | Status | Actual | Threshold | Detail |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const criterion of input.criteria) {
    lines.push(
      `| ${criterion.name} | ${criterion.status.toUpperCase()} | ${criterion.actual} | ${criterion.threshold} | ${criterion.detail} |`
    );
  }
  lines.push("");
  lines.push("## Suites");
  lines.push("");
  lines.push("| Suite | Exit | Status | Pass rate | Total | Passed | Report |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const suite of input.suiteRuns) {
    const passRateText = Number.isFinite(suite.metrics.passRate) ? formatPercent(suite.metrics.passRate) : "n/a";
    lines.push(
      `| ${suite.id} | ${suite.exitCode} | ${suite.metrics.overallStatus.toUpperCase()} | ${passRateText} | ${suite.metrics.total ?? "n/a"} | ${suite.metrics.passed ?? "n/a"} | ${suite.reportPath} |`
    );
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- numbers_not_in_data_violations counts guard-scenario numeric leakage from suite failures.");
  lines.push("- fidelity suite uses DuckDB-oriented query fidelity tests and requires backendActive=duckdb for strict pass.");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  const baseUrl = String(cli.values["base-url"] ?? process.env.ASSISTANT_EVAL_BASE_URL ?? "http://localhost:3010");
  const matrixPath = toAbsolutePath(
    cli.values["matrix-path"] ?? "scripts/assistant-eval-criteria-v1-matrix.json"
  );
  const reportPath = toAbsolutePath(
    cli.values["report-path"] ?? "artifacts/assistant-eval-criteria-v1-report.json"
  );
  const summaryPath = toAbsolutePath(
    cli.values["summary-path"] ?? "docs/assistant-eval-criteria-v1-report.md"
  );
  const skipSuites = new Set(
    String(cli.values["skip-suite"] ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  );
  const collectOnly = cli.flags.has("collect-only");

  if (!fs.existsSync(matrixPath)) {
    throw new Error(`Matrix file not found: ${matrixPath}`);
  }

  const matrix = readJson(matrixPath);
  if (!matrix || !Array.isArray(matrix.suites)) {
    throw new Error(`Invalid matrix format: ${matrixPath}`);
  }

  const health = await fetchHealth(baseUrl, 10000);
  const suiteRuns = [];

  for (const suite of matrix.suites) {
    const id = String(suite.id ?? "").trim();
    if (!id) continue;
    if (skipSuites.has(id)) {
      suiteRuns.push({
        id,
        skipped: true,
        exitCode: null,
        durationMs: 0,
        reportPath: toAbsolutePath(suite.reportPath),
        metrics: {
          total: null,
          passed: null,
          failed: null,
          passRate: null,
          endpointPassRate: null,
          toolPassRate: null,
          outputGuardPassRate: null,
          latencyP95Ms: null,
          gatesPass: null,
          overallStatus: "skip",
          numberLeakViolations: 0,
        },
        stdoutTail: [],
        stderrTail: [],
      });
      continue;
    }

    const suiteReportPath = toAbsolutePath(suite.reportPath);
    await fs.promises.mkdir(path.dirname(suiteReportPath), { recursive: true });

    const env = {
      ...process.env,
      ASSISTANT_EVAL_BASE_URL: baseUrl,
      SMOKE_BASE_URL: baseUrl,
      BACKTEST_KPI_BASE_URL: baseUrl,
    };

    let execution = {
      exitCode: null,
      durationMs: 0,
      stdoutTail: [],
      stderrTail: [],
    };
    if (!collectOnly) {
      let command = "";
      let args = [];

      if (suite.type === "node-script") {
        command = process.execPath;
        args = [String(suite.script)];
        if (suite.reportEnv) {
          env[String(suite.reportEnv)] = suiteReportPath;
        } else if (id === "technical_backtesting") {
          env.BACKTEST_KPI_REPORT_PATH = suiteReportPath;
        }
      } else if (suite.type === "jest") {
        command = process.execPath;
        args = [
          path.resolve("node_modules", "jest", "bin", "jest.js"),
          ...Array.from(suite.args ?? []),
          "--forceExit",
          "--testPathIgnorePatterns=.wt-vercel-fix",
          "--outputFile",
          suiteReportPath,
        ];
      } else {
        throw new Error(`Unsupported suite type for ${id}: ${suite.type}`);
      }

      console.log(`[criteria-v1] running suite=${id}`);
      execution = await runCommand(command, args, env);
    }
    const report = readJson(suiteReportPath);
    const metrics = extractSuiteMetrics(report, execution.exitCode ?? 0);

    suiteRuns.push({
      id,
      skipped: false,
      exitCode: execution.exitCode,
      durationMs: execution.durationMs,
      reportPath: suiteReportPath,
      metrics,
      stdoutTail: execution.stdoutTail,
      stderrTail: execution.stderrTail,
    });
  }

  const suiteMap = new Map(suiteRuns.map((item) => [item.id, item]));
  const thresholds = matrix.thresholds ?? {};

  const fidelitySuite = suiteMap.get("query_fidelity_duckdb");
  const routingSuite = suiteMap.get("routing_gold");
  const stressAggregate = aggregateStressPassRate(suiteMap, [
    "ohlcv_stress",
    "fundamentals_stress",
    "metrics_stress",
  ]);
  const technicalSuite = suiteMap.get("technical_backtesting");

  const numbersNotInDataViolations = suiteRuns.reduce(
    (sum, suite) => sum + Number(suite.metrics.numberLeakViolations ?? 0),
    0
  );
  const fidelityPassRate = Number(fidelitySuite?.metrics.passRate ?? NaN);
  const routingPassRate = Number(routingSuite?.metrics.passRate ?? NaN);
  const routingEndpointPassRate = Number(routingSuite?.metrics.endpointPassRate ?? NaN);
  const stressPassRate = Number(stressAggregate.passRate ?? NaN);
  const backendActive = String(health.backendActive ?? "unknown");

  const criteria = [];

  const fidelityPass =
    backendActive === "duckdb"
    && Number.isFinite(fidelityPassRate)
    && fidelityPassRate >= Number(thresholds.fidelityMinPassRate ?? 0.99);
  criteria.push(
    toCriterion(
      "data_query_fidelity",
      fidelityPass,
      `passRate=${formatPercent(fidelityPassRate)}, backend=${backendActive}`,
      `passRate>=${formatPercent(Number(thresholds.fidelityMinPassRate ?? 0.99))} && backend=duckdb`,
      "DuckDB-backed gold fidelity tests"
    )
  );

  const routingPass =
    Number.isFinite(routingPassRate)
    && routingPassRate >= Number(thresholds.routingMinTurnPassRate ?? 0.99)
    && Number.isFinite(routingEndpointPassRate)
    && routingEndpointPassRate >= Number(thresholds.routingMinEndpointPassRate ?? 0.99);
  criteria.push(
    toCriterion(
      "tool_route_reliability",
      routingPass,
      `turn=${formatPercent(routingPassRate)}, endpoint=${formatPercent(routingEndpointPassRate)}`,
      `turn>=${formatPercent(Number(thresholds.routingMinTurnPassRate ?? 0.99))}, endpoint>=${formatPercent(Number(thresholds.routingMinEndpointPassRate ?? 0.99))}`,
      "Routing matrix tool+endpoint checks"
    )
  );

  const stressPass = Number.isFinite(stressPassRate) && stressPassRate >= Number(thresholds.stressMinTurnPassRate ?? 0.98);
  criteria.push(
    toCriterion(
      "robustness_stress_ohlcv_fundamental_technical_queries",
      stressPass,
      `turnPassRate=${formatPercent(stressPassRate)} (${stressAggregate.passed}/${stressAggregate.total})`,
      `turnPassRate>=${formatPercent(Number(thresholds.stressMinTurnPassRate ?? 0.98))}`,
      "Combined stress matrix (ohlcv + fundamentals + metrics)"
    )
  );

  const noFabricationPass = numbersNotInDataViolations <= Number(thresholds.numbersNotInDataMax ?? 0);
  criteria.push(
    toCriterion(
      "answer_faithfulness_numbers_not_in_data",
      noFabricationPass,
      `violations=${numbersNotInDataViolations}`,
      `violations<=${Number(thresholds.numbersNotInDataMax ?? 0)}`,
      "Guard scenarios must not output unsupported numeric claims"
    )
  );

  const technicalPass =
    Boolean(technicalSuite?.metrics.gatesPass === true)
    || String(technicalSuite?.metrics.overallStatus ?? "") === "pass";
  criteria.push(
    toCriterion(
      "technical_workflow_backtesting_kpi",
      technicalPass,
      `overall=${String(technicalSuite?.metrics.overallStatus ?? "unknown")}, gatesPass=${String(technicalSuite?.metrics.gatesPass ?? "n/a")}`,
      "overall=pass and/or gatesPass=true",
      "Backtesting KPI matrix for technical/risk handling"
    )
  );

  const suitesFailed = suiteRuns
    .filter((suite) => !suite.skipped && suite.exitCode !== null && suite.exitCode !== 0)
    .map((suite) => suite.id);
  const allCriteriaPass = criteria.every((criterion) => criterion.status === "pass");
  const overallStatus = allCriteriaPass && suitesFailed.length === 0 ? "pass" : "fail";

  const finalReport = {
    schemaVersion: "assistant-criteria-v1-2026-02-24",
    generatedAt: new Date().toISOString(),
    baseUrl,
    matrixPath,
    reportPath,
    summaryPath,
    thresholds,
    health,
    suiteRuns,
    criteria,
    suitesFailed,
    overallStatus,
  };

  await fs.promises.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.promises.writeFile(reportPath, `${JSON.stringify(finalReport, null, 2)}\n`, "utf8");

  const summary = buildMarkdownReport({
    generatedAt: finalReport.generatedAt,
    baseUrl: finalReport.baseUrl,
    health: finalReport.health,
    criteria: finalReport.criteria,
    suiteRuns: finalReport.suiteRuns,
    overallStatus: finalReport.overallStatus,
  });
  await fs.promises.mkdir(path.dirname(summaryPath), { recursive: true });
  await fs.promises.writeFile(summaryPath, summary, "utf8");

  console.log(`[criteria-v1] JSON report: ${reportPath}`);
  console.log(`[criteria-v1] Markdown report: ${summaryPath}`);
  console.log(`[criteria-v1] overallStatus=${overallStatus}`);

  if (overallStatus !== "pass") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[criteria-v1] fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exit(1);
});
