import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import Papa from "papaparse";

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

function getDataDir(): string {
  const configured = process.env.DATA_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), "public", "data");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizeSymbol(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const symbol = String(raw).trim().toUpperCase();
  if (!/^[A-Z]{1,10}$/.test(symbol)) return null;
  return symbol;
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
  const yearRaw = row.yearreport ?? row.yearReport;
  const quarterRaw = row.lengthreport ?? row.lengthReport;

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

async function loadStatement(statement: FundamentalsStatement): Promise<StatementCache> {
  const existing = statement === "bs" ? bsCache : statement === "is" ? isCache : cfCache;
  if (existing) return existing;

  const dataDir = getDataDir();
  const fileName = FUNDAMENTALS_FILES[statement];
  const filePath = path.join(dataDir, fileName);

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

  const headers = parsed.meta.fields ?? [];
  const reserved = new Set(["ticker", "symbol", "yearreport", "lengthreport"]);

  // Build normalized key mapping + labels.
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

  for (const row of parsed.data) {
    const symbol = normalizeSymbol(row.symbol ?? row.ticker);
    const periodKey = parsePeriodKey(row);
    if (!symbol || !periodKey) {
      skippedRows += 1;
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
    console.warn(
      `[fundamentals:${statement}] rows=${parsed.data.length}, skipped=${skippedRows}, duplicatePeriods=${duplicatePeriodRows}`
    );
  }

  const cache: StatementCache = { fileName, labels, bySymbol };
  if (statement === "bs") bsCache = cache;
  else if (statement === "is") isCache = cache;
  else cfCache = cache;

  return cache;
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
}

