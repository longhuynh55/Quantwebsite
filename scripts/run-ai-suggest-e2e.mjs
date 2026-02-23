#!/usr/bin/env node

import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = {
    mode: "mock",
    baseUrl: process.env.E2E_BASE_URL || "http://localhost:3010",
    project: "chromium",
    outputDir: "",
    extra: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--mode" && argv[i + 1]) {
      args.mode = String(argv[i + 1]).trim().toLowerCase();
      i += 1;
      continue;
    }
    if (token === "--base-url" && argv[i + 1]) {
      args.baseUrl = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (token === "--project" && argv[i + 1]) {
      args.project = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (token === "--output-dir" && argv[i + 1]) {
      args.outputDir = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    args.extra.push(token);
  }

  if (args.mode !== "mock" && args.mode !== "real") {
    throw new Error(`Invalid --mode "${args.mode}". Use "mock" or "real".`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = { ...process.env };
  env.PW_SKIP_WEBSERVER = "true";
  env.E2E_BASE_URL = args.baseUrl;
  env.E2E_AI_SUGGEST_MODE = args.mode;
  env.PW_OUTPUT_DIR = args.outputDir || `.pw-out-ai-suggest-${args.mode}-${Date.now()}-${process.pid}`;

  const cmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const cmdArgs = [
    "exec",
    "playwright",
    "test",
    "e2e/strategy-builder.ai-suggest.spec.ts",
    `--project=${args.project}`,
    ...args.extra,
  ];

  const result = spawnSync(cmd, cmdArgs, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(`[run-ai-suggest-e2e] spawn failed: ${result.error.message}`);
    process.exit(1);
  }

  if (result.signal) {
    console.error(`[run-ai-suggest-e2e] terminated by signal: ${result.signal}`);
    process.exit(1);
  }

  if (typeof result.status === "number") {
    process.exit(result.status);
  }

  process.exit(1);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[run-ai-suggest-e2e] ${message}`);
  process.exit(1);
}
