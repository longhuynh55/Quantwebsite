const baseUrl = process.env.ASSISTANT_EVAL_BASE_URL ?? "http://localhost:3011";
const timeoutMs = Number(process.env.ASSISTANT_EVAL_TIMEOUT_MS ?? 90000);
const reportPath = process.env.ASSISTANT_EVAL_REPORT_PATH;
const modelLabel = process.env.ASSISTANT_MODEL_LABEL ?? "unknown";
const evalAuthToken = String(process.env.ASSISTANT_EVAL_AUTH_TOKEN ?? "").trim();

const cases = [
  {
    name: "market_snapshot",
    message: "Tóm tắt nhanh thị trường hiện tại: benchmark, top gainer, top loser.",
    contextSnapshot: { page: "home" },
    expectTool: { name: "marketSnapshot", status: "success" },
  },
  {
    name: "fundamental_snapshot",
    message: "Cho tôi doanh thu và lợi nhuận ròng mới nhất của VNM.",
    contextSnapshot: { page: "charts", symbol: "VNM" },
    expectTool: { name: "fundamentalSnapshot", status: "success" },
  },
  {
    name: "backtest_snapshot",
    message: "Tóm tắt backtest SMA crossover cho VNM với net_return, sharpe, max_drawdown, total_trades.",
    contextSnapshot: { page: "backtesting", symbol: "VNM" },
    expectTool: { name: "backtestSummary", status: "success" },
  },
  {
    name: "missing_symbol_abstain",
    message: "Backtest mã ZZZZZ với SMA crossover. Nếu thiếu dữ liệu, trả lời INSUFFICIENT_DATA.",
    contextSnapshot: { page: "backtesting", symbol: "ZZZZZ" },
    expectTool: { name: "backtestSummary", status: "error" },
    expectIncludes: "INSUFFICIENT_DATA",
  },
];

function hasToolStatus(usedTools, name, status) {
  if (!Array.isArray(usedTools)) return false;
  return usedTools.some((item) => item?.name === name && item?.status === status);
}

function percentile(values, pct) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * pct));
  return sorted[index];
}

async function callAssistant(item) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/api/assistant`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(evalAuthToken ? { "x-assistant-eval-token": evalAuthToken, "x-assistant-eval": "true" } : {}),
      },
      body: JSON.stringify({
        message: item.message,
        conversationHistory: [],
        contextSnapshot: item.contextSnapshot,
        preferences: { language: "vi", detailLevel: "brief" },
      }),
      signal: controller.signal,
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    const latencyMs = Date.now() - startedAt;
    const messageText = String(data?.message ?? "");
    const toolOk = item.expectTool
      ? hasToolStatus(data?.usedTools, item.expectTool.name, item.expectTool.status)
      : true;
    const containsOk = item.expectIncludes ? messageText.includes(item.expectIncludes) : true;
    const policyFallback =
      String(data?.policyStatus ?? "").toLowerCase() === "fallback" ||
      String(data?.policyStatus ?? "").toLowerCase() === "shadow_blocked";
    const pass = response.ok && data?.success === true && messageText.length > 0 && containsOk && (toolOk || policyFallback);

    return {
      name: item.name,
      pass,
      latencyMs,
      status: response.status,
      providerUsed: data?.meta?.providerUsed ?? null,
      fallbackUsed: data?.meta?.fallbackUsed ?? null,
      policyStatus: data?.policyStatus ?? null,
      toolOk,
      containsOk,
      error: data?.error ?? null,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    return {
      name: item.name,
      pass: false,
      latencyMs,
      status: null,
      providerUsed: null,
      fallbackUsed: null,
      policyStatus: null,
      toolOk: false,
      containsOk: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function writeReport(report) {
  if (!reportPath) return null;
  const fs = await import("node:fs");
  const path = await import("node:path");
  const absolutePath = path.resolve(reportPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return absolutePath;
}

async function run() {
  const startedAt = Date.now();
  const results = [];
  for (const item of cases) {
    const result = await callAssistant(item);
    results.push(result);
  }

  const passed = results.filter((item) => item.pass).length;
  const latencies = results.map((item) => item.latencyMs).filter((value) => Number.isFinite(value));
  const providers = Array.from(
    new Set(results.map((item) => item.providerUsed).filter((value) => typeof value === "string" && value.length > 0))
  );
  const fallbackCount = results.filter((item) => item.fallbackUsed === true).length;

  const report = {
    runAt: new Date().toISOString(),
    modelLabel,
    baseUrl,
    totalCases: results.length,
    passedCases: passed,
    passRate: results.length > 0 ? passed / results.length : 0,
    latency: {
      avgMs: latencies.length > 0 ? Math.round(latencies.reduce((acc, value) => acc + value, 0) / latencies.length) : null,
      p95Ms: percentile(latencies, 0.95),
    },
    providers,
    fallbackCount,
    durationMs: Date.now() - startedAt,
    results,
  };

  const writtenPath = await writeReport(report);
  if (writtenPath) {
    console.log(`REPORT_PATH=${writtenPath}`);
  }
  console.log(JSON.stringify(report));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
