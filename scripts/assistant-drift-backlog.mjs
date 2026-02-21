import fs from "node:fs";
import path from "node:path";

const DEFAULT_TRIAGE_PATH = "artifacts/assistant-drift-triage-report.json";
const DEFAULT_MONITOR_PATH = "artifacts/assistant-governance-monitor-report.json";
const DEFAULT_STABILITY_PATH = "artifacts/assistant-stability-report.json";
const DEFAULT_OUTPUT_PATH = "artifacts/assistant-drift-backlog-report.json";
const DEFAULT_BOARD_PATH = "artifacts/assistant-drift-backlog-board.md";

function parseCli(argv) {
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
    values[raw] = "true";
  }
  return values;
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

function inferSuiteId(title) {
  const match = /^Suite unstable:\s*(.+)$/i.exec(String(title ?? ""));
  return match ? match[1].trim() : null;
}

function inferMetricId(title) {
  const match = /^Metric breach:\s*(.+)$/i.exec(String(title ?? ""));
  return match ? match[1].trim() : null;
}

function closeCriteriaForItem(item) {
  const type = String(item?.type ?? "");
  if (type === "stage_gate") {
    return [
      "Stage gate appears as pass in `artifacts/assistant-governance-monitor-report.json`.",
      "All impacted nightly suites are gate-pass in `artifacts/assistant-stability-report.json`.",
      "Release freeze is lifted by PM sign-off.",
    ];
  }
  if (type === "metric") {
    const metricId = inferMetricId(item?.title) ?? "metric";
    return [
      `Metric \`${metricId}\` status is \`pass\` in \`artifacts/assistant-governance-monitor-report.json\`.`,
      "No new S1 failures are introduced after fix.",
      "Associated rerun command exits with code 0.",
    ];
  }
  if (type === "suite") {
    const suiteId = inferSuiteId(item?.title) ?? "suite";
    return [
      `Suite \`${suiteId}\` has \`gatePass=true\` in \`artifacts/assistant-stability-report.json\`.`,
      "Flake rate is within suite threshold.",
      "Canonical round report contains zero failed turns/cases.",
    ];
  }
  return [
    "Issue is resolved and revalidated by monitor.",
    "Evidence artifacts are attached.",
  ];
}

function classifyPhase(priority) {
  if (priority === "P0") return "Containment";
  if (priority === "P1") return "Stabilization";
  return "Optimization";
}

function buildBoard(report) {
  const lines = [];
  lines.push("# Assistant Drift Backlog Board");
  lines.push("");
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Source triage: \`${report.triageReportPath}\``);
  lines.push(`- Overall status: **${String(report.overallStatus).toUpperCase()}**`);
  lines.push(`- Total backlog items: ${report.summary.total}`);
  lines.push("");
  lines.push("## Board");
  lines.push("| ID | Priority | Phase | Owner | Title | Status | Rerun |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const item of report.items) {
    lines.push(
      `| ${item.backlogId} | ${item.priority} | ${item.phase} | ${item.owner} | ${item.title} | ${item.status} | \`${item.rerunCommand}\` |`
    );
  }
  lines.push("");
  lines.push("## Done Criteria");
  for (const item of report.items) {
    lines.push(`- ${item.backlogId} (${item.title})`);
    for (const criterion of item.closeCriteria) {
      lines.push(`  - ${criterion}`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const cli = parseCli(process.argv.slice(2));
  const triageReportPath = path.resolve(cli.triage ?? DEFAULT_TRIAGE_PATH);
  const monitorReportPath = path.resolve(cli.monitor ?? DEFAULT_MONITOR_PATH);
  const stabilityReportPath = path.resolve(cli.stability ?? DEFAULT_STABILITY_PATH);
  const outputPath = path.resolve(cli["report-path"] ?? DEFAULT_OUTPUT_PATH);
  const boardPath = path.resolve(cli["board-path"] ?? DEFAULT_BOARD_PATH);

  const triage = safeReadJson(triageReportPath);
  if (!triage) {
    console.error(`Missing triage report: ${triageReportPath}`);
    process.exit(2);
  }
  const monitor = safeReadJson(monitorReportPath);
  const stability = safeReadJson(stabilityReportPath);

  const triageItems = Array.isArray(triage.items) ? triage.items : [];
  const backlogItems = triageItems.map((item, index) => {
    const backlogId = `BACKLOG-${String(index + 1).padStart(3, "0")}`;
    const priority = String(item.priority ?? "P2");
    const phase = classifyPhase(priority);
    return {
      backlogId,
      sourceTriageId: item.id ?? null,
      priority,
      phase,
      type: item.type ?? "unknown",
      title: item.title ?? "Untitled",
      owner: item.owner ?? "PM",
      dueInDays: item.dueInDays ?? (priority === "P0" ? 1 : 3),
      status: "open",
      evidence: item.evidence ?? "",
      rerunCommand: item.rerunCommand ?? "pnpm run docker:eval:assistant:stable:all",
      actions: Array.isArray(item.actions) ? item.actions : [],
      closeCriteria: closeCriteriaForItem(item),
      createdAt: new Date().toISOString(),
    };
  });

  const summary = {
    total: backlogItems.length,
    byPriority: {
      P0: backlogItems.filter((item) => item.priority === "P0").length,
      P1: backlogItems.filter((item) => item.priority === "P1").length,
      P2: backlogItems.filter((item) => item.priority === "P2").length,
    },
    byOwner: Object.fromEntries(
      [...new Set(backlogItems.map((item) => item.owner))]
        .sort((a, b) => a.localeCompare(b))
        .map((owner) => [owner, backlogItems.filter((item) => item.owner === owner).length])
    ),
  };

  const report = {
    schemaVersion: "assistant-drift-backlog-v1-2026-02-20",
    generatedAt: new Date().toISOString(),
    overallStatus: triage.overallStatus ?? "unknown",
    triageReportPath,
    monitorReportPath,
    stabilityReportPath,
    triageSnapshot: {
      summary: triage.summary ?? null,
      generatedAt: triage.generatedAt ?? null,
    },
    monitorSnapshot: monitor
      ? {
          overallStatus: monitor.overallStatus ?? null,
          failedStageGates: (monitor.stageGates ?? []).filter((gate) => gate?.pass === false).map((gate) => gate.name),
          failedMetrics: (monitor.metrics ?? []).filter((metric) => metric?.status === "fail").map((metric) => metric.id),
        }
      : null,
    stabilitySnapshot: stability
      ? {
          overallStatus: stability.overallStatus ?? null,
          failedSuites: (stability.suites ?? [])
            .filter((suite) => suite?.summary?.gatePass === false)
            .map((suite) => suite?.suite),
        }
      : null,
    summary,
    items: backlogItems,
  };

  writeJson(outputPath, report);
  writeText(boardPath, buildBoard(report));

  console.log(`DRIFT_BACKLOG_REPORT_PATH=${outputPath}`);
  console.log(`DRIFT_BACKLOG_BOARD_PATH=${boardPath}`);
  console.log(`DRIFT_BACKLOG_ITEMS=${summary.total}`);
}

main();
