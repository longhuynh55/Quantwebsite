const baseUrl = process.env.SMOKE_BASE_URL ?? process.env.ASSISTANT_EVAL_BASE_URL ?? "http://localhost:3010";
const defaultTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 120000);
const ciMode = readBoolEnv(process.env.CI);
const strictMode = readBoolEnv(process.env.ASSISTANT_EVAL_STRICT) || ciMode;
const evalAuthToken = String(process.env.ASSISTANT_EVAL_AUTH_TOKEN ?? "").trim();
const evalRequestHeaders = {
  "x-assistant-eval": "true",
  ...(evalAuthToken ? { "x-assistant-eval-token": evalAuthToken } : {}),
};

function readBoolEnv(rawValue) {
  const normalized = String(rawValue ?? "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function logInfo(message) {
  console.log(`INFO ${message}`);
}

function logPass(name, detail = "") {
  console.log(`PASS ${name}${detail ? ` - ${detail}` : ""}`);
}

function logFail(name, detail = "") {
  console.error(`FAIL ${name}${detail ? ` - ${detail}` : ""}`);
}

async function fetchJson(path, { method = "GET", body, headers } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), defaultTimeoutMs);
  const requestHeaders = {
    ...evalRequestHeaders,
    ...(body ? { "content-type": "application/json" } : {}),
    ...(headers ?? {}),
  };
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseFirstNumber(value) {
  if (typeof value !== "string") return null;
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMetricFromText(text, key) {
  const linePattern = new RegExp(`${key}\\s*[:=]\\s*([^\\n]+)`, "i");
  const match = text.match(linePattern);
  if (!match) return { found: false, value: null };

  const raw = match[1].trim();
  if (/^n\/?a$/i.test(raw)) {
    return { found: true, value: null };
  }

  const num = parseFirstNumber(raw);
  if (num === null) {
    return { found: true, value: null };
  }

  const isPercentField = key === "net_return" || key === "max_drawdown";
  const hasPercentSign = raw.includes("%");

  if (isPercentField && (hasPercentSign || Math.abs(num) > 1)) {
    return { found: true, value: num / 100 };
  }

  return { found: true, value: num };
}

function hasBacktestCitation(citations) {
  if (!Array.isArray(citations)) return false;
  return citations.some(
    (item) =>
      typeof item?.endpoint === "string" &&
      item.endpoint.includes("/api/backtesting")
  );
}

function hasCitationForEndpoint(citations, endpointFragment) {
  if (!Array.isArray(citations)) return false;
  return citations.some(
    (item) =>
      typeof item?.endpoint === "string" &&
      item.endpoint.includes(endpointFragment)
  );
}

function hasToolStatus(usedTools, toolName, status) {
  if (!Array.isArray(usedTools)) return false;
  return usedTools.some((item) => item?.name === toolName && item?.status === status);
}

async function pickPrimarySymbol() {
  const { response, data } = await fetchJson("/api/stocks?limit=all");
  ensure(response.ok, `GET /api/stocks failed: HTTP ${response.status}`);
  ensure(Array.isArray(data?.stocks), "stocks list missing");

  const preferred = data.stocks.find((s) => String(s?.symbol ?? "").toUpperCase() === "VNM");
  if (preferred?.symbol) return String(preferred.symbol).toUpperCase();

  const active = data.stocks
    .filter((s) => String(s?.status ?? "").toUpperCase() === "ACTIVE")
    .filter((s) => Number.isFinite(Number(s?.dataRows)))
    .sort((a, b) => Number(b.dataRows) - Number(a.dataRows));

  ensure(active.length > 0, "no active symbols available");
  return String(active[0].symbol).toUpperCase();
}

async function getExpectedBacktest(symbol) {
  const endpoint = `/api/backtesting?symbol=${encodeURIComponent(symbol)}&strategy=sma_crossover&capital=100000`;
  const { response, data } = await fetchJson(endpoint);
  ensure(response.ok, `GET ${endpoint} failed: HTTP ${response.status}`);
  ensure(data?.metrics && typeof data.metrics === "object", "metrics missing from backtesting");
  ensure(Number.isFinite(data.metrics?.netReturn), "metrics.netReturn missing");
  ensure(Number.isFinite(data.metrics?.sharpeRatio), "metrics.sharpeRatio missing");
  ensure(Number.isFinite(data.metrics?.maxDrawdown), "metrics.maxDrawdown missing");
  ensure(Number.isFinite(data.metrics?.totalTrades), "metrics.totalTrades missing");

  return {
    netReturn: Number(data.metrics.netReturn),
    sharpeRatio: Number(data.metrics.sharpeRatio),
    maxDrawdown: Number(data.metrics.maxDrawdown),
    totalTrades: Number(data.metrics.totalTrades),
  };
}

async function requestAssistant(message, contextSnapshot) {
  const { response, data } = await fetchJson("/api/assistant", {
    method: "POST",
    body: {
      message,
      conversationHistory: [],
      contextSnapshot,
      preferences: {
        language: "en",
        detailLevel: "brief",
      },
    },
  });

  return { response, data };
}

async function askAssistant(message, contextSnapshot) {
  const { response, data } = await requestAssistant(message, contextSnapshot);
  if (providerLikelyUnavailable(response, data)) {
    throw new Error(`SKIP_EVAL_PROVIDER_UNAVAILABLE: HTTP ${response.status}${data?.error ? ` - ${data.error}` : ""}`);
  }
  ensure(response.ok, `POST /api/assistant failed: HTTP ${response.status}`);
  ensure(data?.success === true, "assistant response.success is false");
  ensure(typeof data?.message === "string" && data.message.length > 0, "assistant message missing");
  return data;
}

function providerLikelyUnavailable(response, data) {
  if (response?.status === 429 || response?.status === 500 || response?.status === 502 || response?.status === 504) return true;
  if (data?.success === true) return false;
  const errorText = String(data?.error ?? "").toLowerCase();
  if (!errorText) return false;
  return (
    errorText.includes("unavailable") ||
    errorText.includes("provider") ||
    errorText.includes("timeout") ||
    errorText.includes("api key") ||
    errorText.includes("authentication")
  );
}

function assertApprox(actual, expected, tolerance, label) {
  const diff = Math.abs(actual - expected);
  ensure(
    diff <= tolerance,
    `${label} mismatch: actual=${actual}, expected=${expected}, diff=${diff}, tol=${tolerance}`
  );
}

async function run() {
  let failures = 0;
  let skipped = false;

  try {
    const preflight = await requestAssistant("Reply with exactly: OK", { page: "backtesting", symbol: "VNM" });
    if (providerLikelyUnavailable(preflight.response, preflight.data)) {
      const reason = `assistant provider unavailable (HTTP ${preflight.response.status})`;
      if (strictMode) {
        throw new Error(`Strict mode enabled: ${reason}`);
      }
      logInfo(`Skipping assistant hallucination eval: ${reason}`);
      console.log("Assistant eval skipped.");
      return;
    }
  } catch (error) {
    if (strictMode) throw error;
    logInfo(`Skipping assistant hallucination eval: preflight failed (${error instanceof Error ? error.message : String(error)})`);
    console.log("Assistant eval skipped.");
    return;
  }

  const tests = [
    async () => {
      const name = "Assistant backtest metrics should match API values";
      try {
        const symbol = await pickPrimarySymbol();
        const expected = await getExpectedBacktest(symbol);
        logInfo(
          `expected for ${symbol}: net_return=${expected.netReturn}, sharpe=${expected.sharpeRatio}, max_drawdown=${expected.maxDrawdown}, total_trades=${expected.totalTrades}`
        );

        const prompt = [
          `For symbol ${symbol}, provide a backtesting snapshot using QuantVN data.`,
          "Reply in exactly 4 lines with this format only:",
          "net_return=<number>",
          "sharpe=<number>",
          "max_drawdown=<number>",
          "total_trades=<number>",
          "If any value is missing, use n/a.",
        ].join("\n");

        const assistant = await askAssistant(prompt, { page: "backtesting", symbol });
        const message = assistant.message;

        const netReturn = parseMetricFromText(message, "net_return");
        const sharpe = parseMetricFromText(message, "sharpe");
        const maxDrawdown = parseMetricFromText(message, "max_drawdown");
        const totalTrades = parseMetricFromText(message, "total_trades");

        ensure(netReturn.found, "net_return key not found in assistant response");
        ensure(sharpe.found, "sharpe key not found in assistant response");
        ensure(maxDrawdown.found, "max_drawdown key not found in assistant response");
        ensure(totalTrades.found, "total_trades key not found in assistant response");
        ensure(netReturn.value !== null, "net_return value is null");
        ensure(sharpe.value !== null, "sharpe value is null");
        ensure(maxDrawdown.value !== null, "max_drawdown value is null");
        ensure(totalTrades.value !== null, "total_trades value is null");

        assertApprox(netReturn.value, expected.netReturn, 0.02, "net_return");
        assertApprox(sharpe.value, expected.sharpeRatio, 0.25, "sharpe");
        assertApprox(maxDrawdown.value, expected.maxDrawdown, 0.02, "max_drawdown");
        assertApprox(totalTrades.value, expected.totalTrades, 2, "total_trades");

        ensure(
          hasToolStatus(assistant.usedTools, "backtestSummary", "success"),
          "backtestSummary tool did not succeed"
        );
        ensure(hasBacktestCitation(assistant.citations), "backtesting citation missing");

        logPass(name, `symbol=${symbol}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("SKIP_EVAL_PROVIDER_UNAVAILABLE:")) {
          throw error;
        }
        failures += 1;
        logFail(name, message);
      }
    },
    async () => {
      const name = "Assistant should not fabricate metrics for missing symbol";
      try {
        const missingSymbol = "ZZZZZ";
        const prompt = [
          `Backtest symbol ${missingSymbol} with SMA crossover.`,
          "If data is unavailable, reply exactly: INSUFFICIENT_DATA",
          "Do not include any numbers or extra text.",
        ].join("\n");

        const assistant = await askAssistant(prompt, { page: "backtesting", symbol: missingSymbol });
        const message = assistant.message.trim();

        ensure(message.includes("INSUFFICIENT_DATA"), `unexpected response: ${message}`);
        ensure(!/\d/.test(message), "response should not contain numeric claims");
        ensure(
          hasToolStatus(assistant.usedTools, "backtestSummary", "error"),
          "backtestSummary should fail for missing symbol"
        );

        logPass(name, `symbol=${missingSymbol}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("SKIP_EVAL_PROVIDER_UNAVAILABLE:")) {
          throw error;
        }
        failures += 1;
        logFail(name, message);
      }
    },
    async () => {
      const name = "Assistant should ground valuation ranking by analytics endpoint";
      try {
        const prompt = "Trong nhóm ngân hàng HOSE ngày 31/12/2025, liệt kê top 5 cổ phiếu có P/E cao nhất.";
        const assistant = await askAssistant(prompt, { page: "home" });
        ensure(
          hasToolStatus(assistant.usedTools, "valuationRanking", "success"),
          "valuationRanking tool did not succeed"
        );
        ensure(
          hasCitationForEndpoint(assistant.citations, "/api/analytics/valuation-rankings"),
          "valuation ranking citation missing"
        );
        logPass(name);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("SKIP_EVAL_PROVIDER_UNAVAILABLE:")) {
          throw error;
        }
        failures += 1;
        logFail(name, message);
      }
    },
    async () => {
      const name = "Assistant should map BCTN shorthand to fundamentals statement";
      try {
        const symbol = await pickPrimarySymbol();
        const prompt = `Cho BCTN mới nhất của ${symbol}, chỉ trả doanh thu và lợi nhuận sau thuế.`;
        const assistant = await askAssistant(prompt, { page: "charts", symbol });
        ensure(
          hasToolStatus(assistant.usedTools, "fundamentalSnapshot", "success"),
          "fundamentalSnapshot tool did not succeed"
        );
        ensure(
          hasCitationForEndpoint(assistant.citations, "/api/fundamentals"),
          "fundamentals citation missing"
        );
        ensure(
          hasCitationForEndpoint(assistant.citations, "statement=is"),
          "fundamentals statement=is citation missing"
        );
        logPass(name, `symbol=${symbol}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("SKIP_EVAL_PROVIDER_UNAVAILABLE:")) {
          throw error;
        }
        failures += 1;
        logFail(name, message);
      }
    },
    async () => {
      const name = "Assistant should expose query-plan metadata for valuation ranking";
      try {
        const prompt = "Top 5 cổ phiếu ngân hàng HOSE theo PE ngày 31/12/2025.";
        const assistant = await askAssistant(prompt, { page: "home" });
        ensure(
          typeof assistant?.meta?.queryIntent === "string" && assistant.meta.queryIntent.length > 0,
          "meta.queryIntent missing"
        );
        ensure(
          assistant.meta.queryIntent === "valuation_ranking" || assistant.meta.queryIntent === "icb_snapshot",
          `unexpected queryIntent=${assistant.meta.queryIntent}`
        );
        ensure(
          typeof assistant?.meta?.queryPlanSummary === "string" && assistant.meta.queryPlanSummary.includes("tools="),
          "meta.queryPlanSummary missing or malformed"
        );
        ensure(
          Array.isArray(assistant?.meta?.plannedTools) && assistant.meta.plannedTools.length > 0,
          "meta.plannedTools missing"
        );
        ensure(
          assistant.meta.plannedTools.includes("valuationRanking"),
          "plannedTools does not include valuationRanking"
        );

        logPass(name);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("SKIP_EVAL_PROVIDER_UNAVAILABLE:")) {
          throw error;
        }
        failures += 1;
        logFail(name, message);
      }
    },
  ];

  for (const test of tests) {
    try {
      await test();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!strictMode && message.startsWith("SKIP_EVAL_PROVIDER_UNAVAILABLE:")) {
        logInfo(`Skipping assistant hallucination eval: ${message.replace("SKIP_EVAL_PROVIDER_UNAVAILABLE:", "").trim()}`);
        skipped = true;
        break;
      }
      throw error;
    }
  }

  if (skipped) {
    console.log("Assistant eval skipped.");
    return;
  }

  if (failures > 0) {
    console.error(`Assistant eval completed with ${failures} failure(s).`);
    process.exit(1);
  }

  console.log("Assistant eval passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
