import fs from "node:fs";
import path from "node:path";

const DEFAULT_STABILITY_DIR = "artifacts/stability";
const DEFAULT_CRITERIA_PATH = "docs/assistant-realworld-drift-criteria-v1.json";
const DEFAULT_OUTPUT_PATH = "artifacts/assistant-drift-baseline-report.json";
const DEFAULT_SUMMARY_PATH = "artifacts/assistant-drift-baseline-summary.md";
const DEFAULT_WINDOW_DAYS = 14;

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

function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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

function safeReadJson(filePath) {
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function collectRoundFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const results = [];
  const queue = [rootDir];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!/-round-\d+\.json$/i.test(entry.name)) continue;
      results.push(fullPath);
    }
  }
  return results;
}

function parseTimestamp(value) {
  if (!value) return null;
  const time = Date.parse(String(value));
  return Number.isFinite(time) ? time : null;
}

function quantile(values, q) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[index];
}

function mean(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const total = values.reduce((acc, item) => acc + item, 0);
  return total / values.length;
}

function parsePolicyCounts(policyStatuses) {
  if (!Array.isArray(policyStatuses) || policyStatuses.length === 0) return null;
  let total = 0;
  let shadow = 0;
  for (const item of policyStatuses) {
    const detail = String(item?.detail ?? "");
    const match = /count=(\d+)/i.exec(detail);
    const count = match ? Number(match[1]) : 0;
    if (!Number.isFinite(count) || count <= 0) continue;
    total += count;
    if (String(item?.status ?? "").toLowerCase() === "shadow_blocked") {
      shadow += count;
    }
  }
  if (total <= 0) return null;
  return shadow / total;
}

function addSample(pool, key, value) {
  const numeric = toNumber(value);
  if (numeric === null) return;
  if (!pool[key]) pool[key] = [];
  pool[key].push(numeric);
}

function extractContextCarryRate(categoryMetrics) {
  if (!categoryMetrics || typeof categoryMetrics !== "object") return null;
  const entries = Object.entries(categoryMetrics);
  let totalTurns = 0;
  let passedTurns = 0;
  for (const [category, stats] of entries) {
    const normalized = String(category).toLowerCase();
    if (!normalized.includes("multi") || !normalized.includes("turn")) continue;
    const total = toNumber(stats?.totalTurns);
    const passed = toNumber(stats?.passedTurns);
    if (total === null || passed === null || total <= 0) continue;
    totalTurns += total;
    passedTurns += passed;
  }
  if (totalTurns <= 0) return null;
  return passedTurns / totalTurns;
}

function metricSpec() {
  return {
    intentPassRate: { direction: "high" },
    toolPassRate: { direction: "high" },
    endpointPassRate: { direction: "high" },
    policyPassRate: { direction: "high" },
    citationPassRate: { direction: "high" },
    realworldCitationCoveragePercent: { direction: "high" },
    contextCarryAccuracy: { direction: "high" },
    latencyP95Ms: { direction: "low" },
    flakeRate: { direction: "low" },
    shadowBlockedShare: { direction: "low" },
  };
}

function buildStats(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const p05 = quantile(values, 0.05);
  const p10 = quantile(values, 0.1);
  const p50 = quantile(values, 0.5);
  const p90 = quantile(values, 0.9);
  const p95 = quantile(values, 0.95);
  const avg = mean(values);
  return {
    count: values.length,
    min: round(min, 6),
    max: round(max, 6),
    p05: round(p05, 6),
    p10: round(p10, 6),
    p50: round(p50, 6),
    p90: round(p90, 6),
    p95: round(p95, 6),
    mean: round(avg, 6),
  };
}

function recommendThreshold(metricId, stats, spec) {
  if (!stats) return null;
  const direction = spec.direction;
  if (direction === "high") {
    const baseline = stats.p50;
    const warnCandidate = Math.min(stats.p10, baseline - 0.01);
    const warnBelow = Math.max(0, round(warnCandidate, 6));
    const criticalCandidate = Math.min(stats.p05, warnBelow - 0.02);
    const criticalBelow = Math.max(0, round(criticalCandidate, 6));
    return { baseline, warnBelow, criticalBelow };
  }
  if (metricId === "flakeRate") {
    const baseline = stats.p50;
    const warnAbove = Math.max(0.01, round(Math.max(stats.p90, baseline + 0.02), 6));
    const criticalAbove = Math.max(0.05, round(Math.max(stats.p95, warnAbove + 0.03), 6));
    return { baseline, warnAbove, criticalAbove };
  }
  const baseline = stats.p50;
  const warnAbove = round(Math.max(stats.p90, baseline * 1.15), 6);
  const criticalAbove = round(Math.max(stats.p95, warnAbove * 1.2), 6);
  return { baseline, warnAbove, criticalAbove };
}

function readCurrentThreshold(metricId, criteria) {
  const drift = criteria?.driftThresholds?.[metricId];
  if (!drift || typeof drift !== "object") return null;
  return drift;
}

function formatSummary(report) {
  const lines = [];
  lines.push("# Assistant Drift Baseline Calibration");
  lines.push("");
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Window days: ${report.windowDays}`);
  lines.push(`- Round files scanned: ${report.roundFilesScanned}`);
  lines.push(`- Round files used: ${report.roundFilesUsed}`);
  lines.push(`- Criteria: \`${report.criteriaPath}\``);
  lines.push("");
  lines.push("## Metrics");
  for (const metric of report.metrics) {
    const stats = metric.stats;
    if (!stats) {
      lines.push(`- ${metric.id}: no samples`);
      continue;
    }
    lines.push(
      `- ${metric.id}: n=${stats.count}, p50=${stats.p50}, p90=${stats.p90}, p95=${stats.p95}, recommendation=${JSON.stringify(metric.recommendation)}`
    );
  }
  lines.push("");
  lines.push("## Notes");
  if (!Array.isArray(report.notes) || report.notes.length === 0) {
    lines.push("- none");
  } else {
    for (const note of report.notes) {
      lines.push(`- ${note}`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function isHealthyRound(report) {
  const overall = String(report?.overallStatus ?? "").toLowerCase();
  if (overall && overall !== "pass") return false;
  const turnPassRate = toNumber(report?.turnPassRate);
  if (turnPassRate !== null && turnPassRate < 0.9) return false;
  const passRate = toNumber(report?.passRate);
  if (passRate !== null && passRate < 0.9) return false;
  return true;
}

function main() {
  const cli = parseCli(process.argv.slice(2));
  const stabilityDir = path.resolve(cli["stability-dir"] ?? DEFAULT_STABILITY_DIR);
  const criteriaPath = path.resolve(cli.criteria ?? DEFAULT_CRITERIA_PATH);
  const outputPath = path.resolve(cli["report-path"] ?? DEFAULT_OUTPUT_PATH);
  const summaryPath = path.resolve(cli["summary-path"] ?? DEFAULT_SUMMARY_PATH);
  const windowDays = Math.max(1, Math.floor(toNumber(cli["window-days"]) ?? DEFAULT_WINDOW_DAYS));
  const cutoffMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;

  const criteria = safeReadJson(criteriaPath) ?? {};
  const roundFiles = collectRoundFiles(stabilityDir);
  const samplePool = {};
  const suiteCounts = {};
  let usedFiles = 0;
  let skippedUnhealthy = 0;

  for (const filePath of roundFiles) {
    const report = safeReadJson(filePath);
    if (!report) continue;
    const timestamp = parseTimestamp(report.runAt) ?? parseTimestamp(report.generatedAt) ?? fs.statSync(filePath).mtimeMs;
    if (timestamp < cutoffMs) continue;
    if (!isHealthyRound(report)) {
      skippedUnhealthy += 1;
      continue;
    }
    usedFiles += 1;

    const suite = path.basename(path.dirname(filePath));
    suiteCounts[suite] = (suiteCounts[suite] ?? 0) + 1;

    addSample(samplePool, "toolPassRate", report?.routingChecks?.tool?.passRate);
    addSample(samplePool, "endpointPassRate", report?.routingChecks?.endpoint?.passRate);
    addSample(samplePool, "intentPassRate", report?.routingChecks?.intent?.passRate);
    addSample(samplePool, "policyPassRate", report?.routingChecks?.policy?.passRate);
    addSample(samplePool, "citationPassRate", report?.routingChecks?.citation?.passRate ?? report?.rates?.citationPassRate);
    addSample(samplePool, "realworldCitationCoveragePercent", report?.citationCoverage?.coveragePercent);
    addSample(samplePool, "latencyP95Ms", report?.performance?.latencyMs?.p95 ?? report?.latency?.p95Ms ?? report?.latencyPercentiles?.p90Ms);
    addSample(samplePool, "contextCarryAccuracy", extractContextCarryRate(report?.categoryMetrics));
    addSample(samplePool, "policyPassRate", report?.rates?.policyPassRate);

    const shadowShare = parsePolicyCounts(report?.policyStatuses);
    addSample(samplePool, "shadowBlockedShare", shadowShare);
  }

  const stabilityReport = safeReadJson(path.resolve("artifacts/assistant-stability-report.json"));
  if (stabilityReport && Array.isArray(stabilityReport.suites)) {
    for (const suite of stabilityReport.suites) {
      if (suite?.summary?.gatePass !== true) continue;
      addSample(samplePool, "flakeRate", suite?.summary?.flakeRate);
    }
  }

  const specs = metricSpec();
  const metrics = [];
  for (const [metricId, spec] of Object.entries(specs)) {
    const values = Array.isArray(samplePool[metricId]) ? samplePool[metricId] : [];
    const stats = buildStats(values);
    const recommendation = stats ? recommendThreshold(metricId, stats, spec) : null;
    const current = readCurrentThreshold(metricId, criteria);
    metrics.push({
      id: metricId,
      direction: spec.direction,
      stats,
      recommendation,
      currentThreshold: current,
    });
  }

  const notes = [];
  if (usedFiles === 0) {
    notes.push("No round files found in selected time window; calibration is based on zero samples.");
  }
  if (skippedUnhealthy > 0) {
    notes.push(`Skipped ${skippedUnhealthy} unhealthy rounds (failed/low-pass) to avoid contaminating baseline.`);
  }
  if (!stabilityReport) {
    notes.push("Missing artifacts/assistant-stability-report.json; flake baseline may be incomplete.");
  }

  const report = {
    schemaVersion: "assistant-drift-baseline-v1-2026-02-20",
    generatedAt: new Date().toISOString(),
    windowDays,
    criteriaPath,
    stabilityDir,
    roundFilesScanned: roundFiles.length,
    roundFilesUsed: usedFiles,
    roundFilesSkippedUnhealthy: skippedUnhealthy,
    suiteCounts,
    metrics,
    notes,
  };

  writeJson(outputPath, report);
  writeText(summaryPath, formatSummary(report));

  console.log(`DRIFT_BASELINE_REPORT_PATH=${outputPath}`);
  console.log(`DRIFT_BASELINE_SUMMARY_PATH=${summaryPath}`);
  console.log(`DRIFT_BASELINE_SAMPLES=${usedFiles}`);
}

main();
