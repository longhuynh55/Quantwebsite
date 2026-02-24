#!/usr/bin/env node

/**
 * Debug helper: compare CSV vs DuckDB query results with no TS runtime dependency.
 *
 * Examples:
 *  - pnpm run debug:compare-backends -- --kind snapshot --symbol VNM --date 2020-01-02
 *  - pnpm run debug:compare-backends -- --kind ranking --date 2020-01-02 --metric volume --order desc --limit 10
 *  - pnpm run debug:compare-backends -- --mode csv --kind ranking --metric close --limit 5
 */

import fs from "fs";
import path from "path";
import process from "process";
import Papa from "papaparse";

const VALID_METRICS = new Set(["close", "open", "high", "low", "volume"]);
const VALID_ORDERS = new Set(["asc", "desc"]);
const STOCK_METADATA_FILE_CANDIDATES = ["stock_metadata_2018_2025.csv", "HOSE_VERIFIED_2020_2025.csv"];
const OHLCV_FILE_CANDIDATES = ["ohlcv_2018_2025.csv", "ohlcv_enriched.csv", "HOSE_VERIFIED_OHLCV_INDUSTRY_2018_2025.csv"];
const DEFAULT_MATRIX_FILE = "scripts/backend-query-matrix.json";
const DEFAULT_MATRIX_REPORT_PATH = "artifacts/backend-query-matrix-report.json";

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] ?? "");
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || String(next).startsWith("--")) {
      out[key] = true;
      continue;
    }
    out[key] = String(next);
    index += 1;
  }
  return out;
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseBool(value, fallback = false) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseNumber(value, fallback) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDateKey(raw) {
  if (raw instanceof Date && Number.isFinite(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  const value = String(raw ?? "").trim();
  if (!value) return "";
  const fromIso = new Date(value);
  if (Number.isFinite(fromIso.getTime())) {
    return fromIso.toISOString().slice(0, 10);
  }
  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const day = slash[1].padStart(2, "0");
    const month = slash[2].padStart(2, "0");
    const year = slash[3];
    return `${year}-${month}-${day}`;
  }
  return value.slice(0, 10);
}

function approxEqual(left, right, tolerance = 1e-6) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return Math.abs(left - right) <= tolerance;
}

function resolveDataDir(params) {
  if (params["data-dir"]) return path.resolve(String(params["data-dir"]));
  if (process.env.DATA_DIR && String(process.env.DATA_DIR).trim()) return path.resolve(String(process.env.DATA_DIR).trim());
  return path.join(process.cwd(), "public", "data");
}

function resolveDuckDbPath(params, dataDir) {
  if (params["duckdb-path"]) return path.resolve(String(params["duckdb-path"]));
  if (process.env.DATA_DUCKDB_PATH && String(process.env.DATA_DUCKDB_PATH).trim()) {
    return path.resolve(String(process.env.DATA_DUCKDB_PATH).trim());
  }
  return path.join(dataDir, "quant_data.duckdb");
}

function pickFirstExistingFile(dataDir, candidates) {
  for (const name of candidates) {
    const filePath = path.join(dataDir, name);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

async function streamCsvRows(filePath, onRow) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Missing CSV file: ${filePath}`);
  }

  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(filePath, { encoding: "utf8" });
    const parser = Papa.parse(Papa.NODE_STREAM_INPUT, {
      header: true,
      skipEmptyLines: true,
    });

    input.on("error", reject);
    parser.on("error", reject);
    parser.on("data", (row) => onRow(row));
    parser.on("finish", resolve);

    input.pipe(parser);
  });
}

function parseNumeric(row, key) {
  const parsed = Number(String(row[key] ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

async function loadActiveHoseSymbolsFromCsv(metadataPath) {
  const symbols = new Set();
  await streamCsvRows(metadataPath, (row) => {
    const symbol = String(row.symbol ?? "").trim().toUpperCase();
    if (!symbol) return;
    const exchange = String(row.exchange ?? "").trim().toUpperCase();
    const status = String(row.status ?? "").trim().toUpperCase();
    if (exchange === "HOSE" && status === "ACTIVE") {
      symbols.add(symbol);
    }
  });
  return symbols;
}

async function runCsvSnapshot({ ohlcvPath, symbol, dateKey }) {
  const target = symbol.trim().toUpperCase();
  let best = null;

  await streamCsvRows(ohlcvPath, (row) => {
    const rowSymbol = String(row.symbol ?? "").trim().toUpperCase();
    if (rowSymbol !== target) return;

    const rowDate = toDateKey(row.date);
    if (!rowDate) return;

    if (dateKey && rowDate > dateKey) return;

    const close = parseNumeric(row, "close");
    const volume = parseNumeric(row, "volume");
    if (!Number.isFinite(close) || !Number.isFinite(volume)) return;

    if (!best || rowDate > best.date) {
      best = {
        symbol: target,
        date: rowDate,
        close,
        volume,
        exactDateMatch: dateKey ? rowDate === dateKey : true,
      };
    }
  });

  if (!best) {
    return { ok: false, error: `No CSV OHLCV row on/before requested date for symbol=${target}` };
  }

  return { ok: true, ...best };
}

async function runCsvRanking({ metadataPath, ohlcvPath, dateKey, metric, order, limit }) {
  const activeHoseSymbols = await loadActiveHoseSymbolsFromCsv(metadataPath);
  const latestBySymbol = new Map();

  await streamCsvRows(ohlcvPath, (row) => {
    const symbol = String(row.symbol ?? "").trim().toUpperCase();
    if (!activeHoseSymbols.has(symbol)) return;

    const rowDate = toDateKey(row.date);
    if (!rowDate) return;
    if (dateKey && rowDate > dateKey) return;

    const open = parseNumeric(row, "open");
    const high = parseNumeric(row, "high");
    const low = parseNumeric(row, "low");
    const close = parseNumeric(row, "close");
    const volume = parseNumeric(row, "volume");
    if (![open, high, low, close, volume].every((value) => Number.isFinite(value))) return;

    const previous = latestBySymbol.get(symbol);
    if (!previous || rowDate > previous.date) {
      latestBySymbol.set(symbol, {
        symbol,
        date: rowDate,
        open,
        high,
        low,
        close,
        volume,
        metricValue: { open, high, low, close, volume }[metric],
        exactDateMatch: dateKey ? rowDate === dateKey : true,
      });
    }
  });

  const candidates = Array.from(latestBySymbol.values())
    .filter((row) => Number.isFinite(row.metricValue));

  candidates.sort((left, right) => {
    const diff = order === "asc" ? left.metricValue - right.metricValue : right.metricValue - left.metricValue;
    if (diff !== 0) return diff;
    return left.symbol.localeCompare(right.symbol);
  });

  return {
    ok: true,
    date: dateKey ?? "latest",
    metric,
    order,
    limit,
    totalCandidates: candidates.length,
    top: candidates.slice(0, limit),
  };
}

async function loadDuckDbModule() {
  try {
    const duckdbImport = await import("duckdb");
    const resolved = duckdbImport?.default && duckdbImport.default.Database ? duckdbImport.default : duckdbImport;
    if (!resolved?.Database) return null;
    return resolved;
  } catch {
    return null;
  }
}

async function runDuckDbAll(duckdbModule, duckdbPath, sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = new duckdbModule.Database(duckdbPath, (openError) => {
      if (openError) {
        reject(openError);
        return;
      }

      db.all(sql, ...params, (queryError, rows) => {
        db.close(() => {
          if (queryError) {
            reject(queryError);
            return;
          }
          resolve(Array.isArray(rows) ? rows : []);
        });
      });
    });
  });
}

async function runDuckDbSnapshot({ duckdbModule, duckdbPath, symbol, dateKey }) {
  const target = symbol.trim().toUpperCase();
  const sql = dateKey
    ? `
      SELECT upper(symbol) AS symbol, CAST(date AS VARCHAR) AS date, close, volume
      FROM ohlcv
      WHERE upper(symbol) = ? AND date <= ?
      ORDER BY date DESC
      LIMIT 1
    `
    : `
      SELECT upper(symbol) AS symbol, CAST(date AS VARCHAR) AS date, close, volume
      FROM ohlcv
      WHERE upper(symbol) = ?
      ORDER BY date DESC
      LIMIT 1
    `;
  const params = dateKey ? [target, dateKey] : [target];
  const rows = await runDuckDbAll(duckdbModule, duckdbPath, sql, params);
  if (rows.length === 0) {
    return { ok: false, error: `No DuckDB OHLCV row on/before requested date for symbol=${target}` };
  }
  const row = rows[0];
  const rowDate = toDateKey(row.date);
  return {
    ok: true,
    symbol: target,
    date: rowDate,
    close: Number(row.close),
    volume: Number(row.volume),
    exactDateMatch: dateKey ? rowDate === dateKey : true,
  };
}

async function runDuckDbRanking({ duckdbModule, duckdbPath, dateKey, metric, order, limit }) {
  const safeMetric = String(metric).toLowerCase();
  const safeOrder = String(order).toLowerCase() === "asc" ? "ASC" : "DESC";
  const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit ?? 10), 10) || 10, 100));
  const whereDate = dateKey ? "AND o.date <= ?" : "";
  const sql = `
    WITH universe AS (
      SELECT upper(symbol) AS symbol
      FROM stock_metadata
      WHERE upper(coalesce(exchange, '')) = 'HOSE'
        AND upper(coalesce(status, '')) = 'ACTIVE'
    ),
    ranked AS (
      SELECT
        u.symbol,
        CAST(o.date AS VARCHAR) AS date,
        CAST(o.open AS DOUBLE) AS open,
        CAST(o.high AS DOUBLE) AS high,
        CAST(o.low AS DOUBLE) AS low,
        CAST(o.close AS DOUBLE) AS close,
        CAST(o.volume AS DOUBLE) AS volume,
        ROW_NUMBER() OVER (PARTITION BY u.symbol ORDER BY o.date DESC) AS rn
      FROM universe u
      JOIN ohlcv o ON upper(o.symbol) = u.symbol
      ${whereDate}
    )
    SELECT symbol, date, open, high, low, close, volume
    FROM ranked
    WHERE rn = 1
    ORDER BY ${safeMetric} ${safeOrder}, symbol ASC
    LIMIT ${safeLimit}
  `;
  const params = dateKey ? [dateKey] : [];
  const rows = await runDuckDbAll(duckdbModule, duckdbPath, sql, params);
  const top = rows.map((row) => {
    const open = Number(row.open);
    const high = Number(row.high);
    const low = Number(row.low);
    const close = Number(row.close);
    const volume = Number(row.volume);
    const rowDate = toDateKey(row.date);
    return {
      symbol: String(row.symbol ?? "").toUpperCase(),
      date: rowDate,
      open,
      high,
      low,
      close,
      volume,
      metricValue: { open, high, low, close, volume }[safeMetric],
      exactDateMatch: dateKey ? rowDate === dateKey : true,
    };
  });

  return {
    ok: true,
    date: dateKey ?? "latest",
    metric: safeMetric,
    order: order,
    limit,
    totalCandidates: null,
    top,
  };
}

function printBackendHeader(label, status) {
  console.log(`[${label}] mode=${status.mode}`);
  console.log(`[${label}] dataDir=${status.dataDir}`);
  if (status.ohlcvPath) console.log(`[${label}] ohlcvCsv=${status.ohlcvPath}`);
  if (status.metadataPath) console.log(`[${label}] metadataCsv=${status.metadataPath}`);
  if (status.duckdbPath) console.log(`[${label}] duckdbPath=${status.duckdbPath}`);
  if (status.note) console.log(`[${label}] note=${status.note}`);
}

function printSnapshot(label, result) {
  console.log(`[${label}] snapshot symbol=${result.symbol} date=${result.date} exact=${result.exactDateMatch}`);
  console.log(`[${label}] close=${result.close} volume=${result.volume}`);
}

function printRanking(label, result) {
  console.log(`[${label}] ranking date=${result.date} metric=${result.metric} order=${result.order} limit=${result.limit}`);
  if (Number.isFinite(result.totalCandidates)) {
    console.log(`[${label}] candidates=${result.totalCandidates}`);
  }
  for (let index = 0; index < Math.min(10, result.top.length); index += 1) {
    const row = result.top[index];
    console.log(
      `[${label}] #${index + 1} ${row.symbol} metric=${row.metricValue} close=${row.close} volume=${row.volume} date=${row.date} exact=${row.exactDateMatch}`
    );
  }
}

function validateInputs(params) {
  const kind = String(params.kind ?? "snapshot").trim().toLowerCase();
  if (!["snapshot", "ranking"].includes(kind)) {
    throw new Error(`Unknown --kind ${kind}. Use snapshot|ranking.`);
  }

  const mode = String(params.mode ?? "compare").trim().toLowerCase();
  if (!["compare", "csv", "duckdb"].includes(mode)) {
    throw new Error(`Unknown --mode ${mode}. Use compare|csv|duckdb.`);
  }

  const metric = String(params.metric ?? "volume").trim().toLowerCase();
  if (!VALID_METRICS.has(metric)) {
    throw new Error(`Invalid --metric ${metric}. Allowed: close, open, high, low, volume.`);
  }

  const order = String(params.order ?? "desc").trim().toLowerCase();
  if (!VALID_ORDERS.has(order)) {
    throw new Error(`Invalid --order ${order}. Allowed: asc, desc.`);
  }

  const limit = clampInt(params.limit, 10, 1, 50);
  const symbol = String(params.symbol ?? "VNM").trim().toUpperCase();
  const date = params.date ? toDateKey(params.date) : null;
  return { kind, mode, metric, order, limit, symbol, date };
}

async function runCsvQuery(parsed, context) {
  const status = {
    mode: "csv",
    dataDir: context.dataDir,
    metadataPath: context.metadataPath,
    ohlcvPath: context.ohlcvPath,
  };

  if (!context.ohlcvPath) {
    return { ok: false, error: "No OHLCV CSV file found", status };
  }

  if (parsed.kind === "snapshot") {
    const result = await runCsvSnapshot({
      ohlcvPath: context.ohlcvPath,
      symbol: parsed.symbol,
      dateKey: parsed.date,
    });
    return { ...result, status };
  }

  if (!context.metadataPath) {
    return { ok: false, error: "No stock metadata CSV file found", status };
  }

  const result = await runCsvRanking({
    metadataPath: context.metadataPath,
    ohlcvPath: context.ohlcvPath,
    dateKey: parsed.date,
    metric: parsed.metric,
    order: parsed.order,
    limit: parsed.limit,
  });
  return { ...result, status };
}

async function runDuckDbQuery(parsed, context) {
  const status = {
    mode: "duckdb",
    dataDir: context.dataDir,
    duckdbPath: context.duckdbPath,
  };

  if (!context.duckdbPath || !fs.existsSync(context.duckdbPath)) {
    return { ok: false, error: `DuckDB file missing: ${context.duckdbPath}`, status };
  }

  const duckdbModule = await loadDuckDbModule();
  if (!duckdbModule) {
    return { ok: false, error: "DuckDB Node binding not available (install optional dependency 'duckdb').", status };
  }

  if (parsed.kind === "snapshot") {
    const result = await runDuckDbSnapshot({
      duckdbModule,
      duckdbPath: context.duckdbPath,
      symbol: parsed.symbol,
      dateKey: parsed.date,
    });
    return { ...result, status };
  }

  const result = await runDuckDbRanking({
    duckdbModule,
    duckdbPath: context.duckdbPath,
    dateKey: parsed.date,
    metric: parsed.metric,
    order: parsed.order,
    limit: parsed.limit,
  });
  return { ...result, status };
}

function compareSnapshot(duck, csv) {
  return (
    duck.symbol === csv.symbol &&
    duck.date === csv.date &&
    approxEqual(duck.close, csv.close, 1e-6) &&
    approxEqual(duck.volume, csv.volume, 1e-6)
  );
}

function compareRanking(duck, csv) {
  const duckSymbols = duck.top.map((row) => row.symbol);
  const csvSymbols = csv.top.map((row) => row.symbol);
  return JSON.stringify(duckSymbols) === JSON.stringify(csvSymbols);
}

function validateSnapshotSchema(result) {
  if (!result || typeof result !== "object") return false;
  if (typeof result.symbol !== "string" || result.symbol.trim().length === 0) return false;
  if (typeof result.date !== "string" || result.date.trim().length === 0) return false;
  if (!Number.isFinite(Number(result.close))) return false;
  if (!Number.isFinite(Number(result.volume))) return false;
  if (typeof result.exactDateMatch !== "boolean") return false;
  return true;
}

function validateRankingSchema(result) {
  if (!result || typeof result !== "object") return false;
  if (!Array.isArray(result.top)) return false;
  for (const row of result.top) {
    if (!row || typeof row !== "object") return false;
    if (typeof row.symbol !== "string" || row.symbol.trim().length === 0) return false;
    if (typeof row.date !== "string" || row.date.trim().length === 0) return false;
    if (!Number.isFinite(Number(row.open))) return false;
    if (!Number.isFinite(Number(row.high))) return false;
    if (!Number.isFinite(Number(row.low))) return false;
    if (!Number.isFinite(Number(row.close))) return false;
    if (!Number.isFinite(Number(row.volume))) return false;
    if (!Number.isFinite(Number(row.metricValue))) return false;
    if (typeof row.exactDateMatch !== "boolean") return false;
  }
  return true;
}

function computePercentile(values, percentile) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  return sorted[rank];
}

function loadMatrixCases(matrixFilePath) {
  const resolvedPath = path.resolve(String(matrixFilePath || DEFAULT_MATRIX_FILE));
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Matrix file not found: ${resolvedPath}`);
  }
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON in matrix file ${resolvedPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const rawCases = Array.isArray(payload) ? payload : payload?.cases;
  if (!Array.isArray(rawCases) || rawCases.length === 0) {
    throw new Error(`Matrix file ${resolvedPath} has no cases.`);
  }
  const cases = rawCases.map((item, index) => {
    const caseItem = item && typeof item === "object" ? item : {};
    const idRaw = String(caseItem.id ?? `case_${index + 1}`).trim();
    const kind = String(caseItem.kind ?? "snapshot").trim().toLowerCase();
    const entry = {
      id: idRaw || `case_${index + 1}`,
      kind,
      symbol: caseItem.symbol,
      date: caseItem.date,
      metric: caseItem.metric,
      order: caseItem.order,
      limit: caseItem.limit,
    };
    validateInputs(entry);
    return entry;
  });
  return { path: resolvedPath, cases };
}

function ensureDirectoryForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function runMatrixMode(params) {
  const matrixEnabled = parseBool(params.matrix, false) || Boolean(params["matrix-file"]);
  if (!matrixEnabled) return null;

  const mode = String(params.mode ?? "compare").trim().toLowerCase();
  if (!["compare", "csv", "duckdb"].includes(mode)) {
    throw new Error(`Unknown --mode ${mode}. Use compare|csv|duckdb.`);
  }

  const allowMissingDuckdb = parseBool(params["allow-missing-duckdb"], false);
  const reportPath = path.resolve(String(params["report-path"] ?? DEFAULT_MATRIX_REPORT_PATH));
  const maxP95CsvMs = Math.max(1, parseNumber(params["max-p95-csv-ms"], 8000));
  const maxP95DuckDbMs = Math.max(1, parseNumber(params["max-p95-duckdb-ms"], 5000));

  const dataDir = resolveDataDir(params);
  const metadataPath = pickFirstExistingFile(dataDir, STOCK_METADATA_FILE_CANDIDATES);
  const ohlcvPath = pickFirstExistingFile(dataDir, OHLCV_FILE_CANDIDATES);
  const duckdbPath = resolveDuckDbPath(params, dataDir);
  const context = { dataDir, metadataPath, ohlcvPath, duckdbPath };

  const { path: matrixPath, cases } = loadMatrixCases(params["matrix-file"]);
  console.log(`[matrix] file=${matrixPath}`);
  console.log(`[matrix] cases=${cases.length} mode=${mode}`);

  const rows = [];
  const csvLatencies = [];
  const duckdbLatencies = [];
  let compareChecks = 0;
  let comparePassed = 0;

  const runCsv = mode === "compare" || mode === "csv";
  const runDuckdb = mode === "compare" || mode === "duckdb";

  for (const matrixCase of cases) {
    const parsed = validateInputs({
      kind: matrixCase.kind,
      symbol: matrixCase.symbol,
      date: matrixCase.date,
      metric: matrixCase.metric,
      order: matrixCase.order,
      limit: matrixCase.limit,
      mode,
    });

    const resultRow = {
      id: matrixCase.id,
      kind: parsed.kind,
      params: {
        symbol: parsed.symbol,
        date: parsed.date,
        metric: parsed.metric,
        order: parsed.order,
        limit: parsed.limit,
      },
      csv: null,
      duckdb: null,
      compareOk: null,
      failures: [],
    };
    let csvPayload = null;
    let duckPayload = null;

    if (runCsv) {
      const startedAt = Date.now();
      const csvResult = await runCsvQuery(parsed, context);
      csvPayload = csvResult;
      const latencyMs = Date.now() - startedAt;
      csvLatencies.push(latencyMs);
      const schemaOk = csvResult.ok
        ? (parsed.kind === "snapshot" ? validateSnapshotSchema(csvResult) : validateRankingSchema(csvResult))
        : false;
      resultRow.csv = {
        ok: csvResult.ok,
        latencyMs,
        schemaOk,
        error: csvResult.ok ? null : csvResult.error,
      };
      if (!csvResult.ok) {
        resultRow.failures.push(`csv_error=${csvResult.error}`);
      } else if (!schemaOk) {
        resultRow.failures.push("csv_schema_invalid");
      }
    }

    if (runDuckdb) {
      const startedAt = Date.now();
      const duckResult = await runDuckDbQuery(parsed, context);
      duckPayload = duckResult;
      const latencyMs = Date.now() - startedAt;
      const duckMissing = !duckResult.ok && String(duckResult.error ?? "").includes("DuckDB");
      if (duckResult.ok) {
        duckdbLatencies.push(latencyMs);
      }
      const schemaOk = duckResult.ok
        ? (parsed.kind === "snapshot" ? validateSnapshotSchema(duckResult) : validateRankingSchema(duckResult))
        : false;
      resultRow.duckdb = {
        ok: duckResult.ok,
        latencyMs,
        schemaOk,
        error: duckResult.ok ? null : duckResult.error,
      };
      if (!duckResult.ok) {
        if (mode === "compare" && allowMissingDuckdb && duckMissing) {
          resultRow.failures.push("duckdb_missing_allowed");
        } else {
          resultRow.failures.push(`duckdb_error=${duckResult.error}`);
        }
      } else if (!schemaOk) {
        resultRow.failures.push("duckdb_schema_invalid");
      }
    }

    const canCompare =
      mode === "compare"
      && resultRow.csv?.ok === true
      && resultRow.duckdb?.ok === true
      && resultRow.csv?.schemaOk === true
      && resultRow.duckdb?.schemaOk === true;
    if (canCompare) {
      compareChecks += 1;
      const compareOk =
        parsed.kind === "snapshot"
          ? compareSnapshot(duckPayload, csvPayload)
          : compareRanking(duckPayload, csvPayload);
      resultRow.compareOk = compareOk;
      if (compareOk) {
        comparePassed += 1;
      } else {
        resultRow.failures.push("cross_backend_mismatch");
      }
    } else if (mode === "compare") {
      resultRow.compareOk = false;
      if (!resultRow.failures.includes("duckdb_missing_allowed")) {
        resultRow.failures.push("cross_backend_compare_skipped");
      }
    }

    const casePass = resultRow.failures.length === 0 || resultRow.failures.every((item) => item === "duckdb_missing_allowed");
    console.log(`${casePass ? "PASS" : "FAIL"} ${resultRow.id} failures=${resultRow.failures.join(",") || "none"}`);
    rows.push(resultRow);
  }

  const csvP95 = computePercentile(csvLatencies, 95);
  const duckdbP95 = computePercentile(duckdbLatencies, 95);
  const failureCount = rows.filter((row) => row.failures.some((item) => item !== "duckdb_missing_allowed")).length;
  const comparePassRate = compareChecks > 0 ? comparePassed / compareChecks : null;
  const csvLatencyGatePass = csvP95 === null || csvP95 <= maxP95CsvMs;
  const duckdbLatencyGatePass = duckdbP95 === null || duckdbP95 <= maxP95DuckDbMs;
  const gatePass = failureCount === 0 && csvLatencyGatePass && duckdbLatencyGatePass;

  const report = {
    runAt: new Date().toISOString(),
    matrixFile: matrixPath,
    mode,
    totalCases: rows.length,
    failedCases: failureCount,
    compareChecks,
    comparePassed,
    comparePassRate,
    performance: {
      csv: { samples: csvLatencies.length, p95Ms: csvP95, maxP95Ms: maxP95CsvMs, gatePass: csvLatencyGatePass },
      duckdb: { samples: duckdbLatencies.length, p95Ms: duckdbP95, maxP95Ms: maxP95DuckDbMs, gatePass: duckdbLatencyGatePass },
    },
    gatePass,
    results: rows,
  };

  ensureDirectoryForFile(reportPath);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`REPORT_PATH=${reportPath}`);
  console.log(JSON.stringify(report));

  if (!gatePass) {
    process.exit(1);
  }
  return report;
}

async function main() {
  const params = parseArgs(process.argv.slice(2));
  const matrixReport = await runMatrixMode(params);
  if (matrixReport) return;
  const parsed = validateInputs(params);
  const allowMissingDuckdb = parseBool(params["allow-missing-duckdb"], false);
  const dataDir = resolveDataDir(params);
  const metadataPath = pickFirstExistingFile(dataDir, STOCK_METADATA_FILE_CANDIDATES);
  const ohlcvPath = pickFirstExistingFile(dataDir, OHLCV_FILE_CANDIDATES);
  const duckdbPath = resolveDuckDbPath(params, dataDir);
  const context = { dataDir, metadataPath, ohlcvPath, duckdbPath };

  const runCsv = parsed.mode === "compare" || parsed.mode === "csv";
  const runDuckdb = parsed.mode === "compare" || parsed.mode === "duckdb";

  const csvResult = runCsv ? await runCsvQuery(parsed, context) : null;
  if (csvResult && !csvResult.ok) {
    console.error(`[csv] ERROR: ${csvResult.error}`);
    if (csvResult.status) printBackendHeader("csv", csvResult.status);
    process.exit(2);
  }

  const duckResult = runDuckdb ? await runDuckDbQuery(parsed, context) : null;
  if (duckResult && !duckResult.ok) {
    if (parsed.mode === "compare" && allowMissingDuckdb) {
      console.warn(`[duckdb] WARN: ${duckResult.error}`);
      printBackendHeader("duckdb", { ...duckResult.status, note: "continue_with_csv_only" });
    } else {
      console.error(`[duckdb] ERROR: ${duckResult.error}`);
      if (duckResult.status) printBackendHeader("duckdb", duckResult.status);
      process.exit(2);
    }
  }

  if (duckResult?.ok) {
    printBackendHeader("duckdb", duckResult.status);
    if (parsed.kind === "snapshot") printSnapshot("duckdb", duckResult);
    if (parsed.kind === "ranking") printRanking("duckdb", duckResult);
  }

  if (csvResult?.ok) {
    printBackendHeader("csv", csvResult.status);
    if (parsed.kind === "snapshot") printSnapshot("csv", csvResult);
    if (parsed.kind === "ranking") printRanking("csv", csvResult);
  }

  if (parsed.mode !== "compare") {
    console.log("[compare] Skipped cross-backend comparison due to selected mode.");
    return;
  }

  if (!duckResult?.ok || !csvResult?.ok) {
    console.log("[compare] Skipped comparison because one backend result is unavailable.");
    return;
  }

  if (parsed.kind === "snapshot") {
    if (!compareSnapshot(duckResult, csvResult)) {
      console.error("[compare] MISMATCH detected between duckdb and csv snapshot outputs.");
      process.exit(1);
    }
    console.log("[compare] OK: snapshot outputs match.");
    return;
  }

  if (parsed.kind === "ranking") {
    if (!compareRanking(duckResult, csvResult)) {
      console.error("[compare] MISMATCH detected between duckdb and csv ranking outputs.");
      process.exit(1);
    }
    console.log("[compare] OK: ranking symbol order matches.");
    return;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(2);
});
