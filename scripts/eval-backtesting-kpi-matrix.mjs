import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

const cli = parseCli(process.argv.slice(2));
const dryRun = cli.flags.has("dry-run") || envFlag("BACKTEST_KPI_DRY_RUN", false);
const baseUrl =
  cli.values["base-url"] ||
  process.env.BACKTEST_KPI_BASE_URL ||
  process.env.ASSISTANT_EVAL_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  "http://localhost:3010";
const reportPath =
  cli.values["report-path"] ||
  process.env.BACKTEST_KPI_REPORT_PATH ||
  "artifacts/backtesting-kpi-matrix-report.json";
const timeoutMs = envNumber("BACKTEST_KPI_TIMEOUT_MS", 45000);
const retryBackoffMs = envNumber("BACKTEST_KPI_RETRY_BACKOFF_MS", 500);
const apiMaxRetries = envInt("BACKTEST_KPI_API_MAX_RETRIES", 2);
const assistantMaxRetries = envInt("BACKTEST_KPI_ASSISTANT_MAX_RETRIES", 1);
const symbolsPerBucket = envInt("BACKTEST_KPI_SYMBOLS_PER_BUCKET", 2);
const requireActiveMetadata = envFlag("BACKTEST_KPI_REQUIRE_ACTIVE_METADATA", true);
const metadataPath = path.join(process.cwd(), "public", "data", "stock_metadata_2018_2025.csv");
const evalAuthToken = String(process.env.ASSISTANT_EVAL_AUTH_TOKEN ?? "").trim();
const allowedPolicyStatuses = parseListEnv("BACKTEST_KPI_ALLOWED_POLICY_STATUSES", ["ok", "fallback", "shadow_blocked"]);
const expectedProviders = parseListEnv("BACKTEST_KPI_EXPECT_PROVIDER", []);

const gatesConfig = {
  minApiSuccessRate: envNumber("BACKTEST_KPI_MIN_API_SUCCESS_RATE", 0.9),
  minAssistantGroundingRate: envNumber("BACKTEST_KPI_MIN_ASSISTANT_GROUNDING_RATE", 0.9),
  minCoverageAcrossBuckets: envNumber("BACKTEST_KPI_MIN_COVERAGE_ACROSS_BUCKETS", 1),
  minCoverageAcrossProfiles: envNumber("BACKTEST_KPI_MIN_COVERAGE_ACROSS_PROFILES", 1),
  minExpectedProviderRate: envNumber(
    "BACKTEST_KPI_MIN_EXPECTED_PROVIDER_RATE",
    expectedProviders.size > 0 ? 1 : 0
  ),
  maxLatencyP95Ms: envNumber("BACKTEST_KPI_MAX_LATENCY_P95_MS", 30000),
  maxS1Failures: envInt("BACKTEST_KPI_MAX_S1_FAILURES", 0),
};

const strategyTypes = [
  "sma_crossover",
  "ema_crossover",
  "rsi_mean_reversion",
  "bollinger_bands",
  "momentum",
];

const profileParamMatrix = {
  short: {
    sma_crossover: { shortPeriod: 5, longPeriod: 15 },
    ema_crossover: { shortPeriod: 5, longPeriod: 15 },
    rsi_mean_reversion: { period: 7, oversold: 35, overbought: 65 },
    bollinger_bands: { period: 10, stdDev: 1.8 },
    momentum: { lookback: 10, threshold: 0.03 },
  },
  medium: {
    sma_crossover: { shortPeriod: 10, longPeriod: 30 },
    ema_crossover: { shortPeriod: 10, longPeriod: 30 },
    rsi_mean_reversion: { period: 14, oversold: 30, overbought: 70 },
    bollinger_bands: { period: 20, stdDev: 2 },
    momentum: { lookback: 20, threshold: 0.05 },
  },
  long: {
    sma_crossover: { shortPeriod: 20, longPeriod: 60 },
    ema_crossover: { shortPeriod: 20, longPeriod: 60 },
    rsi_mean_reversion: { period: 28, oversold: 25, overbought: 75 },
    bollinger_bands: { period: 40, stdDev: 2.5 },
    momentum: { lookback: 60, threshold: 0.08 },
  },
};

const profileNames = Object.keys(profileParamMatrix);
const bucketNames = ["small", "mid", "large"];

function parseCli(argv) {
  const flags = new Set();
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] ?? "");
    if (!token.startsWith("--")) continue;
    const raw = token.slice(2);
    const eq = raw.indexOf("=");
    if (eq > 0) {
      values[raw.slice(0, eq)] = raw.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (typeof next === "string" && !next.startsWith("--")) {
      values[raw] = next;
      i += 1;
      continue;
    }
    flags.add(raw);
  }
  return { flags, values };
}

function envFlag(key, fallback) {
  const raw = String(process.env[key] ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function envNumber(key, fallback) {
  const raw = String(process.env[key] ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envInt(key, fallback) {
  const raw = String(process.env[key] ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseListEnv(key, fallback) {
  const raw = String(process.env[key] ?? "").trim();
  if (!raw) return new Set(fallback.map((x) => x.toLowerCase()));
  const values = raw
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter((x) => x.length > 0);
  if (values.length === 0) return new Set(fallback.map((x) => x.toLowerCase()));
  return new Set(values);
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank];
}

function quantile(values, q) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function toRate(passed, total) {
  return total > 0 ? passed / total : null;
}

function gate(actual, threshold, comparator) {
  if (actual === null || !Number.isFinite(actual)) {
    return { pass: false, actual, threshold, comparator };
  }
  const pass = comparator === "lte" ? actual <= threshold : actual >= threshold;
  return { pass, actual, threshold, comparator };
}

function hasToolStatus(usedTools, name, status) {
  return Array.isArray(usedTools) && usedTools.some((x) => x?.name === name && x?.status === status);
}

function hasCitation(citations, fragment) {
  return Array.isArray(citations) && citations.some((x) => typeof x?.endpoint === "string" && x.endpoint.includes(fragment));
}

function readMetadataRows(csvPath) {
  ensure(fs.existsSync(csvPath), `Metadata CSV not found: ${csvPath}`);
  const content = fs.readFileSync(csvPath, "utf8");
  const parsed = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => String(header ?? "").trim().replace(/^\uFEFF/, "").toLowerCase(),
  });
  if (parsed.errors?.length > 0) {
    const first = parsed.errors[0];
    throw new Error(`Failed to parse metadata CSV: ${first.message} (row=${first.row ?? "n/a"})`);
  }
  const rows = [];
  for (const row of parsed.data ?? []) {
    if (!row || typeof row !== "object") continue;
    const symbol = String(row.symbol ?? "").trim().toUpperCase();
    const exchange = String(row.exchange ?? "").trim().toUpperCase();
    const status = String(row.status ?? "").trim().toUpperCase();
    const avgVolume = Number(row.avg_volume);
    if (!symbol || exchange !== "HOSE" || !Number.isFinite(avgVolume) || avgVolume <= 0) continue;
    if (requireActiveMetadata && status && status !== "ACTIVE") continue;
    rows.push({ symbol, exchange, status: status || "UNKNOWN", avgVolume });
  }
  ensure(rows.length >= 3, `Insufficient HOSE metadata rows after filtering: ${rows.length}`);
  return rows;
}

function deriveLiquidityBuckets(rows) {
  const volumes = rows.map((x) => x.avgVolume);
  const p33 = quantile(volumes, 1 / 3);
  const p66 = quantile(volumes, 2 / 3);
  ensure(p33 !== null && p66 !== null, "Failed to compute liquidity quantiles");

  const bucketed = { small: [], mid: [], large: [] };
  for (const row of rows) {
    if (row.avgVolume <= p33) {
      bucketed.small.push({ ...row, bucket: "small" });
    } else if (row.avgVolume <= p66) {
      bucketed.mid.push({ ...row, bucket: "mid" });
    } else {
      bucketed.large.push({ ...row, bucket: "large" });
    }
  }

  for (const name of bucketNames) {
    ensure(bucketed[name].length > 0, `Empty liquidity bucket detected: ${name}`);
    bucketed[name].sort((a, b) => a.avgVolume - b.avgVolume);
  }

  return {
    thresholds: { p33, p66 },
    buckets: bucketed,
  };
}

function pickDiversifiedSymbols(bucketRows, count) {
  if (bucketRows.length <= count) return [...bucketRows];
  const picked = [];
  const used = new Set();
  for (let i = 0; i < count; i += 1) {
    const idx = Math.round((i * (bucketRows.length - 1)) / Math.max(1, count - 1));
    if (!used.has(idx)) {
      used.add(idx);
      picked.push(bucketRows[idx]);
    }
  }
  if (picked.length < count) {
    for (let i = 0; i < bucketRows.length && picked.length < count; i += 1) {
      if (used.has(i)) continue;
      used.add(i);
      picked.push(bucketRows[i]);
    }
  }
  return picked;
}

function buildSymbolSet(bucketMap, countPerBucket) {
  const perBucket = {};
  const flat = [];
  for (const bucket of bucketNames) {
    const picked = pickDiversifiedSymbols(bucketMap[bucket], countPerBucket);
    perBucket[bucket] = picked.map((item) => ({
      symbol: item.symbol,
      bucket: item.bucket,
      avgVolume: item.avgVolume,
      exchange: item.exchange,
    }));
    for (const item of perBucket[bucket]) {
      flat.push(item);
    }
  }
  ensure(flat.length >= 3, `Selected symbol set is too small: ${flat.length}`);
  return { perBucket, flat };
}

function buildApiCases(symbolSet) {
  const cases = [];
  const seen = new Set();
  let matrixIndex = 0;

  for (const profile of profileNames) {
    for (const strategy of strategyTypes) {
      const bucket = bucketNames[matrixIndex % bucketNames.length];
      const bucketSymbols = symbolSet.perBucket[bucket];
      const symbolIndex = Math.floor(matrixIndex / bucketNames.length) % bucketSymbols.length;
      const symbolInfo = bucketSymbols[symbolIndex];
      matrixIndex += 1;

      const key = `${symbolInfo.symbol}|${strategy}|${profile}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cases.push({
        id: `API-MATRIX-${cases.length + 1}`,
        source: "strategy-profile-matrix",
        symbol: symbolInfo.symbol,
        bucket: symbolInfo.bucket,
        strategy,
        profile,
        params: profileParamMatrix[profile][strategy],
      });
    }
  }

  for (let i = 0; i < symbolSet.flat.length; i += 1) {
    const symbolInfo = symbolSet.flat[i];
    const profile = profileNames[i % profileNames.length];
    const strategy = strategyTypes[i % strategyTypes.length];
    const key = `${symbolInfo.symbol}|${strategy}|${profile}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cases.push({
      id: `API-SYM-${cases.length + 1}`,
      source: "symbol-coverage",
      symbol: symbolInfo.symbol,
      bucket: symbolInfo.bucket,
      strategy,
      profile,
      params: profileParamMatrix[profile][strategy],
    });
  }

  return cases;
}

function buildAssistantCases(symbolSet) {
  return symbolSet.flat.map((symbolInfo, idx) => {
    const profile = profileNames[idx % profileNames.length];
    const strategy = "sma_crossover";
    const horizonLabel = profile === "short" ? "ngan han" : profile === "medium" ? "trung han" : "dai han";
    const message = [
      `Backtest SMA crossover cho ma HOSE ${symbolInfo.symbol} voi von 100000 theo khung ${horizonLabel}.`,
      "Tom tat net return, sharpe ratio, max drawdown va tong so lenh.",
      "Bat buoc dung du lieu noi bo QuantVN va trich dan nguon API.",
    ].join(" ");
    return {
      id: `AST-${idx + 1}`,
      symbol: symbolInfo.symbol,
      bucket: symbolInfo.bucket,
      profile,
      strategy,
      message,
      contextSnapshot: { page: "backtesting", symbol: symbolInfo.symbol },
    };
  });
}

function shouldRetryStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isRetryableError(error) {
  const text = String(error instanceof Error ? error.message : error ?? "").toLowerCase();
  return text.includes("aborted")
    || text.includes("timeout")
    || text.includes("fetch failed")
    || text.includes("network")
    || text.includes("econnreset");
}

function resolveRetryDelayMs(response, attemptIndex) {
  const retryAfter = Number(response?.headers?.get?.("retry-after") ?? "");
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter * 1000;
  }
  return retryBackoffMs * (attemptIndex + 1);
}

async function requestJsonWithRetry({ url, method, headers, body, maxRetries }) {
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      const latencyMs = Date.now() - startedAt;
      if (shouldRetryStatus(response.status) && attempt < maxRetries) {
        const waitMs = resolveRetryDelayMs(response, attempt);
        await sleep(waitMs);
        continue;
      }
      return {
        ok: response.ok,
        status: response.status,
        data,
        latencyMs,
        attempts: attempt + 1,
        error: null,
      };
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries || !isRetryableError(error)) {
        return {
          ok: false,
          status: null,
          data: null,
          latencyMs: Date.now() - startedAt,
          attempts: attempt + 1,
          error: error instanceof Error ? error.message : String(error),
        };
      }
      await sleep(retryBackoffMs * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    status: null,
    data: null,
    latencyMs: null,
    attempts: maxRetries + 1,
    error: lastError instanceof Error ? lastError.message : String(lastError ?? "unknown_error"),
  };
}

async function runBacktestingCase(caseItem) {
  const request = {
    symbol: caseItem.symbol,
    strategy: caseItem.strategy,
    capital: 100000,
    params: caseItem.params,
  };
  const outcome = await requestJsonWithRetry({
    url: `${baseUrl}/api/backtesting`,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: request,
    maxRetries: apiMaxRetries,
  });

  const hasMetrics = outcome.data && typeof outcome.data.metrics === "object";
  const pass = outcome.ok && hasMetrics;
  const failureReasons = [];
  if (!outcome.ok) failureReasons.push(`http_status=${outcome.status ?? "network_error"}`);
  if (outcome.ok && !hasMetrics) failureReasons.push("missing_metrics_payload");
  if (outcome.error) failureReasons.push(`error=${outcome.error}`);

  return {
    ...caseItem,
    endpoint: "/api/backtesting",
    apiCalled: true,
    request,
    pass,
    s1: !pass,
    status: outcome.status,
    latencyMs: outcome.latencyMs,
    attempts: outcome.attempts,
    responseSummary: {
      totalTrades: Number(outcome.data?.metrics?.totalTrades ?? NaN),
      netReturn: Number(outcome.data?.metrics?.netReturn ?? NaN),
      sharpeRatio: Number(outcome.data?.metrics?.sharpeRatio ?? NaN),
      maxDrawdown: Number(outcome.data?.metrics?.maxDrawdown ?? NaN),
    },
    failureReasons,
    rawError: outcome.error,
  };
}

async function runAssistantCase(caseItem) {
  const requestBody = {
    message: caseItem.message,
    conversationHistory: [],
    contextSnapshot: caseItem.contextSnapshot,
    preferences: { language: "en", detailLevel: "brief" },
  };

  const outcome = await requestJsonWithRetry({
    url: `${baseUrl}/api/assistant`,
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-assistant-eval": "true",
      ...(evalAuthToken ? { "x-assistant-eval-token": evalAuthToken } : {}),
    },
    body: requestBody,
    maxRetries: assistantMaxRetries,
  });

  const successResponse = outcome.ok && outcome.data?.success === true;
  const toolOk = hasToolStatus(outcome.data?.usedTools, "backtestSummary", "success");
  const citationOk = hasCitation(outcome.data?.citations, "/api/backtesting");
  const policyStatus = String(outcome.data?.policyStatus ?? "").trim().toLowerCase();
  const policyOk = policyStatus.length > 0 && allowedPolicyStatuses.has(policyStatus);
  const groundingPass = successResponse && toolOk && citationOk && policyOk;
  const failureReasons = [];
  if (!successResponse) failureReasons.push(`assistant_response_invalid status=${outcome.status ?? "network_error"}`);
  if (!toolOk) failureReasons.push("missing_backtestSummary_success");
  if (!citationOk) failureReasons.push("missing_backtesting_citation");
  if (!policyOk) failureReasons.push(`policy_status_unexpected=${policyStatus || "n/a"}`);
  if (outcome.error) failureReasons.push(`error=${outcome.error}`);

  return {
    ...caseItem,
    endpoint: "/api/assistant",
    apiCalled: true,
    pass: groundingPass,
    groundingPass,
    s1: !groundingPass,
    status: outcome.status,
    latencyMs: outcome.latencyMs,
    attempts: outcome.attempts,
    providerUsed: String(outcome.data?.meta?.providerUsed ?? "").trim() || null,
    fallbackUsed: outcome.data?.meta?.fallbackUsed === true,
    policyStatus: policyStatus || null,
    responseSuccess: successResponse,
    toolOk,
    citationOk,
    policyOk,
    failureReasons,
    rawError: outcome.error,
  };
}

function computeKpis(apiResults, assistantResults) {
  const apiTotal = apiResults.length;
  const apiPassed = apiResults.filter((x) => x.pass).length;
  const assistantTotal = assistantResults.length;
  const assistantGrounded = assistantResults.filter((x) => x.groundingPass).length;
  const apiSuccessRate = toRate(apiPassed, apiTotal);
  const assistantGroundingRate = toRate(assistantGrounded, assistantTotal);

  const apiBucketSet = new Set(apiResults.filter((x) => x.pass).map((x) => x.bucket));
  const assistantBucketSet = new Set(assistantResults.filter((x) => x.groundingPass).map((x) => x.bucket));
  const apiBucketCoverage = apiBucketSet.size / bucketNames.length;
  const assistantBucketCoverage = assistantBucketSet.size / bucketNames.length;
  const coverageAcrossBuckets = Math.min(apiBucketCoverage, assistantBucketCoverage);

  const profileCoverageSet = new Set(apiResults.filter((x) => x.pass).map((x) => x.profile));
  const coverageAcrossProfiles = profileCoverageSet.size / profileNames.length;

  const apiLatencies = apiResults.map((x) => x.latencyMs).filter((x) => Number.isFinite(x));
  const assistantLatencies = assistantResults.map((x) => x.latencyMs).filter((x) => Number.isFinite(x));
  const combinedLatencies = [...apiLatencies, ...assistantLatencies];
  const apiLatencyP95 = percentile(apiLatencies, 95);
  const assistantLatencyP95 = percentile(assistantLatencies, 95);
  const latencyP95 = percentile(combinedLatencies, 95);
  const expectedProviderMatched = assistantResults.filter((x) =>
    expectedProviders.has(String(x.providerUsed ?? "").trim().toLowerCase())
  ).length;
  const expectedProviderRate =
    expectedProviders.size > 0 ? toRate(expectedProviderMatched, assistantTotal) : null;
  const s1Failures =
    apiResults.filter((x) => x.s1).length +
    assistantResults.filter((x) => x.s1).length;

  return {
    apiSuccessRate,
    assistantGroundingRate,
    coverageAcrossBuckets,
    coverageAcrossProfiles,
    expectedProviderRate,
    latencyP95,
    s1Failures,
    components: {
      api: { total: apiTotal, passed: apiPassed, latencyP95: apiLatencyP95 },
      assistant: { total: assistantTotal, grounded: assistantGrounded, latencyP95: assistantLatencyP95 },
      apiCallTracking: {
        backtestingCalls: apiResults.length,
        backtestingHttpOk: apiResults.filter((x) => x.status >= 200 && x.status < 300).length,
        assistantCalls: assistantResults.length,
        assistantHttpOk: assistantResults.filter((x) => x.status >= 200 && x.status < 300).length,
        providerUsedCounts: Object.fromEntries(
          Array.from(
            assistantResults.reduce((map, item) => {
              const key = item.providerUsed || "unknown";
              map.set(key, (map.get(key) ?? 0) + 1);
              return map;
            }, new Map())
          ).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        ),
        expectedProviders: Array.from(expectedProviders).sort(),
        expectedProviderMatched,
        fallbackUsedCount: assistantResults.filter((x) => x.fallbackUsed === true).length,
      },
      bucketCoverage: {
        apiBucketCoverage,
        assistantBucketCoverage,
        apiBuckets: Array.from(apiBucketSet).sort(),
        assistantBuckets: Array.from(assistantBucketSet).sort(),
      },
      profileCoverage: {
        coveredProfiles: Array.from(profileCoverageSet).sort(),
      },
      latencySamples: {
        api: apiLatencies.length,
        assistant: assistantLatencies.length,
        combined: combinedLatencies.length,
      },
    },
  };
}

function evaluateGates(kpis) {
  const checks = {
    apiSuccessRate: gate(kpis.apiSuccessRate, gatesConfig.minApiSuccessRate, "gte"),
    assistantGroundingRate: gate(kpis.assistantGroundingRate, gatesConfig.minAssistantGroundingRate, "gte"),
    coverageAcrossBuckets: gate(kpis.coverageAcrossBuckets, gatesConfig.minCoverageAcrossBuckets, "gte"),
    coverageAcrossProfiles: gate(kpis.coverageAcrossProfiles, gatesConfig.minCoverageAcrossProfiles, "gte"),
    expectedProviderRate:
      expectedProviders.size > 0
        ? gate(kpis.expectedProviderRate, gatesConfig.minExpectedProviderRate, "gte")
        : { pass: true, actual: null, threshold: gatesConfig.minExpectedProviderRate, comparator: "gte", skipped: true },
    latencyP95: gate(kpis.latencyP95, gatesConfig.maxLatencyP95Ms, "lte"),
    s1Failures: gate(kpis.s1Failures, gatesConfig.maxS1Failures, "lte"),
  };
  const allPass = Object.values(checks).every((item) => item.pass);
  return { allPass, checks };
}

function buildRuntimeContext() {
  const metadataRows = readMetadataRows(metadataPath);
  const bucketed = deriveLiquidityBuckets(metadataRows);
  const symbolSet = buildSymbolSet(bucketed.buckets, Math.max(1, symbolsPerBucket));
  const apiCases = buildApiCases(symbolSet);
  const assistantCases = buildAssistantCases(symbolSet);
  return {
    metadataRows,
    bucketed,
    symbolSet,
    apiCases,
    assistantCases,
  };
}

async function writeReport(report) {
  const abs = path.resolve(reportPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return abs;
}

function logCase(kind, item) {
  if (item.pass) {
    console.log(`PASS ${kind} ${item.id} symbol=${item.symbol} strategy=${item.strategy} profile=${item.profile}`);
    return;
  }
  console.log(
    `FAIL ${kind} ${item.id} symbol=${item.symbol} strategy=${item.strategy} profile=${item.profile} reasons=${item.failureReasons.join("|")}`
  );
}

async function runDry() {
  const context = buildRuntimeContext();
  const report = {
    schemaVersion: "backtesting-kpi-matrix-v1-2026-02-18",
    runAt: new Date().toISOString(),
    mode: "dry-run",
    baseUrl,
    hoseOnly: true,
    metadataPath,
    selection: {
      requireActiveMetadata,
      symbolsPerBucket,
      metadataRows: context.metadataRows.length,
      thresholds: context.bucketed.thresholds,
      buckets: Object.fromEntries(bucketNames.map((name) => [name, context.bucketed.buckets[name].length])),
      selectedSymbols: context.symbolSet.flat,
    },
    plan: {
      apiCases: context.apiCases.length,
      assistantCases: context.assistantCases.length,
      apiMatrixCoverage: {
        strategies: strategyTypes,
        profiles: profileNames,
        buckets: bucketNames,
      },
    },
    gatesConfig: gatesConfig,
    notes: [
      "Dry-run does not execute network requests.",
      "Assistant checks in live mode validate backtestSummary tool, /api/backtesting citation, and policy status.",
      "When BACKTEST_KPI_EXPECT_PROVIDER is set, live mode also enforces providerUsed gate.",
    ],
  };
  const written = await writeReport(report);
  console.log(`REPORT_PATH=${written}`);
  console.log(`DRY_RUN=true metadata_rows=${context.metadataRows.length} api_cases=${context.apiCases.length} assistant_cases=${context.assistantCases.length}`);
}

async function runLive() {
  const startedAt = Date.now();
  const context = buildRuntimeContext();
  const apiResults = [];
  const assistantResults = [];

  for (const apiCase of context.apiCases) {
    const result = await runBacktestingCase(apiCase);
    apiResults.push(result);
    logCase("API", result);
  }

  for (const assistantCase of context.assistantCases) {
    const result = await runAssistantCase(assistantCase);
    assistantResults.push(result);
    logCase("AST", result);
  }

  const kpis = computeKpis(apiResults, assistantResults);
  const gates = evaluateGates(kpis);
  const overallStatus = gates.allPass ? "pass" : "fail";

  const report = {
    schemaVersion: "backtesting-kpi-matrix-v1-2026-02-18",
    runAt: new Date().toISOString(),
    mode: "live",
    durationMs: Date.now() - startedAt,
    baseUrl,
    hoseOnly: true,
    metadataPath,
    config: {
      timeoutMs,
      retryBackoffMs,
      apiMaxRetries,
      assistantMaxRetries,
      requireActiveMetadata,
      symbolsPerBucket,
      allowedPolicyStatuses: Array.from(allowedPolicyStatuses).sort(),
      expectedProviders: Array.from(expectedProviders).sort(),
      gates: gatesConfig,
    },
    selection: {
      metadataRows: context.metadataRows.length,
      thresholds: context.bucketed.thresholds,
      buckets: Object.fromEntries(bucketNames.map((name) => [name, context.bucketed.buckets[name].length])),
      selectedSymbols: context.symbolSet.flat,
      apiCases: context.apiCases.length,
      assistantCases: context.assistantCases.length,
    },
    kpis,
    gates,
    overallStatus,
    results: {
      api: apiResults,
      assistant: assistantResults,
    },
  };

  const written = await writeReport(report);
  console.log(`REPORT_PATH=${written}`);
  console.log(
    `SUMMARY apiSuccessRate=${formatRate(kpis.apiSuccessRate)} assistantGroundingRate=${formatRate(kpis.assistantGroundingRate)} bucketCoverage=${formatRate(kpis.coverageAcrossBuckets)} profileCoverage=${formatRate(kpis.coverageAcrossProfiles)} expectedProviderRate=${formatRate(kpis.expectedProviderRate)} latencyP95Ms=${kpis.latencyP95 ?? "n/a"} s1Failures=${kpis.s1Failures}`
  );
  console.log(
    `GATES api=${gates.checks.apiSuccessRate.pass ? "PASS" : "FAIL"} assistant=${gates.checks.assistantGroundingRate.pass ? "PASS" : "FAIL"} buckets=${gates.checks.coverageAcrossBuckets.pass ? "PASS" : "FAIL"} profiles=${gates.checks.coverageAcrossProfiles.pass ? "PASS" : "FAIL"} provider=${gates.checks.expectedProviderRate.pass ? "PASS" : "FAIL"} latency=${gates.checks.latencyP95.pass ? "PASS" : "FAIL"} s1=${gates.checks.s1Failures.pass ? "PASS" : "FAIL"}`
  );

  if (!gates.allPass) {
    process.exit(1);
  }
}

function formatRate(value) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(2)}%`;
}

async function main() {
  if (dryRun) {
    await runDry();
    return;
  }
  await runLive();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
