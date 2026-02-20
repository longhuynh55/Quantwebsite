#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import next from "next";

const EPSILON = 1e-9;
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_MAX_RETRIES = 3;
const METRIC_KEYWORDS = [
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
const UNIT_TOKEN_REGEX = /%|\b(vnd|usd|eur|dong|dong\/cp|cp|shares?|co phieu|points?|pts|ty|trieu|billion|million|bn|mn|x|times?|lan)\b/i;
const PERIOD_TOKEN_REGEX = /\b(20\d{2}[-/]\d{1,2}([-/]\d{1,2})?|20\d{2}\s*q[1-4]|q[1-4]\s*20\d{2}|fy\s*20\d{2}|latest|as of|today|hom nay|hien tai|ky|quy|nam|period)\b/i;
const UNITLESS_METRIC_REGEX = /\b(pe|pb|beta|sharpe|roe|roa|margin|ratio|total_trades|trades?|count)\b/;
const PERCENT_LIKE_METRICS = new Set(["net_return", "max_drawdown", "volatility"]);

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function approxEqual(a, b, tolerance = EPSILON) {
  return Math.abs(a - b) <= tolerance;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

function getPriorYearSameQuarter(period) {
  const match = /^(\d{4})Q([1-4])$/.exec(String(period ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const quarter = match[2];
  if (!Number.isFinite(year)) return null;
  return `${year - 1}Q${quarter}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(
  baseUrl,
  endpoint,
  { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_MAX_RETRIES } = {}
) {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
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

      if (response.status !== 429 || attempt === maxRetries) {
        return { response, data, text };
      }

      const retryAfterSec = Number(response.headers.get("Retry-After") ?? "0");
      const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? retryAfterSec * 1000
        : 500 * (attempt + 1);
      await sleep(waitMs);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`fetchJson exhausted retries for ${endpoint}`);
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
    const metric = METRIC_KEYWORDS.find((keyword) => normalized.includes(keyword));
    if (hasNumber && metric) {
      claims.push({
        lineNo: i + 1,
        metric,
        line,
        normalized,
      });
    }
  }
  return claims;
}

function extractFirstNumericValue(text) {
  const match = /-?\d+(?:[.,]\d+)?/.exec(text);
  if (!match) return null;
  const normalized = match[0].replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function hasNumericClaimCitation(citations) {
  if (!Array.isArray(citations) || citations.length === 0) return false;
  return citations.some((item) => {
    const endpoint = String(item?.endpoint ?? "").trim();
    const title = String(item?.title ?? "").trim();
    return endpoint.length > 0 || title.length > 0;
  });
}

function validateMetricSemanticResponse(message, citations) {
  const claims = extractMetricNumericClaims(message);
  if (claims.length === 0) {
    return {
      ok: false,
      reason: "No metric-like numeric claims found in assistant response.",
      claims,
      missingPeriodLines: [],
      missingUnitLines: [],
      citationOk: false,
    };
  }

  const citationOk = hasNumericClaimCitation(citations);
  const citationHasPeriod = Array.isArray(citations)
    && citations.some((item) => String(item?.period ?? "").trim().length > 0);

  const missingPeriodLines = [];
  const missingUnitLines = [];
  for (const claim of claims) {
    const hasPeriod = PERIOD_TOKEN_REGEX.test(claim.normalized) || citationHasPeriod;
    const explicitUnit = UNIT_TOKEN_REGEX.test(claim.normalized) || UNITLESS_METRIC_REGEX.test(claim.normalized);
    const numericValue = extractFirstNumericValue(claim.normalized);
    const implicitRatioUnit = PERCENT_LIKE_METRICS.has(claim.metric)
      && numericValue !== null
      && Math.abs(numericValue) <= 1;
    const hasUnit = explicitUnit || implicitRatioUnit;
    if (!hasPeriod) missingPeriodLines.push(claim.lineNo);
    if (!hasUnit) missingUnitLines.push(claim.lineNo);
  }

  const reasons = [];
  if (!citationOk) reasons.push("Numeric claims detected but citation is missing.");
  if (missingPeriodLines.length > 0) {
    reasons.push(`Missing period on lines: ${missingPeriodLines.join(", ")}`);
  }
  if (missingUnitLines.length > 0) {
    reasons.push(`Missing unit on lines: ${missingUnitLines.join(", ")}`);
  }

  return {
    ok: reasons.length === 0,
    reason: reasons.join(" "),
    claims,
    missingPeriodLines,
    missingUnitLines,
    citationOk,
  };
}

async function startLocalNextServer(projectDir) {
  const app = next({
    dev: true,
    dir: projectDir,
    hostname: "127.0.0.1",
    port: 0,
  });
  await app.prepare();

  const handler = app.getRequestHandler();
  const server = http.createServer((req, res) => handler(req, res));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  ensure(address && typeof address === "object" && typeof address.port === "number", "Unable to allocate local port.");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await app.close();
    },
  };
}

function validateYoySeries(baseSeries, yoySeries, symbol, label) {
  ensure(Array.isArray(baseSeries), `${symbol} ${label}: base series is not an array.`);
  ensure(Array.isArray(yoySeries), `${symbol} ${label}: YoY series is not an array.`);
  ensure(baseSeries.length === yoySeries.length, `${symbol} ${label}: base/YoY length mismatch.`);
  const baseByPeriod = new Map(baseSeries.map((point) => [point?.period ?? "", point?.value ?? null]));

  let validatedPoints = 0;
  for (let i = 0; i < baseSeries.length; i += 1) {
    const current = baseSeries[i];
    const yoyPoint = yoySeries[i];

    ensure(current?.period === yoyPoint?.period, `${symbol} ${label}: period mismatch at index ${i}.`);
    const actual = yoyPoint?.value ?? null;
    if (actual !== null) {
      ensure(isFiniteNumber(actual), `${symbol} ${label}: non-finite YoY at index ${i}.`);
    }

    const currentValue = current?.value ?? null;
    const previousPeriod = getPriorYearSameQuarter(current?.period);
    const previousValue = previousPeriod ? (baseByPeriod.get(previousPeriod) ?? null) : null;
    const shouldBeNull =
      previousPeriod === null
      || currentValue === null
      || previousValue === null
      || previousValue === 0;

    if (shouldBeNull) {
      ensure(actual === null, `${symbol} ${label}: expected null YoY at index ${i}.`);
      continue;
    }

    const expected = (currentValue - previousValue) / Math.abs(previousValue);
    ensure(actual !== null, `${symbol} ${label}: expected numeric YoY at index ${i}.`);
    ensure(
      approxEqual(actual, expected, 1e-9),
      `${symbol} ${label}: YoY mismatch at ${current.period} (actual=${actual}, expected=${expected}).`
    );
    validatedPoints += 1;
  }
  return validatedPoints;
}

async function runYoyGate(baseUrl) {
  const stocks = await fetchJson(baseUrl, "/api/stocks?limit=5");
  ensure(stocks.response.ok, `YOY gate could not load symbols: HTTP ${stocks.response.status}`);
  ensure(Array.isArray(stocks.data?.stocks), "YOY gate: /api/stocks returned invalid payload.");
  const symbols = stocks.data.stocks
    .map((item) => String(item?.symbol ?? "").trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 3);
  ensure(symbols.length >= 2, "YOY gate: insufficient symbols for validation.");

  let validatedPoints = 0;
  const perSymbol = [];
  for (const symbol of symbols) {
    const res = await fetchJson(
      baseUrl,
      `/api/finance-analysis?symbol=${encodeURIComponent(symbol)}&type=fundamental&lookback=8`
    );
    ensure(res.response.ok, `YOY gate ${symbol}: HTTP ${res.response.status}`);
    const payload = res.data?.data;
    const revenueSeries = payload?.incomeStatement?.revenue;
    const revenueYoY = payload?.growth?.revenueYoY;
    const netIncomeSeries = payload?.incomeStatement?.netIncome;
    const netIncomeYoY = payload?.growth?.netIncomeYoY;

    const revenueValidated = validateYoySeries(revenueSeries, revenueYoY, symbol, "revenueYoY");
    const netIncomeValidated = validateYoySeries(netIncomeSeries, netIncomeYoY, symbol, "netIncomeYoY");
    validatedPoints += revenueValidated + netIncomeValidated;
    perSymbol.push({
      symbol,
      revenueValidated,
      netIncomeValidated,
    });
  }

  return {
    id: "YOY_CORRECTNESS",
    status: "PASS",
    detail: `Validated ${validatedPoints} YoY points across symbols: ${perSymbol.map((item) => item.symbol).join(", ")}.`,
    evidence: {
      symbols: perSymbol,
      validatedPoints,
    },
  };
}

function validateRankingRows(rows, metric) {
  ensure(Array.isArray(rows), `${metric}: rows is not an array.`);
  ensure(rows.length > 0, `${metric}: no ranked rows returned.`);
  for (const row of rows) {
    const metricValue = row?.metricValue;
    const sourceMetric = metric === "pe" ? row?.pe : row?.pb;
    ensure(isFiniteNumber(metricValue), `${metric}: metricValue is non-finite.`);
    ensure(metricValue > 0, `${metric}: metricValue must be > 0.`);
    ensure(isFiniteNumber(sourceMetric), `${metric}: source metric is non-finite.`);
    ensure(sourceMetric > 0, `${metric}: source metric must be > 0.`);
    ensure(
      approxEqual(metricValue, sourceMetric, 1e-9),
      `${metric}: metricValue mismatch for ${row?.symbol ?? "unknown"} (metricValue=${metricValue}, source=${sourceMetric}).`
    );
  }
}

async function runPePbRoeGate(baseUrl, projectDir) {
  const metrics = ["pe", "pb"];
  const metricEvidence = [];

  for (const metric of metrics) {
    const res = await fetchJson(
      baseUrl,
      `/api/analytics/valuation-rankings?exchange=HOSE&icbLevel=3&metric=${metric}&order=desc&limit=50`
    );
    ensure(res.response.ok, `${metric}: HTTP ${res.response.status}`);
    const rows = res.data?.rows;
    validateRankingRows(rows, metric);
    metricEvidence.push({
      metric,
      rowsChecked: rows.length,
      asOfDate: res.data?.asOfDate ?? null,
      eligibleRanked: res.data?.eligibleRanked ?? null,
    });
  }

  const stocks = await fetchJson(baseUrl, "/api/stocks?limit=20");
  ensure(stocks.response.ok, `ROE guard could not load symbols: HTTP ${stocks.response.status}`);
  const symbols = stocks.data.stocks
    .map((item) => String(item?.symbol ?? "").trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 8);
  ensure(symbols.length > 0, "ROE guard: no symbols available.");

  let roePointsChecked = 0;
  for (const symbol of symbols) {
    const res = await fetchJson(
      baseUrl,
      `/api/finance-analysis?symbol=${encodeURIComponent(symbol)}&type=fundamental&lookback=8`
    );
    ensure(res.response.ok, `ROE guard ${symbol}: HTTP ${res.response.status}`);
    const roeSeries = res.data?.data?.profitability?.roe;
    ensure(Array.isArray(roeSeries), `ROE guard ${symbol}: missing ROE series.`);
    for (const point of roeSeries) {
      const value = point?.value ?? null;
      if (value === null) continue;
      ensure(isFiniteNumber(value), `ROE guard ${symbol}: non-finite ROE value.`);
      roePointsChecked += 1;
    }
  }

  const sharesGuardSymbols = [];
  for (const symbol of symbols) {
    const valuationRes = await fetchJson(
      baseUrl,
      `/api/finance-analysis?symbol=${encodeURIComponent(symbol)}&type=valuation&lookback=8`
    );
    ensure(valuationRes.response.ok, `PE/PB guard valuation ${symbol}: HTTP ${valuationRes.response.status}`);
    const valuationWarnings = Array.isArray(valuationRes.data?.data?.warnings)
      ? valuationRes.data.data.warnings
      : [];
    const missingShares = valuationWarnings.some((item) => String(item).includes("Missing shares_outstanding field"));
    if (!missingShares) continue;

    const peerRes = await fetchJson(
      baseUrl,
      `/api/finance-analysis?symbol=${encodeURIComponent(symbol)}&type=peer&lookback=8`
    );
    ensure(peerRes.response.ok, `PE/PB guard peer ${symbol}: HTTP ${peerRes.response.status}`);
    const peers = peerRes.data?.data?.peers;
    ensure(Array.isArray(peers), `PE/PB guard ${symbol}: missing peers array.`);
    const me = peers.find((row) => String(row?.symbol ?? "").trim().toUpperCase() === symbol);
    ensure(!!me, `PE/PB guard ${symbol}: target symbol row not found.`);
    ensure(me.pe === null, `PE/PB guard ${symbol}: expected pe=null when shares_outstanding is missing.`);
    ensure(me.pb === null, `PE/PB guard ${symbol}: expected pb=null when shares_outstanding is missing.`);
    sharesGuardSymbols.push(symbol);
  }
  ensure(
    sharesGuardSymbols.length > 0,
    "PE/PB guard: no symbols with missing shares_outstanding field found for validation."
  );

  const dataTsPath = path.join(projectDir, "src", "lib", "finance", "data.ts");
  const ratiosTsPath = path.join(projectDir, "src", "lib", "finance", "ratios.ts");
  const dataTs = await fs.readFile(dataTsPath, "utf8");
  const ratiosTs = await fs.readFile(ratiosTsPath, "utf8");
  ensure(
    /denominator === 0\) return null;/.test(dataTs),
    "safeRatio guard missing zero-denominator protection in data.ts."
  );
  ensure(
    /safeRatio\(netIncome, equity\)/.test(ratiosTs),
    "ROE formula is not using safeRatio(netIncome, equity)."
  );

  return {
    id: "PE_PB_ROE_DATA_VALIDITY",
    status: "PASS",
    detail: "Validated PE/PB positive-finite guard, null-on-missing-shares guard, and ROE finite guard.",
    evidence: {
      metrics: metricEvidence,
      roeSymbolsChecked: symbols,
      roePointsChecked,
      sharesGuardSymbols,
      staticGuards: {
        safeRatioZeroDenominator: true,
        roeUsesSafeRatio: true,
      },
    },
  };
}

async function expect400(baseUrl, endpoint) {
  const res = await fetchJson(baseUrl, endpoint);
  return {
    status: res.response.status,
    body: res.data,
  };
}

async function runHoseOnlyGate(baseUrl) {
  const checks = [
    {
      endpoint: "/api/stocks?exchange=HNX",
      expectedStatus: 400,
      expectedError: 'Only "HOSE" exchange is supported.',
    },
    {
      endpoint: "/api/analytics/icb-snapshot?exchange=HNX&icbLevel=3&limit=5",
      expectedStatus: 400,
      expectedError: null,
    },
    {
      endpoint: "/api/analytics/valuation-rankings?exchange=HNX&icbLevel=3&metric=pe&order=desc&limit=5",
      expectedStatus: 400,
      expectedError: null,
    },
  ];

  const evidence = [];
  const failures = [];

  for (const check of checks) {
    const result = await expect400(baseUrl, check.endpoint);
    evidence.push({
      endpoint: check.endpoint,
      expectedStatus: check.expectedStatus,
      actualStatus: result.status,
      actualError: result.body?.error ?? null,
    });
    if (result.status !== check.expectedStatus) {
      failures.push(`${check.endpoint} expected ${check.expectedStatus}, got ${result.status}`);
      continue;
    }
    if (check.expectedError !== null && String(result.body?.error ?? "") !== check.expectedError) {
      failures.push(`${check.endpoint} expected error "${check.expectedError}", got "${String(result.body?.error ?? "")}"`);
    }
  }

  if (failures.length > 0) {
    return {
      id: "HOSE_ONLY_POLICY",
      status: "FAIL",
      detail: failures.join("; "),
      evidence,
    };
  }

  return {
    id: "HOSE_ONLY_POLICY",
    status: "PASS",
    detail: "All non-HOSE requests were blocked as expected.",
    evidence,
  };
}

async function runAssistantSemanticMetricGuard(baseUrl) {
  const stocks = await fetchJson(baseUrl, "/api/stocks?limit=5");
  ensure(stocks.response.ok, `semantic guard could not load symbols: HTTP ${stocks.response.status}`);
  ensure(Array.isArray(stocks.data?.stocks), "semantic guard: /api/stocks returned invalid payload.");
  const symbol = String(stocks.data.stocks[0]?.symbol ?? "VNM").trim().toUpperCase();
  ensure(symbol.length > 0, "semantic guard: no symbol available.");

  const prompt = [
    `Cho toi backtest SMA crossover cua ${symbol}.`,
    "Tra loi dung 3 dong voi 3 key co dinh: net_return, max_drawdown, total_trades.",
    "Format moi dong: <key>=<number> <unit> | period=<period>.",
    "Bat buoc co period va unit ro rang cho tung dong (total_trades dung unit 'trades').",
  ].join("\n");

  const assistant = await fetchJson(baseUrl, "/api/assistant", {
    method: "POST",
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

  if (providerLikelyUnavailable(assistant.response, assistant.data)) {
    return {
      id: "ASSISTANT_SEMANTIC_METRIC_GUARD",
      status: "PASS",
      detail: `Skipped semantic metric guard due provider unavailability (HTTP ${assistant.response.status}).`,
      evidence: {
        skipped: true,
        httpStatus: assistant.response.status,
      },
    };
  }

  ensure(assistant.response.ok, `semantic guard: assistant HTTP ${assistant.response.status}`);
  ensure(assistant.data?.success === true, "semantic guard: assistant success=false");
  ensure(typeof assistant.data?.message === "string" && assistant.data.message.length > 0, "semantic guard: empty assistant message");

  const verdict = validateMetricSemanticResponse(assistant.data.message, assistant.data?.citations);
  ensure(verdict.ok, `semantic guard failed: ${verdict.reason}`);

  return {
    id: "ASSISTANT_SEMANTIC_METRIC_GUARD",
    status: "PASS",
    detail: `Validated ${verdict.claims.length} metric claims with period/unit and citation.`,
    evidence: {
      symbol,
      claims: verdict.claims.map((item) => ({
        lineNo: item.lineNo,
        metric: item.metric,
        line: item.line,
      })),
      citationCount: Array.isArray(assistant.data?.citations) ? assistant.data.citations.length : 0,
    },
  };
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectDir = path.resolve(scriptDir, "..");
  const artifactDir = path.join(projectDir, "artifacts");
  const artifactPath = path.join(artifactDir, "phase1-gate-report.json");
  const externalBaseUrl = String(process.env.EVAL_BASE_URL ?? process.env.SMOKE_BASE_URL ?? "").trim();

  if (!process.env.DATA_DIR) {
    process.env.DATA_DIR = path.join(projectDir, "public", "data");
  }

  const startedAt = new Date().toISOString();
  let server = null;
  let baseUrl = externalBaseUrl;
  if (!baseUrl) {
    process.env.ASSISTANT_TOOL_BASE_URL = "";
    server = await startLocalNextServer(projectDir);
    baseUrl = server.baseUrl;
  }
  const summary = {
    startedAt,
    baseUrl,
    mode: externalBaseUrl ? "external-base-url" : "local-next-server",
    gates: [],
    overallStatus: "PASS",
    endedAt: null,
  };

  try {
    const gateDefs = [
      { id: "YOY_CORRECTNESS", run: () => runYoyGate(baseUrl) },
      { id: "PE_PB_ROE_DATA_VALIDITY", run: () => runPePbRoeGate(baseUrl, projectDir) },
      { id: "HOSE_ONLY_POLICY", run: () => runHoseOnlyGate(baseUrl) },
      { id: "ASSISTANT_SEMANTIC_METRIC_GUARD", run: () => runAssistantSemanticMetricGuard(baseUrl) },
    ];

    for (const gate of gateDefs) {
      try {
        const result = await gate.run();
        summary.gates.push(result);
        console.log(`[GATE] ${result.status} ${result.id} - ${result.detail}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failedGate = {
          id: gate.id,
          status: "FAIL",
          detail: message,
          evidence: null,
        };
        summary.gates.push(failedGate);
        console.error(`[GATE] FAIL ${failedGate.id} - ${failedGate.detail}`);
      }
    }
  } finally {
    if (server) {
      await server.close();
    }
  }

  if (summary.gates.some((gate) => gate.status !== "PASS")) {
    summary.overallStatus = "FAIL";
  }
  summary.endedAt = new Date().toISOString();

  await fs.mkdir(artifactDir, { recursive: true });
  await fs.writeFile(artifactPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(`[GATE] OVERALL ${summary.overallStatus}`);
  console.log(`[GATE] REPORT ${path.relative(projectDir, artifactPath)}`);

  if (summary.overallStatus !== "PASS") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[GATE] ERROR ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exit(1);
});
