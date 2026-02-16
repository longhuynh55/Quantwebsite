import fsPromises from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import { resolveDataDir } from "./dataDir";

export type ManifestDatasetName = "stockMetadata" | "ohlcv" | "index";

interface ManifestDatasetRecord {
  fileName?: string;
  acceptedRows?: number;
  totalRows?: number;
  uniqueSymbols?: number;
}

export interface RuntimeDataManifest {
  schemaVersion: number;
  generatedAt?: string;
  datasets?: Partial<Record<ManifestDatasetName, ManifestDatasetRecord>>;
}

const MANIFEST_FILE_CANDIDATES = [
  "data_manifest_2018_2025.json",
  "data_manifest.json",
];

let manifestCache: RuntimeDataManifest | null | undefined = undefined;
let manifestPathCache: string | null | undefined = undefined;
let warnedInvalidManifest = false;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeDatasetRecord(value: unknown): ManifestDatasetRecord {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  return {
    fileName: typeof source.fileName === "string" ? source.fileName : undefined,
    acceptedRows: toFiniteNumber(source.acceptedRows),
    totalRows: toFiniteNumber(source.totalRows),
    uniqueSymbols: toFiniteNumber(source.uniqueSymbols),
  };
}

function normalizeManifest(value: unknown): RuntimeDataManifest | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const schemaVersion = toFiniteNumber(source.schemaVersion);
  if (!schemaVersion) return null;

  const datasetsRaw = source.datasets;
  const datasetsObj = datasetsRaw && typeof datasetsRaw === "object"
    ? (datasetsRaw as Record<string, unknown>)
    : {};

  return {
    schemaVersion,
    generatedAt: typeof source.generatedAt === "string" ? source.generatedAt : undefined,
    datasets: {
      stockMetadata: normalizeDatasetRecord(datasetsObj.stockMetadata),
      ohlcv: normalizeDatasetRecord(datasetsObj.ohlcv),
      index: normalizeDatasetRecord(datasetsObj.index),
    },
  };
}

async function resolveManifestPath(): Promise<string | null> {
  if (manifestPathCache !== undefined) return manifestPathCache;
  const dataDir = resolveDataDir().path;
  for (const fileName of MANIFEST_FILE_CANDIDATES) {
    const candidate = path.join(dataDir, fileName);
    if (await fileExists(candidate)) {
      manifestPathCache = candidate;
      return candidate;
    }
  }
  manifestPathCache = null;
  return null;
}

export async function loadRuntimeDataManifest(): Promise<RuntimeDataManifest | null> {
  if (manifestCache !== undefined) return manifestCache;

  const manifestPath = await resolveManifestPath();
  if (!manifestPath) {
    manifestCache = null;
    return null;
  }

  try {
    const raw = await fsPromises.readFile(manifestPath, "utf8");
    const parsed = normalizeManifest(JSON.parse(raw));
    if (!parsed) {
      if (!warnedInvalidManifest) {
        warnedInvalidManifest = true;
        console.warn(`[data-manifest] invalid format: ${manifestPath}`);
      }
      manifestCache = null;
      return null;
    }
    manifestCache = parsed;
    return manifestCache;
  } catch (error) {
    if (!warnedInvalidManifest) {
      warnedInvalidManifest = true;
      console.warn(
        `[data-manifest] failed to load: ${manifestPath} (${error instanceof Error ? error.message : String(error)})`
      );
    }
    manifestCache = null;
    return null;
  }
}

export async function getManifestDataset(dataset: ManifestDatasetName): Promise<ManifestDatasetRecord | null> {
  const manifest = await loadRuntimeDataManifest();
  if (!manifest?.datasets) return null;
  return manifest.datasets[dataset] ?? null;
}

export function clearManifestCache(): void {
  manifestCache = undefined;
  manifestPathCache = undefined;
  warnedInvalidManifest = false;
}
