import fsPromises from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import Papa from "papaparse";
import { resolveDataDir } from "./dataDir";
import { ensureDataBackendReady, clearDataBackendCache } from "./dataBackend";
import { queryDuckDbRows, clearDuckDbModuleCache } from "./duckdbClient";

export type FundamentalsValue = number | string | null;

export type FundamentalsStatement = "bs" | "is" | "cf";

export interface FundamentalsSnapshot {
  period: string; // YYYYQn
  fields: Record<string, FundamentalsValue>;
  labels: Record<string, string>; // normalizedKey -> original header
}

interface StatementCache {
  fileName: string;
  labels: Record<string, string>;
  bySymbol: Map<string, Map<string, Record<string, FundamentalsValue>>>;
}

let bsCache: StatementCache | null = null;
let isCache: StatementCache | null = null;
let cfCache: StatementCache | null = null;

const FUNDAMENTALS_FILES: Record<FundamentalsStatement, string> = {
  bs: "HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv",
  is: "HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv",
  cf: "HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv",
};

const FUNDAMENTALS_TABLES: Record<FundamentalsStatement, string> = {
  bs: "fundamentals_bs",
  is: "fundamentals_is",
  cf: "fundamentals_cf",
};

function getDataDir(): string {
  return resolveDataDir().path;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizeSymbol(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const symbol = String(raw).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z][A-Z0-9]{0,9}$/.test(symbol)) return null;
  return symbol;
}

function pickSymbolFromRow(row: Record<string, unknown>): string | null {
  const symbolKeys = [
    "ticker",
    "symbol",
    "ticker_symbol",
    "stock_code",
    "stockcode",
    "code",
    "ma_ck",
  ];
  for (const key of symbolKeys) {
    const value = normalizeSymbol(row[key]);
    if (value) return value;
  }
  return null;
}

function normalizeKey(rawHeader: string): string {
  const normalized = rawHeader
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "field";
}

function parseValue(raw: unknown): FundamentalsValue {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") return String(raw);

  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // Numeric (including scientific notation)
  if (/^-?\d+(?:\.\d+)?(?:[eE]-?\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }

  return trimmed;
}

function parsePeriodKey(row: Record<string, unknown>): string | null {
  const yearRaw =
    row.yearreport ??
    row.year_report ??
    row.report_year ??
    row.fiscal_year ??
    row.year;
  const quarterRaw =
    row.lengthreport ??
    row.length_report ??
    row.report_quarter ??
    row.quarterreport ??
    row.quarter ??
    row.q;

  const literalPeriod = row.period ?? row.report_period;
  if (literalPeriod !== undefined && literalPeriod !== null) {
    const match = /^(\d{4})\s*Q([1-4])$/i.exec(String(literalPeriod).trim());
    if (match) return `${match[1]}Q${match[2]}`;
  }

  const year = Number(String(yearRaw ?? "").trim());
  const quarter = Number(String(quarterRaw ?? "").trim());
  if (!Number.isFinite(year) || !Number.isFinite(quarter)) return null;
  if (year < 1900 || year > 2100) return null;
  if (quarter < 1 || quarter > 4) return null;
  return `${Math.trunc(year)}Q${Math.trunc(quarter)}`;
}

function comparePeriodAsc(a: string, b: string): number {
  const ma = /^(\d{4})Q([1-4])$/.exec(a);
  const mb = /^(\d{4})Q([1-4])$/.exec(b);
  if (!ma || !mb) return a.localeCompare(b);
  const ya = Number(ma[1]);
  const yb = Number(mb[1]);
  if (ya !== yb) return ya - yb;
  const qa = Number(ma[2]);
  const qb = Number(mb[2]);
  return qa - qb;
}

function setStatementCache(statement: FundamentalsStatement, cache: StatementCache): StatementCache {
  if (statement === "bs") bsCache = cache;
  else if (statement === "is") isCache = cache;
  else cfCache = cache;
  return cache;
}

function normalizeDuckDbFundamentalsRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = key.replace(/^\uFEFF/, "").trim().toLowerCase();
      normalized[normalizedKey] = value;
    }
    return normalized;
  });
}

function buildStatementCacheFromRows(
  statement: FundamentalsStatement,
  fileName: string,
  rows: Record<string, unknown>[],
  headersInput: string[]
): StatementCache {
  const headers = headersInput.map((header) => header.replace(/^\uFEFF/, "").trim().toLowerCase());
  const reserved = new Set(["ticker", "symbol", "yearreport", "lengthreport"]);

  const labels: Record<string, string> = {};
  const headerToKey = new Map<string, string>();
  const usedKeys = new Map<string, number>();
  for (const header of headers) {
    const base = normalizeKey(header);
    const n = (usedKeys.get(base) ?? 0) + 1;
    usedKeys.set(base, n);
    const unique = n === 1 ? base : `${base}_${n}`;
    headerToKey.set(header, unique);
    labels[unique] = header;
  }

  const bySymbol = new Map<string, Map<string, Record<string, FundamentalsValue>>>();
  let skippedRows = 0;
  let duplicatePeriodRows = 0;
  const skippedSamples: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const symbol = pickSymbolFromRow(row);
    const periodKey = parsePeriodKey(row);
    if (!symbol || !periodKey) {
      skippedRows += 1;
      if (skippedSamples.length < 3) {
        skippedSamples.push({
          ticker: row.ticker ?? null,
          symbol: row.symbol ?? null,
          yearreport: row.yearreport ?? row.year_report ?? row.report_year ?? null,
          lengthreport: row.lengthreport ?? row.length_report ?? row.report_quarter ?? row.quarter ?? null,
          period: row.period ?? row.report_period ?? null,
        });
      }
      continue;
    }

    let symbolMap = bySymbol.get(symbol);
    if (!symbolMap) {
      symbolMap = new Map();
      bySymbol.set(symbol, symbolMap);
    }

    if (symbolMap.has(periodKey)) {
      duplicatePeriodRows += 1;
    }

    const fields: Record<string, FundamentalsValue> = {};
    for (const header of headers) {
      if (reserved.has(header)) continue;
      const key = headerToKey.get(header);
      if (!key) continue;
      fields[key] = parseValue((row as Record<string, unknown>)[header]);
    }
    symbolMap.set(periodKey, fields);
  }

  if (skippedRows > 0 || duplicatePeriodRows > 0) {
    const sampleNote =
      skippedSamples.length > 0
        ? `, skippedSamples=${JSON.stringify(skippedSamples)}`
        : "";
    console.warn(
      `[fundamentals:${statement}] rows=${rows.length}, skipped=${skippedRows}, duplicatePeriods=${duplicatePeriodRows}${sampleNote}`
    );
  }

  return {
    fileName,
    labels,
    bySymbol,
  };
}

async function loadStatement(statement: FundamentalsStatement): Promise<StatementCache> {
  const existing = statement === "bs" ? bsCache : statement === "is" ? isCache : cfCache;
  if (existing) return existing;

  const backend = await ensureDataBackendReady(`fundamentals:${statement}`);
  const dataDir = getDataDir();
  const fileName = FUNDAMENTALS_FILES[statement];
  const filePath = path.join(dataDir, fileName);
  const tableName = FUNDAMENTALS_TABLES[statement];

  if (backend.active === "duckdb") {
    try {
      const rows = await queryDuckDbRows(backend.duckdbPath, `SELECT * FROM ${tableName}`);
      const normalizedRows = normalizeDuckDbFundamentalsRows(rows);
      const headers = normalizedRows.length > 0 ? Object.keys(normalizedRows[0]) : [];
      if (headers.length > 0) {
        const cache = buildStatementCacheFromRows(statement, `duckdb:${tableName}`, normalizedRows, headers);
        return setStatementCache(statement, cache);
      }
      console.warn(`[fundamentals:${statement}] DuckDB table ${tableName} is empty; fallback to CSV.`);
    } catch (error) {
      console.warn(
        `[fundamentals:${statement}] DuckDB read failed (${tableName}): ` +
        `${error instanceof Error ? error.message : String(error)}. Fallback to CSV.`
      );
    }
  }

  if (!(await fileExists(filePath))) {
    throw new Error(`Fundamentals file not found: ${fileName} (DATA_DIR=${dataDir})`);
  }

  const content = await fsPromises.readFile(filePath, "utf8");
  const parsed = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim().toLowerCase(),
  });

  if (parsed.errors.length > 0) {
    const top = parsed.errors
      .slice(0, 3)
      .map((e) => `${e.code ?? "unknown"}@row${e.row ?? "?"}`)
      .join(", ");
    throw new Error(
      `Fundamentals CSV parse errors in ${fileName}: errors=${parsed.errors.length} (${top}). ` +
        `Please regenerate prepared fundamentals in public/data (run npm run data:prepare:2018_2025).`
    );
  }

  const headers = parsed.meta.fields ?? [];
  const cache = buildStatementCacheFromRows(statement, fileName, parsed.data, headers);
  return setStatementCache(statement, cache);
}

export async function getAvailablePeriods(symbol: string): Promise<string[]> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return [];

  const [bs, is, cf] = await Promise.all([loadStatement("bs"), loadStatement("is"), loadStatement("cf")]);
  const set = new Set<string>();

  for (const cache of [bs, is, cf]) {
    const m = cache.bySymbol.get(sym);
    if (!m) continue;
    for (const period of m.keys()) set.add(period);
  }

  return Array.from(set).sort(comparePeriodAsc);
}

export async function getStatementSnapshot(
  symbol: string,
  statement: FundamentalsStatement,
  period: string
): Promise<FundamentalsSnapshot | null> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return null;

  const cache = await loadStatement(statement);
  const symbolMap = cache.bySymbol.get(sym);
  if (!symbolMap) return null;
  const fields = symbolMap.get(period);
  if (!fields) return null;
  return { period, fields, labels: cache.labels };
}

export async function resolveLatestPeriod(
  symbol: string,
  statement: "all" | FundamentalsStatement
): Promise<string | null> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return null;

  if (statement === "all") {
    const periods = await getAvailablePeriods(sym);
    return periods.length > 0 ? periods[periods.length - 1] : null;
  }

  const cache = await loadStatement(statement);
  const symbolMap = cache.bySymbol.get(sym);
  if (!symbolMap) return null;
  const periods = Array.from(symbolMap.keys()).sort(comparePeriodAsc);
  return periods.length > 0 ? periods[periods.length - 1] : null;
}

export async function getFundamentalsSourceFiles(): Promise<Record<FundamentalsStatement, string>> {
  // Ensure caches are loaded to validate file existence and return actual file names.
  const [bs, is, cf] = await Promise.all([loadStatement("bs"), loadStatement("is"), loadStatement("cf")]);
  return { bs: bs.fileName, is: is.fileName, cf: cf.fileName };
}

export function clearFundamentalsCache(): void {
  bsCache = null;
  isCache = null;
  cfCache = null;
  clearDataBackendCache();
  clearDuckDbModuleCache();
}


