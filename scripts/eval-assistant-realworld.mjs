import fs from "node:fs";
import path from "node:path";
import {
  createAssistantEvalReport,
  createCategoryResult,
  createFailureExample,
  createPolicyStatus,
  createToolRecord,
} from "./assistant-eval-report-schema.mjs";

const baseUrl = process.env.ASSISTANT_EVAL_BASE_URL ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3010";
const timeoutMs = Number(process.env.ASSISTANT_EVAL_TIMEOUT_MS ?? 120000);
const reportPath = process.env.ASSISTANT_EVAL_REPORT_PATH ?? "artifacts/assistant-realworld-report.json";
const evalAuthToken = String(process.env.ASSISTANT_EVAL_AUTH_TOKEN ?? "").trim();
const maxRequestRetries = Number(process.env.ASSISTANT_EVAL_MAX_RETRIES ?? 2);
const retryBackoffMs = Number(process.env.ASSISTANT_EVAL_RETRY_BACKOFF_MS ?? 400);
const oracleTimeoutMs = Number(process.env.ASSISTANT_EVAL_ORACLE_TIMEOUT_MS ?? 15000);

const scenarios = [
  {
    id: "RW_STOCK_RANKING_CLOSE",
    level: "L1",
    category: "stock",
    turns: [
      {
        message: "Cho toi top 10 co phieu gia dong cua cao nhat ngay 28/05/2024 tren HOSE",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTools: [{ name: "stockSnapshot", status: "success" }],
          endpointIncludes: ["/api/stocks", "metric=close", "order=desc"],
          intent: "stock_snapshot",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
          rejectSuccessfulTools: ["marketSnapshot"],
          oracle: {
            type: "stock_ranking_date",
            endpointIncludes: ["/api/stocks", "metric=close", "order=desc"],
            topK: 5,
            requireDateMatch: true,
          },
        },
      },
    ],
  },
  {
    id: "RW_STOCK_FOLLOWUP_VOLUME",
    level: "L2",
    category: "stock",
    turns: [
      {
        message: "Top 5 co phieu gia dong cua cao nhat ngay 28/05/2024",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTools: [{ name: "stockSnapshot", status: "success" }],
          endpointIncludes: ["/api/stocks", "metric=close"],
          intent: "stock_snapshot",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
          oracle: {
            type: "stock_ranking_date",
            endpointIncludes: ["/api/stocks", "metric=close"],
            topK: 5,
            requireDateMatch: true,
          },
        },
      },
      {
        message: "con theo volume thi sao",
        contextSnapshot: {
          page: "home",
          filters: { date: "28/05/2024", exchange: "HOSE", limit: 5, metric: "volume" },
        },
        expected: {
          requiredTools: [{ name: "stockSnapshot", status: "success" }],
          endpointIncludes: ["/api/stocks", "metric=volume"],
          intent: "stock_snapshot",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
          rejectSuccessfulTools: ["marketSnapshot"],
          oracle: {
            type: "stock_ranking_date",
            endpointIncludes: ["/api/stocks", "metric=volume"],
            topK: 5,
            requireDateMatch: true,
          },
        },
      },
    ],
  },
  {
    id: "RW_STOCK_MULTI_CRITERIA_COMPLEX",
    level: "L3",
    category: "stock",
    turns: [
      {
        message: "Trong nhom ngan hang HOSE ngay 28/05/2024, cho top 5 co phieu co gia dong cua cao nhat va giu dung thu tu.",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTools: [{ name: "stockSnapshot", status: "success" }],
          endpointIncludes: ["/api/stocks", "exchange=HOSE", "metric=close", "icb"],
          intent: "stock_snapshot",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
          rejectSuccessfulTools: ["marketSnapshot"],
          oracle: {
            type: "stock_ranking_date",
            endpointIncludes: ["/api/stocks", "exchange=HOSE", "metric=close"],
            topK: 5,
            requireDateMatch: true,
          },
        },
      },
    ],
  },
  {
    id: "RW_STOCK_SYMBOL_ASOF",
    level: "L1",
    category: "stock",
    turns: [
      {
        message: "Gia dong cua FPT ngay 28/05/2024 la bao nhieu",
        contextSnapshot: { page: "charts", symbol: "FPT" },
        expected: {
          requiredTools: [{ name: "stockSnapshot", status: "success" }],
          endpointIncludes: ["/api/stocks", "symbol=FPT"],
          intent: "stock_snapshot",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
        },
      },
    ],
  },
  {
    id: "RW_STOCK_SMALL_CAP_SYMBOL_ASOF",
    level: "L2",
    category: "stock",
    turns: [
      {
        message: "Gia dong cua DHA ngay 28/05/2024 la bao nhieu",
        contextSnapshot: { page: "charts", symbol: "DHA" },
        expected: {
          requiredTools: [{ name: "stockSnapshot", status: "success" }],
          endpointIncludes: ["/api/stocks", "symbol=DHA"],
          intent: "stock_snapshot",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
        },
      },
    ],
  },
  {
    id: "RW_STOCK_NOISY_QUERY",
    level: "L4",
    category: "stock",
    turns: [
      {
        message: "dm top 5 close 28-05-2024 nhanh",
        contextSnapshot: { page: "home", filters: { limit: 5 } },
        expected: {
          requiredTools: [{ name: "stockSnapshot", status: "success" }],
          endpointIncludes: ["/api/stocks"],
          intent: "stock_snapshot",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
        },
      },
    ],
  },
  {
    id: "RW_SCOPE_NON_HOSE_GUARD",
    level: "L4",
    category: "scope_guard",
    turns: [
      {
        message: "top 10 gia dong cua cao nhat ngay 28/05/2024 tren HNX",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTools: [{ name: "stockSnapshot", status: "success" }],
          endpointIncludes: ["/api/stocks", "exchange=HOSE"],
          intent: "stock_snapshot",
          allowedPolicyStatuses: ["shadow_blocked", "fallback", "ok"],
          minCitationCount: 1,
          messageIncludes: ["HOSE"],
          disallowMetricNumericClaims: true,
          strictDisallowMetricNumericClaims: true,
        },
      },
    ],
  },
  {
    id: "RW_SCOPE_NON_HOSE_UPCOM_GUARD",
    level: "L4",
    category: "scope_guard",
    turns: [
      {
        message: "top 10 gia dong cua cao nhat ngay 28/05/2024 tren UPCOM",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTools: [{ name: "stockSnapshot", status: "success" }],
          endpointIncludes: ["/api/stocks", "exchange=HOSE"],
          intent: "stock_snapshot",
          allowedPolicyStatuses: ["shadow_blocked", "fallback", "ok"],
          minCitationCount: 1,
          messageIncludes: ["HOSE"],
          disallowMetricNumericClaims: true,
          strictDisallowMetricNumericClaims: true,
        },
      },
    ],
  },
  {
    id: "RW_FUTURE_DATE_NUMERIC_GUARD",
    level: "L4",
    category: "scope_guard",
    turns: [
      {
        message: "Cho toi top 10 co phieu gia dong cua cao nhat tren HOSE ngay 31/12/2099",
        contextSnapshot: { page: "home" },
        expected: {
          allowedPolicyStatuses: ["shadow_blocked", "fallback", "ok"],
          messageIncludes: ["khong"],
          disallowMetricNumericClaims: true,
          strictDisallowMetricNumericClaims: true,
        },
      },
    ],
  },
  {
    id: "RW_FUNDAMENTAL_STATEMENT",
    level: "L2",
    category: "fundamentals",
    turns: [
      {
        message: "Cho BCTN moi nhat cua VNM, chi tra doanh thu va loi nhuan sau thue.",
        contextSnapshot: { page: "charts", symbol: "VNM" },
        expected: {
          requiredTools: [{ name: "fundamentalSnapshot", status: "success" }],
          endpointIncludes: ["/api/fundamentals", "statement=is"],
          intent: "fundamentals",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
        },
      },
    ],
  },
  {
    id: "RW_FUNDAMENTAL_ANALYSIS",
    level: "L3",
    category: "fundamentals",
    turns: [
      {
        message: "Phan tich co ban VNM voi current ratio, debt to equity, net margin va cash flow quality.",
        contextSnapshot: { page: "charts", symbol: "VNM" },
        expected: {
          requiredTools: [{ name: "fundamentalAnalysis", status: "success" }],
          endpointIncludes: ["/api/finance-analysis", "type=fundamental"],
          intent: "fundamentals",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
        },
      },
    ],
  },
  {
    id: "RW_FINANCIAL_HEALTH_SCORE",
    level: "L3",
    category: "fundamentals",
    turns: [
      {
        message: "Cho toi financial health score cua VNM va rating.",
        contextSnapshot: { page: "charts", symbol: "VNM" },
        expected: {
          requiredTools: [{ name: "financialHealthScore", status: "success" }],
          endpointIncludes: ["/api/finance-analysis", "type=health"],
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
        },
      },
    ],
  },
  {
    id: "RW_VALUATION_DCF",
    level: "L3",
    category: "valuation",
    turns: [
      {
        message: "Lam DCF valuation cho FPT, cho fair value, current price va WACC.",
        contextSnapshot: { page: "charts", symbol: "FPT" },
        expected: {
          requiredTools: [{ name: "valuationDcf", status: "success" }],
          endpointIncludes: ["/api/finance-analysis", "type=valuation"],
          intent: "valuation",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
        },
      },
    ],
  },
  {
    id: "RW_VALUATION_PEER",
    level: "L3",
    category: "valuation",
    turns: [
      {
        message: "So sanh peer multiples cua FPT, cho median PE va PB.",
        contextSnapshot: { page: "charts", symbol: "FPT" },
        expected: {
          requiredTools: [{ name: "peerMultiples", status: "success" }],
          endpointIncludes: ["/api/finance-analysis", "type=peer"],
          intent: "valuation",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
          oracle: {
            type: "peer_metric_compare",
            endpointIncludes: ["/api/finance-analysis", "type=peer"],
            relTolerance: 0.001,
          },
        },
      },
    ],
  },
  {
    id: "RW_VALUATION_SENSITIVITY",
    level: "L3",
    category: "valuation",
    turns: [
      {
        message: "Chay scenario sensitivity cho FPT voi bull bear base case.",
        contextSnapshot: { page: "charts", symbol: "FPT" },
        expected: {
          requiredTools: [{ name: "scenarioSensitivity", status: "success" }],
          endpointIncludes: ["/api/finance-analysis", "type=sensitivity"],
          intent: "valuation",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
        },
      },
    ],
  },
  {
    id: "RW_VALUATION_RANKING",
    level: "L3",
    category: "valuation",
    turns: [
      {
        message: "Trong nhom ngan hang HOSE ngay 31/12/2025, liet ke top 5 co phieu co P/E cao nhat.",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTools: [{ name: "valuationRanking", status: "success" }],
          endpointIncludes: ["/api/analytics/valuation-rankings", "metric=pe"],
          intent: "valuation_ranking",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
          oracle: {
            type: "valuation_ranking_date",
            endpointIncludes: ["/api/analytics/valuation-rankings", "metric=pe"],
            topK: 5,
          },
        },
      },
    ],
  },
  {
    id: "RW_ICB_SNAPSHOT",
    level: "L3",
    category: "icb",
    turns: [
      {
        message: "Group HOSE theo ICB level 3 ngay 31/12/2025, lay top 5 nhom theo thanh khoan.",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTools: [{ name: "icbSnapshot", status: "success" }],
          endpointIncludes: ["/api/analytics/icb-snapshot"],
          intent: "icb_snapshot",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
        },
      },
    ],
  },
  {
    id: "RW_RISK_SNAPSHOT",
    level: "L3",
    category: "risk",
    turns: [
      {
        message: "Tinh beta va max drawdown cua FPT so voi VNINDEX",
        contextSnapshot: { page: "risk", symbol: "FPT" },
        expected: {
          requiredTools: [{ name: "riskSnapshot", status: "success" }],
          endpointIncludes: ["/api/risk"],
          intent: "risk",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
        },
      },
    ],
  },
  {
    id: "RW_BACKTEST_SUMMARY",
    level: "L3",
    category: "backtesting",
    turns: [
      {
        message: "Tom tat backtest SMA cho FPT gom net return, sharpe va max drawdown.",
        contextSnapshot: { page: "backtesting", symbol: "FPT" },
        expected: {
          requiredTools: [{ name: "backtestSummary", status: "success" }],
          endpointIncludes: ["/api/backtesting"],
          intent: "backtesting",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
        },
      },
    ],
  },
  {
    id: "RW_FACTOR_SNAPSHOT",
    level: "L2",
    category: "factor",
    turns: [
      {
        message: "Tom tat momentum factor va top bottom symbols.",
        contextSnapshot: { page: "factors" },
        expected: {
          requiredTools: [{ name: "factorSnapshot", status: "success" }],
          endpointIncludes: ["/api/factors"],
          intent: "factor",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
        },
      },
    ],
  },
  {
    id: "RW_MARKET_OVERVIEW",
    level: "L1",
    category: "market",
    turns: [
      {
        message: "Cho toi market overview: VNINDEX, top gainer va top loser hien tai.",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTools: [{ name: "marketSnapshot", status: "success" }],
          endpointIncludes: ["/api/market-overview"],
          intent: "market",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
        },
      },
    ],
  },
  {
    id: "RW_DATA_HEALTH",
    level: "L2",
    category: "data_health",
    turns: [
      {
        message: "Kiem tra data backend, missing data va manifest co san sang khong.",
        contextSnapshot: { page: "home" },
        expected: {
          requiredTools: [{ name: "dataHealth", status: "success" }],
          endpointIncludes: ["/api/health/data"],
          intent: "data_health",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
        },
      },
    ],
  },
  {
    id: "RW_VALUATION_CHAIN_FOLLOWUP",
    level: "L4",
    category: "valuation",
    turns: [
      {
        message: "Lam DCF valuation cho FPT.",
        contextSnapshot: { page: "charts", symbol: "FPT" },
        expected: {
          requiredTools: [{ name: "valuationDcf", status: "success" }],
          endpointIncludes: ["/api/finance-analysis", "type=valuation"],
          intent: "valuation",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
        },
      },
      {
        message: "neu wacc tang 1% thi fair value thay doi the nao",
        contextSnapshot: { page: "charts", symbol: "FPT" },
        expected: {
          requiredTools: [{ name: "scenarioSensitivity", status: "success" }],
          endpointIncludes: ["/api/finance-analysis", "type=sensitivity"],
          intent: "valuation",
          allowedPolicyStatuses: ["ok"],
          minCitationCount: 1,
        },
      },
    ],
  },
];

function hasToolStatus(usedTools, toolName, status) {
  if (!Array.isArray(usedTools)) return false;
  return usedTools.some((item) => item?.name === toolName && item?.status === status);
}

function hasAnyCitationEndpoint(citations, fragment) {
  if (!Array.isArray(citations)) return false;
  return citations.some(
    (item) => typeof item?.endpoint === "string" && item.endpoint.includes(fragment)
  );
}

function normalizeForMatch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasMessageFragment(message, fragment) {
  const haystack = normalizeForMatch(message);
  const needle = normalizeForMatch(fragment);
  return needle.length > 0 && haystack.includes(needle);
}

function hasMetricLikeNumericClaim(message) {
  const normalized = normalizeForMatch(message)
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, " ")
    .replace(/\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/g, " ")
    .replace(/\btop\s*\d+\b/g, " ");
  const sentences = normalized.split(/[.!?\n]+/);
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
    "ev/ebitda",
    "beta",
    "drawdown",
    "return",
    "sharpe",
  ];
  return sentences.some((sentence) => metricTokens.some((token) => sentence.includes(token)) && /\d/.test(sentence));
}

function summarizeTools(usedTools) {
  if (!Array.isArray(usedTools) || usedTools.length === 0) return "none";
  return usedTools.map((tool) => `${tool?.name ?? "unknown"}:${tool?.status ?? "unknown"}`).join(",");
}

function normalizeSymbolToken(value) {
  const token = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(token)) return "";
  return token;
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeColumnName(value) {
  return normalizeForMatch(value).replace(/\s+/g, "");
}

function findTableBlock(messageBlocks, predicate) {
  if (!Array.isArray(messageBlocks)) return null;
  for (const block of messageBlocks) {
    if (!block || block.type !== "table") continue;
    if (predicate(block)) return block;
  }
  return null;
}

function findColumnIndex(columns, candidates) {
  if (!Array.isArray(columns) || columns.length === 0) return -1;
  const normalizedCandidates = candidates.map((item) => normalizeColumnName(item));
  return columns.findIndex((column) => {
    const normalized = normalizeColumnName(column);
    return normalizedCandidates.some((candidate) => normalized === candidate || normalized.includes(candidate));
  });
}

function almostEqual(a, b, relTolerance = 0.001, absTolerance = 1e-6) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const delta = Math.abs(a - b);
  const limit = Math.max(absTolerance, Math.abs(b) * relTolerance);
  return delta <= limit;
}

function pickCitationEndpoint(citations, endpointIncludes = []) {
  if (!Array.isArray(citations) || citations.length === 0) return null;
  const fragments = Array.isArray(endpointIncludes) ? endpointIncludes.map((item) => normalizeForMatch(item)) : [];
  for (const citation of citations) {
    const endpoint = String(citation?.endpoint ?? "").trim();
    if (!endpoint) continue;
    const normalizedEndpoint = normalizeForMatch(endpoint);
    const ok = fragments.every((fragment) => normalizedEndpoint.includes(fragment));
    if (ok) return endpoint;
  }
  return null;
}

function normalizeOracleEndpoint(endpoint) {
  const raw = String(endpoint ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith("/")) return null;
  return `${baseUrl}${raw}`;
}

async function fetchOracleJson(endpoint) {
  const url = normalizeOracleEndpoint(endpoint);
  if (!url) {
    return { ok: false, status: null, data: null, error: "invalid_oracle_endpoint" };
  }
  for (let attempt = 0; attempt <= maxRequestRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), oracleTimeoutMs);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok && isRetryableStatus(response.status) && attempt < maxRequestRetries) {
        const retryAfterMs = parseRetryAfterHeaderMs(response.headers.get("retry-after"));
        await sleep(Math.max(retryAfterMs, retryBackoffMs * (attempt + 1)));
        continue;
      }

      return {
        ok: response.ok,
        status: response.status,
        data,
        error: response.ok ? null : `oracle_http_${response.status}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable = isRetryableCallError(error);
      if (retryable && attempt < maxRequestRetries) {
        await sleep(retryBackoffMs * (attempt + 1));
        continue;
      }
      return { ok: false, status: null, data: null, error: `oracle_fetch_failed:${message}` };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: null, data: null, error: "oracle_fetch_failed:max_retries_exceeded" };
}

function parseRetryAfterHeaderMs(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return 0;
  const seconds = Number.parseFloat(value);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.max(0, Math.round(seconds * 1000));
  }
  const parsedDate = Date.parse(value);
  if (!Number.isFinite(parsedDate)) return 0;
  return Math.max(0, parsedDate - Date.now());
}

async function runStockRankingDateOracleCheck(data, oracleConfig) {
  const failures = [];
  const endpoint = pickCitationEndpoint(data?.citations, oracleConfig?.endpointIncludes ?? ["/api/stocks"]);
  if (!endpoint) {
    failures.push("oracle(stock_ranking_date): missing citation endpoint");
    return failures;
  }
  const oracleResponse = await fetchOracleJson(endpoint);
  if (!oracleResponse.ok) {
    failures.push(`oracle(stock_ranking_date): endpoint fetch failed (${oracleResponse.error ?? "unknown"})`);
    return failures;
  }
  const oracleStocks = Array.isArray(oracleResponse.data?.stocks) ? oracleResponse.data.stocks : [];
  if (oracleStocks.length === 0) {
    failures.push("oracle(stock_ranking_date): oracle returned no stocks");
    return failures;
  }

  const rankingTable = findTableBlock(data?.messageBlocks, (block) => {
    const title = normalizeForMatch(block.title);
    const columns = Array.isArray(block.columns) ? block.columns : [];
    const hasSymbolColumn = findColumnIndex(columns, ["symbol"]) >= 0;
    return title.includes("stock ranking") && hasSymbolColumn;
  });
  if (!rankingTable) {
    failures.push("oracle(stock_ranking_date): missing stock ranking table block");
    return failures;
  }

  const symbolIndex = findColumnIndex(rankingTable.columns, ["symbol"]);
  const dateIndex = findColumnIndex(rankingTable.columns, ["date"]);
  if (symbolIndex < 0) {
    failures.push("oracle(stock_ranking_date): missing Symbol column");
    return failures;
  }

  const topKRaw = Number(oracleConfig?.topK ?? 3);
  const topK = Math.max(1, Math.min(10, Number.isFinite(topKRaw) ? topKRaw : 3));
  const expectedRows = oracleStocks.slice(0, topK);
  const actualRows = Array.isArray(rankingTable.rows) ? rankingTable.rows.slice(0, topK) : [];
  if (actualRows.length < expectedRows.length) {
    failures.push(`oracle(stock_ranking_date): insufficient table rows actual=${actualRows.length}, expected=${expectedRows.length}`);
    return failures;
  }

  const expectedSymbols = expectedRows.map((row) => normalizeSymbolToken(row?.symbol));
  const actualSymbols = actualRows.map((row) => normalizeSymbolToken(Array.isArray(row) ? row[symbolIndex] : ""));
  if (expectedSymbols.some((symbol, index) => symbol !== actualSymbols[index])) {
    failures.push(
      `oracle(stock_ranking_date): top symbols mismatch expected=${expectedSymbols.join("|")}, actual=${actualSymbols.join("|")}`
    );
  }

  if (oracleConfig?.requireDateMatch === true && dateIndex >= 0) {
    const expectedDates = expectedRows.map((row) => String(row?.date ?? "").trim());
    const actualDates = actualRows.map((row) => String(Array.isArray(row) ? row[dateIndex] ?? "" : "").trim());
    if (expectedDates.some((value, index) => value !== actualDates[index])) {
      failures.push(
        `oracle(stock_ranking_date): top dates mismatch expected=${expectedDates.join("|")}, actual=${actualDates.join("|")}`
      );
    }
  }

  return failures;
}

async function runValuationRankingOracleCheck(data, oracleConfig) {
  const failures = [];
  const endpoint = pickCitationEndpoint(
    data?.citations,
    oracleConfig?.endpointIncludes ?? ["/api/analytics/valuation-rankings"]
  );
  if (!endpoint) {
    failures.push("oracle(valuation_ranking_date): missing citation endpoint");
    return failures;
  }
  const oracleResponse = await fetchOracleJson(endpoint);
  if (!oracleResponse.ok) {
    failures.push(`oracle(valuation_ranking_date): endpoint fetch failed (${oracleResponse.error ?? "unknown"})`);
    return failures;
  }
  const oracleRows = Array.isArray(oracleResponse.data?.rows)
    ? oracleResponse.data.rows
    : (Array.isArray(oracleResponse.data?.data?.rows) ? oracleResponse.data.data.rows : []);
  if (oracleRows.length === 0) {
    failures.push("oracle(valuation_ranking_date): oracle returned no rows");
    return failures;
  }

  const rankingTable = findTableBlock(data?.messageBlocks, (block) => {
    const title = normalizeForMatch(block.title);
    const columns = Array.isArray(block.columns) ? block.columns : [];
    const hasSymbolColumn = findColumnIndex(columns, ["symbol"]) >= 0;
    return title.includes("valuation ranking") && hasSymbolColumn;
  });
  if (!rankingTable) {
    failures.push("oracle(valuation_ranking_date): missing valuation ranking table block");
    return failures;
  }

  const symbolIndex = findColumnIndex(rankingTable.columns, ["symbol"]);
  if (symbolIndex < 0) {
    failures.push("oracle(valuation_ranking_date): missing Symbol column");
    return failures;
  }

  const topKRaw = Number(oracleConfig?.topK ?? 3);
  const topK = Math.max(1, Math.min(10, Number.isFinite(topKRaw) ? topKRaw : 3));
  const expectedRows = oracleRows.slice(0, topK);
  const actualRows = Array.isArray(rankingTable.rows) ? rankingTable.rows.slice(0, topK) : [];
  if (actualRows.length < expectedRows.length) {
    failures.push(`oracle(valuation_ranking_date): insufficient table rows actual=${actualRows.length}, expected=${expectedRows.length}`);
    return failures;
  }

  const expectedSymbols = expectedRows.map((row) => normalizeSymbolToken(row?.symbol));
  const actualSymbols = actualRows.map((row) => normalizeSymbolToken(Array.isArray(row) ? row[symbolIndex] : ""));
  if (expectedSymbols.some((symbol, index) => symbol !== actualSymbols[index])) {
    failures.push(
      `oracle(valuation_ranking_date): top symbols mismatch expected=${expectedSymbols.join("|")}, actual=${actualSymbols.join("|")}`
    );
  }

  return failures;
}

async function runPeerMetricOracleCheck(data, oracleConfig) {
  const failures = [];
  const endpoint = pickCitationEndpoint(data?.citations, oracleConfig?.endpointIncludes ?? ["/api/finance-analysis", "type=peer"]);
  if (!endpoint) {
    failures.push("oracle(peer_metric_compare): missing citation endpoint");
    return failures;
  }
  const oracleResponse = await fetchOracleJson(endpoint);
  if (!oracleResponse.ok) {
    failures.push(`oracle(peer_metric_compare): endpoint fetch failed (${oracleResponse.error ?? "unknown"})`);
    return failures;
  }
  const oraclePeers = Array.isArray(oracleResponse.data?.data?.peers) ? oracleResponse.data.data.peers : [];
  if (oraclePeers.length === 0) {
    failures.push("oracle(peer_metric_compare): oracle returned no peers");
    return failures;
  }

  const peerTable = findTableBlock(data?.messageBlocks, (block) => normalizeForMatch(block.title).includes("peer multiples"));
  if (!peerTable) {
    failures.push("oracle(peer_metric_compare): missing peer multiples table block");
    return failures;
  }

  const symbolIndex = findColumnIndex(peerTable.columns, ["symbol"]);
  const peIndex = findColumnIndex(peerTable.columns, ["p/e", "pe"]);
  const pbIndex = findColumnIndex(peerTable.columns, ["p/b", "pb"]);
  if (symbolIndex < 0 || peIndex < 0 || pbIndex < 0) {
    failures.push("oracle(peer_metric_compare): missing Symbol/P-E/P-B columns");
    return failures;
  }
  const firstRow = Array.isArray(peerTable.rows) && peerTable.rows.length > 0 ? peerTable.rows[0] : null;
  if (!Array.isArray(firstRow)) {
    failures.push("oracle(peer_metric_compare): table has no data rows");
    return failures;
  }

  const oracleTop = oraclePeers[0] ?? {};
  const actualSymbol = normalizeSymbolToken(firstRow[symbolIndex]);
  const expectedSymbol = normalizeSymbolToken(oracleTop?.symbol);
  if (!actualSymbol || !expectedSymbol || actualSymbol !== expectedSymbol) {
    failures.push(`oracle(peer_metric_compare): top peer symbol mismatch expected=${expectedSymbol || "n/a"}, actual=${actualSymbol || "n/a"}`);
  }

  const relTolerance = Number(oracleConfig?.relTolerance ?? 0.001);
  const actualPe = toNumber(firstRow[peIndex]);
  const actualPb = toNumber(firstRow[pbIndex]);
  const expectedPe = toNumber(oracleTop?.pe);
  const expectedPb = toNumber(oracleTop?.pb);
  const peBothNull = actualPe === null && expectedPe === null;
  const pbBothNull = actualPb === null && expectedPb === null;
  if (!peBothNull) {
    if (actualPe === null || expectedPe === null || !almostEqual(actualPe, expectedPe, relTolerance)) {
      failures.push(`oracle(peer_metric_compare): P/E mismatch expected=${String(expectedPe)}, actual=${String(actualPe)}`);
    }
  }
  if (!pbBothNull) {
    if (actualPb === null || expectedPb === null || !almostEqual(actualPb, expectedPb, relTolerance)) {
      failures.push(`oracle(peer_metric_compare): P/B mismatch expected=${String(expectedPb)}, actual=${String(actualPb)}`);
    }
  }

  return failures;
}

async function runOracleChecks(data, oracleConfig) {
  if (!oracleConfig || typeof oracleConfig !== "object") return [];
  const type = String(oracleConfig.type ?? "").trim();
  if (!type) return [];
  if (type === "stock_ranking_date") {
    return runStockRankingDateOracleCheck(data, oracleConfig);
  }
  if (type === "valuation_ranking_date") {
    return runValuationRankingOracleCheck(data, oracleConfig);
  }
  if (type === "peer_metric_compare") {
    return runPeerMetricOracleCheck(data, oracleConfig);
  }
  return [`oracle: unsupported type=${type}`];
}

function getBucket(map, key) {
  if (!map[key]) {
    map[key] = { totalTurns: 0, passedTurns: 0 };
  }
  return map[key];
}

function calcPercentile(latencies, percentile) {
  if (!Array.isArray(latencies) || latencies.length === 0) return null;
  const sorted = [...latencies].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  return sorted[rank];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isRetryableCallError(error) {
  const text = String(error instanceof Error ? error.message : error ?? "").toLowerCase();
  return (
    text.includes("aborted")
    || text.includes("timeout")
    || text.includes("timed out")
    || text.includes("fetch failed")
    || text.includes("network")
  );
}

async function callAssistant({ message, contextSnapshot, conversationHistory }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}/api/assistant`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-assistant-eval": "true",
        ...(evalAuthToken ? { "x-assistant-eval-token": evalAuthToken } : {}),
      },
      body: JSON.stringify({
        message,
        conversationHistory,
        contextSnapshot,
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

    return { response, data, latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

async function callAssistantWithRetry(input) {
  let lastError = null;
  for (let attempt = 0; attempt <= maxRequestRetries; attempt += 1) {
    try {
      const call = await callAssistant(input);
      if (isRetryableStatus(call.response?.status) && attempt < maxRequestRetries) {
        await sleep(retryBackoffMs * (attempt + 1));
        continue;
      }
      return {
        ...call,
        attempts: attempt + 1,
        error: null,
      };
    } catch (error) {
      lastError = error;
      if (attempt >= maxRequestRetries || !isRetryableCallError(error)) {
        throw error;
      }
      await sleep(retryBackoffMs * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("assistant call failed");
}

async function evaluateExpectations(data, expected) {
  const failures = [];
  const checks = {
    tool: { total: 0, passed: 0 },
    endpoint: { total: 0, passed: 0 },
    intent: { total: 0, passed: 0 },
    policy: { total: 0, passed: 0 },
    citation: { total: 0, passed: 0 },
    message: { total: 0, passed: 0 },
    oracle: { total: 0, passed: 0 },
  };

  if (Array.isArray(expected?.requiredTools)) {
    for (const item of expected.requiredTools) {
      checks.tool.total += 1;
      const ok = hasToolStatus(data?.usedTools, item.name, item.status);
      if (ok) {
        checks.tool.passed += 1;
      } else {
        failures.push(`required tool mismatch: ${item.name}:${item.status}`);
      }
    }
  } else if (expected?.requiredTool) {
    checks.tool.total += 1;
    const ok = hasToolStatus(data?.usedTools, expected.requiredTool.name, expected.requiredTool.status);
    if (ok) {
      checks.tool.passed += 1;
    } else {
      failures.push(`required tool mismatch: ${expected.requiredTool.name}:${expected.requiredTool.status}`);
    }
  }

  if (Array.isArray(expected?.endpointIncludes)) {
    for (const fragment of expected.endpointIncludes) {
      checks.endpoint.total += 1;
      const ok = hasAnyCitationEndpoint(data?.citations, fragment);
      if (ok) {
        checks.endpoint.passed += 1;
      } else {
        failures.push(`missing citation endpoint fragment: ${fragment}`);
      }
    }
  }

  if (typeof expected?.intent === "string" && expected.intent.length > 0) {
    checks.intent.total += 1;
    const actualIntent = String(data?.meta?.queryIntent ?? "").trim();
    const ok = actualIntent === expected.intent;
    if (ok) {
      checks.intent.passed += 1;
    } else {
      failures.push(`query intent mismatch: expected=${expected.intent}, actual=${actualIntent || "n/a"}`);
    }
  }

  if (Array.isArray(expected?.allowedPolicyStatuses) && expected.allowedPolicyStatuses.length > 0) {
    checks.policy.total += 1;
    const actualPolicy = String(data?.policyStatus ?? "");
    const ok = expected.allowedPolicyStatuses.includes(actualPolicy);
    if (ok) {
      checks.policy.passed += 1;
    } else {
      failures.push(`policy status mismatch: expected one of [${expected.allowedPolicyStatuses.join(",")}], actual=${actualPolicy || "n/a"}`);
    }
  }

  if (typeof expected?.minCitationCount === "number") {
    checks.citation.total += 1;
    const count = Array.isArray(data?.citations) ? data.citations.length : 0;
    const ok = count >= expected.minCitationCount;
    if (ok) {
      checks.citation.passed += 1;
    } else {
      failures.push(`citation count below minimum: expected>=${expected.minCitationCount}, actual=${count}`);
    }
  }

  if (Array.isArray(expected?.messageIncludes)) {
    const message = String(data?.message ?? "");
    for (const fragment of expected.messageIncludes) {
      checks.message.total += 1;
      const ok = hasMessageFragment(message, fragment);
      if (ok) {
        checks.message.passed += 1;
      } else {
        failures.push(`assistant message missing fragment: ${fragment}`);
      }
    }
  }

  if (expected?.disallowMetricNumericClaims === true) {
    checks.message.total += 1;
    const metricClaim = hasMetricLikeNumericClaim(String(data?.message ?? ""));
    const hasGrounding =
      (Array.isArray(data?.citations) && data.citations.length > 0)
      && (Array.isArray(data?.usedTools) && data.usedTools.some((tool) => tool?.status === "success"));
    const strictGuard = expected.strictDisallowMetricNumericClaims === true;
    const ok = strictGuard ? !metricClaim : (!metricClaim || hasGrounding);
    if (ok) {
      checks.message.passed += 1;
    } else {
      failures.push(
        strictGuard
          ? "metric-like numeric claim detected in strict guard response"
          : "metric-like numeric claim detected without grounding"
      );
    }
  }

  if (Array.isArray(expected?.rejectSuccessfulTools)) {
    for (const toolName of expected.rejectSuccessfulTools) {
      const unexpectedSuccess = hasToolStatus(data?.usedTools, toolName, "success");
      if (unexpectedSuccess) {
        failures.push(`unexpected successful tool: ${toolName}`);
      }
    }
  }

  if (expected?.oracle) {
    checks.oracle.total += 1;
    const oracleFailures = await runOracleChecks(data, expected.oracle);
    if (oracleFailures.length === 0) {
      checks.oracle.passed += 1;
    } else {
      failures.push(...oracleFailures);
    }
  }

  return { failures, checks };
}

async function writeReport(report) {
  if (!reportPath) return null;
  const absolutePath = path.resolve(reportPath);
  try {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return absolutePath;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code ?? "") : "";
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      console.warn(`WARN report_write_skipped path=${absolutePath} code=${code || "unknown"}`);
      return null;
    }
    throw error;
  }
}

async function run() {
  const startedAt = Date.now();
  const results = [];
  const levelMetrics = {};
  const categoryMetrics = {};
  const policyStatusCounts = {};
  const checkTotals = {
    tool: { total: 0, passed: 0 },
    endpoint: { total: 0, passed: 0 },
    intent: { total: 0, passed: 0 },
    policy: { total: 0, passed: 0 },
    citation: { total: 0, passed: 0 },
    message: { total: 0, passed: 0 },
    oracle: { total: 0, passed: 0 },
  };
  const toolDistribution = new Map();
  const latencies = [];
  const failureExamples = [];

  let totalTurns = 0;
  let passedTurns = 0;
  let citationCandidateTurns = 0;
  let citationSatisfiedTurns = 0;
  let fallbackSessions = 0;
  let falseFallbacks = 0;
  const falseFallbackExamples = [];

  for (const scenario of scenarios) {
    const history = [];
    for (let turnIndex = 0; turnIndex < scenario.turns.length; turnIndex += 1) {
      const turn = scenario.turns[turnIndex];
      totalTurns += 1;

      const levelBucket = getBucket(levelMetrics, scenario.level);
      const categoryBucket = getBucket(categoryMetrics, scenario.category);
      levelBucket.totalTurns += 1;
      categoryBucket.totalTurns += 1;

      let turnResult;
      try {
        const call = await callAssistantWithRetry({
          message: turn.message,
          contextSnapshot: turn.contextSnapshot,
          conversationHistory: history,
        });

        if (typeof call.latencyMs === "number" && Number.isFinite(call.latencyMs)) {
          latencies.push(call.latencyMs);
        }

        const responseOk = call.response.ok && call.data?.success === true;
        const expectation = await evaluateExpectations(call.data, turn.expected);

        for (const key of Object.keys(checkTotals)) {
          checkTotals[key].total += expectation.checks[key].total;
          checkTotals[key].passed += expectation.checks[key].passed;
        }

        if (turn.expected?.minCitationCount || (Array.isArray(turn.expected?.endpointIncludes) && turn.expected.endpointIncludes.length > 0)) {
          citationCandidateTurns += 1;
          if (expectation.checks.citation.passed === expectation.checks.citation.total && expectation.checks.endpoint.passed === expectation.checks.endpoint.total) {
            citationSatisfiedTurns += 1;
          }
        }

        const policyStatus = String(call.data?.policyStatus ?? "unknown");
        policyStatusCounts[policyStatus] = (policyStatusCounts[policyStatus] ?? 0) + 1;

        if (call.data?.meta?.fallbackUsed === true) {
          fallbackSessions += 1;
          const hasMeaningfulSuccess = Array.isArray(call.data?.usedTools)
            && call.data.usedTools.some((item) => item?.status === "success" && Number(item?.evidenceCount ?? 0) > 0);
          if (hasMeaningfulSuccess) {
            falseFallbacks += 1;
            if (falseFallbackExamples.length < 6) {
              falseFallbackExamples.push({
                scenarioId: scenario.id,
                turn: turnIndex + 1,
                policyStatus,
                tools: summarizeTools(call.data?.usedTools),
              });
            }
          }
        }

        if (Array.isArray(call.data?.usedTools)) {
          for (const item of call.data.usedTools) {
            const name = String(item?.name ?? "unknown");
            const stat = toolDistribution.get(name) ?? {
              totalCalls: 0,
              successCount: 0,
              errorCount: 0,
              latencyTotalMs: 0,
              latencySamples: 0,
            };
            stat.totalCalls += 1;
            if (item?.status === "success") stat.successCount += 1;
            if (item?.status === "error") stat.errorCount += 1;
            if (typeof item?.latencyMs === "number" && Number.isFinite(item.latencyMs)) {
              stat.latencyTotalMs += item.latencyMs;
              stat.latencySamples += 1;
            }
            toolDistribution.set(name, stat);
          }
        }

        const turnPassed = responseOk && expectation.failures.length === 0;
        if (turnPassed) {
          passedTurns += 1;
          levelBucket.passedTurns += 1;
          categoryBucket.passedTurns += 1;
        }

        turnResult = {
          scenarioId: scenario.id,
          category: scenario.category,
          level: scenario.level,
          turn: turnIndex + 1,
          pass: turnPassed,
          latencyMs: call.latencyMs,
          status: call.response.status,
          attempts: call.attempts ?? 1,
          policyStatus,
          queryIntent: call.data?.meta?.queryIntent ?? null,
          queryPlanSummary: call.data?.meta?.queryPlanSummary ?? null,
          tools: summarizeTools(call.data?.usedTools),
          failures: responseOk ? expectation.failures : [`assistant HTTP/status failure: ${call.response.status}`],
        };

        if (call.data?.success === true && typeof call.data?.message === "string") {
          history.push({ role: "user", content: turn.message });
          history.push({ role: "assistant", content: call.data.message.slice(0, 1200) });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        turnResult = {
          scenarioId: scenario.id,
          category: scenario.category,
          level: scenario.level,
          turn: turnIndex + 1,
          pass: false,
          latencyMs: null,
          status: null,
          attempts: null,
          policyStatus: null,
          queryIntent: null,
          queryPlanSummary: null,
          tools: "none",
          failures: [`request failed: ${message}`],
        };
      }

      results.push(turnResult);
      if (!turnResult.pass && failureExamples.length < 12) {
        failureExamples.push(
          createFailureExample(
            `${turnResult.scenarioId}#${turnResult.turn}`,
            turnResult.category,
            `level=${turnResult.level}, policy=${String(turnResult.policyStatus ?? "n/a")}`,
            turnResult.failures.join(" | "),
            []
          )
        );
      }

      const prefix = turnResult.pass ? "PASS" : "FAIL";
      const failureText = turnResult.pass ? "" : ` - ${turnResult.failures.join(" | ")}`;
      console.log(`${prefix} ${scenario.id}#${turnResult.turn}${failureText}`);
    }
  }

  const failedTurns = totalTurns - passedTurns;
  const latencyPercentiles = {
    p50Ms: calcPercentile(latencies, 50),
    p90Ms: calcPercentile(latencies, 90),
    p99Ms: calcPercentile(latencies, 99),
  };

  const categoryResults = Object.entries(categoryMetrics)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, stats]) =>
      createCategoryResult(
        name,
        stats.totalTurns > 0 && stats.passedTurns === stats.totalTurns,
        `passed=${stats.passedTurns}/${stats.totalTurns}`,
        [
          { key: "turnPassRate", value: stats.totalTurns > 0 ? stats.passedTurns / stats.totalTurns : 0 },
        ]
      )
    );

  const policyStatuses = Object.entries(policyStatusCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([status, count]) => createPolicyStatus("routing", status, `count=${count}`));

  const toolRecords = Array.from(toolDistribution.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, stat]) =>
      createToolRecord(
        name,
        stat.successCount,
        stat.errorCount,
        stat.latencySamples > 0 ? Number((stat.latencyTotalMs / stat.latencySamples).toFixed(2)) : null
      )
    );

  const finalReport = createAssistantEvalReport({
    overallStatus: failedTurns === 0 ? "pass" : "fail",
    categories: categoryResults,
    latencyPercentiles,
    policyStatuses,
    toolDistribution: {
      totalCalls: toolRecords.reduce((acc, item) => acc + item.successCount + item.errorCount, 0),
      successCount: toolRecords.reduce((acc, item) => acc + item.successCount, 0),
      errorCount: toolRecords.reduce((acc, item) => acc + item.errorCount, 0),
      tools: toolRecords,
    },
    falseFallbacks: {
      totalSessions: fallbackSessions,
      falseFallbacks,
      sampledExamples: falseFallbackExamples,
    },
    citationCoverage: {
      candidateClaims: citationCandidateTurns,
      citedClaims: citationSatisfiedTurns,
      coveragePercent: citationCandidateTurns > 0 ? citationSatisfiedTurns / citationCandidateTurns : null,
      missingSources: results.filter((item) => !item.pass).slice(0, 8).map((item) => `${item.scenarioId}#${item.turn}`),
    },
    failureExemplars: failureExamples,
    metadata: {
      runId: new Date().toISOString(),
      assistantVersion: null,
      evalProfile: "realworld-diverse-v1",
      baseUrl,
      totalScenarios: scenarios.length,
      totalTurns,
      passedTurns,
      failedTurns,
      turnPassRate: totalTurns > 0 ? passedTurns / totalTurns : 0,
      checkTotals,
      levelMetrics,
      categoryMetrics,
      durationMs: Date.now() - startedAt,
    },
    runAt: new Date().toISOString(),
    baseUrl,
    totalScenarios: scenarios.length,
    totalTurns,
    passedTurns,
    failedTurns,
    turnPassRate: totalTurns > 0 ? passedTurns / totalTurns : 0,
    routingChecks: {
      tool: {
        total: checkTotals.tool.total,
        passed: checkTotals.tool.passed,
        passRate: checkTotals.tool.total > 0 ? checkTotals.tool.passed / checkTotals.tool.total : 0,
      },
      endpoint: {
        total: checkTotals.endpoint.total,
        passed: checkTotals.endpoint.passed,
        passRate: checkTotals.endpoint.total > 0 ? checkTotals.endpoint.passed / checkTotals.endpoint.total : 0,
      },
      intent: {
        total: checkTotals.intent.total,
        passed: checkTotals.intent.passed,
        passRate: checkTotals.intent.total > 0 ? checkTotals.intent.passed / checkTotals.intent.total : 0,
      },
      policy: {
        total: checkTotals.policy.total,
        passed: checkTotals.policy.passed,
        passRate: checkTotals.policy.total > 0 ? checkTotals.policy.passed / checkTotals.policy.total : 0,
      },
      citation: {
        total: checkTotals.citation.total,
        passed: checkTotals.citation.passed,
        passRate: checkTotals.citation.total > 0 ? checkTotals.citation.passed / checkTotals.citation.total : 0,
      },
      message: {
        total: checkTotals.message.total,
        passed: checkTotals.message.passed,
        passRate: checkTotals.message.total > 0 ? checkTotals.message.passed / checkTotals.message.total : 0,
      },
      oracle: {
        total: checkTotals.oracle.total,
        passed: checkTotals.oracle.passed,
        passRate: checkTotals.oracle.total > 0 ? checkTotals.oracle.passed / checkTotals.oracle.total : 0,
      },
    },
    levelMetrics,
    categoryMetrics,
    durationMs: Date.now() - startedAt,
    results,
  });

  const writtenPath = await writeReport(finalReport);
  if (writtenPath) {
    console.log(`REPORT_PATH=${writtenPath}`);
  }
  console.log(JSON.stringify(finalReport));

  if (failedTurns > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
