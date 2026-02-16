import fsPromises from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import { resolveDataDir } from "./dataDir";
import { hasDuckDbNodeBinding } from "./duckdbClient";

export type RequestedDataBackend = "auto" | "csv" | "duckdb";
export type ActiveDataBackend = "csv" | "duckdb";

export interface DataBackendStatus {
  requested: RequestedDataBackend;
  active: ActiveDataBackend;
  dataDir: string;
  duckdbPath: string;
  reason: string;
}

let backendStatusCache: Promise<DataBackendStatus> | null = null;
let warnedBackendMessage: string | null = null;

function parseRequestedBackend(raw: string | undefined): RequestedDataBackend {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "duckdb") return "duckdb";
  if (value === "csv") return "csv";
  return "auto";
}

function parseBooleanEnv(raw: string | undefined, fallback: boolean): boolean {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveStatus(): Promise<DataBackendStatus> {
  const requested = parseRequestedBackend(process.env.DATA_BACKEND);
  const dataDir = resolveDataDir().path;
  const duckdbPath = String(process.env.DATA_DUCKDB_PATH ?? "").trim() || path.join(dataDir, "quant_data.duckdb");
  const strictMode = parseBooleanEnv(process.env.DATA_BACKEND_STRICT, false);
  const duckdbExists = await fileExists(duckdbPath);
  const duckdbBindingAvailable = await hasDuckDbNodeBinding();

  if (requested === "csv") {
    return {
      requested,
      active: "csv",
      dataDir,
      duckdbPath,
      reason: "explicit_csv",
    };
  }

  if (requested === "duckdb") {
    if (!duckdbExists && strictMode) {
      throw new Error(
        `DATA_BACKEND=duckdb but file is missing: ${duckdbPath}. ` +
        `Run a data export pipeline or set DATA_BACKEND=csv/auto.`
      );
    }
    if (!duckdbBindingAvailable && strictMode) {
      throw new Error(
        `DATA_BACKEND=duckdb but Node duckdb binding is unavailable. ` +
        `Install optional dependency 'duckdb' or use DATA_BACKEND=csv/auto.`
      );
    }
    if (duckdbExists && duckdbBindingAvailable) {
      return {
        requested,
        active: "duckdb",
        dataDir,
        duckdbPath,
        reason: "duckdb_enabled",
      };
    }
    return {
      requested,
      active: "csv",
      dataDir,
      duckdbPath,
      reason: duckdbExists ? "duckdb_binding_missing_fallback_csv" : "duckdb_file_missing_fallback_csv",
    };
  }

  if (duckdbExists && duckdbBindingAvailable) {
    return {
      requested,
      active: "duckdb",
      dataDir,
      duckdbPath,
      reason: "auto_duckdb_enabled",
    };
  }

  if (duckdbExists && !duckdbBindingAvailable) {
    return {
      requested,
      active: "csv",
      dataDir,
      duckdbPath,
      reason: "auto_duckdb_binding_missing_fallback_csv",
    };
  }

  return {
    requested,
    active: "csv",
    dataDir,
    duckdbPath,
    reason: "auto_csv_default",
  };
}

export async function getDataBackendStatus(): Promise<DataBackendStatus> {
  if (!backendStatusCache) {
    backendStatusCache = resolveStatus();
  }
  const status = await backendStatusCache;
  return { ...status };
}

export async function ensureDataBackendReady(context: string): Promise<DataBackendStatus> {
  const status = await getDataBackendStatus();
  const needsWarning = status.reason.includes("fallback_csv");

  if (needsWarning && warnedBackendMessage !== status.reason) {
    warnedBackendMessage = status.reason;
    console.warn(
      `[data-backend] ${context}: requested=${status.requested}, active=${status.active}, reason=${status.reason}`
    );
  }

  return status;
}

export async function ensureCsvBackendReady(context: string): Promise<DataBackendStatus> {
  return ensureDataBackendReady(context);
}

export function clearDataBackendCache(): void {
  backendStatusCache = null;
  warnedBackendMessage = null;
}
