const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3010";
const defaultTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 120000);
const includeUiChecks = (() => {
  const raw = process.env.SMOKE_INCLUDE_UI;
  if (raw === undefined) return true;
  const normalized = String(raw).trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(normalized);
})();
const WATCHLIST_MAX_SYMBOLS = 50;
const WATCHLIST_QUERY_IMPORT_MAX = 30;

function logPass(name, detail = "") {
  console.log(`PASS ${name}${detail ? ` - ${detail}` : ""}`);
}

function logFail(name, detail = "") {
  console.error(`FAIL ${name}${detail ? ` - ${detail}` : ""}`);
}

async function fetchJson(path, { method = "GET", body, timeoutMs } = {}) {
  const controller = new AbortController();
  const effectiveTimeoutMs = Number.isFinite(timeoutMs) ? timeoutMs : defaultTimeoutMs;
  const timeout = setTimeout(() => controller.abort(), effectiveTimeoutMs);
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

function normalizeSymbol(raw) {
  return String(raw ?? "").trim().toUpperCase();
}

function uniq(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalizeWatchlistSymbol(raw) {
  return normalizeSymbol(raw).replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function mergeWatchlistSymbols(queue, existing = []) {
  const normalizedQueue = queue.map(normalizeWatchlistSymbol).filter(Boolean);
  const merged = [...normalizedQueue, ...existing.map(normalizeWatchlistSymbol).filter(Boolean)];
  return uniq(merged).slice(0, WATCHLIST_MAX_SYMBOLS);
}

function parseChartsWatchlistQuery(raw) {
  return String(raw ?? "")
    .split(",")
    .map((item) => normalizeSymbol(item))
    .filter(Boolean)
    .slice(0, WATCHLIST_QUERY_IMPORT_MAX);
}

function buildScreenerQueryParams(search, filters, options = {}) {
  const params = new URLSearchParams();
  const normalizedSearch = normalizeSymbol(search);
  if (normalizedSearch) params.set("search", normalizedSearch);

  if (filters.status) params.set("status", String(filters.status));
  if (filters.listingPhase) params.set("listingPhase", String(filters.listingPhase));
  if (filters.minAvgVolume) params.set("minAvgVolume", String(filters.minAvgVolume));
  if (filters.maxAvgVolume) params.set("maxAvgVolume", String(filters.maxAvgVolume));
  if (filters.minTradingDays) params.set("minTradingDays", String(filters.minTradingDays));
  if (filters.maxTradingDays) params.set("maxTradingDays", String(filters.maxTradingDays));
  if (filters.industry) params.set("industry", String(filters.industry));
  params.set("sortBy", String(filters.sortBy ?? "symbol"));
  params.set("sortDir", String(filters.sortDir ?? "asc"));

  if (options.exportAll) {
    params.set("limit", "all");
  } else {
    params.set("page", String(filters.page ?? 1));
    params.set("pageSize", String(filters.pageSize ?? 50));
  }
  return params;
}

function canonicalizeStocksPayload(data) {
  const stocks = Array.isArray(data?.stocks) ? data.stocks : [];
  const symbols = stocks.map((row) => normalizeSymbol(row?.symbol)).filter(Boolean);
  const total = Number(data?.total);
  const page = Number(data?.page);
  const pageSize = Number(data?.pageSize);
  return {
    symbols,
    total: Number.isFinite(total) ? total : Number.NaN,
    page: Number.isFinite(page) ? page : null,
    pageSize: Number.isFinite(pageSize) ? pageSize : null,
    sortBy: String(data?.sortBy ?? ""),
    sortDir: String(data?.sortDir ?? ""),
  };
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
  const checks = [
    async () => {
      const name = "GET /api/stocks?limit=1";
      try {
        const { response, data } = await fetchJson("/api/stocks?limit=1");
        ensure(response.ok, `HTTP ${response.status}`);
        ensure(typeof response.headers.get("x-trace-id") === "string" && response.headers.get("x-trace-id").length > 0, "x-trace-id header missing");
        ensure(Array.isArray(data?.stocks), "stocks is not an array");
        ensure(data.stocks.length >= 1, "stocks array is empty");
        logPass(name, `count=${data.stocks.length}`);
      } catch (error) {
        failures += 1;
        logFail(name, error instanceof Error ? error.message : String(error));
      }
    },
    async () => {
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
      const name = "Watchlist persistence/query contract";
      try {
        const { response, data } = await fetchJson("/api/stocks?sortBy=symbol&sortDir=asc&limit=all");
        ensure(response.ok, `metadata HTTP ${response.status}`);
        ensure(Array.isArray(data?.stocks), "metadata stocks missing");
        const seedSymbols = data.stocks.map((item) => normalizeSymbol(item?.symbol)).filter(Boolean).slice(0, 6);
        ensure(seedSymbols.length >= 3, "insufficient metadata symbols for watchlist check");

        const rawQueue = [
          seedSymbols[0],
          ` ${seedSymbols[0]} `,
          seedSymbols[1].toLowerCase(),
          `${seedSymbols[2]}***`,
          seedSymbols[0],
          "",
        ];
        const persisted = mergeWatchlistSymbols(rawQueue, []);
        ensure(persisted.length >= 3, "watchlist persistence produced too few symbols");
        ensure(persisted.length <= WATCHLIST_MAX_SYMBOLS, "watchlist cap exceeded");

        const idempotentReplay = mergeWatchlistSymbols(rawQueue, persisted);
        ensure(
          JSON.stringify(idempotentReplay) === JSON.stringify(persisted),
          "watchlist addSymbols should be idempotent"
        );

        const fromQuery = parseChartsWatchlistQuery(persisted.join(","));
        const rehydrated = mergeWatchlistSymbols(fromQuery, []);
        const expectedRehydrated = persisted.slice(0, WATCHLIST_QUERY_IMPORT_MAX);
        ensure(
          JSON.stringify(rehydrated) === JSON.stringify(expectedRehydrated),
          "watchlist query round-trip mismatch"
        );

        for (const symbol of rehydrated.slice(0, 5)) {
          const { response: symbolRes, data: symbolData } = await fetchJson(`/api/stocks?symbol=${encodeURIComponent(symbol)}&limit=1`);
          ensure(symbolRes.ok, `${symbol} query HTTP ${symbolRes.status}`);
          ensure(Array.isArray(symbolData?.data) && symbolData.data.length === 1, `${symbol} expected 1-row series`);
          ensure(normalizeSymbol(symbolData?.metadata?.symbol) === symbol, `${symbol} metadata mismatch`);
        }

        logPass(name, `persisted=${persisted.length}, queried=${Math.min(rehydrated.length, 5)}`);
      } catch (error) {
        failures += 1;
        logFail(name, error instanceof Error ? error.message : String(error));
      }
    },
    async () => {
      const name = "POST /api/telemetry/ui-kpi contract";
      try {
        const { response, data } = await fetchJson("/api/telemetry/ui-kpi", {
          method: "POST",
          body: {
            metric: "watchlist_interaction",
            event: "watchlist_toggled",
            page: "screener",
            source: "smoke_contract",
            symbol: "VNM",
            count: 1,
            detail: {
              mode: "smoke",
            },
          },
        });
        if (response.status === 429) {
          logPass(name, "skipped rate-limited");
          return;
        }
        ensure(response.status === 202, `expected HTTP 202, got ${response.status}`);
        ensure(data?.accepted === true, "accepted flag must be true");
        logPass(name);
      } catch (error) {
        failures += 1;
        logFail(name, error instanceof Error ? error.message : String(error));
      }
    },
    async () => {
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
        logPass(name, `backend=${data.backend.active}`);
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
        ensure(Number.isFinite(data.metrics?.netReturn), "metrics.netReturn missing");
        ensure(Number.isFinite(data.metrics?.grossReturn), "metrics.grossReturn missing");
        ensure(data?.configApplied && typeof data.configApplied === "object", "configApplied missing");
        ensure(data?.diagnostics && typeof data.diagnostics === "object", "diagnostics missing");
        logPass(name, `trades=${Array.isArray(data?.trades) ? data.trades.length : 0}`);
      } catch (error) {
        failures += 1;
        logFail(name, error instanceof Error ? error.message : String(error));
      }
    },
    async () => {
      const name = "POST /api/backtesting advanced config";
      try {
        const { response, data } = await fetchJson("/api/backtesting", {
          method: "POST",
          body: {
            symbol: "VNM",
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
        ensure(data?.configApplied?.executionModel === "next_open", "executionModel mismatch");
        ensure(Number.isFinite(data?.diagnostics?.coverageRatio), "diagnostics.coverageRatio missing");
        logPass(name);
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
    async () => {
      const name = "Screener preset apply equivalence (manual vs preset query)";
      try {
        const { response: metadataResponse, data: metadataData } = await fetchJson("/api/stocks?sortBy=avgVolume&sortDir=desc&limit=all");
        ensure(metadataResponse.ok, `metadata HTTP ${metadataResponse.status}`);
        ensure(Array.isArray(metadataData?.stocks) && metadataData.stocks.length > 0, "metadata stocks unavailable");

        const topSymbol = normalizeSymbol(metadataData.stocks[0]?.symbol || "VNM");
        ensure(topSymbol.length > 0, "unable to resolve sample symbol");
        const listingPhase = String(metadataData.stocks[0]?.listingPhase ?? "HOSE").trim() || "HOSE";
        const industry = String(
          metadataData.stocks.find((item) => typeof item?.icbName4 === "string" && item.icbName4.trim())?.icbName4 ?? ""
        ).trim();

        const manualState = {
          search: topSymbol.slice(0, 2),
          filters: {
            status: "ACTIVE",
            listingPhase,
            minAvgVolume: "",
            maxAvgVolume: "",
            minTradingDays: "",
            maxTradingDays: "",
            industry,
            sortBy: "avgVolume",
            sortDir: "desc",
            page: 1,
            pageSize: 25,
          },
        };
        const savedPreset = {
          search: manualState.search,
          filters: {
            status: manualState.filters.status,
            listingPhase: manualState.filters.listingPhase,
            minAvgVolume: manualState.filters.minAvgVolume,
            maxAvgVolume: manualState.filters.maxAvgVolume,
            minTradingDays: manualState.filters.minTradingDays,
            maxTradingDays: manualState.filters.maxTradingDays,
            industry: manualState.filters.industry,
            sortBy: manualState.filters.sortBy,
            sortDir: manualState.filters.sortDir,
            pageSize: manualState.filters.pageSize,
          },
        };
        const appliedPresetFilters = {
          ...savedPreset.filters,
          page: 1,
        };

        const manualParams = buildScreenerQueryParams(manualState.search, manualState.filters);
        const presetParams = buildScreenerQueryParams(savedPreset.search, appliedPresetFilters);
        ensure(manualParams.toString() === presetParams.toString(), "manual/preset query string mismatch");

        const { response: manualRes, data: manualData } = await fetchJson(`/api/stocks?${manualParams.toString()}`);
        const { response: presetRes, data: presetData } = await fetchJson(`/api/stocks?${presetParams.toString()}`);
        ensure(manualRes.ok, `manual query HTTP ${manualRes.status}`);
        ensure(presetRes.ok, `preset query HTTP ${presetRes.status}`);

        const manualCanonical = canonicalizeStocksPayload(manualData);
        const presetCanonical = canonicalizeStocksPayload(presetData);
        ensure(manualCanonical.total === presetCanonical.total, "manual/preset total mismatch");
        ensure(manualCanonical.page === presetCanonical.page, "manual/preset page mismatch");
        ensure(manualCanonical.pageSize === presetCanonical.pageSize, "manual/preset pageSize mismatch");
        ensure(manualCanonical.sortBy === presetCanonical.sortBy, "manual/preset sortBy mismatch");
        ensure(manualCanonical.sortDir === presetCanonical.sortDir, "manual/preset sortDir mismatch");
        ensure(
          JSON.stringify(manualCanonical.symbols) === JSON.stringify(presetCanonical.symbols),
          "manual/preset symbol ordering mismatch"
        );

        logPass(name, `rows=${manualCanonical.symbols.length}, total=${manualCanonical.total}`);
      } catch (error) {
        failures += 1;
        logFail(name, error instanceof Error ? error.message : String(error));
      }
    },
    async () => {
      const name = "POST /api/assistant context payload contract";
      try {
        const richContextSnapshot = {
          page: "screener",
          symbol: "VNM",
          symbols: ["VNM", "FPT", " hpg "],
          timeframe: "365",
          selectedIndicators: ["sma20", "ema50"],
          filters: {
            search: "vnm",
            listingPhase: "HOSE",
            pageSize: 25,
            nested: { shouldStayOpaque: true },
          },
          lastApiPayload: {
            endpoint: "/api/stocks",
            params: { listingPhase: "HOSE", page: 1 },
          },
          navGroup: "analysis",
          exportContext: {
            reportType: "screener_snapshot",
            timeframe: "1y",
            filters: {
              listingPhase: "HOSE",
              includeInactive: false,
              pageSize: 25,
            },
          },
        };

        const rich = await fetchJson("/api/assistant", {
          method: "POST",
          body: {
            message: "",
            conversationHistory: [{ role: "user", content: "test context payload" }],
            contextSnapshot: richContextSnapshot,
            preferences: { language: "vi", detailLevel: "brief" },
          },
        });
        if (rich.response.status === 429) {
          logPass(name, "skipped rate-limited");
          return;
        }
        ensure(rich.response.status === 400, `expected 400 for rich context, got HTTP ${rich.response.status}`);
        ensure(rich.data?.success === false, "rich context should preserve error contract success=false");
        ensure(String(rich.data?.error ?? "") === "Message is required.", "rich context error contract mismatch");

        const legacy = await fetchJson("/api/assistant", {
          method: "POST",
          body: {
            message: "",
            conversationHistory: [],
            context: { page: "screener", filters: { listingPhase: "HOSE" } },
          },
        });
        if (legacy.response.status === 429) {
          logPass(name, "skipped rate-limited");
          return;
        }
        ensure(legacy.response.status === 400, `expected 400 for legacy context, got HTTP ${legacy.response.status}`);
        ensure(legacy.data?.success === false, "legacy context should preserve error contract success=false");
        ensure(String(legacy.data?.error ?? "") === "Message is required.", "legacy context error contract mismatch");
        ensure(String(legacy.data?.error ?? "") === String(rich.data?.error ?? ""), "legacy/rich error mismatch");

        logPass(name, "rich+legacy payload accepted");
      } catch (error) {
        failures += 1;
        logFail(name, error instanceof Error ? error.message : String(error));
      }
    },
    async () => {
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
