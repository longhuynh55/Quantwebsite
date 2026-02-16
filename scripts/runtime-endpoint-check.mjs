import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import next from "next";

const DEFAULT_TIMEOUT_MS = Number(process.env.CHECK_TIMEOUT_MS ?? 120000);
const EXTERNAL_BASE_URL =
  process.env.CHECK_BASE_URL ?? process.env.SMOKE_BASE_URL ?? process.env.ASSISTANT_EVAL_BASE_URL ?? "";

function nowIso() {
  return new Date().toISOString();
}

function log(kind, message) {
  const line = `${nowIso()} ${kind} ${message}`;
  if (kind === "ERROR") console.error(line);
  else console.log(line);
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeBaseUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function parseDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function fetchJson(baseUrl, endpoint, { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { response, data, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function startLocalNextServer(projectDir) {
  const devMode = String(process.env.CHECK_NEXT_DEV ?? "").trim().toLowerCase() === "true";
  const app = next({ dev: devMode, dir: projectDir, hostname: "127.0.0.1", port: 0 });
  await app.prepare();

  const handler = app.getRequestHandler();
  const server = http.createServer((req, res) => handler(req, res));

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  ensure(address && typeof address === "object" && typeof address.port === "number", "Failed to bind local server port");

  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    devMode,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await app.close();
    },
  };
}

async function run() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectDir = path.resolve(scriptDir, "..");

  // Mirror Docker compose env_file behavior for local runs.
  const envFromFile = parseDotEnvFile(path.join(projectDir, ".env.glm"));
  for (const [key, value] of Object.entries(envFromFile)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  if (!process.env.DATA_DIR) {
    process.env.DATA_DIR = path.join(projectDir, "public", "data");
  }

  const normalizedExternal = normalizeBaseUrl(EXTERNAL_BASE_URL);
  const useExternal = Boolean(normalizedExternal);

  let server = null;
  let baseUrl = normalizedExternal;

  if (!useExternal) {
    log("INFO", "Starting local Next.js server for endpoint checks...");
    server = await startLocalNextServer(projectDir);
    baseUrl = server.baseUrl;
    log("INFO", `Local server ready (${server.devMode ? "dev" : "prod"} mode): ${baseUrl}`);
  } else {
    log("INFO", `Using external base URL: ${baseUrl}`);
  }

  // Ensure assistant grounding tools hit this server (compose uses ASSISTANT_TOOL_BASE_URL).
  process.env.ASSISTANT_TOOL_BASE_URL = baseUrl;

  const results = {
    baseUrl,
    dockerComposeBlocked: false,
    checks: {},
  };

  try {
    log("INFO", `Checking GET /api/stocks?limit=1 (${baseUrl})`);
    const stocks = await fetchJson(baseUrl, "/api/stocks?limit=1", { timeoutMs: 60000 });
    results.checks.stocks = { status: stocks.response.status, ok: stocks.response.ok };
    ensure(stocks.response.ok, `GET /api/stocks failed: HTTP ${stocks.response.status}`);
    ensure(Array.isArray(stocks.data?.stocks), "GET /api/stocks: response.stocks is not an array");
    ensure(stocks.data.stocks.length >= 1, "GET /api/stocks: empty stocks list");
    const symbol = String(stocks.data.stocks[0].symbol ?? "").trim().toUpperCase();
    ensure(symbol, "GET /api/stocks: missing first symbol");
    results.checks.stocks.symbolPicked = symbol;

    log("INFO", `Checking GET /api/fundamentals (symbol=${symbol})`);
    const fundamentals = await fetchJson(
      baseUrl,
      `/api/fundamentals?symbol=${encodeURIComponent(symbol)}&statement=all&period=latest`,
      { timeoutMs: 120000 }
    );
    results.checks.fundamentals = { status: fundamentals.response.status, ok: fundamentals.response.ok };
    ensure(fundamentals.response.ok, `GET /api/fundamentals failed: HTTP ${fundamentals.response.status}`);
    ensure(typeof fundamentals.data?.period === "string" && fundamentals.data.period.length > 0, "period missing");
    ensure(Array.isArray(fundamentals.data?.availablePeriods), "availablePeriods missing");
    ensure(fundamentals.data?.meta?.sourceFiles, "meta.sourceFiles missing");
    results.checks.fundamentals.period = fundamentals.data.period;
    results.checks.fundamentals.availablePeriodsCount = fundamentals.data.availablePeriods.length;
    results.checks.fundamentals.sourceFiles = fundamentals.data.meta.sourceFiles;

    log("INFO", `Checking POST /api/assistant (symbol=${symbol})`);
    const assistant = await fetchJson(baseUrl, "/api/assistant", {
      method: "POST",
      timeoutMs: 180000,
      body: {
        message: `In 1-2 sentences, summarize the latest fundamentals situation for ${symbol}.`,
        conversationHistory: [],
        contextSnapshot: { page: "charts", symbol },
        preferences: { language: "en", detailLevel: "brief" },
        requestId: `runtime-endpoint-check-${Date.now()}`,
      },
    });
    results.checks.assistant = { status: assistant.response.status, ok: assistant.response.ok };
    ensure(assistant.response.ok, `POST /api/assistant failed: HTTP ${assistant.response.status}`);
    ensure(typeof assistant.data?.success === "boolean", "assistant response.success missing");

    if (assistant.data.success) {
      ensure(typeof assistant.data?.message === "string" && assistant.data.message.trim().length > 0, "assistant message empty");
      results.checks.assistant.success = true;
      results.checks.assistant.providerUsed = assistant.data?.meta?.providerUsed ?? null;
      results.checks.assistant.fallbackUsed = assistant.data?.meta?.fallbackUsed ?? null;
      results.checks.assistant.preview = assistant.data.message.trim().slice(0, 240);
    } else {
      results.checks.assistant.success = false;
      results.checks.assistant.error = assistant.data?.error ?? "unknown_error";
      results.checks.assistant.providerUsed = assistant.data?.meta?.providerUsed ?? null;
      results.checks.assistant.fallbackUsed = assistant.data?.meta?.fallbackUsed ?? null;
      throw new Error(`Assistant returned success=false: ${results.checks.assistant.error}`);
    }

    log("INFO", "All endpoint checks passed.");
    console.log(JSON.stringify(results, null, 2));
  } finally {
    if (server) {
      log("INFO", "Stopping local server...");
      await server.close();
    }
  }
}

run().catch((error) => {
  log("ERROR", error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
