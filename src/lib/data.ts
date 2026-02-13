import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { parseCsvWithValidation, RawCsvRow, ValidationResult } from "./csvLoader";
import { parseCSVDate, isValidDate } from "./utils";

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

let stockMetadataCache: StockMetadata[] | null = null;
let ohlcvCache: Map<string, OHLCV[]> | null = null;
let indexCache: IndexData[] | null = null;

const dataQualityCache: Record<DatasetName, DataQualityReport | null> = {
  stockMetadata: null,
  ohlcv: null,
  index: null,
};

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

/**
 * Safely checks if a file exists using async operations
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function getDataDir(): string {
  const configured = process.env.DATA_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.join(process.cwd(), "public", "data");
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

export async function loadStockMetadata(): Promise<StockMetadata[]> {
  if (stockMetadataCache) return stockMetadataCache;

  const dataDir = getDataDir();
  const filePath = await resolveFirstExistingFile(dataDir, [
    "stock_metadata_2018_2025.csv",
    "HOSE_VERIFIED_2020_2025.csv",
  ]);

  try {
    if (!filePath) {
      console.error("Stock metadata file not found in:", dataDir);
      return [];
    }

    const content = await fsPromises.readFile(filePath, "utf-8");
    if (!content || content.trim() === "") {
      console.error("Stock metadata file is empty");
      return [];
    }

    const parseResult = parseCsvWithValidation(content, validateStockMetadataRow);
    stockMetadataCache = parseResult.rows;

    const report = buildQualityReport("stockMetadata", parseResult);
    logQualityReport(report);

    return stockMetadataCache;
  } catch (error) {
    console.error("Failed to load stock metadata:", error instanceof Error ? error.message : "Unknown error");
    return [];
  }
}

export async function loadOHLCVData(): Promise<Map<string, OHLCV[]>> {
  if (ohlcvCache) return ohlcvCache;

  const dataDir = getDataDir();
  const filePath = await resolveFirstExistingFile(dataDir, [
    "ohlcv_2018_2025.csv",
    "ohlcv_enriched.csv",
  ]);

  try {
    if (!filePath) {
      console.error("OHLCV data file not found in:", dataDir);
      return new Map();
    }

    const content = await fsPromises.readFile(filePath, "utf-8");
    if (!content || content.trim() === "") {
      console.error("OHLCV data file is empty");
      return new Map();
    }

    const dataMap = new Map<string, OHLCV[]>();
    const parseResult = parseCsvWithValidation(content, validateOHLCVRow);

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

    return ohlcvCache;
  } catch (error) {
    console.error("Failed to load OHLCV data:", error instanceof Error ? error.message : "Unknown error");
    return new Map();
  }
}

export async function loadOHLCVForSymbol(symbol: string): Promise<OHLCV[]> {
  if (!symbol || typeof symbol !== "string") {
    return [];
  }
  const allData = await loadOHLCVData();
  return allData.get(symbol.trim().toUpperCase()) || [];
}

export async function loadIndexData(): Promise<IndexData[]> {
  if (indexCache) return indexCache;

  const dataDir = getDataDir();
  const filePath = path.join(dataDir, "Market_Indices_Daily_2020_2025.csv");

  try {
    if (!(await fileExists(filePath))) {
      console.error("Index data file not found:", filePath);
      return [];
    }

    const content = await fsPromises.readFile(filePath, "utf-8");
    if (!content || content.trim() === "") {
      console.error("Index data file is empty");
      return [];
    }

    const parseResult = parseCsvWithValidation(content, validateIndexRow);
    indexCache = parseResult.rows;
    indexCache.sort((a, b) => a.date.getTime() - b.date.getTime());

    const report = buildQualityReport("index", parseResult);
    logQualityReport(report);

    return indexCache;
  } catch (error) {
    console.error("Failed to load index data:", error instanceof Error ? error.message : "Unknown error");
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

export function hasSufficientDataQuality(dataset: DatasetName, minAcceptedRatio: number = 0.95): boolean {
  const report = dataQualityCache[dataset];
  if (!report) return true;
  if (report.totalRows === 0) return false;
  return report.acceptedRatio >= minAcceptedRatio;
}

/**
 * Clears all caches - useful for testing or when data files are updated
 */
export function clearCache(): void {
  stockMetadataCache = null;
  ohlcvCache = null;
  indexCache = null;
  dataQualityCache.stockMetadata = null;
  dataQualityCache.ohlcv = null;
  dataQualityCache.index = null;
}
