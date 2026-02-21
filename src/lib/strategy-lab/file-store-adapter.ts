import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import type { StrategyLabStoreAdapter, StrategyLabStoreSnapshot } from "@/lib/strategy-lab/store";

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function parseSnapshot(raw: string): StrategyLabStoreSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as StrategyLabStoreSnapshot;
    if (!parsed || parsed.version !== 1) return null;
    if (!parsed.counters || !Array.isArray(parsed.runs) || !Array.isArray(parsed.jobs) || !Array.isArray(parsed.results) || !Array.isArray(parsed.eventsByRunId)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function createStrategyLabFileStoreAdapter(filePath: string): StrategyLabStoreAdapter {
  const resolvedPath = path.resolve(filePath);
  const tempPath = `${resolvedPath}.tmp`;

  return {
    name: `file:${resolvedPath}`,
    loadSnapshot: () => {
      if (!existsSync(resolvedPath)) return null;
      const raw = readFileSync(resolvedPath, "utf-8");
      return parseSnapshot(raw);
    },
    persistSnapshot: (snapshot) => {
      ensureDir(resolvedPath);
      const payload = JSON.stringify(snapshot);
      writeFileSync(tempPath, payload, "utf-8");
      renameSync(tempPath, resolvedPath);
    },
    clearSnapshot: () => {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
      if (existsSync(resolvedPath)) {
        unlinkSync(resolvedPath);
      }
    },
  };
}
