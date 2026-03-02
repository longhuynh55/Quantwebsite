import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import type { StrategyLabStoreAdapter, StrategyLabStoreSnapshot } from "@/lib/strategy-lab/store";

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidCounters(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.runCounter === "number" &&
    Number.isFinite(value.runCounter) &&
    typeof value.jobCounter === "number" &&
    Number.isFinite(value.jobCounter) &&
    typeof value.eventCounter === "number" &&
    Number.isFinite(value.eventCounter)
  );
}

function isValidRunRecordShape(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.runId !== "string" || typeof value.jobId !== "string") return false;
  if (!isRecord(value.input)) return false;
  if (!isRecord(value.input.params) || !isRecord(value.input.config)) return false;
  return true;
}

function isValidJobRecordShape(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.jobId === "string" &&
    typeof value.runId === "string" &&
    typeof value.status === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isValidResultRecordShape(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.runId === "string" &&
    typeof value.symbol === "string" &&
    typeof value.strategyType === "string" &&
    typeof value.strategyName === "string" &&
    typeof value.generatedAt === "string" &&
    isRecord(value.result) &&
    isRecord(value.reproMetadata) &&
    isRecord(value.antiBiasSignals)
  );
}

function isValidEventEntryShape(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.runId === "string" && Array.isArray(value.events);
}

function isValidSnapshot(value: unknown): value is StrategyLabStoreSnapshot {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (!isValidCounters(value.counters)) return false;
  if (!Array.isArray(value.runs) || !value.runs.every(isValidRunRecordShape)) return false;
  if (!Array.isArray(value.jobs) || !value.jobs.every(isValidJobRecordShape)) return false;
  if (!Array.isArray(value.results) || !value.results.every(isValidResultRecordShape)) return false;
  if (!Array.isArray(value.eventsByRunId) || !value.eventsByRunId.every(isValidEventEntryShape)) return false;
  return true;
}

function parseSnapshot(raw: string): StrategyLabStoreSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isValidSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function makeTempPath(filePath: string): string {
  return `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2, 10)}.tmp`;
}

function listTempSnapshotPaths(filePath: string): string[] {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) return [];
  const fileName = path.basename(filePath);
  return readdirSync(dir)
    .filter((entry) => entry === `${fileName}.tmp` || (entry.startsWith(`${fileName}.`) && entry.endsWith(".tmp")))
    .map((entry) => path.join(dir, entry));
}

export function createStrategyLabFileStoreAdapter(filePath: string): StrategyLabStoreAdapter {
  const resolvedPath = path.resolve(filePath);

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
      const tempPath = makeTempPath(resolvedPath);
      writeFileSync(tempPath, payload, "utf-8");
      renameSync(tempPath, resolvedPath);
    },
    clearSnapshot: () => {
      for (const tempPath of listTempSnapshotPaths(resolvedPath)) {
        try {
          if (existsSync(tempPath)) {
            unlinkSync(tempPath);
          }
        } catch {
          // Ignore concurrent cleanup races.
        }
      }
      if (existsSync(resolvedPath)) {
        unlinkSync(resolvedPath);
      }
    },
  };
}
