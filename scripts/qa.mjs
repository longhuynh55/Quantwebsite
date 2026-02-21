const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3010";
const defaultTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 180000);
const includeUiChecks = (() => {
  const raw = process.env.SMOKE_INCLUDE_UI;
  if (raw === undefined) return true;
  const normalized = String(raw).trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(normalized);
})();
const assistantEvalToken = String(process.env.ASSISTANT_EVAL_AUTH_TOKEN ?? "").trim();
const assistantSemanticGuardAttempts = Math.max(
  1,
  Number(process.env.ASSISTANT_SEMANTIC_GUARD_ATTEMPTS ?? 2)
);
const metricKeywords = [
  "net_return",
  "max_drawdown",
  "total_trades",
  "sharpe",
  "beta",
  "var",
  "volatility",
  "revenue",
  "income",
  "profit",
  "pe",
  "pb",
  "price",
  "close",
  "open",
  "high",
  "low",
  "volume",
];
const unitTokenRegex = /%|\b(vnd|usd|eur|dong|dong\/cp|cp|shares?|co phieu|points?|pts|ty|trieu|billion|million|bn|mn|x|times?|lan)\b/i;
const periodTokenRegex = /\b(20\d{2}[-/]\d{1,2}([-/]\d{1,2})?|20\d{2}\s*q[1-4]|q[1-4]\s*20\d{2}|fy\s*20\d{2}|latest|as of|today|hom nay|hien tai|ky|quy|nam|period)\b/i;
const unitlessMetricRegex = /\b(pe|pb|beta|sharpe|roe|roa|margin|ratio)\b/;
const WATCHLIST_MAX_SYMBOLS = 50;
const WATCHLIST_QUERY_IMPORT_MAX = 30;

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

function toDateKey(raw) {
  const ms = parseDateMs(raw);
  if (ms === null) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function normalizeSymbol(raw) {
  return String(raw ?? "").trim().toUpperCase();
}

function normalizeWatchlistSymbol(raw) {
  return normalizeSymbol(raw).replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function diffCalendarDays(olderDateKey, newerDateKey) {
  const olderMs = parseDateMs(`${olderDateKey}T00:00:00Z`);
  const newerMs = parseDateMs(`${newerDateKey}T00:00:00Z`);
  if (olderMs === null || newerMs === null) return Number.NaN;
  return Math.max(0, Math.round((newerMs - olderMs) / 86400000));
}

function formatSymbols(symbols, max = 6) {
  const list = uniq(symbols.map((item) => normalizeSymbol(item))).filter(Boolean);
  if (list.length === 0) return "none";
  if (list.length <= max) return list.join(", ");
  return `${list.slice(0, max).join(", ")} (+${list.length - max} more)`;
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

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

function providerLikelyUnavailable(response, data) {
  if (response?.status === 429 || response?.status === 500 || response?.status === 502 || response?.status === 504) {
    return true;
  }
  if (data?.success === true) return false;
  const errorText = String(data?.error ?? "").toLowerCase();
  if (!errorText) return false;
  return (
    errorText.includes("unavailable")
    || errorText.includes("provider")
    || errorText.includes("timeout")
    || errorText.includes("api key")
    || errorText.includes("authentication")
  );
}

function extractMetricNumericClaims(message) {
  const lines = String(message ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const claims = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const normalized = normalizeText(line);
    const hasNumber = /-?\d+(?:[.,]\d+)?%?/.test(normalized);
    const metric = metricKeywords.find((keyword) => normalized.includes(keyword));
    if (hasNumber && metric) {
      claims.push({ lineNo: i + 1, metric, line, normalized });
    }
  }
  return claims;
}

function isInsufficientDataResponse(message, policyStatus) {
  const normalized = normalizeText(message);
  if (String(policyStatus ?? "").trim().toLowerCase() === "fallback") return true;
  return (
    normalized.includes("insufficient_data")
    || normalized.includes("cannot provide numeric")
    || normalized.includes("grounded data")
    || normalized.includes("khong the")
    || normalized.includes("khong du du lieu")
  );
}

function validateMetricSemanticResponse(message, citations, policyStatus) {
  const claims = extractMetricNumericClaims(message);
  if (claims.length === 0) {
    if (isInsufficientDataResponse(message, policyStatus)) {
      return { ok: true, reason: "", claims, missingPeriodLines: [], missingUnitLines: [], citationOk: true };
    }
    return { ok: false, reason: "No metric-like numeric claims found.", claims, missingPeriodLines: [], missingUnitLines: [] };
  }

  const citationOk = Array.isArray(citations) && citations.some((item) => {
    const endpoint = String(item?.endpoint ?? "").trim();
    const title = String(item?.title ?? "").trim();
    return endpoint.length > 0 || title.length > 0;
  });
  const citationHasPeriod = Array.isArray(citations)
    && citations.some((item) => String(item?.period ?? "").trim().length > 0);

  const missingPeriodLines = [];
  const missingUnitLines = [];
  for (const claim of claims) {
    const hasPeriod = periodTokenRegex.test(claim.normalized) || citationHasPeriod;
    const hasUnit = unitTokenRegex.test(claim.normalized) || unitlessMetricRegex.test(claim.normalized);
    if (!hasPeriod) missingPeriodLines.push(claim.lineNo);
    if (!hasUnit) missingUnitLines.push(claim.lineNo);
  }

  const reasons = [];
  if (!citationOk) reasons.push("Missing citation for numeric claims.");
  if (missingPeriodLines.length > 0) reasons.push(`Missing period on lines: ${missingPeriodLines.join(", ")}`);
  if (missingUnitLines.length > 0) reasons.push(`Missing unit on lines: ${missingUnitLines.join(", ")}`);

  return {
    ok: reasons.length === 0,
    reason: reasons.join(" "),
    claims,
    missingPeriodLines,
    missingUnitLines,
    citationOk,
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

  const checks = [];

  let allStocks = [];
  let primarySymbol = null;
  let fullSymbol = null;
  let partialSymbol = null;
  let inactiveSymbol = null;
  let freshnessSampleSymbols = [];
  const fullSeriesBySymbol = new Map();
  const stockMetadataBySymbol = new Map();

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
      stockMetadataBySymbol.clear();
      for (const row of allStocks) {
        const sym = normalizeSymbol(row?.symbol);
        if (sym) stockMetadataBySymbol.set(sym, row);
      }

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
      const highCoverageActive = sortedByRowsDesc.filter((s) => Number(s?.dataRows) >= 365);
      freshnessSampleSymbols = (highCoverageActive.length > 0 ? highCoverageActive : sortedByRowsDesc)
        .slice(0, 6)
        .map((s) => normalizeSymbol(s?.symbol))
        .filter(Boolean);

      const infoParts = [
        primarySymbol ? `primary=${primarySymbol}` : null,
        fullSymbol ? `full=${fullSymbol}` : null,
        partialSymbol ? `partial=${partialSymbol}` : null,
        inactiveSymbol ? `inactive=${inactiveSymbol}` : null,
        freshnessSampleSymbols.length > 0 ? `freshnessSample=${freshnessSampleSymbols.join(",")}` : null,
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
    const name = "Watchlist persistence/query contract";
    try {
      ensure(allStocks.length > 0, "metadata unavailable for watchlist contract");
      const activeSymbols = allStocks
        .filter((item) => String(item?.status ?? "").toUpperCase() === "ACTIVE")
        .map((item) => normalizeSymbol(item?.symbol))
        .filter(Boolean);
      const seedSymbols = uniq([primarySymbol, fullSymbol, partialSymbol, ...activeSymbols.slice(0, 6)]).filter(Boolean);
      ensure(seedSymbols.length >= 3, "insufficient seed symbols for watchlist contract");

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

      const replay = mergeWatchlistSymbols(rawQueue, persisted);
      ensure(JSON.stringify(replay) === JSON.stringify(persisted), "watchlist addSymbols should be idempotent");

      const fromChartsQuery = parseChartsWatchlistQuery(persisted.join(","));
      const rehydrated = mergeWatchlistSymbols(fromChartsQuery, []);
      const expectedRehydrated = persisted.slice(0, WATCHLIST_QUERY_IMPORT_MAX);
      ensure(
        JSON.stringify(rehydrated) === JSON.stringify(expectedRehydrated),
        "watchlist query round-trip mismatch"
      );

      const queryCandidates = rehydrated
        .filter((symbol) => String(stockMetadataBySymbol.get(symbol)?.status ?? "").toUpperCase() === "ACTIVE")
        .slice(0, 6);
      ensure(queryCandidates.length >= 2, "insufficient active symbols to validate watchlist query");

      for (const symbol of queryCandidates) {
        const { response, data } = await fetchJson(`/api/stocks?symbol=${encodeURIComponent(symbol)}&limit=1`);
        ensure(response.ok, `${symbol} query HTTP ${response.status}`);
        ensure(Array.isArray(data?.data) && data.data.length === 1, `${symbol} expected 1-row series`);
        ensure(normalizeSymbol(data?.metadata?.symbol) === symbol, `${symbol} metadata mismatch`);
      }

      logPass(name, `persisted=${persisted.length}, queried=${queryCandidates.length}`);
    } catch (error) {
      failures += 1;
      logFail(name, error instanceof Error ? error.message : String(error));
    }
  });

  checks.push(async () => {
    const name = "Screener preset apply equivalence (manual vs preset query)";
    try {
      ensure(allStocks.length > 0, "metadata unavailable for preset contract");

      const activeRows = allStocks.filter((item) => String(item?.status ?? "").toUpperCase() === "ACTIVE");
      ensure(activeRows.length > 0, "no active rows for preset contract");
      const topSymbol = normalizeSymbol(activeRows[0]?.symbol ?? primarySymbol);
      ensure(topSymbol.length > 0, "unable to resolve top symbol for preset contract");
      const listingPhase = String(activeRows[0]?.listingPhase ?? "HOSE").trim() || "HOSE";
      const industry = String(
        activeRows.find((item) => typeof item?.icbName4 === "string" && item.icbName4.trim())?.icbName4 ?? ""
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

      const { response: manualResponse, data: manualData } = await fetchJson(`/api/stocks?${manualParams.toString()}`);
      const { response: presetResponse, data: presetData } = await fetchJson(`/api/stocks?${presetParams.toString()}`);
      ensure(manualResponse.ok, `manual query HTTP ${manualResponse.status}`);
      ensure(presetResponse.ok, `preset query HTTP ${presetResponse.status}`);

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
  });

  checks.push(async () => {
    const name = "POST /api/telemetry/ui-kpi contract";
    try {
      const symbol = normalizeSymbol(primarySymbol ?? "VNM") || "VNM";
      const { response, data } = await fetchJson("/api/telemetry/ui-kpi", {
        method: "POST",
        body: {
          metric: "assistant_contextual_action_ctr",
          event: "assistant_contextual_action_clicked",
          page: "charts",
          source: "qa_contract",
          symbol,
          count: 1,
          detail: {
            mode: "qa",
            contextual: true,
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

      const upperSymbol = normalizeSymbol(symbol);
      const sourceMetadata = stockMetadataBySymbol.get(upperSymbol);
      if (sourceMetadata) {
        const metadataRows = Number(sourceMetadata?.dataRows);
        if (Number.isFinite(metadataRows)) {
          ensure(
            metadataRows === data.total,
            `rows mismatch for ${upperSymbol}: metadata.dataRows=${metadataRows}, series.total=${data.total}; possible stale/truncated OHLCV`
          );
        }

        const expectedFirstDate = toDateKey(sourceMetadata?.firstDate);
        const expectedLastDate = toDateKey(sourceMetadata?.lastDate);
        const gotFirstDate = toDateKey(data.data[0]?.date);
        const gotLastDate = toDateKey(data.data[data.data.length - 1]?.date);

        if (expectedFirstDate && gotFirstDate) {
          ensure(
            gotFirstDate === expectedFirstDate,
            `first-date mismatch for ${upperSymbol}: metadata=${expectedFirstDate}, series=${gotFirstDate}; possible head truncation`
          );
        }
        if (expectedLastDate && gotLastDate) {
          ensure(
            gotLastDate === expectedLastDate,
            `last-date mismatch for ${upperSymbol}: metadata=${expectedLastDate}, series=${gotLastDate}; possible stale/tail truncation`
          );
        }
      } else if (Number.isFinite(Number(data.metadata?.dataRows))) {
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
    const name = "Stocks freshness/truncation guard (top active sample)";
    try {
      const sample = uniq(freshnessSampleSymbols).slice(0, 6);
      ensure(sample.length >= 3, `insufficient active sample for freshness check (got ${sample.length}, need >=3)`);

      const observations = [];
      for (const sym of sample) {
        const { response, data } = await fetchJson(`/api/stocks?symbol=${encodeURIComponent(sym)}&limit=1`);
        ensure(response.ok, `${sym} HTTP ${response.status}`);
        ensure(Array.isArray(data?.data), `${sym} data is not an array`);
        ensure(data.data.length === 1, `${sym} expected 1 row for limit=1, got ${data.data.length}`);
        ensure(Number.isFinite(data?.total) && data.total > 0, `${sym} invalid total`);

        const lastDate = toDateKey(data.data[0]?.date);
        ensure(lastDate, `${sym} invalid last date in limit=1 response`);

        const sourceMetadata = stockMetadataBySymbol.get(normalizeSymbol(sym));
        if (sourceMetadata && Number.isFinite(Number(sourceMetadata?.dataRows))) {
          const expectedRows = Number(sourceMetadata.dataRows);
          ensure(
            expectedRows === data.total,
            `${sym} metadata.dataRows=${expectedRows}, API total=${data.total}; possible stale/truncated stock dataset`
          );
        }

        observations.push({ symbol: sym, lastDate });
      }

      const cohortLatest = observations.reduce((latest, item) => (item.lastDate > latest ? item.lastDate : latest), "");
      ensure(cohortLatest, "unable to determine cohort latest date");

      const stale = observations
        .map((item) => ({
          symbol: item.symbol,
          lastDate: item.lastDate,
          lagDays: diffCalendarDays(item.lastDate, cohortLatest),
        }))
        .filter((item) => Number.isFinite(item.lagDays) && item.lagDays > 20);

      ensure(
        stale.length <= 1,
        `stale sample symbols vs cohort latest ${cohortLatest}: ${stale
          .map((item) => `${item.symbol}@${item.lastDate}(lag=${item.lagDays}d)`)
          .join(", ")}`
      );

      logPass(name, `sample=${sample.length}, latest=${cohortLatest}, stale>${20}d=${stale.length}`);
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

        const requestedSymbols = symbols.map((sym) => normalizeSymbol(sym)).filter(Boolean);
        const requestedSet = new Set(requestedSymbols);
        const universeSymbols = data.effectiveUniverse.map((sym) => normalizeSymbol(sym)).filter(Boolean);
        const universeSet = new Set(universeSymbols);
        ensure(
          universeSet.size === universeSymbols.length,
          `method=${method} duplicate symbols in effectiveUniverse: ${formatSymbols(universeSymbols)}`
        );

        const excludedSymbols = data.excludedSymbols
          .map((item) => normalizeSymbol(item?.symbol))
          .filter(Boolean);
        const excludedSet = new Set(excludedSymbols);
        const overlap = universeSymbols.filter((sym) => excludedSet.has(sym));
        ensure(
          overlap.length === 0,
          `method=${method} symbol appears in both effectiveUniverse and excludedSymbols: ${formatSymbols(overlap)}`
        );

        const unknownUniverse = universeSymbols.filter((sym) => !requestedSet.has(sym));
        ensure(
          unknownUniverse.length === 0,
          `method=${method} effectiveUniverse contains unknown symbols: ${formatSymbols(unknownUniverse)}`
        );

        const unknownExcluded = [...excludedSet].filter((sym) => !requestedSet.has(sym));
        ensure(
          unknownExcluded.length === 0,
          `method=${method} excludedSymbols contains unknown symbols: ${formatSymbols(unknownExcluded)}`
        );

        const accounted = new Set([...universeSet, ...excludedSet]);
        const missingRequested = [...requestedSet].filter((sym) => !accounted.has(sym));
        ensure(
          missingRequested.length === 0,
          `method=${method} unaccounted requested symbols: ${formatSymbols(missingRequested)}`
        );

        const allocationSymbols = data.allocations.map((item) => normalizeSymbol(item?.symbol)).filter(Boolean);
        const allocationSet = new Set(allocationSymbols);
        ensure(
          allocationSet.size === allocationSymbols.length,
          `method=${method} duplicate symbols in allocations: ${formatSymbols(allocationSymbols)}`
        );
        const missingAlloc = universeSymbols.filter((sym) => !allocationSet.has(sym));
        const extraAlloc = allocationSymbols.filter((sym) => !universeSet.has(sym));
        ensure(
          missingAlloc.length === 0 && extraAlloc.length === 0,
          `method=${method} allocations/effectiveUniverse mismatch missing=${formatSymbols(missingAlloc)} extra=${formatSymbols(extraAlloc)}`
        );

        // Weights sanity
        const weights = data.allocations.map((a) => Number(a?.weight));
        ensure(weights.every((w) => Number.isFinite(w) && w >= 0), `method=${method} invalid weights`);
        const sum = weights.reduce((acc, v) => acc + v, 0);
        ensure(approxEqual(sum, 1, 1e-6), `method=${method} weights sum != 1 (sum=${sum})`);

        // Correlation matrix shape sanity
        ensure(data?.correlationMatrix?.symbols, `method=${method} correlationMatrix.symbols missing`);
        ensure(Array.isArray(data?.correlationMatrix?.matrix), `method=${method} correlationMatrix.matrix missing`);
        const mSyms = data.correlationMatrix.symbols.map((sym) => normalizeSymbol(sym)).filter(Boolean);
        const m = data.correlationMatrix.matrix;
        ensure(mSyms.length === m.length, `method=${method} correlation matrix dimension mismatch`);
        for (const row of m) {
          ensure(Array.isArray(row) && row.length === mSyms.length, `method=${method} correlation row mismatch`);
        }
        const matrixSet = new Set(mSyms);
        ensure(matrixSet.size === mSyms.length, `method=${method} duplicate symbols in correlationMatrix: ${formatSymbols(mSyms)}`);
        const missingMatrix = universeSymbols.filter((sym) => !matrixSet.has(sym));
        const extraMatrix = mSyms.filter((sym) => !universeSet.has(sym));
        ensure(
          missingMatrix.length === 0 && extraMatrix.length === 0,
          `method=${method} correlationMatrix/effectiveUniverse mismatch missing=${formatSymbols(missingMatrix)} extra=${formatSymbols(extraMatrix)}`
        );

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

  checks.push(async () => {
    const name = "POST /api/assistant context payload contract";
    try {
      const contextSymbol = normalizeSymbol(primarySymbol ?? "VNM") || "VNM";
      const richContextSnapshot = {
        page: "screener",
        symbol: contextSymbol,
        symbols: [contextSymbol, normalizeSymbol(fullSymbol ?? ""), normalizeSymbol(partialSymbol ?? "")].filter(Boolean),
        timeframe: "365",
        selectedIndicators: ["sma20", "ema50"],
        filters: {
          search: contextSymbol.toLowerCase(),
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
          context: { page: "screener", filters: { listingPhase: "HOSE", search: contextSymbol } },
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
  });

  checks.push(async () => {
    const name = "POST /api/assistant semantic metric guard (period/unit/citation)";
    try {
      const symbol = String(primarySymbol ?? "VNM");
      const prompt = [
        `Cho toi backtest SMA crossover cua ${symbol}.`,
        "Tra loi dung 3 dong theo format: metric=<number> <unit> | period=<period>.",
        "Bat buoc co period va unit ro rang cho moi metric.",
      ].join("\n");

      const evalHeaders = assistantEvalToken
        ? {
            "x-assistant-eval": "true",
            "x-assistant-eval-token": assistantEvalToken,
          }
        : {};

      let lastReason = "semantic metric guard failed";
      for (let attempt = 1; attempt <= assistantSemanticGuardAttempts; attempt += 1) {
        const { response, data } = await fetchJson("/api/assistant", {
          method: "POST",
          headers: evalHeaders,
          body: {
            message: prompt,
            conversationHistory: [],
            contextSnapshot: {
              page: "backtesting",
              symbol,
            },
            preferences: {
              language: "vi",
              detailLevel: "brief",
            },
          },
        });

        if (providerLikelyUnavailable(response, data)) {
          logInfo(`semantic metric guard skipped: provider unavailable (HTTP ${response.status})`);
          logPass(name, "skipped provider unavailable");
          return;
        }

        if (!response.ok) {
          lastReason = `HTTP ${response.status}`;
        } else if (data?.success !== true) {
          lastReason = "assistant success=false";
        } else if (!(typeof data?.message === "string" && data.message.length > 0)) {
          lastReason = "assistant message missing";
        } else {
          const verdict = validateMetricSemanticResponse(data.message, data?.citations, data?.policyStatus);
          if (verdict.ok) {
            logPass(name, `symbol=${symbol}, claims=${verdict.claims.length}, attempt=${attempt}/${assistantSemanticGuardAttempts}`);
            return;
          }
          lastReason = verdict.reason || "semantic metric guard failed";
        }

        if (attempt < assistantSemanticGuardAttempts) {
          logInfo(
            `semantic metric guard retry ${attempt}/${assistantSemanticGuardAttempts} for ${symbol}: ${lastReason}`
          );
          await sleep(400);
        }
      }

      throw new Error(lastReason);
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
      { path: "/backtesting", mustContain: ["Backtesting"] },
      { path: "/factors", mustContain: ["Factor Analysis"] },
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
