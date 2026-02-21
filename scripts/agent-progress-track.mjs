import fs from "node:fs";
import path from "node:path";

const DEFAULT_TRACKER_PATH = "docs/COMPOSER_AGENT_FUNCTION_CALLING_TRACKER_V1.json";
const DEFAULT_PROGRESS_PATH = "docs/PROGRESS.md";
const DEFAULT_REPORT_PATH = "artifacts/composer-agent-progress-report.json";
const DEFAULT_BOARD_PATH = "artifacts/composer-agent-progress-board.md";
const DEFAULT_WEEKLY_PATH = "docs/COMPOSER_AGENT_WEEKLY_STATUS_AUTO.md";
const AUTO_BLOCK_START = "<!-- AGENT_PROGRESS_AUTO_START -->";
const AUTO_BLOCK_END = "<!-- AGENT_PROGRESS_AUTO_END -->";

const VALID_STATUSES = new Set(["todo", "in_progress", "done", "blocked"]);
const STATUS_ORDER = new Map([
  ["blocked", 0],
  ["in_progress", 1],
  ["todo", 2],
  ["done", 3],
]);
const PRIORITY_ORDER = new Map([
  ["P0", 0],
  ["P1", 1],
  ["P2", 2],
  ["P3", 3],
]);

function parseCli(argv) {
  const values = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] ?? "");
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
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
  return { values, positionals };
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toIsoNow() {
  return new Date().toISOString();
}

function toDateOnly(iso) {
  return String(iso).slice(0, 10);
}

function normalizeStatus(raw) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!VALID_STATUSES.has(value)) return null;
  return value;
}

function statusWeight(status) {
  return STATUS_ORDER.has(status) ? Number(STATUS_ORDER.get(status)) : 99;
}

function priorityWeight(priority) {
  return PRIORITY_ORDER.has(priority) ? Number(PRIORITY_ORDER.get(priority)) : 99;
}

function summarizeTracker(tracker) {
  const milestones = Array.isArray(tracker?.milestones) ? tracker.milestones : [];
  const countsByStatus = {
    todo: 0,
    in_progress: 0,
    done: 0,
    blocked: 0,
    unknown: 0,
  };

  for (const milestone of milestones) {
    const status = normalizeStatus(milestone?.status);
    if (!status) {
      countsByStatus.unknown += 1;
      continue;
    }
    countsByStatus[status] += 1;
  }

  const focus = [...milestones]
    .filter((item) => normalizeStatus(item?.status) === "in_progress" || normalizeStatus(item?.status) === "blocked")
    .sort((a, b) => {
      const statusDiff = statusWeight(normalizeStatus(a?.status)) - statusWeight(normalizeStatus(b?.status));
      if (statusDiff !== 0) return statusDiff;
      const priorityDiff = priorityWeight(String(a?.priority ?? "")) - priorityWeight(String(b?.priority ?? ""));
      if (priorityDiff !== 0) return priorityDiff;
      return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
    });

  const doneMilestoneIds = new Set(
    milestones
      .filter((item) => normalizeStatus(item?.status) === "done")
      .map((item) => String(item?.id ?? ""))
  );
  const readyTodo = milestones
    .filter((item) => normalizeStatus(item?.status) === "todo")
    .filter((item) => {
      const dependsOn = Array.isArray(item?.dependsOn) ? item.dependsOn : [];
      if (dependsOn.length === 0) return true;
      return dependsOn.every((dep) => doneMilestoneIds.has(String(dep)));
    })
    .sort((a, b) => {
      const priorityDiff = priorityWeight(String(a?.priority ?? "")) - priorityWeight(String(b?.priority ?? ""));
      if (priorityDiff !== 0) return priorityDiff;
      return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
    });

  const nextActions = buildNextActions(focus, readyTodo);
  return {
    totalMilestones: milestones.length,
    countsByStatus,
    focusMilestones: focus.slice(0, 4).map(toMilestoneSummary),
    readyTodoMilestones: readyTodo.slice(0, 4).map(toMilestoneSummary),
    nextActions,
  };
}

function toMilestoneSummary(milestone) {
  return {
    id: String(milestone?.id ?? ""),
    title: String(milestone?.title ?? ""),
    status: normalizeStatus(milestone?.status) ?? "unknown",
    owner: String(milestone?.owner ?? ""),
    priority: String(milestone?.priority ?? ""),
    phase: String(milestone?.phase ?? ""),
  };
}

function buildNextActions(focus, readyTodo) {
  const actions = [];
  for (const item of focus.slice(0, 3)) {
    const dod = Array.isArray(item?.definitionOfDone) ? item.definitionOfDone : [];
    const firstDod = typeof dod[0] === "string" ? dod[0] : "Close milestone definition of done.";
    actions.push(`Close ${item.id}: ${firstDod}`);
  }
  for (const item of readyTodo.slice(0, 2)) {
    actions.push(`Start ${item.id}: ${String(item?.title ?? "").trim()}`);
  }
  return actions.slice(0, 5);
}

function renderBoard(report) {
  const lines = [];
  lines.push("# Composer Agent Progress Board");
  lines.push("");
  lines.push(`- Generated At: ${report.generatedAt}`);
  lines.push(`- Tracker: \`${report.trackerPath}\``);
  lines.push(`- Updated At: ${report.trackerUpdatedAt}`);
  lines.push("");
  lines.push("## Status Counts");
  lines.push(`- Todo: ${report.summary.countsByStatus.todo}`);
  lines.push(`- In Progress: ${report.summary.countsByStatus.in_progress}`);
  lines.push(`- Done: ${report.summary.countsByStatus.done}`);
  lines.push(`- Blocked: ${report.summary.countsByStatus.blocked}`);
  lines.push("");
  lines.push("## Focus Milestones");
  if (report.summary.focusMilestones.length === 0) {
    lines.push("- None");
  } else {
    for (const item of report.summary.focusMilestones) {
      lines.push(`- ${item.id} [${item.status}] (${item.priority}) - ${item.title}`);
    }
  }
  lines.push("");
  lines.push("## Ready Todo Milestones");
  if (report.summary.readyTodoMilestones.length === 0) {
    lines.push("- None");
  } else {
    for (const item of report.summary.readyTodoMilestones) {
      lines.push(`- ${item.id} (${item.priority}) - ${item.title}`);
    }
  }
  lines.push("");
  lines.push("## Next Actions");
  if (report.summary.nextActions.length === 0) {
    lines.push("- None");
  } else {
    report.summary.nextActions.forEach((action, index) => {
      lines.push(`${index + 1}. ${action}`);
    });
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderWeekly(tracker, report, weekOf) {
  const milestones = Array.isArray(tracker?.milestones) ? tracker.milestones : [];
  const lines = [];
  lines.push("# Composer Agent Weekly Status (Auto)");
  lines.push("");
  lines.push("## Week Of");
  lines.push(`- Date range: ${weekOf}`);
  lines.push("- Owner: Auto Tracker");
  lines.push("");
  lines.push("## Milestone Status Snapshot");
  lines.push("| Milestone ID | Current Status | Owner | Priority | Note |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const item of milestones) {
    lines.push(
      `| ${String(item.id ?? "")} | ${String(item.status ?? "unknown")} | ${String(item.owner ?? "")} | ${String(item.priority ?? "")} | ${String(item.title ?? "")} |`
    );
  }
  lines.push("");
  lines.push("## KPI Signals");
  lines.push(`- Tool call success rate: ${formatSignalValue(milestones, "toolCallSuccessRate")}`);
  lines.push(`- Policy fallback rate: ${formatSignalValue(milestones, "policyFallbackRate")}`);
  lines.push(`- Agent mode request share: ${formatSignalValue(milestones, "agentModeRequestShare")}`);
  lines.push(`- Composer completion rate: ${formatSignalValue(milestones, "composerCompletionRate")}`);
  lines.push("");
  lines.push("## Next Week Commitments (Auto)");
  if (report.summary.nextActions.length === 0) {
    lines.push("1. No commitment inferred.");
  } else {
    report.summary.nextActions.forEach((action, index) => {
      lines.push(`${index + 1}. ${action}`);
    });
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function formatSignalValue(milestones, signalName) {
  for (const milestone of milestones) {
    const value = milestone?.signals?.[signalName];
    if (value === null || value === undefined) continue;
    return String(value);
  }
  return "n/a";
}

function buildProgressAutoBlock(report) {
  const lines = [];
  lines.push(AUTO_BLOCK_START);
  lines.push("## Composer Agent Auto Sync");
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Tracker Updated At: ${report.trackerUpdatedAt}`);
  lines.push(`- Status: todo=${report.summary.countsByStatus.todo}, in_progress=${report.summary.countsByStatus.in_progress}, done=${report.summary.countsByStatus.done}, blocked=${report.summary.countsByStatus.blocked}`);
  lines.push("- Next Actions:");
  if (report.summary.nextActions.length === 0) {
    lines.push("  - None");
  } else {
    for (const action of report.summary.nextActions) {
      lines.push(`  - ${action}`);
    }
  }
  lines.push(AUTO_BLOCK_END);
  return `${lines.join("\n")}\n`;
}

function upsertProgressAutoBlock(progressPath, blockText) {
  const existing = fs.existsSync(progressPath) ? fs.readFileSync(progressPath, "utf8") : "# QuantVN Pro Features Progress\n\n";
  const startIndex = existing.indexOf(AUTO_BLOCK_START);
  const endIndex = existing.indexOf(AUTO_BLOCK_END);
  if (startIndex >= 0 && endIndex > startIndex) {
    const head = existing.slice(0, startIndex);
    const tail = existing.slice(endIndex + AUTO_BLOCK_END.length);
    const normalizedTail = tail.startsWith("\n") ? tail.slice(1) : tail;
    return `${head}${blockText}\n${normalizedTail}`.replace(/\n{3,}/g, "\n\n");
  }

  const lines = existing.split("\n");
  const insertIndex = lines.findIndex((line, index) => index > 0 && line.startsWith("## "));
  if (insertIndex === -1) {
    return `${existing.trimEnd()}\n\n${blockText}`.replace(/\n{3,}/g, "\n\n");
  }
  const before = lines.slice(0, insertIndex).join("\n");
  const after = lines.slice(insertIndex).join("\n");
  return `${before}\n\n${blockText}\n${after}`.replace(/\n{3,}/g, "\n\n");
}

function buildReport(trackerPath, tracker) {
  const generatedAt = toIsoNow();
  const summary = summarizeTracker(tracker);
  return {
    generatedAt,
    trackerPath: path.resolve(trackerPath),
    trackerUpdatedAt: String(tracker?.updatedAt ?? "unknown"),
    summary,
  };
}

function setMilestoneStatus({ trackerPath, milestoneId, nextStatus, note, actor, timestamp, dryRun }) {
  const tracker = readJson(trackerPath);
  const milestones = Array.isArray(tracker?.milestones) ? tracker.milestones : [];
  const target = milestones.find((item) => String(item?.id ?? "") === milestoneId);
  if (!target) {
    throw new Error(`Milestone not found: ${milestoneId}`);
  }

  const previousStatus = normalizeStatus(target.status) ?? "unknown";
  target.status = nextStatus;
  if (!Array.isArray(target.statusHistory)) {
    target.statusHistory = [];
  }
  target.statusHistory.push({
    from: previousStatus,
    to: nextStatus,
    changedAt: timestamp,
    note: note || "",
    actor: actor || "agent-progress-track",
  });
  tracker.updatedAt = toDateOnly(timestamp);

  if (!dryRun) {
    writeJson(trackerPath, tracker);
  }

  return tracker;
}

function runSync(cli) {
  const trackerPath = path.resolve(cli.values.tracker ?? DEFAULT_TRACKER_PATH);
  const progressPath = path.resolve(cli.values.progress ?? DEFAULT_PROGRESS_PATH);
  const reportPath = path.resolve(cli.values["report-path"] ?? DEFAULT_REPORT_PATH);
  const boardPath = path.resolve(cli.values["board-path"] ?? DEFAULT_BOARD_PATH);
  const weeklyPath = path.resolve(cli.values["weekly-path"] ?? DEFAULT_WEEKLY_PATH);
  const tracker = readJson(trackerPath);
  const report = buildReport(trackerPath, tracker);
  const board = renderBoard(report);
  const weekly = renderWeekly(tracker, report, toDateOnly(report.generatedAt));
  const progressBlock = buildProgressAutoBlock(report);
  const nextProgressContent = upsertProgressAutoBlock(progressPath, progressBlock);
  const dryRun = String(cli.values["dry-run"] ?? "false").toLowerCase() === "true";

  if (!dryRun) {
    writeJson(reportPath, report);
    writeText(boardPath, board);
    writeText(weeklyPath, weekly);
    writeText(progressPath, nextProgressContent);
  }

  console.log(`TRACKER_PATH=${trackerPath}`);
  console.log(`PROGRESS_PATH=${progressPath}`);
  console.log(`REPORT_PATH=${reportPath}`);
  console.log(`BOARD_PATH=${boardPath}`);
  console.log(`WEEKLY_PATH=${weeklyPath}`);
  console.log(`SUMMARY_STATUS=${JSON.stringify(report.summary.countsByStatus)}`);
}

function runSetStatus(cli) {
  const trackerPath = path.resolve(cli.values.tracker ?? DEFAULT_TRACKER_PATH);
  const milestoneId = String(cli.values.id ?? "").trim();
  const nextStatus = normalizeStatus(cli.values.status);
  const note = String(cli.values.note ?? "").trim();
  const actor = String(cli.values.actor ?? "").trim();
  const timestamp = String(cli.values.timestamp ?? "").trim() || toIsoNow();
  const dryRun = String(cli.values["dry-run"] ?? "false").toLowerCase() === "true";

  if (!milestoneId) {
    throw new Error("Missing required --id for set-status.");
  }
  if (!nextStatus) {
    throw new Error("Missing/invalid --status. Use todo|in_progress|done|blocked.");
  }

  setMilestoneStatus({
    trackerPath,
    milestoneId,
    nextStatus,
    note,
    actor,
    timestamp,
    dryRun,
  });

  runSync({
    values: {
      ...cli.values,
      tracker: trackerPath,
      "dry-run": String(dryRun),
    },
  });
}

function runWeekly(cli) {
  const trackerPath = path.resolve(cli.values.tracker ?? DEFAULT_TRACKER_PATH);
  const weeklyPath = path.resolve(cli.values["weekly-path"] ?? DEFAULT_WEEKLY_PATH);
  const tracker = readJson(trackerPath);
  const report = buildReport(trackerPath, tracker);
  const weekOf = String(cli.values["week-of"] ?? toDateOnly(report.generatedAt));
  const weekly = renderWeekly(tracker, report, weekOf);
  const dryRun = String(cli.values["dry-run"] ?? "false").toLowerCase() === "true";
  if (!dryRun) {
    writeText(weeklyPath, weekly);
  }
  console.log(`WEEKLY_PATH=${weeklyPath}`);
}

function main() {
  const cli = parseCli(process.argv.slice(2));
  const command = String(cli.positionals[0] ?? "sync").trim().toLowerCase();

  if (command === "sync") {
    runSync(cli);
    return;
  }
  if (command === "set-status") {
    runSetStatus(cli);
    return;
  }
  if (command === "weekly") {
    runWeekly(cli);
    return;
  }

  throw new Error(`Unsupported command: ${command}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`agent-progress-track failed: ${message}`);
  process.exit(1);
}

