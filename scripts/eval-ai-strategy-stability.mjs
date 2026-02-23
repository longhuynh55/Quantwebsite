#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.AI_STRATEGY_BASE_URL || "http://localhost:3010",
    endpoint: "/api/ai/generate-strategy",
    runs: Number.parseInt(process.env.AI_STRATEGY_STABILITY_RUNS || "20", 10),
    timeoutMs: Number.parseInt(process.env.AI_STRATEGY_TIMEOUT_MS || "120000", 10),
    prompt:
      process.env.AI_STRATEGY_PROMPT ||
      "Tao chien luoc rat ngan gon, toi da 4 node, khong giai thich dai, chi thong so can thiet cho VNM",
    maxFailureRate: Number.parseFloat(process.env.AI_STRATEGY_MAX_FAILURE_RATE || "0.05"),
    maxParseFailureRate: Number.parseFloat(process.env.AI_STRATEGY_MAX_PARSE_FAILURE_RATE || "0.02"),
    reportPath: process.env.AI_STRATEGY_REPORT_PATH || "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--base-url" && argv[i + 1]) {
      args.baseUrl = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (token === "--endpoint" && argv[i + 1]) {
      args.endpoint = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (token === "--runs" && argv[i + 1]) {
      args.runs = Number.parseInt(String(argv[i + 1]).trim(), 10);
      i += 1;
      continue;
    }
    if (token === "--timeout-ms" && argv[i + 1]) {
      args.timeoutMs = Number.parseInt(String(argv[i + 1]).trim(), 10);
      i += 1;
      continue;
    }
    if (token === "--prompt" && argv[i + 1]) {
      args.prompt = String(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--max-failure-rate" && argv[i + 1]) {
      args.maxFailureRate = Number.parseFloat(String(argv[i + 1]).trim());
      i += 1;
      continue;
    }
    if (token === "--max-parse-failure-rate" && argv[i + 1]) {
      args.maxParseFailureRate = Number.parseFloat(String(argv[i + 1]).trim());
      i += 1;
      continue;
    }
    if (token === "--report" && argv[i + 1]) {
      args.reportPath = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
  }

  if (!Number.isFinite(args.runs) || args.runs <= 0) {
    throw new Error(`Invalid runs value: ${args.runs}`);
  }
  return args;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

async function requestOnce(url, prompt, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - started;
    const bodyText = await response.text();
    let body = null;
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = null;
    }

    if (response.ok && body?.success) {
      return {
        ok: true,
        latencyMs,
        providerUsed: body.providerUsed || "",
        nodes: Array.isArray(body?.strategy?.nodes) ? body.strategy.nodes.length : 0,
        edges: Array.isArray(body?.strategy?.edges) ? body.strategy.edges.length : 0,
        parseFail: false,
        error: "",
      };
    }

    const errorText = bodyText || `HTTP ${response.status}`;
    return {
      ok: false,
      latencyMs,
      providerUsed: body?.providerUsed || "",
      nodes: 0,
      edges: 0,
      parseFail: errorText.includes("Failed to parse strategy"),
      error: errorText.slice(0, 600),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      latencyMs: Date.now() - started,
      providerUsed: "",
      nodes: 0,
      edges: 0,
      parseFail: message.includes("Failed to parse strategy"),
      error: message.slice(0, 600),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = `${args.baseUrl.replace(/\/+$/, "")}${args.endpoint.startsWith("/") ? args.endpoint : `/${args.endpoint}`}`;

  const runs = [];
  for (let i = 1; i <= args.runs; i += 1) {
    const run = await requestOnce(url, args.prompt, args.timeoutMs);
    runs.push({ run: i, ...run });
  }

  const successCount = runs.filter((run) => run.ok).length;
  const failureCount = runs.length - successCount;
  const parseFailCount = runs.filter((run) => run.parseFail).length;
  const failureRate = failureCount / runs.length;
  const parseFailureRate = parseFailCount / runs.length;
  const latencies = runs.filter((run) => run.ok).map((run) => run.latencyMs);
  const latencyP95 = percentile(latencies, 95);

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: args.baseUrl,
    endpoint: args.endpoint,
    runs: args.runs,
    thresholds: {
      maxFailureRate: args.maxFailureRate,
      maxParseFailureRate: args.maxParseFailureRate,
    },
    summary: {
      successCount,
      failureCount,
      parseFailCount,
      failureRate,
      parseFailureRate,
      latencyP95,
    },
    details: runs,
  };

  if (args.reportPath) {
    const outPath = path.resolve(args.reportPath);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
  }

  console.log(JSON.stringify(report.summary, null, 2));

  if (failureRate > args.maxFailureRate) {
    console.error(
      `[eval-ai-strategy-stability] failure rate ${failureRate.toFixed(4)} exceeded ${args.maxFailureRate.toFixed(4)}`
    );
    process.exit(1);
  }
  if (parseFailureRate > args.maxParseFailureRate) {
    console.error(
      `[eval-ai-strategy-stability] parse failure rate ${parseFailureRate.toFixed(4)} exceeded ${args.maxParseFailureRate.toFixed(4)}`
    );
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[eval-ai-strategy-stability] ${message}`);
  process.exit(1);
});

