import { NextResponse } from "next/server";
import fsPromises from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import {
  getDataQualityReport,
  hasSufficientDataQuality,
  loadIndexData,
  loadOHLCVData,
  loadStockMetadata,
  clearCache,
  type DatasetName,
} from "@/lib/data";
import { getDataBackendStatus, type DataBackendStatus } from "@/lib/dataBackend";
import { resolveDataDir } from "@/lib/dataDir";
import { loadRuntimeDataManifest } from "@/lib/dataManifest";
import { clearFundamentalsCache, getFundamentalsSourceFiles } from "@/lib/fundamentals";
import { queryDuckDbRows } from "@/lib/duckdbClient";

const MIN_DATA_QUALITY_RATIO = 0.95;
const FUNDAMENTALS_CSV_FILES = [
  "HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv",
  "HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv",
  "HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv",
] as const;

interface ProbeCheck {
  name: string;
  ok: boolean;
  detail: string | null;
}

interface DatasetHealth {
  ok: boolean;
  loadedRows: number;
  totalRows: number;
  acceptedRows: number;
  acceptedRatio: number;
  parseErrorCount: number;
  rejectionReasons: Record<string, number>;
  generatedAt: string | null;
}

function parseBoolean(rawValue: string | null, fallback: boolean): boolean {
  const normalized = String(rawValue ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

async function isReadable(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveReadableCandidate(
  dataDir: string,
  candidates: readonly string[]
): Promise<string | null> {
  for (const fileName of candidates) {
    const filePath = path.join(dataDir, fileName);
    if (await isReadable(filePath)) {
      return fileName;
    }
  }
  return null;
}

function buildProbeCheck(name: string, ok: boolean, detail: string | null = null): ProbeCheck {
  return { name, ok, detail };
}

function buildManifestSnapshot(
  manifest: Awaited<ReturnType<typeof loadRuntimeDataManifest>>
): { available: false } | { available: true; schemaVersion: number; generatedAt: string | null; datasets: unknown } {
  if (!manifest) {
    return { available: false };
  }
  return {
    available: true,
    schemaVersion: manifest.schemaVersion,
    generatedAt: manifest.generatedAt ?? null,
    datasets: manifest.datasets ?? {},
  };
}

async function probeDuckDbTable(
  backendStatus: DataBackendStatus,
  tableName: string,
  requiredNonEmpty: boolean
): Promise<ProbeCheck> {
  try {
    const rows = await queryDuckDbRows(backendStatus.duckdbPath, `SELECT * FROM ${tableName} LIMIT 1`);
    if (requiredNonEmpty && rows.length === 0) {
      return buildProbeCheck(`duckdb:${tableName}`, false, "table is empty");
    }
    return buildProbeCheck(`duckdb:${tableName}`, true, rows.length > 0 ? "rows_available" : "table_exists");
  } catch (error) {
    return buildProbeCheck(
      `duckdb:${tableName}`,
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function runProbeChecks(
  backendStatus: DataBackendStatus,
  includeFundamentals: boolean
): Promise<ProbeCheck[]> {
  const checks: ProbeCheck[] = [];

  if (backendStatus.active === "duckdb") {
    checks.push(await probeDuckDbTable(backendStatus, "stock_metadata", true));
    checks.push(await probeDuckDbTable(backendStatus, "ohlcv", true));
    checks.push(await probeDuckDbTable(backendStatus, "market_index", true));
  } else {
    const stockMetadataFile = await resolveReadableCandidate(backendStatus.dataDir, [
      "stock_metadata_2018_2025.csv",
      "HOSE_VERIFIED_2020_2025.csv",
    ]);
    checks.push(
      buildProbeCheck(
        "csv:stock_metadata",
        Boolean(stockMetadataFile),
        stockMetadataFile ? `using ${stockMetadataFile}` : "missing candidate metadata files"
      )
    );

    const ohlcvFile = await resolveReadableCandidate(backendStatus.dataDir, [
      "ohlcv_2018_2025.csv",
      "HOSE_VERIFIED_OHLCV_INDUSTRY_2018_2025.csv",
      "ohlcv_enriched.csv",
    ]);
    checks.push(
      buildProbeCheck(
        "csv:ohlcv",
        Boolean(ohlcvFile),
        ohlcvFile ? `using ${ohlcvFile}` : "missing candidate ohlcv files"
      )
    );

    const indexFilePath = path.join(backendStatus.dataDir, "Market_Indices_Daily_2020_2025.csv");
    const indexReadable = await isReadable(indexFilePath);
    checks.push(
      buildProbeCheck(
        "csv:market_index",
        indexReadable,
        indexReadable ? "readable" : "missing Market_Indices_Daily_2020_2025.csv"
      )
    );
  }

  if (includeFundamentals) {
    for (const fileName of FUNDAMENTALS_CSV_FILES) {
      const filePath = path.join(backendStatus.dataDir, fileName);
      const readable = await isReadable(filePath);
      checks.push(
        buildProbeCheck(
          `fundamentals:${fileName}`,
          readable,
          readable ? "readable" : "missing fundamentals csv"
        )
      );
    }
  }

  return checks;
}

function buildDatasetHealth(dataset: DatasetName, loadedRows: number): DatasetHealth {
  const report = getDataQualityReport(dataset);
  if (!report) {
    return {
      ok: false,
      loadedRows,
      totalRows: 0,
      acceptedRows: 0,
      acceptedRatio: 0,
      parseErrorCount: 1,
      rejectionReasons: { report_unavailable: 1 },
      generatedAt: null,
    };
  }

  return {
    ok: hasSufficientDataQuality(dataset, MIN_DATA_QUALITY_RATIO),
    loadedRows,
    totalRows: report.totalRows,
    acceptedRows: report.acceptedRows,
    acceptedRatio: report.acceptedRatio,
    parseErrorCount: report.parseErrorCount,
    rejectionReasons: { ...report.rejectionReasons },
    generatedAt: report.generatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const probe = parseBoolean(searchParams.get("probe"), false);
  const refresh = parseBoolean(searchParams.get("refresh"), false);
  const includeFundamentals = parseBoolean(searchParams.get("includeFundamentals"), true);

  if (refresh) {
    clearCache();
    clearFundamentalsCache();
  }

  const dataDir = resolveDataDir();
  const manifest = await loadRuntimeDataManifest();

  let backendStatus: Awaited<ReturnType<typeof getDataBackendStatus>> | null = null;
  let backendError: string | null = null;
  try {
    backendStatus = await getDataBackendStatus();
  } catch (error) {
    backendError = error instanceof Error ? error.message : String(error);
  }

  if (backendError) {
    return NextResponse.json(
      {
        ok: false,
        mode: probe ? "probe" : "full",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        backend: { ok: false, error: backendError },
        dataDir,
        manifest: buildManifestSnapshot(manifest),
      },
      { status: 503 }
    );
  }

  const resolvedBackendStatus = backendStatus as DataBackendStatus;
  if (probe) {
    const checks = await runProbeChecks(resolvedBackendStatus, includeFundamentals);
    const ok = checks.every((check) => check.ok);
    return NextResponse.json(
      {
        ok,
        mode: "probe",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        backend: {
          ok: true,
          ...resolvedBackendStatus,
        },
        dataDir,
        manifest: buildManifestSnapshot(manifest),
        checks,
      },
      { status: ok ? 200 : 503 }
    );
  }

  const [stockMetadata, ohlcvMap, indexData] = await Promise.all([
    loadStockMetadata(),
    loadOHLCVData(),
    loadIndexData(),
  ]);

  const datasets = {
    stockMetadata: buildDatasetHealth("stockMetadata", stockMetadata.length),
    ohlcv: buildDatasetHealth("ohlcv", Array.from(ohlcvMap.values()).reduce((sum, series) => sum + series.length, 0)),
    index: buildDatasetHealth("index", indexData.length),
  };

  let fundamentals = {
    checked: includeFundamentals,
    ok: !includeFundamentals,
    sourceFiles: null as Awaited<ReturnType<typeof getFundamentalsSourceFiles>> | null,
    error: null as string | null,
  };
  if (includeFundamentals) {
    try {
      const sourceFiles = await getFundamentalsSourceFiles();
      fundamentals = {
        checked: true,
        ok: true,
        sourceFiles,
        error: null,
      };
    } catch (error) {
      fundamentals = {
        checked: true,
        ok: false,
        sourceFiles: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const coreOk = datasets.stockMetadata.ok && datasets.ohlcv.ok && datasets.index.ok;
  const ok = coreOk && fundamentals.ok;

  return NextResponse.json(
    {
      ok,
      mode: "full",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      backend: {
        ok: true,
        ...resolvedBackendStatus,
      },
      dataDir,
      manifest: buildManifestSnapshot(manifest),
      datasets,
      fundamentals,
    },
    { status: ok ? 200 : 503 }
  );
}
