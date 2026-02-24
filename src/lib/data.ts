import fsPromises from "fs/promises";
import { constants as fsConstants, createReadStream } from "fs";
import path from "path";
import readline from "readline";
import { parseCsvWithValidation, RawCsvRow, ValidationResult } from "./csvLoader";
import { parseCSVDate, isValidDate } from "./utils";
import { resolveDataDir } from "./dataDir";
import { ensureDataBackendReady, clearDataBackendCache } from "./dataBackend";
import { getManifestDataset, clearManifestCache } from "./dataManifest";
import { queryDuckDbRows, clearDuckDbModuleCache } from "./duckdbClient";
import { clearFundamentalsCache } from "./fundamentals";

export interface StockMetadata {
  symbol: string;
  exchange: string;
  status: string;
  dataRows: number;
  source: string;
  firstDate: Date;
  lastDate: Date;
  totalTradingDays: number;
  avgVolume: number;
  listingPhase: string;
  organName?: string;
  icbCode1?: string;
  icbCode2?: string;
  icbCode3?: string;
  icbCode4?: string;
  icbName2?: string;
  icbName3?: string;
  icbName4?: string;
}

export interface OHLCV {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
}

export interface IndexData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
}

export type DatasetName = "stockMetadata" | "ohlcv" | "index";

export interface DataQualityReport {
  dataset: DatasetName;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  acceptedRatio: number;
  rejectionReasons: Record<string, number>;
  parseErrorCount: number;
  generatedAt: Date;
}

export interface DatasetLoadStatus {
  dataset: DatasetName;
  status: "unknown" | "ok" | "error";
  reason?: string;
  message?: string;
  backend?: "csv" | "duckdb";
  source?: string;
  updatedAt: Date;
}

let stockMetadataCache: StockMetadata[] | null = null;
let ohlcvCache: Map<string, OHLCV[]> | null = null;
let ohlcvSymbolCache: Map<string, OHLCV[]> = new Map();
let indexCache: IndexData[] | null = null;

const dataQualityCache: Record<DatasetName, DataQualityReport | null> = {
  stockMetadata: null,
  ohlcv: null,
  index: null,
};

const datasetStatusCache: Record<DatasetName, DatasetLoadStatus> = {
  stockMetadata: {
    dataset: "stockMetadata",
    status: "unknown",
    updatedAt: new Date(0),
  },
  ohlcv: {
    dataset: "ohlcv",
    status: "unknown",
    updatedAt: new Date(0),
  },
  index: {
    dataset: "index",
    status: "unknown",
    updatedAt: new Date(0),
  },
};

const STOCK_METADATA_FILE_CANDIDATES = [
  "stock_metadata_2018_2025.csv",
  "HOSE_VERIFIED_2020_2025.csv",
];
const OHLCV_FILE_CANDIDATES = [
  "HOSE_VERIFIED_OHLCV_INDUSTRY_2018_2025.csv",
  "ohlcv_2018_2025.csv",
  "ohlcv_enriched.csv",
];
const MANIFEST_FILE_CANDIDATES = [
  "data_manifest_2018_2025.json",
  "data_manifest.json",
];
const INDEX_FILE_NAME = "Market_Indices_Daily_2020_2025.csv";
const DUCKDB_FILE_NAME = "quant_data.duckdb";
const FUNDAMENTALS_FILE_NAMES = [
  "HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv",
  "HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv",
  "HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv",
] as const;

let dataSourceFingerprintCache: string | null = null;
let lastDataSourceFingerprintCheckAt = 0;

function success<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function failure(reason: string): ValidationResult<never> {
  return { ok: false, reason };
}

function parseNumber(rawValue: string | undefined): number | null {
  if (rawValue === undefined) return null;
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function validateOhlcBounds(
  open: number,
  high: number,
  low: number,
  close: number
): ValidationResult<true> {
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
    return failure("non_positive_price");
  }
  if (high < low) {
    return failure("high_below_low");
  }
  if (high < open || high < close) {
    return failure("high_below_open_or_close");
  }
  if (low > open || low > close) {
    return failure("low_above_open_or_close");
  }
  return success(true);
}

function buildQualityReport<T>(
  dataset: DatasetName,
  parseResult: {
    totalRows: number;
    acceptedRows: number;
    rejectedRows: number;
    rejectionReasons: Record<string, number>;
    parseErrorCount: number;
    rows: T[];
  }
): DataQualityReport {
  const report: DataQualityReport = {
    dataset,
    totalRows: parseResult.totalRows,
    acceptedRows: parseResult.acceptedRows,
    rejectedRows: parseResult.rejectedRows,
    acceptedRatio: parseResult.totalRows > 0 ? parseResult.acceptedRows / parseResult.totalRows : 0,
    rejectionReasons: { ...parseResult.rejectionReasons },
    parseErrorCount: parseResult.parseErrorCount,
    generatedAt: new Date(),
  };

  dataQualityCache[dataset] = report;
  return report;
}

function setDatasetStatusSuccess(
  dataset: DatasetName,
  backend: "csv" | "duckdb",
  source: string
): void {
  datasetStatusCache[dataset] = {
    dataset,
    status: "ok",
    backend,
    source,
    updatedAt: new Date(),
  };
}

function setDatasetStatusFailure(
  dataset: DatasetName,
  reason: string,
  backend: "csv" | "duckdb",
  source: string,
  message?: string
): void {
  datasetStatusCache[dataset] = {
    dataset,
    status: "error",
    reason,
    message,
    backend,
    source,
    updatedAt: new Date(),
  };
}

function emitLoadFailureReport(
  dataset: DatasetName,
  reason: string,
  options: {
    backend: "csv" | "duckdb";
    source: string;
    message?: string;
  }
): DataQualityReport {
  setDatasetStatusFailure(dataset, reason, options.backend, options.source, options.message);
  const report = buildQualityReport(dataset, {
    totalRows: 0,
    acceptedRows: 0,
    rejectedRows: 0,
    rejectionReasons: { [reason]: 1 },
    parseErrorCount: 1,
    rows: [],
  });
  logQualityReport(report);
  return report;
}

function logQualityReport(report: DataQualityReport): void {
  const ratioPct = (report.acceptedRatio * 100).toFixed(2);
  const reasonSummary = Object.entries(report.rejectionReasons)
    .map(([reason, count]) => `${reason}=${count}`)
    .join(", ");

  if (report.rejectedRows > 0 || report.parseErrorCount > 0) {
    console.warn(
      `[data-quality:${report.dataset}] accepted=${report.acceptedRows}/${report.totalRows} ` +
      `(${ratioPct}%), rejected=${report.rejectedRows}, parseErrors=${report.parseErrorCount}` +
      (reasonSummary ? `, reasons=[${reasonSummary}]` : "")
    );
  } else {
    console.info(
      `[data-quality:${report.dataset}] accepted=${report.acceptedRows}/${report.totalRows} (${ratioPct}%)`
    );
  }
}

function validateStockMetadataRow(row: RawCsvRow): ValidationResult<StockMetadata> {
  const symbol = row.symbol?.toUpperCase();
  if (!symbol) return failure("missing_symbol");

  const exchange = row.exchange;
  if (!exchange) return failure("missing_exchange");

  const status = row.status;
  if (!status) return failure("missing_status");

  const source = row.source || "";
  const listingPhase = row.listing_phase || "";

  const dataRows = parseNumber(row.data_rows_2018_2025 ?? row.data_rows_2020_2025);
  if (dataRows === null) return failure("invalid_data_rows");

  const totalTradingDays = parseNumber(row.total_trading_days);
  if (totalTradingDays === null) return failure("invalid_total_trading_days");

  const avgVolume = parseNumber(row.avg_volume);
  if (avgVolume === null) return failure("invalid_avg_volume");

  const firstDate = parseCSVDate(row.first_date || "");
  if (!isValidDate(firstDate)) return failure("invalid_first_date");

  const lastDate = parseCSVDate(row.last_date || "");
  if (!isValidDate(lastDate)) return failure("invalid_last_date");

  return success({
    symbol,
    exchange,
    status,
    dataRows: Math.trunc(dataRows),
    source,
    firstDate,
    lastDate,
    totalTradingDays,
    avgVolume,
    listingPhase,
    organName: row.organ_name || undefined,
    icbCode1: row.icb_code1 || undefined,
    icbCode2: row.icb_code2 || undefined,
    icbCode3: row.icb_code3 || undefined,
    icbCode4: row.icb_code4 || undefined,
    icbName2: row.icb_name2 || undefined,
    icbName3: row.icb_name3 || undefined,
    icbName4: row.icb_name4 || undefined,
  });
}

function validateOHLCVRow(row: RawCsvRow): ValidationResult<OHLCV> {
  const symbol = row.symbol?.toUpperCase();
  if (!symbol) return failure("missing_symbol");

  const date = parseCSVDate(row.date || "");
  if (!isValidDate(date)) return failure("invalid_date");

  const open = parseNumber(row.open);
  if (open === null) return failure("invalid_open");

  const high = parseNumber(row.high);
  if (high === null) return failure("invalid_high");

  const low = parseNumber(row.low);
  if (low === null) return failure("invalid_low");

  const close = parseNumber(row.close);
  if (close === null) return failure("invalid_close");

  const volume = parseNumber(row.volume);
  if (volume === null) return failure("invalid_volume");
  if (volume < 0) return failure("negative_volume");

  const boundsValidation = validateOhlcBounds(open, high, low, close);
  if (!boundsValidation.ok) return boundsValidation;

  return success({
    date,
    open,
    high,
    low,
    close,
    volume,
    symbol,
  });
}

function validateIndexRow(row: RawCsvRow): ValidationResult<IndexData> {
  const symbol = row.symbol?.toUpperCase();
  if (!symbol) return failure("missing_symbol");

  const rawDate = row.time || row.date;
  const date = parseCSVDate(rawDate || "");
  if (!isValidDate(date)) return failure("invalid_date");

  const open = parseNumber(row.open);
  if (open === null) return failure("invalid_open");

  const high = parseNumber(row.high);
  if (high === null) return failure("invalid_high");

  const low = parseNumber(row.low);
  if (low === null) return failure("invalid_low");

  const close = parseNumber(row.close);
  if (close === null) return failure("invalid_close");

  const volume = parseNumber(row.volume);
  if (volume === null) return failure("invalid_volume");
  if (volume < 0) return failure("negative_volume");

  const boundsValidation = validateOhlcBounds(open, high, low, close);
  if (!boundsValidation.ok) return boundsValidation;

  return success({
    date,
    open,
    high,
    low,
    close,
    volume,
    symbol,
  });
}

interface DuckDbValidatedParseResult<T> {
  rows: T[];
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  rejectionReasons: Record<string, number>;
  parseErrorCount: number;
}

function normalizeDuckDbRowToRawCsvRow(row: Record<string, unknown>): RawCsvRow {
  const out: RawCsvRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || value === null) continue;
    if (value instanceof Date) {
      out[key] = value.toISOString().slice(0, 10);
      continue;
    }
    if (typeof value === "string") {
      out[key] = value.trim();
      continue;
    }
    out[key] = String(value);
  }
  return out;
}

function incrementRejectionReason(reasons: Record<string, number>, reason: string): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  out.push(current);
  return out;
}

function decodeCsvCell(raw: string | undefined): string {
  if (typeof raw !== "string") return "";
  return raw.trim();
}

interface OhlcvCsvHeaderIndexes {
  symbol: number;
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function resolveOhlcvCsvHeaderIndexes(headerLine: string): OhlcvCsvHeaderIndexes | null {
  const headers = splitCsvLine(headerLine).map((cell) =>
    decodeCsvCell(cell).replace(/^\uFEFF/, "").trim().toLowerCase()
  );
  const findHeaderIndex = (name: string) => headers.indexOf(name);

  const indexes: OhlcvCsvHeaderIndexes = {
    symbol: findHeaderIndex("symbol"),
    date: findHeaderIndex("date"),
    open: findHeaderIndex("open"),
    high: findHeaderIndex("high"),
    low: findHeaderIndex("low"),
    close: findHeaderIndex("close"),
    volume: findHeaderIndex("volume"),
  };

  if (Object.values(indexes).some((index) => index < 0)) {
    return null;
  }

  return indexes;
}

function parseDuckDbRowsWithValidation<T>(
  rows: Record<string, unknown>[],
  validator: (row: RawCsvRow) => ValidationResult<T>
): DuckDbValidatedParseResult<T> {
  const acceptedRows: T[] = [];
  const rejectionReasons = new Map<string, number>();

  for (const row of rows) {
    const normalized = normalizeDuckDbRowToRawCsvRow(row);
    const validation = validator(normalized);
    if (validation.ok) {
      acceptedRows.push(validation.value);
      continue;
    }
    const reason = validation.reason || "unknown";
    rejectionReasons.set(reason, (rejectionReasons.get(reason) ?? 0) + 1);
  }

  return {
    rows: acceptedRows,
    totalRows: rows.length,
    acceptedRows: acceptedRows.length,
    rejectedRows: Math.max(0, rows.length - acceptedRows.length),
    rejectionReasons: Object.fromEntries(rejectionReasons.entries()),
    parseErrorCount: 0,
  };
}

function parseNumberEnv(raw: string | undefined, fallback: number): number {
  const parsed = Number(String(raw ?? "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBooleanEnv(raw: string | undefined, fallback: boolean): boolean {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseIntegerEnv(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function enforceManifestRowsGate(
  dataset: DatasetName,
  acceptedRows: number
): Promise<void> {
  const datasetManifest = await getManifestDataset(dataset);
  if (!datasetManifest) return;

  const expectedRowsRaw = datasetManifest.acceptedRows;
  if (typeof expectedRowsRaw !== "number" || !Number.isFinite(expectedRowsRaw)) return;
  const expectedRows = expectedRowsRaw;

  const tolerance = Math.max(0, parseIntegerEnv(process.env.DATA_MANIFEST_ROW_TOLERANCE, 0));
  const strictManifest = parseBooleanEnv(process.env.DATA_MANIFEST_STRICT, true);
  const diff = Math.abs(expectedRows - acceptedRows);
  if (diff <= tolerance) return;

  const message =
    `Data manifest gate failed for ${dataset}: acceptedRows=${acceptedRows}, ` +
    `expectedRows=${expectedRows}, diff=${diff}, tolerance=${tolerance}`;

  if (strictManifest) {
    throw new Error(message);
  }

  console.warn(`[data-manifest] ${message}`);
}

function getMinAcceptedRatio(dataset: DatasetName): number {
  const rawDefaultRatio = parseNumberEnv(process.env.DATA_MIN_ACCEPTED_RATIO, 0.95);
  const defaultRatio = rawDefaultRatio > 0 && rawDefaultRatio <= 1 ? rawDefaultRatio : 0.95;
  const clamp = (value: number) => (value > 0 && value <= 1 ? value : defaultRatio);
  if (dataset === "stockMetadata") {
    return clamp(parseNumberEnv(process.env.DATA_MIN_ACCEPTED_RATIO_STOCK_METADATA, defaultRatio));
  }
  if (dataset === "ohlcv") {
    return clamp(parseNumberEnv(process.env.DATA_MIN_ACCEPTED_RATIO_OHLCV, defaultRatio));
  }
  return clamp(parseNumberEnv(process.env.DATA_MIN_ACCEPTED_RATIO_INDEX, defaultRatio));
}

function enforceParseQualityGate(
  dataset: DatasetName,
  filePath: string,
  parseResult: {
    totalRows: number;
    acceptedRows: number;
    parseErrorCount: number;
  }
): void {
  if (!parseBooleanEnv(process.env.DATA_STRICT_READ, true)) return;

  if (parseResult.totalRows <= 0) {
    throw new Error(`Data quality gate failed for ${dataset}: no rows found (${filePath})`);
  }

  if (parseBooleanEnv(process.env.DATA_STRICT_PARSE, true) && parseResult.parseErrorCount > 0) {
    throw new Error(
      `Data quality gate failed for ${dataset}: parseErrors=${parseResult.parseErrorCount} (${filePath})`
    );
  }

  const acceptedRatio = parseResult.acceptedRows / parseResult.totalRows;
  const minAcceptedRatio = getMinAcceptedRatio(dataset);
  if (acceptedRatio < minAcceptedRatio) {
    throw new Error(
      `Data quality gate failed for ${dataset}: acceptedRatio=${acceptedRatio.toFixed(4)} < ${minAcceptedRatio} (${filePath})`
    );
  }
}

function getFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("data quality gate failed")) return "quality_gate_failed";
  return "read_failure";
}

/**
 * Safely checks if a file exists using async operations
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function getDataDir(): string {
  return resolveDataDir().path;
}

async function resolveFirstExistingFile(dataDir: string, candidates: string[]): Promise<string | null> {
  for (const name of candidates) {
    const filePath = path.join(dataDir, name);
    if (await fileExists(filePath)) {
      return filePath;
    }
  }
  return null;
}

async function resolveFileMtimeMs(filePath: string | null): Promise<number> {
  if (!filePath) return 0;
  try {
    const stats = await fsPromises.stat(filePath);
    return Number.isFinite(stats.mtimeMs) ? Math.trunc(stats.mtimeMs) : 0;
  } catch {
    return 0;
  }
}

async function computeDataSourceFingerprint(): Promise<string> {
  const dataDir = getDataDir();
  const [stockMetadataPath, ohlcvPath, manifestPath] = await Promise.all([
    resolveFirstExistingFile(dataDir, STOCK_METADATA_FILE_CANDIDATES),
    resolveFirstExistingFile(dataDir, OHLCV_FILE_CANDIDATES),
    resolveFirstExistingFile(dataDir, MANIFEST_FILE_CANDIDATES),
  ]);
  const indexPath = path.join(dataDir, INDEX_FILE_NAME);
  const duckdbPath = path.join(dataDir, DUCKDB_FILE_NAME);
  const fundamentalsPaths = FUNDAMENTALS_FILE_NAMES.map((fileName) => path.join(dataDir, fileName));

  const [
    stockMetadataMtimeMs,
    ohlcvMtimeMs,
    indexMtimeMs,
    manifestMtimeMs,
    duckdbMtimeMs,
    fundamentalsBsMtimeMs,
    fundamentalsIsMtimeMs,
    fundamentalsCfMtimeMs,
  ] = await Promise.all([
    resolveFileMtimeMs(stockMetadataPath),
    resolveFileMtimeMs(ohlcvPath),
    resolveFileMtimeMs(indexPath),
    resolveFileMtimeMs(manifestPath),
    resolveFileMtimeMs(duckdbPath),
    resolveFileMtimeMs(fundamentalsPaths[0] ?? null),
    resolveFileMtimeMs(fundamentalsPaths[1] ?? null),
    resolveFileMtimeMs(fundamentalsPaths[2] ?? null),
  ]);

  return JSON.stringify({
    dataDir,
    dataBackend: String(process.env.DATA_BACKEND ?? "auto").trim().toLowerCase(),
    duckdbPath: String(process.env.DATA_DUCKDB_PATH ?? "").trim().toLowerCase(),
    stockMetadataPath,
    stockMetadataMtimeMs,
    ohlcvPath,
    ohlcvMtimeMs,
    indexPath,
    indexMtimeMs,
    manifestPath,
    manifestMtimeMs,
    duckdbMtimeMs,
    fundamentalsPaths,
    fundamentalsBsMtimeMs,
    fundamentalsIsMtimeMs,
    fundamentalsCfMtimeMs,
  });
}

async function ensureRuntimeDataFreshness(): Promise<void> {
  const now = Date.now();
  const checkIntervalMs = Math.max(1000, parseIntegerEnv(process.env.DATA_CACHE_REFRESH_CHECK_MS, 5000));
  if (now - lastDataSourceFingerprintCheckAt < checkIntervalMs) return;

  lastDataSourceFingerprintCheckAt = now;
  const fingerprint = await computeDataSourceFingerprint();

  if (dataSourceFingerprintCache === null) {
    dataSourceFingerprintCache = fingerprint;
    return;
  }

  if (dataSourceFingerprintCache !== fingerprint) {
    console.info("[data-cache] Detected runtime data source change. Clearing in-memory caches.");
    clearCache();
    dataSourceFingerprintCache = fingerprint;
    lastDataSourceFingerprintCheckAt = now;
  }
}

async function loadStockMetadataFromDuckDb(duckdbPath: string): Promise<StockMetadata[]> {
  const rows = await queryDuckDbRows(
    duckdbPath,
    "SELECT * FROM stock_metadata"
  );
  const parseResult = parseDuckDbRowsWithValidation(rows, validateStockMetadataRow);
  enforceParseQualityGate("stockMetadata", `duckdb:${duckdbPath}:stock_metadata`, parseResult);
  await enforceManifestRowsGate("stockMetadata", parseResult.acceptedRows);
  const report = buildQualityReport("stockMetadata", parseResult);
  logQualityReport(report);
  setDatasetStatusSuccess("stockMetadata", "duckdb", `duckdb:${duckdbPath}:stock_metadata`);
  return parseResult.rows;
}

async function loadOHLCVDataFromDuckDb(duckdbPath: string): Promise<Map<string, OHLCV[]>> {
  const rows = await queryDuckDbRows(
    duckdbPath,
    "SELECT symbol, date, open, high, low, close, volume FROM ohlcv ORDER BY symbol, date"
  );
  const parseResult = parseDuckDbRowsWithValidation(rows, validateOHLCVRow);
  enforceParseQualityGate("ohlcv", `duckdb:${duckdbPath}:ohlcv`, parseResult);
  await enforceManifestRowsGate("ohlcv", parseResult.acceptedRows);

  const dataMap = new Map<string, OHLCV[]>();
  for (const row of parseResult.rows) {
    if (!dataMap.has(row.symbol)) {
      dataMap.set(row.symbol, []);
    }
    dataMap.get(row.symbol)!.push(row);
  }
  for (const series of dataMap.values()) {
    series.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  const report = buildQualityReport("ohlcv", parseResult);
  logQualityReport(report);
  setDatasetStatusSuccess("ohlcv", "duckdb", `duckdb:${duckdbPath}:ohlcv`);
  return dataMap;
}

async function loadOHLCVForSymbolFromDuckDb(duckdbPath: string, symbol: string): Promise<OHLCV[]> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const source = `duckdb:${duckdbPath}:ohlcv`;
  const rows = await queryDuckDbRows(
    duckdbPath,
    "SELECT symbol, date, open, high, low, close, volume FROM ohlcv WHERE symbol = ? ORDER BY date",
    [normalizedSymbol]
  );
  const parseResult = parseDuckDbRowsWithValidation(rows, validateOHLCVRow);

  if (parseResult.totalRows <= 0) {
    if (dataQualityCache.ohlcv?.totalRows === 0) {
      dataQualityCache.ohlcv = null;
    }
    datasetStatusCache.ohlcv = {
      dataset: "ohlcv",
      status: "unknown",
      backend: "duckdb",
      source,
      updatedAt: new Date(),
    };
    return parseResult.rows;
  }

  const report = buildQualityReport("ohlcv", parseResult);
  if (report.rejectedRows > 0 || report.parseErrorCount > 0) {
    logQualityReport(report);
  }
  setDatasetStatusSuccess("ohlcv", "duckdb", source);
  return parseResult.rows;
}

async function loadOHLCVForSymbolFromCsv(dataDir: string, symbol: string): Promise<OHLCV[]> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const filePath = await resolveFirstExistingFile(dataDir, OHLCV_FILE_CANDIDATES);
  const source = filePath ? `csv:${filePath}` : `csv:${dataDir}`;

  if (!filePath) {
    emitLoadFailureReport("ohlcv", "missing_file", {
      backend: "csv",
      source,
      message: "OHLCV file not found",
    });
    return [];
  }

  const rows: OHLCV[] = [];
  const rejectionReasons: Record<string, number> = {};
  let parseErrorCount = 0;
  let totalRows = 0;
  let headerParsed = false;
  let headerIndexes: OhlcvCsvHeaderIndexes | null = null;

  const stream = createReadStream(filePath, { encoding: "utf-8" });
  const lineReader = readline.createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const rawLine of lineReader) {
      const line = String(rawLine ?? "");
      if (!headerParsed) {
        headerParsed = true;
        headerIndexes = resolveOhlcvCsvHeaderIndexes(line);
        if (!headerIndexes) {
          emitLoadFailureReport("ohlcv", "invalid_header", {
            backend: "csv",
            source,
            message: "OHLCV CSV header is invalid",
          });
          return [];
        }
        continue;
      }

      if (!line.trim()) continue;
      if (!headerIndexes) continue;

      const cells = splitCsvLine(line);
      if (cells.length <= headerIndexes.symbol) {
        parseErrorCount += 1;
        incrementRejectionReason(rejectionReasons, "parse_missing_symbol_column");
        continue;
      }

      const symbolCell = decodeCsvCell(cells[headerIndexes.symbol]);
      if (symbolCell.toUpperCase() !== normalizedSymbol) {
        continue;
      }

      totalRows += 1;
      const missingRequiredColumn =
        cells.length <= headerIndexes.date
        || cells.length <= headerIndexes.open
        || cells.length <= headerIndexes.high
        || cells.length <= headerIndexes.low
        || cells.length <= headerIndexes.close
        || cells.length <= headerIndexes.volume;
      if (missingRequiredColumn) {
        parseErrorCount += 1;
        incrementRejectionReason(rejectionReasons, "parse_missing_required_column");
        continue;
      }

      const row: RawCsvRow = {
        symbol: symbolCell,
        date: decodeCsvCell(cells[headerIndexes.date]),
        open: decodeCsvCell(cells[headerIndexes.open]),
        high: decodeCsvCell(cells[headerIndexes.high]),
        low: decodeCsvCell(cells[headerIndexes.low]),
        close: decodeCsvCell(cells[headerIndexes.close]),
        volume: decodeCsvCell(cells[headerIndexes.volume]),
      };

      const validation = validateOHLCVRow(row);
      if (!validation.ok) {
        incrementRejectionReason(rejectionReasons, validation.reason || "invalid_row");
        continue;
      }
      rows.push(validation.value);
    }
  } catch (error) {
    emitLoadFailureReport("ohlcv", getFailureReason(error), {
      backend: "csv",
      source,
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  } finally {
    lineReader.close();
    stream.destroy();
  }

  if (totalRows <= 0) {
    if (dataQualityCache.ohlcv?.totalRows === 0) {
      dataQualityCache.ohlcv = null;
    }
    datasetStatusCache.ohlcv = {
      dataset: "ohlcv",
      status: "unknown",
      backend: "csv",
      source,
      updatedAt: new Date(),
    };
    return [];
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());
  const parseResult = {
    rows,
    totalRows,
    acceptedRows: rows.length,
    rejectedRows: Math.max(0, totalRows - rows.length),
    rejectionReasons,
    parseErrorCount,
  };

  const report = buildQualityReport("ohlcv", parseResult);
  if (report.rejectedRows > 0 || report.parseErrorCount > 0) {
    logQualityReport(report);
  }
  setDatasetStatusSuccess("ohlcv", "csv", source);
  return rows;
}

async function resolveDuckDbDateColumn(duckdbPath: string, tableName: string): Promise<"date" | "time"> {
  const escapedTable = tableName.replace(/'/g, "''");
  const schemaRows = await queryDuckDbRows(duckdbPath, `PRAGMA table_info('${escapedTable}')`);
  const availableColumns = new Set(
    schemaRows
      .map((row) => String(row.name ?? "").trim().toLowerCase())
      .filter((name) => name.length > 0)
  );

  if (availableColumns.has("date")) return "date";
  if (availableColumns.has("time")) return "time";
  throw new Error(`DuckDB table '${tableName}' is missing date/time column`);
}

async function loadIndexDataFromDuckDb(duckdbPath: string): Promise<IndexData[]> {
  const dateColumn = await resolveDuckDbDateColumn(duckdbPath, "market_index");
  const rows = await queryDuckDbRows(
    duckdbPath,
    `SELECT symbol, ${dateColumn} AS date, open, high, low, close, volume FROM market_index ORDER BY ${dateColumn}`
  );
  const parseResult = parseDuckDbRowsWithValidation(rows, validateIndexRow);
  enforceParseQualityGate("index", `duckdb:${duckdbPath}:market_index`, parseResult);
  await enforceManifestRowsGate("index", parseResult.acceptedRows);

  const sorted = [...parseResult.rows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const report = buildQualityReport("index", parseResult);
  logQualityReport(report);
  setDatasetStatusSuccess("index", "duckdb", `duckdb:${duckdbPath}:market_index`);
  return sorted;
}

export async function loadStockMetadata(): Promise<StockMetadata[]> {
  await ensureRuntimeDataFreshness();
  if (stockMetadataCache) return stockMetadataCache;

  const backend = await ensureDataBackendReady("loadStockMetadata");
  const dataDir = getDataDir();
  const filePath = await resolveFirstExistingFile(dataDir, STOCK_METADATA_FILE_CANDIDATES);

  try {
    if (backend.active === "duckdb") {
      stockMetadataCache = await loadStockMetadataFromDuckDb(backend.duckdbPath);
      return stockMetadataCache;
    }

    if (!filePath) {
      console.error("Stock metadata file not found in:", dataDir);
      emitLoadFailureReport("stockMetadata", "missing_file", {
        backend: backend.active,
        source: `csv:${dataDir}`,
        message: "Stock metadata file not found",
      });
      return [];
    }

    const content = await fsPromises.readFile(filePath, "utf-8");
    if (!content || content.trim() === "") {
      console.error("Stock metadata file is empty");
      emitLoadFailureReport("stockMetadata", "empty_file", {
        backend: backend.active,
        source: `csv:${filePath}`,
        message: "Stock metadata CSV is empty",
      });
      return [];
    }

    const parseResult = parseCsvWithValidation(content, validateStockMetadataRow);
    enforceParseQualityGate("stockMetadata", filePath, parseResult);
    await enforceManifestRowsGate("stockMetadata", parseResult.acceptedRows);
    stockMetadataCache = parseResult.rows;

    const report = buildQualityReport("stockMetadata", parseResult);
    logQualityReport(report);
    setDatasetStatusSuccess("stockMetadata", "csv", `csv:${filePath}`);

    return stockMetadataCache;
  } catch (error) {
    console.error("Failed to load stock metadata:", error instanceof Error ? error.message : "Unknown error");
    emitLoadFailureReport("stockMetadata", getFailureReason(error), {
      backend: backend.active,
      source: filePath ? `csv:${filePath}` : `csv:${dataDir}`,
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function loadOHLCVData(): Promise<Map<string, OHLCV[]>> {
  await ensureRuntimeDataFreshness();
  if (ohlcvCache) return ohlcvCache;

  const backend = await ensureDataBackendReady("loadOHLCVData");
  const dataDir = getDataDir();
  const filePath = await resolveFirstExistingFile(dataDir, OHLCV_FILE_CANDIDATES);

  try {
    if (backend.active === "duckdb") {
      ohlcvCache = await loadOHLCVDataFromDuckDb(backend.duckdbPath);
      return ohlcvCache;
    }

    if (!filePath) {
      console.error("OHLCV data file not found in:", dataDir);
      emitLoadFailureReport("ohlcv", "missing_file", {
        backend: backend.active,
        source: `csv:${dataDir}`,
        message: "OHLCV file not found",
      });
      return new Map();
    }

    const content = await fsPromises.readFile(filePath, "utf-8");
    if (!content || content.trim() === "") {
      console.error("OHLCV data file is empty");
      emitLoadFailureReport("ohlcv", "empty_file", {
        backend: backend.active,
        source: `csv:${filePath}`,
        message: "OHLCV CSV is empty",
      });
      return new Map();
    }

    const dataMap = new Map<string, OHLCV[]>();
    const parseResult = parseCsvWithValidation(content, validateOHLCVRow);
    enforceParseQualityGate("ohlcv", filePath, parseResult);
    await enforceManifestRowsGate("ohlcv", parseResult.acceptedRows);

    for (const ohlcv of parseResult.rows) {
      if (!dataMap.has(ohlcv.symbol)) {
        dataMap.set(ohlcv.symbol, []);
      }
      dataMap.get(ohlcv.symbol)!.push(ohlcv);
    }

    for (const series of dataMap.values()) {
      series.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    ohlcvCache = dataMap;

    const report = buildQualityReport("ohlcv", parseResult);
    logQualityReport(report);
    setDatasetStatusSuccess("ohlcv", "csv", `csv:${filePath}`);

    return ohlcvCache;
  } catch (error) {
    console.error("Failed to load OHLCV data:", error instanceof Error ? error.message : "Unknown error");
    emitLoadFailureReport("ohlcv", getFailureReason(error), {
      backend: backend.active,
      source: filePath ? `csv:${filePath}` : `csv:${dataDir}`,
      message: error instanceof Error ? error.message : String(error),
    });
    return new Map();
  }
}

export async function loadOHLCVForSymbol(symbol: string): Promise<OHLCV[]> {
  if (!symbol || typeof symbol !== "string") {
    return [];
  }
  await ensureRuntimeDataFreshness();
  const normalizedSymbol = symbol.trim().toUpperCase();
  const backend = await ensureDataBackendReady("loadOHLCVForSymbol");
  if (backend.active === "duckdb") {
    try {
      return await loadOHLCVForSymbolFromDuckDb(backend.duckdbPath, normalizedSymbol);
    } catch (error) {
      console.error("Failed to load OHLCV symbol from DuckDB:", error instanceof Error ? error.message : "Unknown error");
      emitLoadFailureReport("ohlcv", getFailureReason(error), {
        backend: backend.active,
        source: `duckdb:${backend.duckdbPath}:ohlcv`,
        message: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
  if (ohlcvCache) {
    return ohlcvCache.get(normalizedSymbol) || [];
  }
  const cachedSeries = ohlcvSymbolCache.get(normalizedSymbol);
  if (cachedSeries) {
    return cachedSeries;
  }

  const series = await loadOHLCVForSymbolFromCsv(getDataDir(), normalizedSymbol);
  if (series.length > 0) {
    ohlcvSymbolCache.set(normalizedSymbol, series);
  }
  return series;
}

export async function loadIndexData(): Promise<IndexData[]> {
  await ensureRuntimeDataFreshness();
  if (indexCache) return indexCache;

  const backend = await ensureDataBackendReady("loadIndexData");
  const dataDir = getDataDir();
  const filePath = path.join(dataDir, INDEX_FILE_NAME);

  try {
    if (backend.active === "duckdb") {
      indexCache = await loadIndexDataFromDuckDb(backend.duckdbPath);
      return indexCache;
    }

    if (!(await fileExists(filePath))) {
      console.error("Index data file not found:", filePath);
      emitLoadFailureReport("index", "missing_file", {
        backend: backend.active,
        source: `csv:${filePath}`,
        message: "Market index CSV file not found",
      });
      return [];
    }

    const content = await fsPromises.readFile(filePath, "utf-8");
    if (!content || content.trim() === "") {
      console.error("Index data file is empty");
      emitLoadFailureReport("index", "empty_file", {
        backend: backend.active,
        source: `csv:${filePath}`,
        message: "Market index CSV is empty",
      });
      return [];
    }

    const parseResult = parseCsvWithValidation(content, validateIndexRow);
    enforceParseQualityGate("index", filePath, parseResult);
    await enforceManifestRowsGate("index", parseResult.acceptedRows);
    indexCache = parseResult.rows;
    indexCache.sort((a, b) => a.date.getTime() - b.date.getTime());

    const report = buildQualityReport("index", parseResult);
    logQualityReport(report);
    setDatasetStatusSuccess("index", "csv", `csv:${filePath}`);

    return indexCache;
  } catch (error) {
    console.error("Failed to load index data:", error instanceof Error ? error.message : "Unknown error");
    emitLoadFailureReport("index", getFailureReason(error), {
      backend: backend.active,
      source: `csv:${filePath}`,
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export function getDataQualityReport(dataset: DatasetName): DataQualityReport | null {
  const report = dataQualityCache[dataset];
  if (!report) return null;
  return {
    ...report,
    rejectionReasons: { ...report.rejectionReasons },
  };
}

export function getDatasetLoadStatus(dataset: DatasetName): DatasetLoadStatus {
  const status = datasetStatusCache[dataset];
  return {
    ...status,
    updatedAt: new Date(status.updatedAt.getTime()),
  };
}

export function hasSufficientDataQuality(dataset: DatasetName, minAcceptedRatio: number = 0.95): boolean {
  const report = dataQualityCache[dataset];
  if (!report) return false;
  if (report.totalRows === 0) return false;
  return report.acceptedRatio >= minAcceptedRatio;
}

export async function getDataSourceFingerprint(): Promise<string> {
  return computeDataSourceFingerprint();
}

/**
 * Clears all caches - useful for testing or when data files are updated
 */
export function clearCache(): void {
  stockMetadataCache = null;
  ohlcvCache = null;
  ohlcvSymbolCache = new Map();
  indexCache = null;
  dataQualityCache.stockMetadata = null;
  dataQualityCache.ohlcv = null;
  dataQualityCache.index = null;
  dataSourceFingerprintCache = null;
  lastDataSourceFingerprintCheckAt = 0;
  datasetStatusCache.stockMetadata = {
    dataset: "stockMetadata",
    status: "unknown",
    updatedAt: new Date(),
  };
  datasetStatusCache.ohlcv = {
    dataset: "ohlcv",
    status: "unknown",
    updatedAt: new Date(),
  };
  datasetStatusCache.index = {
    dataset: "index",
    status: "unknown",
    updatedAt: new Date(),
  };
  clearDataBackendCache();
  clearDuckDbModuleCache();
  clearManifestCache();
  clearFundamentalsCache();
}



