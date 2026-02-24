"use client";

export interface StockOhlcvRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StocksSymbolResponse {
  error?: string;
  data?: StockOhlcvRow[];
}

interface StocksBatchResponse {
  error?: string;
  data?: Record<string, StockOhlcvRow[]>;
}

export interface MarketOverviewResponse {
  error?: string;
  benchmark?: string;
  currentIndex?: number;
  mtdReturn?: number;
  totalStocks?: number;
  avgVolume?: number;
  eligibleStocks?: number;
  excludedStaleCount?: number;
  excludedInactiveCount?: number;
  excludedMissingAsOfCount?: number;
  excludedMissingPrevCount?: number;
  degradedMode?: string;
  topGainers?: Array<{ symbol?: string; change?: number }>;
  topLosers?: Array<{ symbol?: string; change?: number }>;
  marketTrend?: Array<{ date?: string; value?: number }>;
}

export interface HealthDataProbeResponse {
  ok?: boolean;
  degradedMode?: string;
  backend?: {
    active?: "csv" | "duckdb";
  };
}

function asErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  if (!("error" in payload)) return null;
  const value = (payload as { error?: unknown }).error;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  const payloadError = asErrorMessage(payload);

  if (!response.ok) {
    throw new Error(payloadError ?? `HTTP ${response.status}`);
  }
  if (payloadError) {
    throw new Error(payloadError);
  }

  return payload as T;
}

export async function fetchStockSeries(
  symbol: string,
  limit: number,
  signal?: AbortSignal
): Promise<StockOhlcvRow[]> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) return [];

  const response = await fetchJson<StocksSymbolResponse>(
    `/api/stocks?symbol=${encodeURIComponent(normalizedSymbol)}&limit=${encodeURIComponent(String(limit))}`,
    signal
  );
  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchStockSeriesBatch(
  symbols: string[],
  limit: number,
  signal?: AbortSignal
): Promise<Record<string, StockOhlcvRow[]>> {
  const normalized = Array.from(
    new Set(
      symbols
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 30)
    )
  );

  if (normalized.length === 0) return {};

  const response = await fetchJson<StocksBatchResponse>(
    `/api/stocks/batch?symbols=${encodeURIComponent(normalized.join(","))}&limit=${encodeURIComponent(String(limit))}`,
    signal
  );
  return response.data && typeof response.data === "object" ? response.data : {};
}

export function normalizePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.abs(value) <= 1.5 ? value * 100 : value;
}

export function toNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
