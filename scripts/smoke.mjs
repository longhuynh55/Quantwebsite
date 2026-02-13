const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3010";
const defaultTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 120000);
const includeUiChecks = (() => {
  const raw = process.env.SMOKE_INCLUDE_UI;
  if (raw === undefined) return true;
  const normalized = String(raw).trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(normalized);
})();

function logPass(name, detail = "") {
  console.log(`PASS ${name}${detail ? ` - ${detail}` : ""}`);
}

function logFail(name, detail = "") {
  console.error(`FAIL ${name}${detail ? ` - ${detail}` : ""}`);
}

async function fetchJson(path, { method = "GET", body } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), defaultTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
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

async function fetchText(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), defaultTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, { signal: controller.signal });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  let failures = 0;
  const checks = [
    async () => {
      const name = "GET /api/stocks?limit=1";
      try {
        const { response, data } = await fetchJson("/api/stocks?limit=1");
        ensure(response.ok, `HTTP ${response.status}`);
        ensure(Array.isArray(data?.stocks), "stocks is not an array");
        ensure(data.stocks.length >= 1, "stocks array is empty");
        logPass(name, `count=${data.stocks.length}`);
      } catch (error) {
        failures += 1;
        logFail(name, error instanceof Error ? error.message : String(error));
      }
    },
    async () => {
      const name = "GET /api/stocks?symbol=VNM&limit=all";
      try {
        const { response, data } = await fetchJson("/api/stocks?symbol=VNM&limit=all");
        ensure(response.ok, `HTTP ${response.status}`);
        ensure(Array.isArray(data?.data), "data is not an array");
        ensure(Number.isFinite(data?.total), "total missing");
        ensure(data.data.length === data.total, "limit=all should return full series");
        logPass(name, `rows=${data.data.length}`);
      } catch (error) {
        failures += 1;
        logFail(name, error instanceof Error ? error.message : String(error));
      }
    },
    async () => {
      const name = "GET /api/fundamentals?symbol=AAA&period=latest&statement=all";
      try {
        const { response, data } = await fetchJson("/api/fundamentals?symbol=AAA&period=latest&statement=all");
        ensure(response.ok, `HTTP ${response.status}`);
        ensure(Array.isArray(data?.availablePeriods), "availablePeriods is not an array");
        ensure(typeof data?.period === "string" && data.period.length > 0, "period missing");
        logPass(name, `period=${data.period}, periods=${data.availablePeriods.length}`);
      } catch (error) {
        failures += 1;
        logFail(name, error instanceof Error ? error.message : String(error));
      }
    },
    async () => {
      const name = "POST /api/optimize baseline";
      try {
        const { response, data } = await fetchJson("/api/optimize", {
          method: "POST",
          body: { symbols: ["VNM", "FPT", "HPG"], method: "risk_parity" },
        });
        ensure(response.ok, `HTTP ${response.status}`);
        ensure(Array.isArray(data?.allocations), "allocations is not an array");
        ensure(data.allocations.length >= 2, "not enough allocations");
        ensure(Array.isArray(data?.effectiveUniverse), "effectiveUniverse is not an array");
        logPass(name, `effectiveUniverse=${data.effectiveUniverse.length}`);
      } catch (error) {
        failures += 1;
        logFail(name, error instanceof Error ? error.message : String(error));
      }
    },
    async () => {
      const name = "POST /api/optimize exclusion";
      try {
        const { response, data } = await fetchJson("/api/optimize", {
          method: "POST",
          body: { symbols: ["VNM", "FLC", "FPT"], method: "risk_parity" },
        });
        ensure(response.ok, `HTTP ${response.status}`);
        ensure(Array.isArray(data?.excludedSymbols), "excludedSymbols is not an array");
        const hasInactiveFLC = data.excludedSymbols.some(
          (item) => item?.symbol === "FLC" && String(item?.reason ?? "").startsWith("inactive_status_")
        );
        ensure(hasInactiveFLC, "FLC inactive exclusion not found");
        logPass(name, `excluded=${data.excludedSymbols.length}`);
      } catch (error) {
        failures += 1;
        logFail(name, error instanceof Error ? error.message : String(error));
      }
    },
    async () => {
      const name = "GET /api/market-overview";
      try {
        const { response, data } = await fetchJson("/api/market-overview");
        ensure(response.ok, `HTTP ${response.status}`);
        ensure(Number.isFinite(data?.eligibleStocks), "eligibleStocks missing");
        ensure(Number.isFinite(data?.excludedStaleCount), "excludedStaleCount missing");
        ensure(Number.isFinite(data?.excludedInactiveCount), "excludedInactiveCount missing");
        logPass(
          name,
          `eligible=${data.eligibleStocks}, stale=${data.excludedStaleCount}, inactive=${data.excludedInactiveCount}`
        );
      } catch (error) {
        failures += 1;
        logFail(name, error instanceof Error ? error.message : String(error));
      }
    },
    async () => {
      const name = "GET /api/risk?symbol=VNM&benchmark=VNINDEX";
      try {
        const { response, data } = await fetchJson("/api/risk?symbol=VNM&benchmark=VNINDEX");
        ensure(response.ok, `HTTP ${response.status}`);
        ensure(data?.metrics && typeof data.metrics === "object", "metrics missing");
        ensure(Number.isFinite(data.metrics?.var95), "metrics.var95 missing");
        ensure(Number.isFinite(data.metrics?.volatility), "metrics.volatility missing");
        ensure(Number.isFinite(data.metrics?.beta), "metrics.beta missing");
        logPass(name, `beta=${data.metrics.beta}`);
      } catch (error) {
        failures += 1;
        logFail(name, error instanceof Error ? error.message : String(error));
      }
    },
    async () => {
      const name = "GET /api/backtesting?symbol=VNM&strategy=sma_crossover&capital=100000";
      try {
        const { response, data } = await fetchJson("/api/backtesting?symbol=VNM&strategy=sma_crossover&capital=100000");
        ensure(response.ok, `HTTP ${response.status}`);
        ensure(Array.isArray(data?.equityCurve), "equityCurve is not an array");
        ensure(data.equityCurve.length > 0, "equityCurve is empty");
        ensure(data?.metrics && typeof data.metrics === "object", "metrics missing");
        ensure(Number.isFinite(data.metrics?.totalReturn), "metrics.totalReturn missing");
        logPass(name, `trades=${Array.isArray(data?.trades) ? data.trades.length : 0}`);
      } catch (error) {
        failures += 1;
        logFail(name, error instanceof Error ? error.message : String(error));
      }
    },
    async () => {
      const name = "GET /api/factors?factor=momentum&limit=50";
      try {
        const { response, data } = await fetchJson("/api/factors?factor=momentum&limit=50");
        ensure(response.ok, `HTTP ${response.status}`);
        ensure(Array.isArray(data?.topStocks), "topStocks is not an array");
        ensure(Array.isArray(data?.bottomStocks), "bottomStocks is not an array");
        ensure(data.topStocks.length > 0, "topStocks is empty");
        logPass(name, `top=${data.topStocks.length}, bottom=${data.bottomStocks.length}`);
      } catch (error) {
        failures += 1;
        logFail(name, error instanceof Error ? error.message : String(error));
      }
    },
  ];

  if (!includeUiChecks) {
    console.log("INFO UI checks skipped (SMOKE_INCLUDE_UI=false)");
  } else {
    checks.push(async () => {
      const name = "GET /charts?symbol=VNM";
      try {
        const { response, text } = await fetchText("/charts?symbol=VNM");
        ensure(response.ok, `HTTP ${response.status}`);
        ensure(text.length > 0, "empty response body");
        logPass(name, `bytes=${text.length}`);
      } catch (error) {
        failures += 1;
        logFail(name, error instanceof Error ? error.message : String(error));
      }
    });
  }

  for (const check of checks) {
    await check();
  }

  if (failures > 0) {
    console.error(`Smoke test completed with ${failures} failure(s).`);
    process.exit(1);
  }

  console.log("Smoke test passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
