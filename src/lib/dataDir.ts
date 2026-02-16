import fs from "fs";
import path from "path";

export type DataDirSource = "env" | "public" | "workspace";

export interface DataDirResolution {
  path: string;
  source: DataDirSource;
}

let hasWarnedRawFallback = false;

function parseBooleanEnv(raw: string | undefined, fallback: boolean): boolean {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return fallback;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
}

export function resolveDataDir(): DataDirResolution {
  const configured = process.env.DATA_DIR?.trim();
  if (configured) {
    return { path: path.resolve(configured), source: "env" };
  }

  const runtimeDataDir = path.join(process.cwd(), "public", "data");
  if (fs.existsSync(runtimeDataDir)) {
    return { path: runtimeDataDir, source: "public" };
  }

  const allowRawFallback = parseBooleanEnv(process.env.DATA_ALLOW_RAW_FALLBACK, false);
  const workspaceDataDir = path.resolve(process.cwd(), "..", "data");
  if (allowRawFallback && fs.existsSync(workspaceDataDir)) {
    if (!hasWarnedRawFallback) {
      hasWarnedRawFallback = true;
      console.warn(
        `[data-dir] Falling back to workspace raw data at ${workspaceDataDir}. ` +
        `Set DATA_DIR=/app/public/data or keep prepared runtime files in public/data for stable serving.`
      );
    }
    return { path: workspaceDataDir, source: "workspace" };
  }

  return { path: runtimeDataDir, source: "public" };
}
