#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_STEP_DELAY_MS = 1500;
const DEFAULT_IDLE_DELAY_MS = 3500;
const DEFAULT_ERROR_DELAY_MS = 5000;

function parsePositiveInt(raw, fallback) {
  const parsed = Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function buildWorkerId() {
  const explicit = String(process.env.STRATEGY_LAB_WORKER_ID ?? "").trim();
  if (explicit) return explicit;
  const host = String(process.env.HOSTNAME ?? "local");
  return `sl-worker-${host}-${process.pid}`;
}

function normalizeBaseUrl(raw) {
  const value = String(raw ?? DEFAULT_BASE_URL).trim();
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

const args = new Set(process.argv.slice(2).map((token) => token.trim().toLowerCase()));
const runOnce = args.has("--once") || String(process.env.STRATEGY_LAB_WORKER_ONCE ?? "").trim() === "1";

const baseUrl = normalizeBaseUrl(process.env.STRATEGY_LAB_WORKER_BASE_URL);
const endpoint = `${baseUrl}/api/strategy-lab/worker/tick`;
const workerId = buildWorkerId();
const queueName = String(process.env.STRATEGY_LAB_WORKER_QUEUE ?? "").trim() || undefined;
const leaseMs = parsePositiveInt(process.env.STRATEGY_LAB_WORKER_LEASE_MS, undefined);
const heartbeatMs = parsePositiveInt(process.env.STRATEGY_LAB_WORKER_HEARTBEAT_MS, undefined);
const stepDelayMs = parsePositiveInt(process.env.STRATEGY_LAB_WORKER_STEP_DELAY_MS, DEFAULT_STEP_DELAY_MS);
const idleDelayMs = parsePositiveInt(process.env.STRATEGY_LAB_WORKER_IDLE_DELAY_MS, DEFAULT_IDLE_DELAY_MS);
const errorDelayMs = parsePositiveInt(process.env.STRATEGY_LAB_WORKER_ERROR_DELAY_MS, DEFAULT_ERROR_DELAY_MS);
const adminToken = String(process.env.STRATEGY_LAB_ADMIN_TOKEN ?? "").trim() || undefined;

const payload = {
  workerId,
  queueName,
  leaseMs,
  heartbeatMs,
};

let shouldStop = false;
let hadError = false;

function log(message, extra) {
  const prefix = `[strategy-lab-worker] ${new Date().toISOString()}`;
  if (extra !== undefined) {
    console.log(prefix, message, extra);
    return;
  }
  console.log(prefix, message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on("SIGINT", () => {
  shouldStop = true;
  log("received SIGINT, stopping worker loop");
});

process.on("SIGTERM", () => {
  shouldStop = true;
  log("received SIGTERM, stopping worker loop");
});

async function runStep() {
  const headers = {
    "content-type": "application/json",
  };
  if (adminToken) {
    headers["x-strategy-lab-admin-token"] = adminToken;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok || !responseBody?.ok) {
    const errorCode = responseBody?.error?.code ?? "UNKNOWN";
    const errorMessage = responseBody?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`${errorCode}: ${errorMessage}`);
  }

  const status = String(responseBody?.data?.status ?? "unknown");
  const runId = responseBody?.data?.runId;
  const jobId = responseBody?.data?.jobId;
  return { status, runId, jobId };
}

async function main() {
  log("starting", {
    endpoint,
    workerId,
    queueName: queueName ?? "strategy_lab_default",
    runOnce,
  });

  do {
    try {
      const step = await runStep();
      hadError = false;
      log(`step=${step.status}`, {
        runId: step.runId ?? null,
        jobId: step.jobId ?? null,
      });

      if (runOnce) break;
      if (step.status === "idle") {
        await sleep(idleDelayMs);
      } else {
        await sleep(stepDelayMs);
      }
    } catch (error) {
      hadError = true;
      const message = error instanceof Error ? error.message : String(error);
      log("step failed", { message });
      if (runOnce) break;
      await sleep(errorDelayMs);
    }
  } while (!shouldStop);

  log("stopped", { hadError });
  if (hadError && runOnce) {
    process.exitCode = 1;
  }
}

void main();
