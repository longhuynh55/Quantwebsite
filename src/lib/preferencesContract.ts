export type PreferencesScope = "local" | "dev";

export interface ScreenerPresetFilters {
  status: string;
  listingPhase: "HOSE";
  minAvgVolume: string;
  maxAvgVolume: string;
  minTradingDays: string;
  maxTradingDays: string;
  industry: string;
  sortBy: "symbol" | "status" | "avgVolume" | "totalTradingDays" | "listingPhase" | "icbName4";
  sortDir: "asc" | "desc";
  pageSize: number;
}

export interface ScreenerPreset {
  id: string;
  name: string;
  search: string;
  filters: ScreenerPresetFilters;
  createdAt: string;
}

export interface UserPreferences {
  presets: ScreenerPreset[];
  watchlistSymbols: string[];
}

export interface PreferencesMeta {
  exists: boolean;
  updatedAt: string | null;
}

export interface PreferencesResponse {
  scope: PreferencesScope;
  user: string;
  preferences: UserPreferences;
  meta: PreferencesMeta;
}

export const MAX_PRESETS = 12;
export const MAX_WATCHLIST_SYMBOLS = 50;
const MAX_SYMBOL_LENGTH = 10;
const MAX_USER_LENGTH = 40;
const MAX_TEXT_LENGTH = 120;
const DEFAULT_PAGE_SIZE = 50;

const SORT_BY_VALUES = new Set<ScreenerPresetFilters["sortBy"]>([
  "symbol",
  "status",
  "avgVolume",
  "totalTradingDays",
  "listingPhase",
  "icbName4",
]);
const SORT_DIR_VALUES = new Set<ScreenerPresetFilters["sortDir"]>(["asc", "desc"]);

export function createDefaultPreferences(): UserPreferences {
  return {
    presets: [],
    watchlistSymbols: [],
  };
}

export function resolvePreferencesScope(
  raw: string | null | undefined,
  fallback: PreferencesScope = "local"
): PreferencesScope {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "dev") return "dev";
  if (value === "local") return "local";
  return fallback;
}

export function normalizePreferencesUser(raw: string | null | undefined): string {
  const value = String(raw ?? "local")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, MAX_USER_LENGTH);
  return value || "local";
}

export function normalizeSymbol(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, MAX_SYMBOL_LENGTH);
}

export function sanitizeWatchlistSymbols(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    const symbol = normalizeSymbol(item);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    normalized.push(symbol);
    if (normalized.length >= MAX_WATCHLIST_SYMBOLS) break;
  }
  return normalized;
}

export function sanitizeScreenerPresets(input: unknown): ScreenerPreset[] {
  if (!Array.isArray(input)) return [];
  const sanitized: ScreenerPreset[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const item = input[index];
    const preset = sanitizeSinglePreset(item, index);
    if (!preset) continue;
    sanitized.push(preset);
    if (sanitized.length >= MAX_PRESETS) break;
  }
  return sanitized;
}

export function applyPreferencesPatch(current: UserPreferences, patch: unknown): UserPreferences {
  const record = asRecord(patch);
  const next: UserPreferences = {
    presets: current.presets,
    watchlistSymbols: current.watchlistSymbols,
  };

  if (Object.prototype.hasOwnProperty.call(record, "presets")) {
    next.presets = sanitizeScreenerPresets(record.presets);
  }

  if (Object.prototype.hasOwnProperty.call(record, "watchlistSymbols")) {
    next.watchlistSymbols = sanitizeWatchlistSymbols(record.watchlistSymbols);
  }

  return next;
}

function sanitizeSinglePreset(input: unknown, index: number): ScreenerPreset | null {
  const record = asRecord(input);
  const name = normalizeText(record.name, 80);
  if (!name) return null;

  const filtersRecord = asRecord(record.filters);
  const sortByRaw = normalizeText(filtersRecord.sortBy, 40);
  const sortDirRaw = normalizeText(filtersRecord.sortDir, 40).toLowerCase();

  const sortBy: ScreenerPresetFilters["sortBy"] = SORT_BY_VALUES.has(sortByRaw as ScreenerPresetFilters["sortBy"])
    ? (sortByRaw as ScreenerPresetFilters["sortBy"])
    : "symbol";
  const sortDir: ScreenerPresetFilters["sortDir"] = SORT_DIR_VALUES.has(sortDirRaw as ScreenerPresetFilters["sortDir"])
    ? (sortDirRaw as ScreenerPresetFilters["sortDir"])
    : "asc";

  const filters: ScreenerPresetFilters = {
    status: normalizeText(filtersRecord.status, 30),
    listingPhase: "HOSE",
    minAvgVolume: normalizeText(filtersRecord.minAvgVolume, 20),
    maxAvgVolume: normalizeText(filtersRecord.maxAvgVolume, 20),
    minTradingDays: normalizeText(filtersRecord.minTradingDays, 20),
    maxTradingDays: normalizeText(filtersRecord.maxTradingDays, 20),
    industry: normalizeText(filtersRecord.industry, 80),
    sortBy,
    sortDir,
    pageSize: normalizePositiveInteger(filtersRecord.pageSize, DEFAULT_PAGE_SIZE, 1, 200),
  };

  const id = normalizeText(record.id, 80) || createFallbackPresetId(index);
  const createdAt = normalizeIsoDate(record.createdAt);

  return {
    id,
    name,
    search: normalizeText(record.search, MAX_TEXT_LENGTH),
    filters,
    createdAt,
  };
}

function asRecord(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

function normalizeText(input: unknown, maxLength: number): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, maxLength);
}

function normalizePositiveInteger(input: unknown, fallback: number, min: number, max: number): number {
  const value = typeof input === "number" ? input : Number(String(input ?? "").trim());
  if (!Number.isFinite(value)) return fallback;
  const parsed = Math.trunc(value);
  if (parsed < min || parsed > max) return fallback;
  return parsed;
}

function normalizeIsoDate(input: unknown): string {
  if (typeof input === "string") {
    const parsed = new Date(input);
    if (Number.isFinite(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

function createFallbackPresetId(index: number): string {
  return `preset-${Date.now()}-${index}`;
}
