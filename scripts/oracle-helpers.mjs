const DEFAULT_TIMEOUT_MS = 30_000;
const EPSILON = 1e-9;

function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function normalizeOracleSymbol(raw) {
  const symbol = String(raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z][A-Z0-9]{0,9}$/.test(symbol)) return null;
  return symbol;
}

export function normalizeOracleDate(raw) {
  const input = String(raw ?? "").trim();
  if (!input) return null;

  const yyyyMmDd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(input);
  if (yyyyMmDd) {
    return createDateKey(Number(yyyyMmDd[1]), Number(yyyyMmDd[2]), Number(yyyyMmDd[3]));
  }

  const ddMmYyyy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(input);
  if (ddMmYyyy) {
    const day = Number(ddMmYyyy[1]);
    const month = Number(ddMmYyyy[2]);
    const year = Number(ddMmYyyy[3]);
    return createDateKey(year, month, day);
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return createDateKey(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

function createDateKey(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 1900 || year > 2200) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function buildAbsoluteUrl(baseUrl, endpoint) {
  const base = String(baseUrl ?? "").trim();
  if (!base) throw new Error("oracle: baseUrl is required.");
  const path = String(endpoint ?? "").trim();
  if (!path) throw new Error("oracle: endpoint is required.");
  return new URL(path, base).toString();
}

async function fetchJson(baseUrl, endpoint, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(buildAbsoluteUrl(baseUrl, endpoint), {
      method: "GET",
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { response, data, text };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeOrder(raw) {
  const value = normalizeText(raw);
  if (value === "asc" || value === "ascending") return "asc";
  return "desc";
}

function normalizeStocksMetric(raw) {
  const value = normalizeText(raw);
  if (value === "open" || value === "high" || value === "low" || value === "close" || value === "volume") {
    return value;
  }
  return "close";
}

function normalizeValuationMetric(raw) {
  const value = normalizeText(raw);
  if (value === "pb" || value === "p/b" || value === "p_b") return "pb";
  if (value.includes("ev") && value.includes("ebitda")) return "ev_ebitda";
  return "pe";
}

function resolveLimit(raw, fallback = 10) {
  const value = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(100, value);
}

function pickMessageBlockTable(messageBlocks, titleIncludes) {
  if (!Array.isArray(messageBlocks)) return null;
  const titleNeedle = normalizeText(titleIncludes);
  for (const block of messageBlocks) {
    if (!block || block.type !== "table") continue;
    if (!titleNeedle) return block;
    const title = normalizeText(block.title);
    if (title.includes(titleNeedle)) return block;
  }
  return null;
}

function resolveColumnIndex(columns, candidates, fallbackIndex) {
  const normalizedColumns = Array.isArray(columns) ? columns.map((item) => normalizeText(item)) : [];
  for (const candidate of candidates) {
    const needle = normalizeText(candidate);
    const index = normalizedColumns.findIndex((col) => col.includes(needle));
    if (index >= 0) return index;
  }
  return fallbackIndex;
}

function extractSymbolsFromTable(messageBlocks, titleIncludes) {
  const table = pickMessageBlockTable(messageBlocks, titleIncludes);
  if (!table || !Array.isArray(table.rows)) {
    return { symbols: [], rowCount: 0, symbolColumnIndex: -1, title: null };
  }

  const symbolColumnIndex = resolveColumnIndex(table.columns, ["symbol", "ma"], 1);
  const symbols = table.rows
    .map((row) => (Array.isArray(row) ? normalizeOracleSymbol(row[symbolColumnIndex]) : null))
    .filter((item) => item !== null);
  return {
    symbols,
    rowCount: table.rows.length,
    symbolColumnIndex,
    title: typeof table.title === "string" ? table.title : null,
  };
}

function extractSymbolMetricMapFromTable(messageBlocks, input) {
  const table = pickMessageBlockTable(messageBlocks, input.titleIncludes);
  if (!table || !Array.isArray(table.rows)) {
    return { values: new Map(), rowCount: 0, symbolColumnIndex: -1, metricColumnIndex: -1, title: null };
  }

  const symbolColumnIndex = resolveColumnIndex(table.columns, ["symbol", "ma"], 1);
  const metricColumnIndex = resolveColumnIndex(
    table.columns,
    input.metricColumnCandidates ?? ["metric value", "metric", input.metric],
    symbolColumnIndex + 1
  );
  const values = new Map();
  for (const row of table.rows) {
    if (!Array.isArray(row)) continue;
    const symbol = normalizeOracleSymbol(row[symbolColumnIndex]);
    const metricValue = toFiniteNumber(row[metricColumnIndex]);
    if (!symbol || metricValue === null) continue;
    values.set(symbol, metricValue);
  }

  return {
    values,
    rowCount: table.rows.length,
    symbolColumnIndex,
    metricColumnIndex,
    title: typeof table.title === "string" ? table.title : null,
  };
}

function countPrefixMatches(left, right, topN) {
  const n = Math.min(topN, left.length, right.length);
  let matches = 0;
  for (let i = 0; i < n; i += 1) {
    if (left[i] === right[i]) matches += 1;
  }
  return matches;
}

function countOverlap(left, right, topN) {
  const leftTop = new Set(left.slice(0, topN));
  let overlap = 0;
  for (const symbol of right.slice(0, topN)) {
    if (leftTop.has(symbol)) overlap += 1;
  }
  return overlap;
}

function relationFromValues(left, right, tolerance = EPSILON) {
  if (left > right + tolerance) return "gt";
  if (left < right - tolerance) return "lt";
  return "eq";
}

function evaluateOperator(left, right, operator, tolerance = EPSILON) {
  if (operator === "gt") return left > right + tolerance;
  if (operator === "gte") return left > right - tolerance;
  if (operator === "lt") return left < right - tolerance;
  if (operator === "lte") return left < right + tolerance;
  if (operator === "eq") return Math.abs(left - right) <= tolerance;
  if (operator === "neq") return Math.abs(left - right) > tolerance;
  return true;
}

function buildStocksTopKEndpoint(spec) {
  const params = new URLSearchParams();
  params.set("exchange", String(spec.exchange ?? "HOSE").trim().toUpperCase() || "HOSE");
  params.set("metric", normalizeStocksMetric(spec.metric));
  params.set("order", normalizeOrder(spec.order));
  params.set("limit", String(resolveLimit(spec.limit, 10)));
  const normalizedDate = normalizeOracleDate(spec.date);
  if (normalizedDate) params.set("date", normalizedDate);
  if (String(spec.icb ?? "").trim()) params.set("icb", String(spec.icb).trim());
  return `/api/stocks?${params.toString()}`;
}

function buildValuationTopKEndpoint(spec) {
  const params = new URLSearchParams();
  params.set("metric", normalizeValuationMetric(spec.metric));
  params.set("order", normalizeOrder(spec.order));
  params.set("limit", String(resolveLimit(spec.limit, 10)));
  const normalizedDate = normalizeOracleDate(spec.date);
  if (normalizedDate) params.set("date", normalizedDate);
  if (String(spec.icbLevel ?? "").trim()) params.set("icbLevel", String(spec.icbLevel).trim());
  if (String(spec.icb ?? "").trim()) params.set("icb", String(spec.icb).trim());
  params.set("exchange", String(spec.exchange ?? "HOSE").trim().toUpperCase() || "HOSE");
  return `/api/analytics/valuation-rankings?${params.toString()}`;
}

export async function runTopKByDateOracleCheck(input) {
  const source = normalizeText(input?.spec?.source) === "valuation" ? "valuation" : "stocks";
  const spec = input?.spec ?? {};
  const endpoint = source === "valuation" ? buildValuationTopKEndpoint(spec) : buildStocksTopKEndpoint(spec);
  const checkTopN = resolveLimit(spec.compareTopN, Math.min(resolveLimit(spec.limit, 10), 5));
  const minMatch = resolveLimit(spec.minPrefixMatch, Math.max(1, Math.min(3, checkTopN)));
  const requireExactOrderTopN = resolveLimit(spec.requireExactOrderTopN, 0);
  const compareMode = normalizeText(spec.compareMode) === "set" ? "set" : "prefix";
  const tableTitleIncludes = String(
    spec.tableTitleIncludes
      ?? (source === "valuation" ? "valuation ranking" : "stock ranking")
  );
  const assistantExtract = extractSymbolsFromTable(input?.assistant?.messageBlocks, tableTitleIncludes);
  const observedSymbols = assistantExtract.symbols;
  if (observedSymbols.length === 0) {
    return {
      ok: false,
      reason: `oracle_topk: no assistant table rows found (title~"${tableTitleIncludes}")`,
      evidence: {
        source,
        endpoint,
        observedTopSymbols: [],
        oracleTopSymbols: [],
      },
    };
  }

  const oracleFetch = await fetchJson(input.baseUrl, endpoint, input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (!oracleFetch.response.ok) {
    return {
      ok: false,
      reason: `oracle_topk: oracle endpoint failed HTTP ${oracleFetch.response.status}`,
      evidence: {
        source,
        endpoint,
        observedTopSymbols: observedSymbols.slice(0, checkTopN),
        oracleTopSymbols: [],
      },
    };
  }

  const oracleRows =
    source === "valuation"
      ? Array.isArray(oracleFetch.data?.rows) ? oracleFetch.data.rows : []
      : Array.isArray(oracleFetch.data?.stocks) ? oracleFetch.data.stocks : [];
  const oracleSymbols = oracleRows
    .map((row) => normalizeOracleSymbol(row?.symbol))
    .filter((symbol) => symbol !== null);

  const overlap = countOverlap(observedSymbols, oracleSymbols, checkTopN);
  const prefixMatches = countPrefixMatches(observedSymbols, oracleSymbols, checkTopN);
  const exactOrderWindow = Math.min(requireExactOrderTopN, checkTopN);
  const exactOrderMatches = exactOrderWindow > 0
    ? countPrefixMatches(observedSymbols, oracleSymbols, exactOrderWindow)
    : 0;
  const exactOrderPass = exactOrderWindow === 0 || exactOrderMatches >= exactOrderWindow;
  const score = compareMode === "set" ? overlap : prefixMatches;
  const ok = score >= minMatch && exactOrderPass;
  const exactOrderReason = exactOrderWindow > 0
    ? `, exact_order=${exactOrderMatches}/${exactOrderWindow}`
    : "";

  return {
    ok,
    reason: ok
      ? `oracle_topk: pass (${compareMode}_matches=${score}/${checkTopN}, min=${minMatch}${exactOrderReason})`
      : `oracle_topk: fail (${compareMode}_matches=${score}/${checkTopN}, min=${minMatch}${exactOrderReason})`,
    evidence: {
      source,
      endpoint,
      checkTopN,
      minMatch,
      compareMode,
      requireExactOrderTopN: exactOrderWindow,
      exactOrderMatches,
      exactOrderPass,
      observedTopSymbols: observedSymbols.slice(0, checkTopN),
      oracleTopSymbols: oracleSymbols.slice(0, checkTopN),
      overlap,
      prefixMatches,
      tableTitle: assistantExtract.title,
      tableRows: assistantExtract.rowCount,
    },
  };
}

async function fetchStockMetricValue(baseUrl, symbol, metric, date, timeoutMs) {
  const params = new URLSearchParams();
  params.set("symbol", symbol);
  params.set("limit", "1");
  const normalizedDate = normalizeOracleDate(date);
  if (normalizedDate) params.set("date", normalizedDate);
  const endpoint = `/api/stocks?${params.toString()}`;
  const res = await fetchJson(baseUrl, endpoint, timeoutMs);
  if (!res.response.ok) {
    return { endpoint, value: null, error: `HTTP ${res.response.status}` };
  }
  const rows = Array.isArray(res.data?.data) ? res.data.data : [];
  if (rows.length === 0) {
    return { endpoint, value: null, error: "empty_rows" };
  }
  const row = rows[0];
  const value = toFiniteNumber(row?.[metric]);
  return { endpoint, value, error: value === null ? "metric_missing" : null };
}

async function fetchValuationMetricMap(baseUrl, spec, timeoutMs) {
  const endpoint = buildValuationTopKEndpoint({
    ...spec,
    limit: 100,
    order: "desc",
  });
  const res = await fetchJson(baseUrl, endpoint, timeoutMs);
  if (!res.response.ok) {
    return { endpoint, values: new Map(), error: `HTTP ${res.response.status}` };
  }
  const rows = Array.isArray(res.data?.rows) ? res.data.rows : [];
  const values = new Map();
  for (const row of rows) {
    const symbol = normalizeOracleSymbol(row?.symbol);
    const metricValue = toFiniteNumber(row?.metricValue);
    if (!symbol || metricValue === null) continue;
    values.set(symbol, metricValue);
  }
  return { endpoint, values, error: null };
}

export async function runSymbolCompareMetricOracleCheck(input) {
  const spec = input?.spec ?? {};
  const source = normalizeText(spec.source) === "valuation" ? "valuation" : "stocks";
  const metric = source === "valuation" ? normalizeValuationMetric(spec.metric) : normalizeStocksMetric(spec.metric);
  const leftSymbol = normalizeOracleSymbol(spec.leftSymbol);
  const rightSymbol = normalizeOracleSymbol(spec.rightSymbol);
  if (!leftSymbol || !rightSymbol) {
    return {
      ok: false,
      reason: "oracle_symbol_compare: invalid left/right symbol.",
      evidence: null,
    };
  }

  let oracleLeft = null;
  let oracleRight = null;
  let oracleEndpoint = null;
  if (source === "stocks") {
    const [leftRes, rightRes] = await Promise.all([
      fetchStockMetricValue(input.baseUrl, leftSymbol, metric, spec.date, input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      fetchStockMetricValue(input.baseUrl, rightSymbol, metric, spec.date, input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    ]);
    oracleLeft = leftRes.value;
    oracleRight = rightRes.value;
    oracleEndpoint = `${leftRes.endpoint} | ${rightRes.endpoint}`;
    if (leftRes.error || rightRes.error || oracleLeft === null || oracleRight === null) {
      return {
        ok: false,
        reason: `oracle_symbol_compare: oracle stock fetch failed (${leftRes.error ?? "ok"}, ${rightRes.error ?? "ok"})`,
        evidence: {
          source,
          metric,
          leftSymbol,
          rightSymbol,
          leftEndpoint: leftRes.endpoint,
          rightEndpoint: rightRes.endpoint,
          leftValue: oracleLeft,
          rightValue: oracleRight,
        },
      };
    }
  } else {
    const valuationRes = await fetchValuationMetricMap(input.baseUrl, spec, input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    oracleEndpoint = valuationRes.endpoint;
    oracleLeft = valuationRes.values.get(leftSymbol) ?? null;
    oracleRight = valuationRes.values.get(rightSymbol) ?? null;
    if (valuationRes.error || oracleLeft === null || oracleRight === null) {
      return {
        ok: false,
        reason: `oracle_symbol_compare: oracle valuation fetch failed (${valuationRes.error ?? "missing_symbol_metric"})`,
        evidence: {
          source,
          metric,
          endpoint: valuationRes.endpoint,
          leftSymbol,
          rightSymbol,
          leftValue: oracleLeft,
          rightValue: oracleRight,
        },
      };
    }
  }

  const operator = normalizeText(spec.operator) || "gt";
  const oracleRelation = relationFromValues(oracleLeft, oracleRight, spec.tolerance ?? EPSILON);
  const operatorSatisfied = evaluateOperator(oracleLeft, oracleRight, operator, spec.tolerance ?? EPSILON);
  if (!operatorSatisfied) {
    return {
      ok: false,
      reason: `oracle_symbol_compare: oracle relation does not satisfy operator=${operator} (${leftSymbol}=${oracleLeft}, ${rightSymbol}=${oracleRight})`,
      evidence: {
        source,
        metric,
        operator,
        oracleRelation,
        endpoint: oracleEndpoint,
        leftSymbol,
        rightSymbol,
        leftValue: oracleLeft,
        rightValue: oracleRight,
      },
    };
  }

  const tableTitleIncludes = String(
    spec.tableTitleIncludes
      ?? (source === "valuation" ? "valuation ranking" : "stock ranking")
  );
  const observed = extractSymbolMetricMapFromTable(input?.assistant?.messageBlocks, {
    titleIncludes: tableTitleIncludes,
    metric,
    metricColumnCandidates:
      source === "valuation"
        ? ["metric", "p/e", "p/b", "ev/ebitda"]
        : ["metric value", metric],
  });
  const observedLeft = observed.values.get(leftSymbol) ?? null;
  const observedRight = observed.values.get(rightSymbol) ?? null;
  if (observedLeft === null || observedRight === null) {
    return {
      ok: false,
      reason: `oracle_symbol_compare: assistant table lacks metric for ${leftSymbol}/${rightSymbol}`,
      evidence: {
        source,
        metric,
        operator,
        endpoint: oracleEndpoint,
        leftSymbol,
        rightSymbol,
        oracleLeft,
        oracleRight,
        observedLeft,
        observedRight,
        tableTitle: observed.title,
        tableRows: observed.rowCount,
      },
    };
  }

  const observedRelation = relationFromValues(observedLeft, observedRight, spec.tolerance ?? EPSILON);
  const ok = observedRelation === oracleRelation;
  return {
    ok,
    reason: ok
      ? `oracle_symbol_compare: pass (observed=${observedRelation}, oracle=${oracleRelation})`
      : `oracle_symbol_compare: fail (observed=${observedRelation}, oracle=${oracleRelation})`,
    evidence: {
      source,
      metric,
      operator,
      endpoint: oracleEndpoint,
      leftSymbol,
      rightSymbol,
      oracleLeft,
      oracleRight,
      oracleRelation,
      observedLeft,
      observedRight,
      observedRelation,
      tableTitle: observed.title,
      tableRows: observed.rowCount,
    },
  };
}
