import fs from "node:fs";
import path from "node:path";

const baseUrl =
  process.env.ASSISTANT_REQ6_V2_BASE_URL
  || process.env.ASSISTANT_REQ6_BASE_URL
  || process.env.ASSISTANT_EVAL_BASE_URL
  || process.env.SMOKE_BASE_URL
  || "http://localhost:3010";
const reportPath =
  process.env.ASSISTANT_REQ6_V2_REPORT_PATH
  || "artifacts/assistant-requirements6-v2-report.json";
const timeoutMs = Number(process.env.ASSISTANT_REQ6_V2_TIMEOUT_MS ?? 30000);
const maxRetries = Number(process.env.ASSISTANT_REQ6_V2_MAX_RETRIES ?? 2);
const retryBackoffMs = Number(process.env.ASSISTANT_REQ6_V2_RETRY_BACKOFF_MS ?? 350);
const stabilityRounds = Math.max(1, Number(process.env.ASSISTANT_REQ6_V2_STABILITY_ROUNDS ?? 3));

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
  return callAssistantWithHistory(message, [], contextSnapshot);
}

async function callAssistantWithHistory(message, conversationHistory = [], contextSnapshot = { page: "home" }) {
  const payload = {
    message,
    conversationHistory,
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

function getStockRows(payload) {
  return Array.isArray(payload?.stocks) ? payload.stocks : [];
}

function getActiveRows(rows) {
  return rows.filter((item) => String(item?.status ?? "").toUpperCase() === "ACTIVE");
}

function getNonActiveRows(rows) {
  return rows.filter((item) => String(item?.status ?? "").toUpperCase() !== "ACTIVE");
}

function pickLowLiquiditySymbols(rows, count = 3) {
  const ranked = getActiveRows(rows)
    .filter((item) => Number(item?.avgVolume) > 0)
    .sort((a, b) => Number(a.avgVolume) - Number(b.avgVolume));
  return ranked.slice(0, count);
}

function countToolSuccess(usedTools, toolName) {
  if (!Array.isArray(usedTools)) return 0;
  return usedTools.filter((tool) => tool?.name === toolName && tool?.status === "success").length;
}

function hasCitationEndpoint(citations, fragment) {
  if (!Array.isArray(citations)) return false;
  return citations.some((item) => String(item?.endpoint ?? "").includes(fragment));
}

async function runRequirement1() {
  const cases = [];
  const universe = await fetchJson("/api/stocks?limit=500");
  ensure(universe.ok, `universe HTTP ${universe.status}`);
  const rows = getStockRows(universe.data);
  const nonActive = getNonActiveRows(rows);
  const delisted = nonActive.find((item) => String(item?.status ?? "").toUpperCase() === "DELISTED") ?? nonActive[0];
  const ipoDuringPeriod = getActiveRows(rows).find((item) => String(item?.listingPhase ?? "") === "IPO_DURING_PERIOD");

  cases.push(await runCase(
    "R1_1_ipo_timeline",
    "IPO-in-period symbol should expose non-full listing timeline.",
    async () => {
      ensure(ipoDuringPeriod, "no IPO_DURING_PERIOD symbol found");
      const res = await fetchJson(`/api/stocks?symbol=${encodeURIComponent(ipoDuringPeriod.symbol)}&limit=5`);
      ensure(res.ok, `HTTP ${res.status}`);
      const metadata = res.data?.metadata ?? {};
      ensure(metadata.listingPhase === "IPO_DURING_PERIOD", `listingPhase=${metadata.listingPhase ?? "n/a"}`);
      const firstDate = isoFromAnyDate(metadata.firstDate);
      ensure(firstDate !== null, "missing firstDate");
      ensure(firstDate > "2018-01-02", `expected firstDate > 2018-01-02, got ${firstDate}`);
      return {
        symbol: metadata.symbol ?? ipoDuringPeriod.symbol,
        listingPhase: metadata.listingPhase,
        firstDate,
        lastDate: isoFromAnyDate(metadata.lastDate),
      };
    }
  ));

  cases.push(await runCase(
    "R1_2_delisted_asof",
    "Delisted symbol query on future date should fallback to last available as-of date.",
    async () => {
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

  cases.push(await runCase(
    "R1_4_exact_match_flag",
    "Exact date match flag should be true when requested date has trading row.",
    async () => {
      const target = getActiveRows(rows).find((item) => isoFromAnyDate(item?.firstDate) <= "2024-05-28");
      ensure(target, "no suitable active symbol found");
      const res = await fetchJson(`/api/stocks?symbol=${encodeURIComponent(target.symbol)}&date=28-05-2024&limit=1`);
      ensure(res.ok, `HTTP ${res.status}`);
      ensure(res.data?.exactDateMatch === true, `exactDateMatch=${String(res.data?.exactDateMatch)}`);
      const asOfIso = normalizeDate(res.data?.asOfDate);
      ensure(asOfIso === "2024-05-28", `asOfDate=${asOfIso ?? "n/a"} expected=2024-05-28`);
      return {
        symbol: target.symbol,
        asOfDate: asOfIso,
        exactDateMatch: res.data?.exactDateMatch === true,
      };
    }
  ));

  cases.push(await runCase(
    "R1_5_asof_not_after_last_trading_day",
    "As-of date should never exceed symbol last available date.",
    async () => {
      ensure(delisted, "no non-active symbol found");
      const lastDate = isoFromAnyDate(delisted.lastDate);
      ensure(lastDate !== null, "missing lastDate");
      const res = await fetchJson(`/api/stocks?symbol=${encodeURIComponent(delisted.symbol)}&date=31-12-2099&limit=1`);
      ensure(res.ok, `HTTP ${res.status}`);
      const asOf = normalizeDate(res.data?.asOfDate);
      ensure(asOf !== null, "missing asOfDate");
      ensure(asOf <= lastDate, `asOfDate=${asOf} > lastDate=${lastDate}`);
      return {
        symbol: delisted.symbol,
        lastDate,
        asOfDate: asOf,
      };
    }
  ));

  cases.push(await runCase(
    "R1_6_metadata_consistency",
    "Metadata should expose consistent firstDate <= lastDate and positive trading days.",
    async () => {
      const sample = rows.slice(0, 30);
      ensure(sample.length > 0, "empty universe sample");
      for (const item of sample) {
        const first = isoFromAnyDate(item?.firstDate);
        const last = isoFromAnyDate(item?.lastDate);
        ensure(first !== null && last !== null, `invalid first/last date for ${item?.symbol ?? "n/a"}`);
        ensure(first <= last, `${item?.symbol ?? "n/a"} firstDate=${first} > lastDate=${last}`);
        ensure(Number(item?.totalTradingDays) > 0, `${item?.symbol ?? "n/a"} totalTradingDays invalid`);
      }
      return {
        checkedSymbols: sample.length,
      };
    }
  ));

  return cases;
}

async function runRequirement2() {
  const cases = [];
  const symbols = ["FPT", "VNM", "AAT"];
  const periods = ["2024Q4", "2025Q4"];

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

  cases.push(await runCase(
    "R2_4_available_periods_sorted",
    "Available periods should be sorted ascending without duplicates.",
    async () => {
      const res = await fetchJson("/api/fundamentals?symbol=VNM&statement=all");
      ensure(res.ok, `HTTP ${res.status}`);
      const periodsList = Array.isArray(res.data?.availablePeriods) ? res.data.availablePeriods : [];
      ensure(periodsList.length > 0, "availablePeriods empty");
      const dedupeSize = new Set(periodsList).size;
      ensure(dedupeSize === periodsList.length, "availablePeriods contains duplicates");
      const sorted = [...periodsList].sort((a, b) => String(a).localeCompare(String(b)));
      ensure(JSON.stringify(sorted) === JSON.stringify(periodsList), "availablePeriods is not sorted ascending");
      return {
        count: periodsList.length,
        first: periodsList[0],
        last: periodsList[periodsList.length - 1],
      };
    }
  ));

  cases.push(await runCase(
    "R2_5_cross_symbol_period_matrix",
    "Fundamental data should be queryable across symbol-period matrix.",
    async () => {
      const checks = [];
      for (const symbol of symbols) {
        for (const period of periods) {
          const res = await fetchJson(
            `/api/fundamentals?symbol=${encodeURIComponent(symbol)}&statement=all&period=${encodeURIComponent(period)}`
          );
          ensure(res.ok, `${symbol} ${period} HTTP ${res.status}`);
          ensure(res.data?.period === period, `${symbol} ${period} period mismatch`);
          checks.push({
            symbol,
            period,
            coverageRatio: res.data?.coverage?.coverageRatio ?? null,
          });
        }
      }
      return { checks };
    }
  ));

  cases.push(await runCase(
    "R2_6_assistant_statement_timegrounding",
    "Assistant statement request should include fundamentals citation and stable policy.",
    async () => {
      const res = await callAssistant("Cho toi BCTN quy 4 2024 cua VNM, chi so doanh thu va loi nhuan sau thue.", { page: "charts", symbol: "VNM" });
      ensure(res.ok, `HTTP ${res.status}`);
      ensure(res.data?.policyStatus === "ok", `policyStatus=${res.data?.policyStatus ?? "n/a"}`);
      const hasFundamentalsCitation = hasCitationEndpoint(res.data?.citations, "/api/fundamentals");
      ensure(hasFundamentalsCitation, "missing fundamentals citation");
      const plan = String(res.data?.meta?.queryPlanSummary ?? "");
      ensure(plan.includes("fundamentalSnapshot"), `queryPlanSummary=${plan || "n/a"}`);
      return {
        policyStatus: res.data?.policyStatus,
        queryPlanSummary: plan,
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

  cases.push(await runCase(
    "R3_4_lowercase_vs_pattern",
    "Lowercase compare pattern should still resolve symbols correctly.",
    async () => {
      const res = await callAssistant(
        "so sanh fpt vs vnm ve pe va pb quy gan nhat",
        { page: "home" }
      );
      ensure(res.ok, `HTTP ${res.status}`);
      const policyStatus = String(res.data?.policyStatus ?? "");
      ensure(policyStatus === "ok" || policyStatus === "fallback", `policyStatus=${policyStatus || "n/a"}`);
      const plan = String(res.data?.meta?.queryPlanSummary ?? "");
      ensure(plan.includes("FPT") && plan.includes("VNM"), `queryPlanSummary=${plan || "n/a"}`);
      return {
        policyStatus,
        queryPlanSummary: plan,
      };
    }
  ));

  cases.push(await runCase(
    "R3_5_mixed_metric_prompt",
    "Complex mixed prompt (price + fundamentals + date) should stay grounded.",
    async () => {
      const res = await callAssistant(
        "So sanh FPT va VNM: gia dong cua ngay 28/05/2024, PE va ROE quy gan nhat",
        { page: "home" }
      );
      ensure(res.ok, `HTTP ${res.status}`);
      ensure(res.data?.success === true, "assistant success=false");
      const symbols = getCitationSymbols(res.data?.citations);
      ensure(symbols.includes("FPT") && symbols.includes("VNM"), `citation symbols=${symbols.join(",") || "n/a"}`);
      ensure(
        hasCitationEndpoint(res.data?.citations, "/api/stocks") || hasCitationEndpoint(res.data?.citations, "/api/fundamentals"),
        "missing stock/fundamentals citation"
      );
      return {
        policyStatus: res.data?.policyStatus ?? null,
        citationSymbols: symbols,
      };
    }
  ));

  cases.push(await runCase(
    "R3_6_followup_context_carry",
    "Follow-up prompt should carry context for symbol/date scope.",
    async () => {
      const first = await callAssistantWithHistory(
        "Cho toi top 5 gia dong cua cao nhat ngay 28/05/2024 tren HOSE",
        [],
        { page: "home" }
      );
      ensure(first.ok, `first HTTP ${first.status}`);
      const history = [
        { role: "user", content: "Cho toi top 5 gia dong cua cao nhat ngay 28/05/2024 tren HOSE" },
        { role: "assistant", content: String(first.data?.message ?? "") },
      ];
      const second = await callAssistantWithHistory("con theo volume thi sao", history, {
        page: "home",
        filters: {
          date: "28/05/2024",
          limit: 5,
          metric: "volume",
          exchange: "HOSE",
        },
      });
      ensure(second.ok, `follow-up HTTP ${second.status}`);
      ensure(second.data?.policyStatus === "ok", `policyStatus=${second.data?.policyStatus ?? "n/a"}`);
      const plan = String(second.data?.meta?.queryPlanSummary ?? "");
      ensure(plan.includes("date=28-05-2024") || plan.includes("date=28/05/2024"), `queryPlanSummary=${plan || "n/a"}`);
      ensure(countToolSuccess(second.data?.usedTools, "stockSnapshot") > 0, "stockSnapshot not used in follow-up");
      return {
        followupPolicyStatus: second.data?.policyStatus,
        followupPlan: plan,
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

  cases.push(await runCase(
    "R4_4_explicit_future_date_no_numeric",
    "Explicit far-future date should be blocked/fallback without numeric hallucination.",
    async () => {
      const res = await callAssistant("Top 10 gia dong cua cao nhat ngay 31/12/2099 tren HOSE", { page: "home" });
      ensure(res.ok, `HTTP ${res.status}`);
      const policyStatus = String(res.data?.policyStatus ?? "");
      ensure(policyStatus === "shadow_blocked" || policyStatus === "fallback", `policyStatus=${policyStatus || "n/a"}`);
      ensure(!hasMetricNumericClaim(String(res.data?.message ?? "")), "numeric claim detected in explicit future-date response");
      return { policyStatus };
    }
  ));

  cases.push(await runCase(
    "R4_5_unknown_symbol_safe_response",
    "Unknown symbol request should avoid fabricated numeric outputs.",
    async () => {
      const res = await callAssistant("Gia dong cua ZZZZ ngay 28/05/2024 la bao nhieu?", { page: "home" });
      ensure(res.ok, `HTTP ${res.status}`);
      const policyStatus = String(res.data?.policyStatus ?? "");
      ensure(["ok", "fallback", "shadow_blocked"].includes(policyStatus), `policyStatus=${policyStatus || "n/a"}`);
      if (policyStatus !== "ok") {
        ensure(!hasMetricNumericClaim(String(res.data?.message ?? "")), "numeric claim detected in unknown-symbol fallback");
      }
      return {
        policyStatus,
        policyReason: res.data?.policyReason ?? null,
      };
    }
  ));

  cases.push(await runCase(
    "R4_6_non_hose_upcom_no_numeric",
    "UPCOM scope query should be blocked/fallback without fabricated numbers.",
    async () => {
      const res = await callAssistant("Top 5 co phieu gia dong cua cao nhat tren UPCOM ngay 28/05/2024", { page: "home" });
      ensure(res.ok, `HTTP ${res.status}`);
      const policyStatus = String(res.data?.policyStatus ?? "");
      ensure(policyStatus === "shadow_blocked" || policyStatus === "fallback", `policyStatus=${policyStatus || "n/a"}`);
      ensure(!hasMetricNumericClaim(String(res.data?.message ?? "")), "numeric claim detected for UPCOM blocked response");
      return { policyStatus };
    }
  ));

  return cases;
}

async function runRequirement5() {
  const cases = [];
  const universe = await fetchJson("/api/stocks?limit=500");
  ensure(universe.ok, `universe HTTP ${universe.status}`);
  const rows = getStockRows(universe.data);
  const lowLiquidity = pickLowLiquiditySymbols(rows, 5);

  cases.push(await runCase(
    "R5_1_small_cap_symbol_selection",
    "System should locate at least one low-liquidity active HOSE symbol for stress testing.",
    async () => {
      ensure(lowLiquidity.length > 0, "no low-liquidity active symbol found");
      const picked = lowLiquidity[0];
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
      ensure(lowLiquidity.length > 0, "no low-liquidity active symbol found");
      const symbol = lowLiquidity[0].symbol;
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
      ensure(lowLiquidity.length > 0, "no low-liquidity active symbol found");
      const symbol = lowLiquidity[0].symbol;
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

  cases.push(await runCase(
    "R5_4_low_liquidity_batch_api",
    "Batch low-liquidity symbols should all return OHLCV as-of rows.",
    async () => {
      ensure(lowLiquidity.length >= 3, `insufficient low-liquidity sample count=${lowLiquidity.length}`);
      const sample = lowLiquidity.slice(0, 3);
      const checks = [];
      for (const item of sample) {
        const res = await fetchJson(`/api/stocks?symbol=${encodeURIComponent(item.symbol)}&date=28-05-2024&limit=1`);
        ensure(res.ok, `${item.symbol} HTTP ${res.status}`);
        ensure(Array.isArray(res.data?.data) && res.data.data.length > 0, `${item.symbol} missing OHLCV row`);
        checks.push({
          symbol: item.symbol,
          asOfDate: normalizeDate(res.data?.asOfDate),
          exactDateMatch: res.data?.exactDateMatch === true,
        });
      }
      return { checks };
    }
  ));

  cases.push(await runCase(
    "R5_5_low_liquidity_fundamentals",
    "Low-liquidity symbols should still expose fundamentals coverage when available.",
    async () => {
      ensure(lowLiquidity.length > 0, "no low-liquidity active symbol found");
      const symbol = lowLiquidity[0].symbol;
      const res = await fetchJson(`/api/fundamentals?symbol=${encodeURIComponent(symbol)}&statement=all`);
      ensure(res.ok, `HTTP ${res.status}`);
      const available = Array.isArray(res.data?.availablePeriods) ? res.data.availablePeriods : [];
      ensure(available.length > 0, `no available periods for ${symbol}`);
      ensure(res.data?.coverage?.coverageRatio >= 0, `invalid coverageRatio for ${symbol}`);
      return {
        symbol,
        availablePeriodsCount: available.length,
        coverageRatio: res.data?.coverage?.coverageRatio ?? null,
      };
    }
  ));

  cases.push(await runCase(
    "R5_6_small_cap_compare_assistant",
    "Assistant should handle low-liquidity pair comparison without breaking grounding.",
    async () => {
      ensure(lowLiquidity.length >= 2, `insufficient low-liquidity sample count=${lowLiquidity.length}`);
      const left = lowLiquidity[0].symbol;
      const right = lowLiquidity[1].symbol;
      const res = await callAssistant(`So sanh gia dong cua ${left} va ${right} ngay 28/05/2024`, { page: "home" });
      ensure(res.ok, `HTTP ${res.status}`);
      ensure(res.data?.policyStatus === "ok", `policyStatus=${res.data?.policyStatus ?? "n/a"}`);
      const symbols = getCitationSymbols(res.data?.citations);
      ensure(symbols.includes(left) && symbols.includes(right), `citation symbols=${symbols.join(",") || "n/a"}`);
      return {
        symbols: [left, right],
        policyStatus: res.data?.policyStatus,
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
        { id: "P4", message: "Top 5 co phieu gia dong cua cao nhat tren UPCOM ngay 28/05/2024", expectPolicy: "shadow_blocked" },
        { id: "P5", message: "Gia dong cua FPT ngay mai la bao nhieu?", expectPolicy: "shadow_blocked" },
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
      ensure(passRate >= 0.92, `stability passRate=${passRate.toFixed(4)} < 0.92`);
      return { rounds: stabilityRounds, total, passed, passRate, rows };
    }
  ));

  cases.push(await runCase(
    "R6_4_ohlcv_recent_window_consistency",
    "Recent OHLCV window should maintain monotonic dates and valid OHLC bounds.",
    async () => {
      const symbols = ["FPT", "VNM", "DHA"];
      const checks = [];
      for (const symbol of symbols) {
        const res = await fetchJson(`/api/stocks?symbol=${encodeURIComponent(symbol)}&limit=30`);
        ensure(res.ok, `${symbol} HTTP ${res.status}`);
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        ensure(rows.length >= 5, `${symbol} insufficient rows`);
        let prev = null;
        for (const row of rows) {
          const d = isoFromAnyDate(row?.date);
          ensure(d !== null, `${symbol} row missing date`);
          if (prev !== null) ensure(prev <= d, `${symbol} non-monotonic date sequence`);
          prev = d;
          const open = Number(row?.open);
          const high = Number(row?.high);
          const low = Number(row?.low);
          const close = Number(row?.close);
          ensure(Number.isFinite(open) && Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close), `${symbol} invalid OHLC`);
          ensure(low <= high, `${symbol} low > high`);
          ensure(low <= open && open <= high, `${symbol} open out of bounds`);
          ensure(low <= close && close <= high, `${symbol} close out of bounds`);
        }
        checks.push({ symbol, rows: rows.length });
      }
      return { checks };
    }
  ));

  cases.push(await runCase(
    "R6_5_fundamentals_formula_sanity",
    "Fundamentals derived ratios should be finite and consistent with reported values.",
    async () => {
      const res = await fetchJson("/api/finance-analysis?symbol=FPT&type=fundamental");
      ensure(res.ok, `HTTP ${res.status}`);
      const data = res.data?.data ?? {};
      const latestFromSeries = (series) => {
        if (!Array.isArray(series) || series.length === 0) return null;
        const last = series[series.length - 1];
        const value = Number(last?.value);
        return Number.isFinite(value) ? value : null;
      };
      const metricMap = {
        currentRatio: latestFromSeries(data?.liquidity?.currentRatio),
        debtToEquity: latestFromSeries(data?.leverage?.debtToEquity),
        netMargin: latestFromSeries(data?.profitability?.netMargin),
        ocfToNetIncome: latestFromSeries(data?.cashFlowQuality?.ocfToNetIncome),
      };
      for (const [key, value] of Object.entries(metricMap)) {
        ensure(value !== null, `metric ${key} not finite`);
      }
      return {
        symbol: "FPT",
        metrics: metricMap,
      };
    }
  ));

  cases.push(await runCase(
    "R6_6_assistant_route_robust_mix",
    "Assistant should keep robust policy/routes under mixed robust prompts.",
    async () => {
      const prompts = [
        { message: "Top 10 gia dong cua cao nhat ngay 28/05/2024", expectedIntent: "stock_snapshot", expectedPolicy: "ok" },
        { message: "Cho toi BCTN moi nhat cua VNM", expectedIntent: "fundamentals", expectedPolicy: "ok" },
        { message: "Tinh beta va max drawdown cua FPT so voi VNINDEX", expectedIntent: "risk", expectedPolicy: "ok" },
        { message: "Top 10 gia dong cua cao nhat tren HNX ngay 28/05/2024", expectedIntent: "stock_snapshot", expectedPolicy: "shadow_blocked" },
      ];
      const checks = [];
      for (const item of prompts) {
        const res = await callAssistant(item.message, { page: "home" });
        ensure(res.ok, `HTTP ${res.status} message=${item.message}`);
        const intent = String(res.data?.meta?.queryIntent ?? "");
        const policy = String(res.data?.policyStatus ?? "");
        ensure(intent === item.expectedIntent, `intent=${intent} expected=${item.expectedIntent}`);
        ensure(policy === item.expectedPolicy || (item.expectedPolicy === "ok" && policy === "fallback"), `policy=${policy} expected=${item.expectedPolicy}`);
        checks.push({
          message: item.message,
          intent,
          policy,
        });
      }
      return { checks };
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
    schemaVersion: "assistant-req6-v2",
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
