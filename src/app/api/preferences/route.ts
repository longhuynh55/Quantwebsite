import fsPromises from "fs/promises";
import { existsSync, statSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  applyPreferencesPatch,
  createDefaultPreferences,
  normalizePreferencesUser,
  resolvePreferencesScope,
  type PreferencesResponse,
  type PreferencesScope,
  type UserPreferences,
} from "@/lib/preferencesContract";

export const runtime = "nodejs";

interface StoredPreferencesFile {
  scope: PreferencesScope;
  user: string;
  updatedAt: string;
  preferences: UserPreferences;
}

interface ReadPreferencesResult {
  exists: boolean;
  updatedAt: string | null;
  preferences: UserPreferences;
}

const preferencesWriteLocks = new Map<string, Promise<void>>();

function getStorageDir(): string {
  const configured = process.env.PREFERENCES_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  const legacyRoot = path.join(process.cwd(), "tmp");
  try {
    if (!existsSync(legacyRoot) || statSync(legacyRoot).isDirectory()) {
      return path.join(legacyRoot, "preferences");
    }
  } catch {
    return path.join(process.cwd(), ".tmp", "preferences");
  }
  // The repository has a root-level file named "tmp"; avoid ENOTDIR by falling back.
  return path.join(process.cwd(), ".tmp", "preferences");
}

function getDefaultScope(): PreferencesScope {
  return process.env.NODE_ENV === "development" ? "dev" : "local";
}

function buildStoragePath(scope: PreferencesScope, user: string): string {
  const safeScope = resolvePreferencesScope(scope, getDefaultScope());
  const safeUser = normalizePreferencesUser(user);
  return path.join(getStorageDir(), `${safeScope}__${safeUser}.json`);
}

function buildWriteLockKey(scope: PreferencesScope, user: string): string {
  return `${resolvePreferencesScope(scope, getDefaultScope())}::${normalizePreferencesUser(user)}`;
}

function buildTempFilePath(filePath: string): string {
  return `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2, 10)}.tmp`;
}

async function withPreferencesWriteLock<T>(
  scope: PreferencesScope,
  user: string,
  operation: () => Promise<T>
): Promise<T> {
  const lockKey = buildWriteLockKey(scope, user);
  const previous = preferencesWriteLocks.get(lockKey) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => current);
  preferencesWriteLocks.set(lockKey, queued);

  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    releaseCurrent();
    if (preferencesWriteLocks.get(lockKey) === queued) {
      preferencesWriteLocks.delete(lockKey);
    }
  }
}

function buildResponse(
  scope: PreferencesScope,
  user: string,
  result: ReadPreferencesResult
): PreferencesResponse {
  return {
    scope,
    user,
    preferences: result.preferences,
    meta: {
      exists: result.exists,
      updatedAt: result.updatedAt,
    },
  };
}

async function readStoredPreferences(scope: PreferencesScope, user: string): Promise<ReadPreferencesResult> {
  const filePath = buildStoragePath(scope, user);
  try {
    const raw = await fsPromises.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredPreferencesFile> & Record<string, unknown>;
    const patchSource = Object.prototype.hasOwnProperty.call(parsed, "preferences")
      ? parsed.preferences
      : parsed;
    const sanitized = applyPreferencesPatch(createDefaultPreferences(), patchSource);
    const updatedAtRaw = typeof parsed.updatedAt === "string" ? parsed.updatedAt : null;
    const updatedAt = updatedAtRaw && Number.isFinite(new Date(updatedAtRaw).getTime())
      ? new Date(updatedAtRaw).toISOString()
      : null;

    return {
      exists: true,
      updatedAt,
      preferences: sanitized,
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        exists: false,
        updatedAt: null,
        preferences: createDefaultPreferences(),
      };
    }
    throw error;
  }
}

async function writeStoredPreferences(
  scope: PreferencesScope,
  user: string,
  preferences: UserPreferences
): Promise<ReadPreferencesResult> {
  const filePath = buildStoragePath(scope, user);
  const now = new Date().toISOString();
  const payload: StoredPreferencesFile = {
    scope,
    user,
    updatedAt: now,
    preferences,
  };

  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = buildTempFilePath(filePath);
  await fsPromises.writeFile(tempPath, JSON.stringify(payload, null, 2), "utf8");
  try {
    await fsPromises.rename(tempPath, filePath);
  } catch (error) {
    await fsPromises.unlink(tempPath).catch(() => undefined);
    throw error;
  }

  return {
    exists: true,
    updatedAt: now,
    preferences,
  };
}

function parseScopeAndUser(request: Request): { scope: PreferencesScope; user: string } {
  const { searchParams } = new URL(request.url);
  const scope = resolvePreferencesScope(searchParams.get("scope"), getDefaultScope());
  const user = normalizePreferencesUser(searchParams.get("user"));
  return { scope, user };
}

export async function GET(request: Request) {
  try {
    const { scope, user } = parseScopeAndUser(request);
    const result = await readStoredPreferences(scope, user);
    return NextResponse.json(buildResponse(scope, user, result));
  } catch (error) {
    console.error("Failed to load preferences:", error);
    return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const { scope, user } = parseScopeAndUser(request);
    const result = await withPreferencesWriteLock(scope, user, async () => {
      const current = await readStoredPreferences(scope, user);
      const next = applyPreferencesPatch(current.preferences, body);
      return writeStoredPreferences(scope, user, next);
    });
    return NextResponse.json(buildResponse(scope, user, result));
  } catch (error) {
    console.error("Failed to save preferences:", error);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }
}
