import fs from "node:fs";
import path from "node:path";

const DEFAULT_MONITOR_REPORT_PATH = "artifacts/assistant-governance-monitor-report.json";
const DEFAULT_STABILITY_REPORT_PATH = "artifacts/assistant-stability-report.json";
const DEFAULT_OUTPUT_PATH = "artifacts/assistant-drift-triage-report.json";
const DEFAULT_SUMMARY_PATH = "artifacts/assistant-drift-triage-summary.md";

const SUITE_STABILITY_REPORT_HINTS = {
  routing: "artifacts/assistant-routing-stability-report.json",
  realworld: "artifacts/assistant-realworld-stability-report.json",
  "pr-gate": "artifacts/assistant-pr-gate-stability-report.json",
  "policy-matrix": "artifacts/assistant-policy-matrix-stability-report.json",
  "perf-reliability": "artifacts/assistant-perf-reliability-stability-report.json",
  "postcheck-anomaly": "artifacts/assistant-postcheck-anomaly-stability-report.json",
};

function parseCli(argv) {
  const values = {};
  const flags = new Set();
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
  return { values, flags };
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, value, "utf8");
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTimestamp(value) {
  if (!value) return null;
  const ts = Date.parse(String(value));
  return Number.isFinite(ts) ? ts : null;
}

function priorityFromMetric(metricId) {
  const p0 = new Set(["policySafetyRate", "unsupportedClaimRate", "s1Failures"]);
  return p0.has(metricId) ? "P0" : "P1";
}

function ownerFromMetric(metricId) {
  const owners = {
    toolRoutingAccuracy: "AI Engineering",
    endpointGroundingAccuracy: "AI Engineering",
    intentAccuracy: "AI Engineering",
    citationCoverage: "QA + AI Engineering",
    formatCompliance: "QA + Frontend",
    contextCarryAccuracy: "AI Engineering",
    policySafetyRate: "AI Engineering + PM",
    unsupportedClaimRate: "AI Engineering + PM",
    s1Failures: "PM + QA",
  };
  return owners[metricId] ?? "PM + AI Engineering";
}

function ownerFromSuite(suiteId) {
  const owners = {
    routing: "AI Engineering",
    realworld: "QA + BA",
    "pr-gate": "PM + QA",
    "policy-matrix": "AI Engineering",
    "perf-reliability": "SRE + Backend",
    "postcheck-anomaly": "QA + AI Engineering",
  };
  return owners[suiteId] ?? "PM + QA";
}

function suiteStableCommand(suiteId) {
  const map = {
    routing: "pnpm run docker:eval:assistant:routing:stable",
    realworld: "pnpm run docker:eval:assistant:realworld:stable",
    "pr-gate": "pnpm run docker:eval:assistant:pr-gate:stable",
    "policy-matrix": "pnpm run docker:eval:assistant:policy-matrix:stable",
    "perf-reliability": "pnpm run docker:eval:assistant:perf-reliability:stable",
    "postcheck-anomaly": "pnpm run docker:eval:assistant:postcheck:v1:stable",
  };
  return map[suiteId] ?? `pnpm run docker:eval:assistant:${suiteId}:stable`;
}

function priorityFromSuite(summary) {
  const minObserved = toNumber(summary?.minObservedPassRate) ?? 1;
  const flake = toNumber(summary?.flakeRate) ?? 0;
  if (minObserved < 0.8 || flake > 0.3) return "P0";
  return "P1";
}

function buildMetricAction(metricId) {
  const actions = {
    toolRoutingAccuracy: [
      "Run `pnpm run docker:eval:assistant:routing:stable` and inspect failed scenario groups by intent.",
      "Patch planner/signal routing before policy changes.",
    ],
    endpointGroundingAccuracy: [
      "Run routing + realworld suites and compare endpoint fragments in citations.",
      "Fix endpoint selection or tool request param mapping.",
    ],
    intentAccuracy: [
      "Review query-plan summary mismatches and update intent keyword/signals.",
      "Add regression scenarios for failed intent clusters.",
    ],
    citationCoverage: [
      "Run `pnpm run docker:eval:assistant:realworld:stable`.",
      "Patch citation emission for tool success and error paths.",
    ],
    formatCompliance: [
      "Run realworld and postcheck suites, focus on message blocks/table contracts.",
      "Add output-contract checks for missing columns/phrases.",
    ],
    contextCarryAccuracy: [
      "Run postcheck anomaly suite and inspect multi-turn drift scenarios.",
      "Ensure planner + policy + tools share same symbol/date context source.",
    ],
    policySafetyRate: [
      "Run `pnpm run docker:eval:assistant:policy-matrix:stable`.",
      "Block release until policy failures return to threshold.",
    ],
    unsupportedClaimRate: [
      "Audit fallback responses for numeric leakage and missing refusal phrases.",
      "Patch policy bypass and guardrails for unsupported claims.",
    ],
    s1Failures: [
      "Freeze release lane and open incident immediately.",
      "Convert each S1 failure into permanent regression scenario.",
    ],
  };
  return actions[metricId] ?? ["Investigate failing metric and create focused regression scenarios."];
}

function buildMetricRerunCommand(metricId) {
  const map = {
    toolRoutingAccuracy: "pnpm run docker:eval:assistant:routing:stable",
    endpointGroundingAccuracy: "pnpm run docker:eval:assistant:routing:stable",
    intentAccuracy: "pnpm run docker:eval:assistant:routing:stable",
    citationCoverage: "pnpm run docker:eval:assistant:realworld:stable",
    formatCompliance: "pnpm run docker:eval:assistant:realworld:stable",
    contextCarryAccuracy: "pnpm run docker:eval:assistant:postcheck:v1:stable",
    policySafetyRate: "pnpm run docker:eval:assistant:policy-matrix:stable",
    unsupportedClaimRate: "pnpm run docker:eval:assistant:policy-matrix:stable",
    s1Failures: "pnpm run docker:eval:assistant:stable:all",
  };
  return map[metricId] ?? "pnpm run docker:eval:assistant:stable:all";
}

function buildSuiteAction(suiteId) {
  const command = suiteStableCommand(suiteId);
  return [
    `Re-run suite: \`${command}\`.`,
    "Classify failures by auth/config/runtime/assertion and attach report evidence.",
    "Open fix ticket with owner and due date, then re-run gate.",
  ];
}

function dedupeItems(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = `${item.type}|${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function sortByPriority(items) {
  const rank = { P0: 0, P1: 1, P2: 2 };
  return [...items].sort((a, b) => {
    const byPriority = (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
    if (byPriority !== 0) return byPriority;
    return String(a.title).localeCompare(String(b.title));
  });
}

function renderSummary(report) {
  const lines = [];
  lines.push("# Assistant Drift Triage");
  lines.push("");
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Overall status: **${String(report.overallStatus).toUpperCase()}**`);
  lines.push(`- Monitor report: \`${report.monitorReportPath}\``);
  lines.push(`- Stability report: \`${report.stabilityReportPath}\``);
  lines.push("");
  lines.push("## Backlog Summary");
  lines.push(`- Total items: ${report.summary.total}`);
  lines.push(`- P0: ${report.summary.byPriority.P0}`);
  lines.push(`- P1: ${report.summary.byPriority.P1}`);
  lines.push(`- P2: ${report.summary.byPriority.P2}`);
  lines.push("");
  lines.push("## Items");
  for (const item of report.items) {
    lines.push(`- [${item.priority}] ${item.title} | owner=${item.owner} | evidence=${item.evidence}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const cli = parseCli(process.argv.slice(2));
  const monitorReportPath = path.resolve(cli.values.monitor ?? DEFAULT_MONITOR_REPORT_PATH);
  const stabilityReportPath = path.resolve(cli.values.stability ?? DEFAULT_STABILITY_REPORT_PATH);
  const outputPath = path.resolve(cli.values["report-path"] ?? DEFAULT_OUTPUT_PATH);
  const summaryPath = path.resolve(cli.values["summary-path"] ?? DEFAULT_SUMMARY_PATH);
  const failOnP0 = cli.flags.has("fail-on-p0");
  const includeAdvisoryMetrics = cli.flags.has("include-advisory-metrics");

  const monitor = safeReadJson(monitorReportPath);
  const stability = safeReadJson(stabilityReportPath);
  if (!monitor) {
    console.error(`Missing monitor report: ${monitorReportPath}`);
    process.exit(2);
  }

  const items = [];
  let seq = 1;

  for (const gate of monitor.stageGates ?? []) {
    if (gate?.pass === true) continue;
    items.push({
      id: `TRIAGE-${String(seq).padStart(3, "0")}`,
      priority: "P0",
      type: "stage_gate",
      title: `Gate failed: ${gate.name}`,
      owner: "PM + QA",
      dueInDays: 1,
      evidence: String(gate.detail ?? "gate_failed"),
      rerunCommand: "pnpm run docker:eval:assistant:stable:all",
      actions: [
        "Freeze release lane for assistant-related changes.",
        "Re-run affected suites and attach fresh artifacts.",
      ],
    });
    seq += 1;
  }

  for (const metric of monitor.metrics ?? []) {
    if (metric?.status !== "fail") continue;
    const metricId = String(metric.id ?? "unknown_metric");
    const isRequired = metric?.required !== false;
    if (!isRequired && !includeAdvisoryMetrics) continue;
    const priority = isRequired ? priorityFromMetric(metricId) : "P2";
    items.push({
      id: `TRIAGE-${String(seq).padStart(3, "0")}`,
      priority,
      type: isRequired ? "metric" : "metric_advisory",
      title: `${isRequired ? "Metric breach" : "Advisory metric drift"}: ${metricId}`,
      owner: ownerFromMetric(metricId),
      dueInDays: priority === "P0" ? 1 : priority === "P1" ? 3 : 7,
      evidence: `actual=${metric.actual}, threshold=${metric.threshold}, comparator=${metric.comparator}`,
      rerunCommand: buildMetricRerunCommand(metricId),
      actions: buildMetricAction(metricId),
    });
    seq += 1;
  }

  const suiteMap = new Map(
    (Array.isArray(stability?.suites) ? stability.suites : []).map((suite) => [String(suite?.suite ?? "unknown"), suite])
  );

  for (const [suiteId, reportPath] of Object.entries(SUITE_STABILITY_REPORT_HINTS)) {
    const stabilitySnapshot = safeReadJson(path.resolve(reportPath));
    const latestSuite = Array.isArray(stabilitySnapshot?.suites)
      ? stabilitySnapshot.suites.find((suite) => String(suite?.suite ?? "") === suiteId)
      : null;
    if (!latestSuite) continue;

    const currentSuite = suiteMap.get(suiteId);
    const currentTimestamp = toTimestamp(currentSuite?.runAt);
    const latestTimestamp = toTimestamp(latestSuite?.runAt);
    const shouldReplace =
      !currentSuite ||
      (latestTimestamp !== null && currentTimestamp !== null && latestTimestamp > currentTimestamp) ||
      (latestTimestamp !== null && currentTimestamp === null);

    if (shouldReplace) {
      suiteMap.set(suiteId, latestSuite);
    }
  }

  const suiteList = Array.from(suiteMap.values());
  for (const suite of suiteList) {
    const suiteId = String(suite?.suite ?? "unknown");
    if (suite?.summary?.gatePass === true) continue;
    const priority = priorityFromSuite(suite?.summary);
    items.push({
      id: `TRIAGE-${String(seq).padStart(3, "0")}`,
      priority,
      type: "suite",
      title: `Suite unstable: ${suiteId}`,
      owner: ownerFromSuite(suiteId),
      dueInDays: priority === "P0" ? 1 : 3,
      evidence: `flakeRate=${suite?.summary?.flakeRate}, minPassRate=${suite?.summary?.minObservedPassRate}`,
      rerunCommand: suiteStableCommand(suiteId),
      actions: buildSuiteAction(suiteId),
    });
    seq += 1;
  }

  const normalizedItems = sortByPriority(dedupeItems(items));
  const summary = {
    total: normalizedItems.length,
    byPriority: {
      P0: normalizedItems.filter((item) => item.priority === "P0").length,
      P1: normalizedItems.filter((item) => item.priority === "P1").length,
      P2: normalizedItems.filter((item) => item.priority === "P2").length,
    },
  };

  const report = {
    schemaVersion: "assistant-drift-triage-v1-2026-02-20",
    generatedAt: new Date().toISOString(),
    overallStatus: monitor.overallStatus ?? "unknown",
    monitorReportPath,
    stabilityReportPath,
    summary,
    items: normalizedItems,
  };

  writeJson(outputPath, report);
  writeText(summaryPath, renderSummary(report));

  console.log(`DRIFT_TRIAGE_REPORT_PATH=${outputPath}`);
  console.log(`DRIFT_TRIAGE_SUMMARY_PATH=${summaryPath}`);
  console.log(`DRIFT_TRIAGE_ITEMS=${summary.total}`);

  if (failOnP0 && summary.byPriority.P0 > 0) {
    process.exit(1);
  }
}

main();
