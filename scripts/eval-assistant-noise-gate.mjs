#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const REPORT_PATH = process.env.ASSISTANT_EVAL_REPORT_PATH ?? "artifacts/assistant-noise-gate-report.json";
const IS_DOCKER_RUNTIME = fs.existsSync("/.dockerenv");
const DEFAULT_ASSISTANT_BASE_URL =
  process.env.ASSISTANT_EVAL_BASE_URL
  ?? process.env.SMOKE_BASE_URL
  ?? (IS_DOCKER_RUNTIME ? "http://127.0.0.1:3000" : "http://localhost:3010");

const SUITES = [
  {
    id: "ohlcv_stress",
    script: "scripts/eval-assistant-ohlcv-stress.mjs",
    reportPath: "artifacts/assistant-ohlcv-stress-report.json",
  },
  {
    id: "ohlcv_combo_noise",
    script: "scripts/eval-assistant-ohlcv-combo-noise.mjs",
    reportPath: "artifacts/assistant-ohlcv-combo-noise-report.json",
  },
  {
    id: "fundamentals_hyper_noise",
    script: "scripts/eval-assistant-fundamentals-hyper-noise-matrix.mjs",
    reportPath: "artifacts/assistant-fundamentals-hyper-noise-report.json",
  },
];

function ensureDirFor(filePath) {
  const dir = path.dirname(path.resolve(ROOT, filePath));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function runSuite(suite) {
  const startedAt = Date.now();
  const child = spawnSync(
    process.execPath,
    [suite.script],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        ASSISTANT_EVAL_BASE_URL: DEFAULT_ASSISTANT_BASE_URL,
        ASSISTANT_EVAL_REPORT_PATH: suite.reportPath,
      },
    }
  );
  return {
    id: suite.id,
    script: suite.script,
    reportPath: suite.reportPath,
    exitCode: child.status ?? 1,
    signal: child.signal ?? null,
    durationMs: Date.now() - startedAt,
    pass: child.status === 0,
  };
}

function main() {
  const startedAt = Date.now();
  const results = SUITES.map((suite) => runSuite(suite));
  const failed = results.filter((item) => !item.pass);
  const report = {
    runAt: new Date().toISOString(),
    totalSuites: results.length,
    passedSuites: results.length - failed.length,
    failedSuites: failed.length,
    passRate: results.length > 0 ? (results.length - failed.length) / results.length : 0,
    gatePass: failed.length === 0,
    durationMs: Date.now() - startedAt,
    results,
  };

  ensureDirFor(REPORT_PATH);
  fs.writeFileSync(path.resolve(ROOT, REPORT_PATH), JSON.stringify(report, null, 2), "utf8");
  console.log(`REPORT_PATH=${path.resolve(ROOT, REPORT_PATH)}`);
  console.log(JSON.stringify(report));

  if (!report.gatePass) process.exit(1);
}

main();
