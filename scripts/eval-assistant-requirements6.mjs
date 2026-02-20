import fs from "node:fs";
import path from "node:path";

const baseUrl =
  process.env.ASSISTANT_REQ6_BASE_URL
  || process.env.ASSISTANT_EVAL_BASE_URL
  || process.env.SMOKE_BASE_URL
  || "http://localhost:3010";
const reportPath =
  process.env.ASSISTANT_REQ6_REPORT_PATH
  || "artifacts/assistant-requirements6-report.json";
const timeoutMs = Number(process.env.ASSISTANT_REQ6_TIMEOUT_MS ?? 30000);
const maxRetries = Number(process.env.ASSISTANT_REQ6_MAX_RETRIES ?? 2);
const retryBackoffMs = Number(process.env.ASSISTANT_REQ6_RETRY_BACKOFF_MS ?? 350);
const stabilityRounds = Math.max(1, Number(process.env.ASSISTANT_REQ6_STABILITY_ROUNDS ?? 2));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isRetryableError(error) {
  const text = String(error instanceof Error ? error.message : error ?? "").toLowerCase();
  return (
    text.includes("timeout")
    || text.includes("aborted")
    || text.includes("fetch")
    || text.includes("network")
    || text.includes("socket")
    || text.includes("connect")
  );
}

async function fetchJson(endpoint, options = {}) {
  const method = options.method ?? "GET";
  const body = options.body ?? null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
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
      if (isRetryableStatus(response.status) && attempt < maxRetries) {
        await sleep(retryBackoffMs * (attempt + 1));
        continue;
      }
      return { ok: response.ok, status: response.status, data, text };
    } catch (error) {
      if (attempt >= maxRetries || !isRetryableError(error)) {
        throw error;
      }
      await sleep(retryBackoffMs * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`request failed: ${endpoint}`);
}

async function callAssistant(message, contextSnapshot = { page: "home" }) {
  const payload = {
    message,
    conversationHistory: [],
    contextSnapshot,
    preferences: {
      language: "vi",
      detailLevel: "brief",
    },
  };
  return fetchJson("/api/assistant", {
    method: "POST",
    body: payload,
  });
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d");
}

function normalizeDate(input) {
  const text = String(input ?? "").trim();
  if (!text) return null;
  const yyyyMmDd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text);
  if (yyyyMmDd) {
    const yyyy = Number(yyyyMmDd[1]);
    const mm = Number(yyyyMmDd[2]);
    const dd = Number(yyyyMmDd[3]);
    return toIsoDate(yyyy, mm, dd);
  }
  const ddMmYyyy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/.exec(text);
  if (ddMmYyyy) {
    const dd = Number(ddMmYyyy[1]);
    const mm = Number(ddMmYyyy[2]);
    const yearRaw = Number(ddMmYyyy[3]);
    const yyyy = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    return toIsoDate(yyyy, mm, dd);
  }
  return null;
}

function toIsoDate(yyyy, mm, dd) {
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  const date = new Date(yyyy, mm - 1, dd);
  if (
    date.getFullYear() !== yyyy
    || date.getMonth() !== mm - 1
    || date.getDate() !== dd
  ) {
    return null;
  }
  return `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function isoFromAnyDate(value) {
  if (!value) return null;
  if (value instanceof Date) return toIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return toIsoDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

function hasMetricNumericClaim(text) {
  const normalized = normalizeText(text)
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, " ")
    .replace(/\b20\d{2}[/-]\d{1,2}[/-]\d{1,2}\b/g, " ")
    .replace(/\btop\s*\d+\b/g, " ");
  const lines = normalized.split(/[.!?\n]+/);
  const metricTokens = [
    "gia",
    "close",
    "open",
    "high",
    "low",
    "volume",
    "khoi luong",
    "pe",
    "pb",
    "roe",
    "roa",
    "margin",
    "drawdown",
    "return",
    "sharpe",
    "yoy",
  ];
  return lines.some((line) => metricTokens.some((token) => line.includes(token)) && /\d/.test(line));
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function getCitationSymbols(citations) {
  if (!Array.isArray(citations)) return [];
  return Array.from(
    new Set(
      citations
        .map((item) => String(item?.symbol ?? "").trim().toUpperCase())
        .filter((item) => item.length > 0)
    )
  );
}

async function runCase(id, description, fn) {
  const startedAt = Date.now();
  try {
    const evidence = await fn();
    return {
      id,
      description,
      pass: true,
      durationMs: Date.now() - startedAt,
      detail: "PASS",
      evidence: evidence ?? null,
    };
  } catch (error) {
    return {
      id,
      description,
      pass: false,
      durationMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : String(error),
      evidence: null,
    };
  }
}

async function runRequirement1() {
  const cases = [];
  cases.push(await runCase(
    "R1_1_ipo_timeline",
    "IPO-in-period symbol should expose non-full listing timeline.",
    async () => {
      const res = await fetchJson("/api/stocks?symbol=AAT&limit=5");
      ensure(res.ok, `HTTP ${res.status}`);
      const metadata = res.data?.metadata ?? {};
      ensure(metadata.listingPhase === "IPO_DURING_PERIOD", `listingPhase=${metadata.listingPhase ?? "n/a"}`);
      const firstDate = isoFromAnyDate(metadata.firstDate);
      ensure(firstDate !== null, "missing firstDate");
      ensure(firstDate > "2018-01-02", `expected firstDate > 2018-01-02, got ${firstDate}`);
      return { symbol: "AAT", listingPhase: metadata.listingPhase, firstDate, lastDate: isoFromAnyDate(metadata.lastDate) };
    }
  ));

  cases.push(await runCase(
    "R1_2_delisted_asof",
    "Delisted symbol query on future date should fallback to last available as-of date.",
    async () => {
      const universe = await fetchJson("/api/stocks?limit=500");
      ensure(universe.ok, `HTTP ${universe.status}`);
      const rows = Array.isArray(universe.data?.stocks) ? universe.data.stocks : [];
      const delisted = rows.find((item) => String(item?.status ?? "").toUpperCase() !== "ACTIVE");
      ensure(delisted, "no non-active symbol found");
      const requestedDate = "31-12-2025";
      const hist = await fetchJson(`/api/stocks?symbol=${encodeURIComponent(delisted.symbol)}&date=${requestedDate}&limit=1`);
      ensure(hist.ok, `HTTP ${hist.status}`);
      const metadata = hist.data?.metadata ?? {};
      ensure(String(metadata.status ?? "").toUpperCase() !== "ACTIVE", `status=${metadata.status ?? "n/a"}`);
      const requestedIso = normalizeDate(hist.data?.requestedDate ?? requestedDate);
      const asOfIso = normalizeDate(hist.data?.asOfDate);
      ensure(requestedIso !== null, "missing requestedDate");
      ensure(asOfIso !== null, "missing asOfDate");
      ensure(asOfIso <= requestedIso, `asOfDate=${asOfIso} > requestedDate=${requestedIso}`);
      return {
        symbol: delisted.symbol,
        status: metadata.status,
        requestedDate: requestedIso,
        asOfDate: asOfIso,
        exactDateMatch: hist.data?.exactDateMatch === true,
      };
    }
  ));

  cases.push(await runCase(
    "R1_3_non_active_presence",
    "Universe should expose non-active states (delisted/suspended-like lifecycle).",
    async () => {
      const universe = await fetchJson("/api/stocks?limit=500");
      ensure(universe.ok, `HTTP ${universe.status}`);
      const rows = Array.isArray(universe.data?.stocks) ? universe.data.stocks : [];
      const nonActive = rows.filter((item) => String(item?.status ?? "").toUpperCase() !== "ACTIVE");
      ensure(nonActive.length > 0, "no non-active symbols found");
      return {
        nonActiveCount: nonActive.length,
        sample: nonActive.slice(0, 5).map((item) => ({
          symbol: item.symbol,
          status: item.status,
          listingPhase: item.listingPhase,
          firstDate: isoFromAnyDate(item.firstDate),
          lastDate: isoFromAnyDate(item.lastDate),
        })),
      };
    }
  ));

  return cases;
}

async function runRequirement2() {
  const cases = [];
  cases.push(await runCase(
    "R2_1_all_statements_period_match",
    "BalanceSheet/IncomeStatement/CashFlow should align to requested period.",
    async () => {
      const period = "2025Q4";
      const res = await fetchJson(`/api/fundamentals?symbol=VNM&statement=all&period=${period}`);
      ensure(res.ok, `HTTP ${res.status}`);
      ensure(res.data?.period === period, `period=${res.data?.period ?? "n/a"}`);
      ensure(res.data?.balanceSheet?.period === period, "balanceSheet period mismatch");
      ensure(res.data?.incomeStatement?.period === period, "incomeStatement period mismatch");
      ensure(res.data?.cashFlow?.period === period, "cashFlow period mismatch");
      return {
        symbol: "VNM",
        period,
        coverageRatio: res.data?.coverage?.coverageRatio ?? null,
      };
    }
  ));

  cases.push(await runCase(
    "R2_2_partial_listing_period_query",
    "Fundamental query for IPO-in-period symbol should return requested historical period if available.",
    async () => {
      const period = "2018Q4";
      const res = await fetchJson(`/api/fundamentals?symbol=AAT&statement=all&period=${period}`);
      ensure(res.ok, `HTTP ${res.status}`);
      const available = Array.isArray(res.data?.availablePeriods) ? res.data.availablePeriods : [];
      ensure(available.includes(period), `period ${period} missing in availablePeriods`);
      ensure(res.data?.balanceSheet?.period === period, "balanceSheet period mismatch");
      ensure(res.data?.incomeStatement?.period === period, "incomeStatement period mismatch");
      ensure(res.data?.cashFlow?.period === period, "cashFlow period mismatch");
      return {
        symbol: "AAT",
        period,
        availablePeriodsCount: available.length,
      };
    }
  ));

  cases.push(await runCase(
    "R2_3_statement_specific_time_alignment",
    "Statement-specific endpoints should remain time-aligned across BS/IS/CF.",
    async () => {
      const period = "2024Q4";
      const bs = await fetchJson(`/api/fundamentals?symbol=FPT&statement=bs&period=${period}`);
      const is = await fetchJson(`/api/fundamentals?symbol=FPT&statement=is&period=${period}`);
      const cf = await fetchJson(`/api/fundamentals?symbol=FPT&statement=cf&period=${period}`);
      ensure(bs.ok && is.ok && cf.ok, `HTTP statuses bs=${bs.status}, is=${is.status}, cf=${cf.status}`);
      ensure(bs.data?.period === period, `bs period=${bs.data?.period ?? "n/a"}`);
      ensure(is.data?.period === period, `is period=${is.data?.period ?? "n/a"}`);
      ensure(cf.data?.period === period, `cf period=${cf.data?.period ?? "n/a"}`);
      return {
        symbol: "FPT",
        period,
        bsCoverage: bs.data?.coverage?.coverageRatio ?? null,
        isCoverage: is.data?.coverage?.coverageRatio ?? null,
        cfCoverage: cf.data?.coverage?.coverageRatio ?? null,
      };
    }
  ));

  return cases;
}

async function runRequirement3() {
  const cases = [];
  cases.push(await runCase(
    "R3_1_multi_symbol_fundamental_compare",
    "Assistant should recognize two symbols and run grounded multi-symbol compare.",
    async () => {
      const res = await callAssistant(
        "So sanh FPT va VNM: PE, PB, ROE, bien loi nhuan rong, tang truong doanh thu YoY quy gan nhat",
        { page: "home" }
      );
      ensure(res.ok, `HTTP ${res.status}`);
      ensure(res.data?.policyStatus === "ok", `policyStatus=${res.data?.policyStatus ?? "n/a"}`);
      const plan = String(res.data?.meta?.queryPlanSummary ?? "");
      ensure(plan.includes("symbols=FPT,VNM"), `queryPlanSummary=${plan || "n/a"}`);
      const symbols = getCitationSymbols(res.data?.citations);
      ensure(symbols.includes("FPT") && symbols.includes("VNM"), `citation symbols=${symbols.join(",") || "n/a"}`);
      return {
        policyStatus: res.data?.policyStatus,
        queryPlanSummary: plan,
        citationSymbols: symbols,
      };
    }
  ));

  cases.push(await runCase(
    "R3_2_multi_symbol_price_asof_compare",
    "Assistant should compare two small/mid symbols on a specific date.",
    async () => {
      const res = await callAssistant(
        "So sanh gia dong cua DHA va C32 ngay 28/05/2024",
        { page: "home" }
      );
      ensure(res.ok, `HTTP ${res.status}`);
      ensure(res.data?.policyStatus === "ok", `policyStatus=${res.data?.policyStatus ?? "n/a"}`);
      const symbols = getCitationSymbols(res.data?.citations);
      ensure(symbols.includes("DHA") && symbols.includes("C32"), `citation symbols=${symbols.join(",") || "n/a"}`);
      const stockSnapshotSuccess = Array.isArray(res.data?.usedTools)
        ? res.data.usedTools.filter((tool) => tool?.name === "stockSnapshot" && tool?.status === "success").length
        : 0;
      ensure(stockSnapshotSuccess >= 2, `stockSnapshot success count=${stockSnapshotSuccess}`);
      return {
        policyStatus: res.data?.policyStatus,
        stockSnapshotSuccess,
        citationSymbols: symbols,
      };
    }
  ));

  cases.push(await runCase(
    "R3_3_three_symbol_graceful_handling",
    "Assistant should handle 3-symbol compare gracefully (grounded output or safe fallback).",
    async () => {
      const res = await callAssistant(
        "So sanh PE giua FPT, VNM va DHA trong quy gan nhat",
        { page: "home" }
      );
      ensure(res.ok, `HTTP ${res.status}`);
      ensure(res.data?.success === true, "assistant success=false");
      const policyStatus = String(res.data?.policyStatus ?? "");
      ensure(["ok", "fallback", "shadow_blocked"].includes(policyStatus), `policyStatus=${policyStatus || "n/a"}`);
      if (policyStatus === "ok") {
        const symbols = getCitationSymbols(res.data?.citations);
        ensure(symbols.length >= 2, `citation symbols=${symbols.join(",") || "n/a"}`);
      } else {
        const text = String(res.data?.message ?? "");
        ensure(text.includes("INSUFFICIENT_DATA"), "missing INSUFFICIENT_DATA fallback");
        ensure(!hasMetricNumericClaim(text), "numeric claim detected in fallback");
      }
      return {
        policyStatus,
        queryPlanSummary: res.data?.meta?.queryPlanSummary ?? null,
      };
    }
  ));

  return cases;
}

async function runRequirement4() {
  const cases = [];
  cases.push(await runCase(
    "R4_1_no_false_fallback_when_data_exists",
    "When data exists, assistant should answer grounded instead of false fallback.",
    async () => {
      const res = await callAssistant("Gia dong cua FPT ngay 28/05/2024 la bao nhieu?", { page: "home" });
      ensure(res.ok, `HTTP ${res.status}`);
      ensure(res.data?.policyStatus === "ok", `policyStatus=${res.data?.policyStatus ?? "n/a"}`);
      const hasStocksCitation = Array.isArray(res.data?.citations)
        && res.data.citations.some((item) => String(item?.endpoint ?? "").includes("/api/stocks"));
      ensure(hasStocksCitation, "missing /api/stocks citation");
      ensure(hasMetricNumericClaim(String(res.data?.message ?? "")), "expected numeric claim in grounded answer");
      return {
        policyStatus: res.data?.policyStatus,
        queryPlanSummary: res.data?.meta?.queryPlanSummary ?? null,
      };
    }
  ));

  cases.push(await runCase(
    "R4_2_non_hose_guard_no_numeric",
    "Non-HOSE query should be blocked/fallback without numeric hallucination.",
    async () => {
      const res = await callAssistant("Top 10 gia dong cua cao nhat ngay 28/05/2024 tren HNX", { page: "home" });
      ensure(res.ok, `HTTP ${res.status}`);
      const policyStatus = String(res.data?.policyStatus ?? "");
      ensure(policyStatus === "shadow_blocked" || policyStatus === "fallback", `policyStatus=${policyStatus || "n/a"}`);
      ensure(!hasMetricNumericClaim(String(res.data?.message ?? "")), "numeric claim detected in blocked response");
      return { policyStatus };
    }
  ));

  cases.push(await runCase(
    "R4_3_future_date_guard_no_numeric",
    "Future-date query should be blocked/fallback without numeric hallucination.",
    async () => {
      const res = await callAssistant("Gia dong cua FPT ngay mai la bao nhieu?", { page: "home" });
      ensure(res.ok, `HTTP ${res.status}`);
      const policyStatus = String(res.data?.policyStatus ?? "");
      ensure(policyStatus === "shadow_blocked" || policyStatus === "fallback", `policyStatus=${policyStatus || "n/a"}`);
      ensure(!hasMetricNumericClaim(String(res.data?.message ?? "")), "numeric claim detected in future-date response");
      return { policyStatus };
    }
  ));

  return cases;
}

async function runRequirement5() {
  const cases = [];
  cases.push(await runCase(
    "R5_1_small_cap_symbol_selection",
    "System should locate at least one low-liquidity active HOSE symbol for stress testing.",
    async () => {
      const universe = await fetchJson("/api/stocks?limit=500");
      ensure(universe.ok, `HTTP ${universe.status}`);
      const rows = Array.isArray(universe.data?.stocks) ? universe.data.stocks : [];
      const active = rows
        .filter((item) => String(item?.status ?? "").toUpperCase() === "ACTIVE")
        .filter((item) => Number(item?.avgVolume) > 0)
        .sort((a, b) => Number(a.avgVolume) - Number(b.avgVolume));
      ensure(active.length > 0, "no active symbol found");
      const picked = active[0];
      return {
        symbol: picked.symbol,
        avgVolume: picked.avgVolume,
        listingPhase: picked.listingPhase,
      };
    }
  ));

  cases.push(await runCase(
    "R5_2_small_cap_api_query",
    "Low-liquidity symbol should still return as-of OHLCV data.",
    async () => {
      const universe = await fetchJson("/api/stocks?limit=500");
      ensure(universe.ok, `HTTP ${universe.status}`);
      const rows = Array.isArray(universe.data?.stocks) ? universe.data.stocks : [];
      const active = rows
        .filter((item) => String(item?.status ?? "").toUpperCase() === "ACTIVE")
        .filter((item) => Number(item?.avgVolume) > 0)
        .sort((a, b) => Number(a.avgVolume) - Number(b.avgVolume));
      ensure(active.length > 0, "no active symbol found");
      const symbol = active[0].symbol;
      const res = await fetchJson(`/api/stocks?symbol=${encodeURIComponent(symbol)}&date=28-05-2024&limit=1`);
      ensure(res.ok, `HTTP ${res.status}`);
      ensure(Array.isArray(res.data?.data) && res.data.data.length > 0, "missing OHLCV row");
      const rowDate = isoFromAnyDate(res.data.data[0]?.date);
      ensure(rowDate !== null, "missing OHLCV row date");
      const requestedDate = normalizeDate(res.data?.requestedDate ?? "28-05-2024");
      ensure(requestedDate !== null, "missing requestedDate");
      ensure(rowDate <= requestedDate, `rowDate=${rowDate} > requestedDate=${requestedDate}`);
      return {
        symbol,
        requestedDate,
        asOfDate: normalizeDate(res.data?.asOfDate),
        exactDateMatch: res.data?.exactDateMatch === true,
      };
    }
  ));

  cases.push(await runCase(
    "R5_3_small_cap_assistant_query",
    "Assistant should answer grounded query for a low-liquidity symbol.",
    async () => {
      const universe = await fetchJson("/api/stocks?limit=500");
      ensure(universe.ok, `HTTP ${universe.status}`);
      const rows = Array.isArray(universe.data?.stocks) ? universe.data.stocks : [];
      const active = rows
        .filter((item) => String(item?.status ?? "").toUpperCase() === "ACTIVE")
        .filter((item) => Number(item?.avgVolume) > 0)
        .sort((a, b) => Number(a.avgVolume) - Number(b.avgVolume));
      ensure(active.length > 0, "no active symbol found");
      const symbol = active[0].symbol;
      const res = await callAssistant(`Gia dong cua ${symbol} ngay 28/05/2024 la bao nhieu?`, { page: "home" });
      ensure(res.ok, `HTTP ${res.status}`);
      ensure(res.data?.policyStatus === "ok", `policyStatus=${res.data?.policyStatus ?? "n/a"}`);
      const symbols = getCitationSymbols(res.data?.citations);
      ensure(symbols.includes(symbol), `citation symbols=${symbols.join(",") || "n/a"} expected=${symbol}`);
      return {
        symbol,
        policyStatus: res.data?.policyStatus,
        queryPlanSummary: res.data?.meta?.queryPlanSummary ?? null,
      };
    }
  ));

  return cases;
}

async function runRequirement6() {
  const cases = [];

  cases.push(await runCase(
    "R6_1_ohlcv_timeline_matrix",
    "OHLCV should be stable across symbol/date matrix on HOSE.",
    async () => {
      const matrix = [
        { symbol: "FPT", date: "28-05-2024" },
        { symbol: "VNM", date: "28-05-2024" },
        { symbol: "DHA", date: "28-05-2024" },
        { symbol: "AAT", date: "24-03-2021" },
      ];
      const checks = [];
      for (const item of matrix) {
        const res = await fetchJson(
          `/api/stocks?symbol=${encodeURIComponent(item.symbol)}&date=${encodeURIComponent(item.date)}&limit=1`
        );
        ensure(res.ok, `${item.symbol} HTTP ${res.status}`);
        ensure(Array.isArray(res.data?.data) && res.data.data.length > 0, `${item.symbol} missing OHLCV row`);
        const row = res.data.data[0];
        const rowDate = isoFromAnyDate(row?.date);
        const reqDate = normalizeDate(item.date);
        ensure(rowDate !== null && reqDate !== null, `${item.symbol} invalid rowDate/requestedDate`);
        ensure(rowDate <= reqDate, `${item.symbol} rowDate=${rowDate} > requestedDate=${reqDate}`);
        checks.push({
          symbol: item.symbol,
          requestedDate: reqDate,
          asOfDate: normalizeDate(res.data?.asOfDate),
          exactDateMatch: res.data?.exactDateMatch === true,
          close: row?.close ?? null,
          volume: row?.volume ?? null,
        });
      }
      return { checks };
    }
  ));

  cases.push(await runCase(
    "R6_2_fundamentals_timeline_matrix",
    "BS/IS/CF should be stable across symbol/period matrix.",
    async () => {
      const matrix = [
        { symbol: "FPT", period: "2025Q4" },
        { symbol: "VNM", period: "2025Q4" },
        { symbol: "AAT", period: "2024Q4" },
      ];
      const checks = [];
      for (const item of matrix) {
        const res = await fetchJson(
          `/api/fundamentals?symbol=${encodeURIComponent(item.symbol)}&statement=all&period=${encodeURIComponent(item.period)}`
        );
        ensure(res.ok, `${item.symbol} HTTP ${res.status}`);
        ensure(res.data?.period === item.period, `${item.symbol} period=${res.data?.period ?? "n/a"} expected=${item.period}`);
        ensure(res.data?.balanceSheet?.period === item.period, `${item.symbol} bs period mismatch`);
        ensure(res.data?.incomeStatement?.period === item.period, `${item.symbol} is period mismatch`);
        ensure(res.data?.cashFlow?.period === item.period, `${item.symbol} cf period mismatch`);
        checks.push({
          symbol: item.symbol,
          period: item.period,
          coverageRatio: res.data?.coverage?.coverageRatio ?? null,
          availablePeriodsCount: Array.isArray(res.data?.availablePeriods) ? res.data.availablePeriods.length : 0,
        });
      }
      return { checks };
    }
  ));

  cases.push(await runCase(
    "R6_3_assistant_stability_rounds",
    "Assistant should remain stable across repeated robust queries.",
    async () => {
      const prompts = [
        { id: "P1", message: "Cho toi top 10 co phieu gia dong cua cao nhat ngay 28/05/2024 tren HOSE", expectPolicy: "ok" },
        { id: "P2", message: "Cho BCTN quy gan nhat cua VNM va tom tat diem chinh", expectPolicy: "ok" },
        { id: "P3", message: "So sanh gia dong cua DHA va C32 ngay 28/05/2024", expectPolicy: "ok" },
      ];
      const rows = [];
      let total = 0;
      let passed = 0;
      for (let round = 1; round <= stabilityRounds; round += 1) {
        for (const prompt of prompts) {
          total += 1;
          const res = await callAssistant(prompt.message, { page: "home" });
          ensure(res.ok, `${prompt.id} round ${round} HTTP ${res.status}`);
          const policyStatus = String(res.data?.policyStatus ?? "");
          const pass = policyStatus === prompt.expectPolicy;
          if (pass) passed += 1;
          rows.push({
            round,
            promptId: prompt.id,
            policyStatus,
            pass,
            queryIntent: res.data?.meta?.queryIntent ?? null,
          });
        }
      }
      const passRate = total > 0 ? passed / total : 0;
      ensure(passRate >= 0.95, `stability passRate=${passRate.toFixed(4)} < 0.95`);
      return { rounds: stabilityRounds, total, passed, passRate, rows };
    }
  ));

  return cases;
}

function summarizeRequirement(id, title, cases) {
  const total = cases.length;
  const passed = cases.filter((item) => item.pass).length;
  return {
    id,
    title,
    total,
    passed,
    failed: total - passed,
    passRate: total > 0 ? passed / total : 0,
    status: passed === total ? "pass" : "fail",
    cases,
  };
}

async function writeReport(report) {
  const absolutePath = path.resolve(reportPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return absolutePath;
}

async function main() {
  const startedAt = new Date().toISOString();
  const req1 = summarizeRequirement("R1", "Timeline and listing lifecycle handling", await runRequirement1());
  const req2 = summarizeRequirement("R2", "Financial statements correctness and time alignment", await runRequirement2());
  const req3 = summarizeRequirement("R3", "Multi-symbol linking and comparison handling", await runRequirement3());
  const req4 = summarizeRequirement("R4", "Anti-hallucination and safe fallback behavior", await runRequirement4());
  const req5 = summarizeRequirement("R5", "Small/junk stock query capability", await runRequirement5());
  const req6 = summarizeRequirement("R6", "Robust OHLCV/fundamentals timeline stability", await runRequirement6());

  const requirements = [req1, req2, req3, req4, req5, req6];
  const totalCases = requirements.reduce((acc, req) => acc + req.total, 0);
  const passedCases = requirements.reduce((acc, req) => acc + req.passed, 0);
  const failedCases = totalCases - passedCases;
  const overallStatus = failedCases === 0 ? "pass" : "fail";

  const report = {
    schemaVersion: "assistant-req6-v1",
    generatedAt: new Date().toISOString(),
    baseUrl,
    config: {
      timeoutMs,
      maxRetries,
      retryBackoffMs,
      stabilityRounds,
    },
    summary: {
      totalRequirements: requirements.length,
      passedRequirements: requirements.filter((req) => req.status === "pass").length,
      failedRequirements: requirements.filter((req) => req.status !== "pass").length,
      totalCases,
      passedCases,
      failedCases,
      passRate: totalCases > 0 ? passedCases / totalCases : 0,
      overallStatus,
    },
    requirements,
    startedAt,
    endedAt: new Date().toISOString(),
  };

  const written = await writeReport(report);
  for (const req of requirements) {
    console.log(`${req.status === "pass" ? "PASS" : "FAIL"} ${req.id} ${req.passed}/${req.total} ${req.title}`);
  }
  console.log(`REPORT_PATH=${written}`);
  console.log(
    `SUMMARY requirements=${report.summary.passedRequirements}/${report.summary.totalRequirements} cases=${passedCases}/${totalCases} overall=${overallStatus.toUpperCase()}`
  );

  if (overallStatus !== "pass") process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
