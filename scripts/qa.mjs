const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3010";
const defaultTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 180000);
const includeUiChecks = (() => {
  const raw = process.env.SMOKE_INCLUDE_UI;
  if (raw === undefined) return true;
  const normalized = String(raw).trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(normalized);
})();

function logInfo(message) {
  console.log(`INFO ${message}`);
}

function logPass(name, detail = "") {
  console.log(`PASS ${name}${detail ? ` - ${detail}` : ""}`);
}

function logFail(name, detail = "") {
  console.error(`FAIL ${name}${detail ? ` - ${detail}` : ""}`);
}

async function fetchJson(path, { method = "GET", body, headers, timeoutMs } = {}) {
  const controller = new AbortController();
  const effectiveTimeoutMs = Number.isFinite(timeoutMs) ? timeoutMs : defaultTimeoutMs;
  const timeout = setTimeout(() => controller.abort(), effectiveTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(headers ?? {}),
      },
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

async function fetchText(path, { headers } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), defaultTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, { signal: controller.signal, headers });
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

function approxEqual(a, b, tol = 1e-6) {
  return Math.abs(a - b) <= tol;
}

function uniq(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function parseDateMs(raw) {
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : null;
}

function validateOhlcvSeriesPoints(points) {
  ensure(Array.isArray(points), "data is not an array");
  ensure(points.length > 0, "data array is empty");

  const seenDates = new Set();
  let prevMs = null;

  for (const p of points) {
    const ms = parseDateMs(p?.date);
    ensure(ms !== null, `invalid date: ${p?.date}`);
    if (prevMs !== null) {
      ensure(ms >= prevMs, "series is not sorted ascending by date");
    }
    prevMs = ms;

    const dateKey = String(p.date);
    ensure(!seenDates.has(dateKey), `duplicate date detected: ${dateKey}`);
    seenDates.add(dateKey);

    const open = Number(p?.open);
    const high = Number(p?.high);
    const low = Number(p?.low);
    const close = Number(p?.close);
    const volume = Number(p?.volume);

    ensure(Number.isFinite(open) && open > 0, "invalid open");
    ensure(Number.isFinite(high) && high > 0, "invalid high");
    ensure(Number.isFinite(low) && low > 0, "invalid low");
    ensure(Number.isFinite(close) && close > 0, "invalid close");
    ensure(Number.isFinite(volume) && volume >= 0, "invalid volume");

    ensure(high >= low, "high < low");
    ensure(high >= open && high >= close, "high < open/close");
    ensure(low <= open && low <= close, "low > open/close");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForReadiness({ timeoutMs = 60000, intervalMs = 1000 } = {}) {
  const startedAt = Date.now();
  const probePath = "/api/health/data?probe=true&includeFundamentals=true";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const { response, data } = await fetchJson(probePath, { timeoutMs: 8000 });
      if (response.ok && data?.ok === true) {
        return;
      }
    } catch {
      // ignore and retry
    }

    await sleep(intervalMs);
  }

  throw new Error(`Readiness check timed out after ${timeoutMs}ms: ${probePath}`);
}

async function run() {
  let failures = 0;

  await waitForReadiness();

  const checks = [];

  let allStocks = [];
  let primarySymbol = null;
  let fullSymbol = null;
  let partialSymbol = null;
  let inactiveSymbol = null;
  const fullSeriesBySymbol = new Map();

  checks.push(async () => {
    const name = "GET /api/stocks?limit=all (metadata)";
    try {
      const { response, data } = await fetchJson("/api/stocks?limit=all");
      ensure(response.ok, `HTTP ${response.status}`);
      ensure(Array.isArray(data?.stocks), "stocks is not an array");
      ensure(Number.isFinite(data?.total), "total missing");
      ensure(data.stocks.length === data.total, "limit=all should return full metadata list");
      ensure(data.stocks.length > 0, "stocks list is empty");

      allStocks = data.stocks;
      const active = allStocks
        .filter((s) => String(s?.status ?? "").toUpperCase() === "ACTIVE")
        .filter((s) => Number.isFinite(Number(s?.dataRows)));

      const sortedByRowsDesc = [...active].sort((a, b) => Number(b.dataRows) - Number(a.dataRows));
      const sortedByRowsAsc = [...active].sort((a, b) => Number(a.dataRows) - Number(b.dataRows));

      primarySymbol =
        allStocks.find((s) => String(s?.symbol ?? "").toUpperCase() === "VNM")?.symbol ??
        sortedByRowsDesc[0]?.symbol ??
        null;

      fullSymbol = sortedByRowsDesc[0]?.symbol ?? primarySymbol;
      partialSymbol = sortedByRowsAsc[0]?.symbol ?? null;
      inactiveSymbol = allStocks.find((s) => String(s?.status ?? "").toUpperCase() !== "ACTIVE")?.symbol ?? null;

      const infoParts = [
        primarySymbol ? `primary=${primarySymbol}` : null,
        fullSymbol ? `full=${fullSymbol}` : null,
        partialSymbol ? `partial=${partialSymbol}` : null,
        inactiveSymbol ? `inactive=${inactiveSymbol}` : null,
      ].filter(Boolean);
      logInfo(`metadata loaded: total=${data.total}; ${infoParts.join(", ")}`);

      logPass(name, `total=${data.total}`);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "GET /api/stocks?search=VN&limit=5";
    try {
      const { response, data } = await fetchJson("/api/stocks?search=VN&limit=5");
      ensure(response.ok, `HTTP ${response.status}`);
      ensure(Array.isArray(data?.stocks), "stocks is not an array");
      ensure(Number.isFinite(data?.total), "total missing");
      ensure(data.stocks.length <= 5, "limit not respected");
      ensure(data.total >= data.stocks.length, "total < returned length");
      logPass(name, `returned=${data.stocks.length}, total=${data.total}`);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "GET /api/health/data";
    try {
      const { response, data } = await fetchJson("/api/health/data");
      ensure(response.ok, `HTTP ${response.status}`);
      ensure(data?.ok === true, "health ok=false");
      ensure(data?.backend && typeof data.backend === "object", "backend missing");
      ensure(typeof data?.backend?.active === "string", "backend.active missing");
      ensure(data?.datasets && typeof data.datasets === "object", "datasets missing");
      ensure(data?.datasets?.stockMetadata?.ok === true, "stockMetadata health not ok");
      ensure(data?.datasets?.ohlcv?.ok === true, "ohlcv health not ok");
      ensure(data?.datasets?.index?.ok === true, "index health not ok");
      ensure(data?.fundamentals?.ok === true, "fundamentals health not ok");
      logPass(name, `backend=${data.backend.active}`);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "GET /api/stocks?limit=0 (400)";
    try {
      const { response, data } = await fetchJson("/api/stocks?limit=0");
      ensure(response.status === 400, `expected 400, got HTTP ${response.status}`);
      ensure(typeof response.headers.get("x-trace-id") === "string" && response.headers.get("x-trace-id").length > 0, "x-trace-id header missing");
      ensure(typeof data?.error === "string" && data.error.length > 0, "error message missing");
      logPass(name);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "GET /api/stocks?exchange=HNX (HOSE-only contract)";
    try {
      const { response, data } = await fetchJson("/api/stocks?exchange=HNX");
      ensure(response.status === 400, `expected 400, got HTTP ${response.status}`);
      ensure(typeof response.headers.get("x-trace-id") === "string" && response.headers.get("x-trace-id").length > 0, "x-trace-id header missing");
      ensure(String(data?.error ?? "") === 'Only "HOSE" exchange is supported.', "unexpected error message");
      logPass(name);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  const validateSymbolSeries = (symbol) => async () => {
    const name = `GET /api/stocks?symbol=${symbol}&limit=all (series)`;
    try {
      const { response, data } = await fetchJson(`/api/stocks?symbol=${encodeURIComponent(symbol)}&limit=all`);
      ensure(response.ok, `HTTP ${response.status}`);
      ensure(Array.isArray(data?.data), "data is not an array");
      ensure(Number.isFinite(data?.total), "total missing");
      ensure(data.data.length === data.total, "limit=all should return full series");
      ensure(data?.metadata && typeof data.metadata === "object", "metadata missing");
      ensure(String(data.metadata.symbol).toUpperCase() === String(symbol).toUpperCase(), "metadata.symbol mismatch");

      validateOhlcvSeriesPoints(data.data);

      // If metadata includes dataRows, it should match total for the prepared dataset.
      if (Number.isFinite(Number(data.metadata?.dataRows))) {
        ensure(
          Number(data.metadata.dataRows) === data.total,
          `metadata.dataRows (${data.metadata.dataRows}) != total (${data.total})`
        );
      }

      fullSeriesBySymbol.set(String(symbol).toUpperCase(), data.data);
      logPass(name, `rows=${data.data.length}`);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  };

  checks.push(async () => {
    const name = "Validate sample symbols (series + invariants)";
    try {
      ensure(primarySymbol, "primarySymbol unavailable");
      const symbols = uniq([primarySymbol, fullSymbol, partialSymbol, inactiveSymbol]).map((s) => String(s));
      ensure(symbols.length > 0, "no symbols selected");
      logInfo(`validating symbols: ${symbols.join(", ")}`);
      for (const sym of symbols) {
        await validateSymbolSeries(sym)();
      }
      logPass(name, `symbols=${symbols.length}`);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "Stock slicing checks (limit=30/90/365 vs all)";
    try {
      const sym = String(primarySymbol ?? "");
      ensure(sym, "primarySymbol missing");

      const full = fullSeriesBySymbol.get(sym.toUpperCase());
      ensure(Array.isArray(full) && full.length > 0, "full series missing");

      const fullLast = String(full[full.length - 1]?.date ?? "");
      ensure(fullLast, "full last date missing");

      for (const limit of [30, 90, 365]) {
        const { response, data } = await fetchJson(`/api/stocks?symbol=${encodeURIComponent(sym)}&limit=${limit}`);
        ensure(response.ok, `HTTP ${response.status}`);
        ensure(Array.isArray(data?.data), "data is not an array");
        ensure(data.data.length === limit, `expected ${limit} rows, got ${data.data.length}`);
        ensure(Number.isFinite(data?.total) && data.total === full.length, "total mismatch vs full");
        const sliceLast = String(data.data[data.data.length - 1]?.date ?? "");
        ensure(sliceLast === fullLast, "slice last date mismatch vs full");

        const expectedFirst = String(full[full.length - limit]?.date ?? "");
        const gotFirst = String(data.data[0]?.date ?? "");
        ensure(gotFirst === expectedFirst, "slice first date mismatch vs full");
      }

      logPass(name, `symbol=${sym}`);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "GET /api/fundamentals?symbol=AAA&period=latest&statement=all";
    try {
      const { response, data } = await fetchJson("/api/fundamentals?symbol=AAA&period=latest&statement=all");
      ensure(response.ok, `HTTP ${response.status}`);
      ensure(Array.isArray(data?.availablePeriods), "availablePeriods is not an array");
      ensure(typeof data?.period === "string" && /^\d{4}Q[1-4]$/.test(data.period), "period missing/invalid");
      ensure(data?.incomeStatement?.fields && typeof data.incomeStatement.fields === "object", "incomeStatement missing");
      ensure(data?.balanceSheet?.fields && typeof data.balanceSheet.fields === "object", "balanceSheet missing");
      ensure(data?.cashFlow?.fields && typeof data.cashFlow.fields === "object", "cashFlow missing");
      ensure(Object.keys(data.incomeStatement.fields).length > 5, "incomeStatement too small");
      logPass(name, `period=${data.period}, periods=${data.availablePeriods.length}`);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "GET /api/fundamentals statement filter (bs)";
    try {
      const { response, data } = await fetchJson("/api/fundamentals?symbol=AAA&period=latest&statement=bs");
      ensure(response.ok, `HTTP ${response.status}`);
      ensure(data?.balanceSheet?.fields && typeof data.balanceSheet.fields === "object", "balanceSheet missing");
      ensure(data?.incomeStatement === null, "incomeStatement should be null for statement=bs");
      ensure(data?.cashFlow === null, "cashFlow should be null for statement=bs");
      logPass(name);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "GET /api/fundamentals invalid period (400)";
    try {
      const { response, data } = await fetchJson("/api/fundamentals?symbol=AAA&period=2025Q5&statement=all");
      ensure(response.status === 400, `expected 400, got HTTP ${response.status}`);
      ensure(typeof data?.error === "string" && data.error.length > 0, "error message missing");
      logPass(name);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "GET /api/fundamentals missing symbol (400)";
    try {
      const { response, data } = await fetchJson("/api/fundamentals?period=latest&statement=all");
      ensure(response.status === 400, `expected 400, got HTTP ${response.status}`);
      ensure(typeof data?.error === "string" && data.error.length > 0, "error message missing");
      logPass(name);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "POST /api/optimize (all methods)";
    try {
      const active = allStocks
        .filter((s) => String(s?.status ?? "").toUpperCase() === "ACTIVE")
        .filter((s) => Number.isFinite(Number(s?.dataRows)))
        .sort((a, b) => Number(b.dataRows) - Number(a.dataRows));

      const seed = active.slice(0, 10).map((s) => String(s.symbol));
      const symbols = uniq([...seed, partialSymbol, inactiveSymbol]).slice(0, 12);
      ensure(symbols.length >= 2, "not enough symbols for optimize");

      const methods = ["mean_variance", "risk_parity", "equal_weight"];
      for (const method of methods) {
        const { response, data } = await fetchJson("/api/optimize", {
          method: "POST",
          body: { symbols, method },
        });
        ensure(response.ok, `method=${method} HTTP ${response.status}`);
        ensure(Array.isArray(data?.allocations), `method=${method} allocations missing`);
        ensure(data.allocations.length >= 2, `method=${method} not enough allocations`);
        ensure(Array.isArray(data?.effectiveUniverse), `method=${method} effectiveUniverse missing`);
        ensure(Array.isArray(data?.excludedSymbols), `method=${method} excludedSymbols missing`);
        ensure(data.effectiveUniverse.length === data.allocations.length, `method=${method} universe/allocation mismatch`);

        // Weights sanity
        const weights = data.allocations.map((a) => Number(a?.weight));
        ensure(weights.every((w) => Number.isFinite(w) && w >= 0), `method=${method} invalid weights`);
        const sum = weights.reduce((acc, v) => acc + v, 0);
        ensure(approxEqual(sum, 1, 1e-6), `method=${method} weights sum != 1 (sum=${sum})`);

        // Correlation matrix shape sanity
        ensure(data?.correlationMatrix?.symbols, `method=${method} correlationMatrix.symbols missing`);
        ensure(Array.isArray(data?.correlationMatrix?.matrix), `method=${method} correlationMatrix.matrix missing`);
        const mSyms = data.correlationMatrix.symbols;
        const m = data.correlationMatrix.matrix;
        ensure(mSyms.length === m.length, `method=${method} correlation matrix dimension mismatch`);
        for (const row of m) {
          ensure(Array.isArray(row) && row.length === mSyms.length, `method=${method} correlation row mismatch`);
        }

        // Expected metrics
        ensure(Number.isFinite(Number(data?.expectedReturn)), `method=${method} expectedReturn missing`);
        ensure(Number.isFinite(Number(data?.volatility)), `method=${method} volatility missing`);
        ensure(Number.isFinite(Number(data?.sharpeRatio)), `method=${method} sharpeRatio missing`);

        if (inactiveSymbol) {
          const hasInactive = data.excludedSymbols.some(
            (item) =>
              String(item?.symbol ?? "").toUpperCase() === String(inactiveSymbol).toUpperCase() &&
              String(item?.reason ?? "").startsWith("inactive_status_")
          );
          ensure(hasInactive, `method=${method} inactive symbol not excluded`);
        }
      }

      logPass(name, `symbols=${symbols.length}`);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "GET /api/market-overview";
    try {
      const { response, data } = await fetchJson("/api/market-overview");
      ensure(response.ok, `HTTP ${response.status}`);
      ensure(Number.isFinite(data?.eligibleStocks), "eligibleStocks missing");
      ensure(Array.isArray(data?.topGainers), "topGainers missing");
      ensure(Array.isArray(data?.topLosers), "topLosers missing");
      ensure(Array.isArray(data?.marketTrend), "marketTrend missing");
      ensure(typeof data?.benchmark === "string" && data.benchmark.length > 0, "benchmark missing");
      logPass(
        name,
        `eligible=${data.eligibleStocks}, gainers=${data.topGainers.length}, losers=${data.topLosers.length}, trend=${data.marketTrend.length}`
      );
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const sym = String(primarySymbol ?? "");
    const name = `GET /api/risk?symbol=${sym}&benchmark=VNINDEX`;
    try {
      ensure(sym, "primarySymbol missing");
      const { response, data } = await fetchJson(`/api/risk?symbol=${encodeURIComponent(sym)}&benchmark=VNINDEX`);
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
  });

  checks.push(async () => {
    const sym = partialSymbol ? String(partialSymbol) : "";
    const name = partialSymbol ? `GET /api/risk?symbol=${sym}&benchmark=VNINDEX (partial)` : "GET /api/risk (partial) (skipped)";
    try {
      if (!partialSymbol) {
        logInfo("partialSymbol unavailable; skipping partial risk check");
        logPass(name);
        return;
      }
      const { response, data } = await fetchJson(`/api/risk?symbol=${encodeURIComponent(sym)}&benchmark=VNINDEX`);
      ensure([200, 400, 404, 429].includes(response.status), `unexpected HTTP ${response.status}`);
      if (response.ok) {
        ensure(data?.metrics && typeof data.metrics === "object", "metrics missing");
      } else {
        ensure(typeof data?.error === "string" && data.error.length > 0, "error message missing");
      }
      logPass(name, `HTTP ${response.status}`);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const sym = String(primarySymbol ?? "");
    const name = `GET /api/backtesting (all strategies) symbol=${sym}`;
    try {
      ensure(sym, "primarySymbol missing");
      const strategies = ["sma_crossover", "ema_crossover", "rsi_mean_reversion", "bollinger_bands", "momentum"];
      for (const strategy of strategies) {
        const { response, data } = await fetchJson(
          `/api/backtesting?symbol=${encodeURIComponent(sym)}&strategy=${encodeURIComponent(strategy)}&capital=100000`
        );
        ensure(response.ok, `strategy=${strategy} HTTP ${response.status}`);
        ensure(Array.isArray(data?.equityCurve), `strategy=${strategy} equityCurve missing`);
        ensure(data.equityCurve.length > 0, `strategy=${strategy} equityCurve empty`);
        ensure(data?.metrics && typeof data.metrics === "object", `strategy=${strategy} metrics missing`);
        ensure(Number.isFinite(data.metrics?.totalReturn), `strategy=${strategy} metrics.totalReturn missing`);
        ensure(Number.isFinite(data.metrics?.netReturn), `strategy=${strategy} metrics.netReturn missing`);
        ensure(Number.isFinite(data.metrics?.grossReturn), `strategy=${strategy} metrics.grossReturn missing`);
        ensure(data?.configApplied && typeof data.configApplied === "object", `strategy=${strategy} configApplied missing`);
        ensure(data?.diagnostics && typeof data.diagnostics === "object", `strategy=${strategy} diagnostics missing`);
      }
      logPass(name, `strategies=5`);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "POST /api/backtesting (advanced params + config)";
    try {
      const sym = String(primarySymbol ?? "");
      ensure(sym, "primarySymbol missing");
      const { response, data } = await fetchJson("/api/backtesting", {
        method: "POST",
        body: {
          symbol: sym,
          strategy: "sma_crossover",
          capital: 100000,
          params: { shortPeriod: 10, longPeriod: 30 },
          executionModel: "next_open",
          feeBps: 15,
          sellTaxBps: 10,
          slippageBps: 5,
          lotSize: 1,
        },
      });
      ensure(response.ok, `HTTP ${response.status}`);
      ensure(Array.isArray(data?.equityCurve), "equityCurve missing");
      ensure(data.equityCurve.length > 0, "equityCurve empty");
      ensure(data?.configApplied?.executionModel === "next_open", "configApplied.executionModel mismatch");
      ensure(Number.isFinite(data?.diagnostics?.coverageRatio), "diagnostics.coverageRatio missing");
      logPass(name);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "GET /api/backtesting invalid strategy params (400)";
    try {
      const sym = String(primarySymbol ?? "");
      ensure(sym, "primarySymbol missing");
      const { response, data } = await fetchJson(
        `/api/backtesting?symbol=${encodeURIComponent(sym)}&strategy=sma_crossover&capital=100000&shortPeriod=40&longPeriod=20`
      );
      ensure(response.status === 400, `expected 400, got HTTP ${response.status}`);
      ensure(typeof data?.error === "string" && data.error.length > 0, "error message missing");
      logPass(name);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "POST /api/backtesting invalid config (400)";
    try {
      const sym = String(primarySymbol ?? "");
      ensure(sym, "primarySymbol missing");
      const { response, data } = await fetchJson("/api/backtesting", {
        method: "POST",
        body: { symbol: sym, strategy: "sma_crossover", capital: 100000, feeBps: -1 },
      });
      ensure(response.status === 400, `expected 400, got HTTP ${response.status}`);
      ensure(typeof data?.error === "string" && data.error.length > 0, "error message missing");
      logPass(name);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "GET /api/backtesting invalid strategy (400)";
    try {
      const sym = String(primarySymbol ?? "");
      ensure(sym, "primarySymbol missing");
      const { response, data } = await fetchJson(`/api/backtesting?symbol=${encodeURIComponent(sym)}&strategy=bad&capital=100000`);
      ensure(response.status === 400, `expected 400, got HTTP ${response.status}`);
      ensure(typeof data?.error === "string" && data.error.length > 0, "error message missing");
      logPass(name);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "GET /api/factors (all factors)";
    try {
      const factors = ["momentum", "value", "volatility", "size"];
      for (const factor of factors) {
        const { response, data } = await fetchJson(`/api/factors?factor=${encodeURIComponent(factor)}&limit=30`);
        ensure(response.ok, `factor=${factor} HTTP ${response.status}`);
        ensure(String(data?.factor ?? "").toLowerCase() === factor, `factor mismatch (${data?.factor})`);
        ensure(Array.isArray(data?.topStocks), `factor=${factor} topStocks missing`);
        ensure(Array.isArray(data?.bottomStocks), `factor=${factor} bottomStocks missing`);
        ensure(Number.isFinite(data?.total), `factor=${factor} total missing`);
        ensure(data.total > 0, `factor=${factor} total=0`);
      }
      logPass(name, `factors=4`);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "GET /api/factors invalid factor (400)";
    try {
      const { response, data } = await fetchJson("/api/factors?factor=bad&limit=30");
      ensure(response.status === 400, `expected 400, got HTTP ${response.status}`);
      ensure(typeof data?.error === "string" && data.error.length > 0, "error message missing");
      logPass(name);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "POST /api/assistant route contract";
    try {
      const { response, data } = await fetchJson("/api/assistant", {
        method: "POST",
        body: { message: "", conversationHistory: [] },
      });
      ensure(response.status !== 404, "route not found (404)");
      ensure([200, 400, 429, 500, 502, 504].includes(response.status), `unexpected HTTP ${response.status}`);
      ensure(typeof data?.success === "boolean", "success flag missing");
      if (data.success) {
        ensure(typeof data?.message === "string", "message missing on success response");
      } else {
        ensure(typeof data?.error === "string" && data.error.length > 0, "error message missing");
      }
      logPass(name, `HTTP ${response.status}`);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  if (!includeUiChecks) {
    checks.push(async () => {
      logInfo("UI checks skipped (SMOKE_INCLUDE_UI=false)");
    });
  } else {
    const uiChecks = [
      { path: "/", mustContain: ["QuantVN"] },
      { path: "/screener", mustContain: ["Stock Screener"] },
      // In production, /charts may stream a minimal HTML shell and hydrate client-side, so keep this check light.
      { path: "/charts", mustContain: ["Interactive Charts"] },
      { path: "/portfolio", mustContain: ["Portfolio Optimization"] },
      { path: "/risk", mustContain: ["Risk Management"] },
      { path: "/backtesting", mustContain: ["Strategy Backtesting"] },
      { path: "/factors", mustContain: ["Factor Investing"] },
      { path: "/learn", mustContain: ["Learn"] },
    ];

    for (const item of uiChecks) {
      checks.push(async () => {
        const name = `GET ${item.path} (UI)`;
        try {
          const { response, text } = await fetchText(item.path);
          ensure(response.ok, `HTTP ${response.status}`);
          ensure(text.length > 0, "empty response body");
          for (const token of item.mustContain) {
            ensure(text.includes(token), `missing token: ${token}`);
          }
          logPass(name, `bytes=${text.length}`);
        } catch (error) {
          failures += 1;
          logFail(name, error instanceof Error ? error.message : String(error));
        }
      });
    }
  }

  const start = Date.now();
  for (const check of checks) {
    await check();
  }
  const durationMs = Date.now() - start;

  if (failures > 0) {
    console.error(`QA completed with ${failures} failure(s) in ${durationMs}ms.`);
    process.exit(1);
  }

  console.log(`QA passed in ${durationMs}ms.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
