import { NextResponse } from "next/server";
import { loadIndexData, loadOHLCVData, loadStockMetadata, type OHLCV } from "@/lib/data";
import { loadRuntimeDataManifest } from "@/lib/dataManifest";
import { toDateKey } from "@/lib/dataPolicy";
import { resolveDataDir } from "@/lib/dataDir";
import { isLowMemoryModeEnabled } from "@/lib/runtimeMode";
import { ensureDataBackendReady } from "@/lib/dataBackend";
import { queryDuckDbRows } from "@/lib/duckdbClient";

type DataAction = "stats" | "stocks" | "latest" | "gainers" | "losers" | "search";

function normalizeAction(raw: string | null): DataAction | null {
  const value = String(raw ?? "stats").trim().toLowerCase();
  if (["stats", "stocks", "latest", "gainers", "losers", "search"].includes(value)) {
    return value as DataAction;
  }
  return null;
}

function toLatestPrice(symbol: string, row: OHLCV) {
  return {
    symbol,
    close: row.close,
    volume: row.volume,
    date: toDateKey(row.date),
  };
}

function computeMovers(ohlcvBySymbol: Map<string, OHLCV[]>) {
  const movers: Array<{ symbol: string; close: number; volume: number; date: string; change_percent: number }> = [];

  for (const [symbol, rows] of ohlcvBySymbol.entries()) {
    if (!rows || rows.length < 2) continue;
    const latest = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (!Number.isFinite(prev.close) || prev.close === 0) continue;

    movers.push({
      symbol,
      close: latest.close,
      volume: latest.volume,
      date: toDateKey(latest.date),
      change_percent: ((latest.close - prev.close) / prev.close) * 100,
    });
  }

  return movers;
}

function normalizeDuckDbNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeDuckDbDateKey(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toDateKey(value);
  const text = String(value ?? "").trim();
  if (!text) return null;
  const candidate = text.length >= 10 ? text.slice(0, 10) : text;
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = normalizeAction(searchParams.get("action"));

  if (!action) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const backend = await ensureDataBackendReady("api/data");
    const lowMemoryMode = isLowMemoryModeEnabled();

    switch (action) {
      case "stats": {
        const [stocks, indices, manifest] = await Promise.all([
          loadStockMetadata(),
          loadIndexData(),
          loadRuntimeDataManifest(),
        ]);

        let ohlcvRecords = 0;
        const manifestRows = manifest?.datasets?.ohlcv?.acceptedRows;
        if (backend.active === "duckdb") {
          ohlcvRecords = Number.isFinite(manifestRows) ? Number(manifestRows) : 0;
        } else if (lowMemoryMode) {
          ohlcvRecords = Number.isFinite(manifestRows) ? Number(manifestRows) : 0;
        } else {
          const ohlcv = await loadOHLCVData();
          for (const rows of ohlcv.values()) ohlcvRecords += rows.length;
        }

        const available = stocks.length > 0 || ohlcvRecords > 0 || indices.length > 0;
        return NextResponse.json({
          stocks: stocks.length,
          ohlcvRecords,
          indices: indices.length,
          dataDir: resolveDataDir().path,
          available,
          degradedMode: lowMemoryMode ? "low_memory" : undefined,
        });
      }

      case "stocks": {
        const stocks = await loadStockMetadata();
        return NextResponse.json({ stocks, count: stocks.length });
      }

      case "latest": {
        if (lowMemoryMode) {
          return NextResponse.json(
            { error: "latest action is disabled in low-memory mode" },
            { status: 503 }
          );
        }

        if (backend.active === "duckdb") {
          const probe = await queryDuckDbRows(backend.duckdbPath, "SELECT 1 AS ok FROM ohlcv LIMIT 1");
          if (probe.length === 0) {
            return NextResponse.json({ error: "OHLCV dataset unavailable (duckdb table ohlcv is empty)." }, { status: 503 });
          }

          const rows = await queryDuckDbRows(
            backend.duckdbPath,
            `
              WITH base AS (
                SELECT
                  symbol,
                  try_cast(date AS DATE) AS date,
                  try_cast(close AS DOUBLE) AS close,
                  try_cast(volume AS DOUBLE) AS volume,
                  row_number() OVER (PARTITION BY symbol ORDER BY try_cast(date AS DATE) DESC) AS rn
                FROM ohlcv
              )
              SELECT symbol, date, close, volume
              FROM base
              WHERE rn = 1
            `,
            []
          );

          const prices = rows
            .map((raw) => {
              const symbol = String(raw?.symbol ?? "").trim().toUpperCase();
              const date = normalizeDuckDbDateKey(raw?.date);
              const close = normalizeDuckDbNumber(raw?.close);
              const volume = normalizeDuckDbNumber(raw?.volume);
              if (!symbol || !date || close === null || volume === null) return null;
              return { symbol, close, volume, date };
            })
            .filter(Boolean)
            .sort((a, b) => (a?.symbol ?? "").localeCompare(b?.symbol ?? ""));

          return NextResponse.json({ prices, count: prices.length });
        }

        const ohlcv = await loadOHLCVData();
        const prices = Array.from(ohlcv.entries())
          .filter(([, rows]) => rows.length > 0)
          .map(([symbol, rows]) => toLatestPrice(symbol, rows[rows.length - 1]))
          .sort((a, b) => a.symbol.localeCompare(b.symbol));

        return NextResponse.json({ prices, count: prices.length });
      }

      case "gainers": {
        if (lowMemoryMode) {
          return NextResponse.json(
            { error: "gainers action is disabled in low-memory mode" },
            { status: 503 }
          );
        }

        if (backend.active === "duckdb") {
          const probe = await queryDuckDbRows(backend.duckdbPath, "SELECT 1 AS ok FROM ohlcv LIMIT 1");
          if (probe.length === 0) {
            return NextResponse.json({ error: "OHLCV dataset unavailable (duckdb table ohlcv is empty)." }, { status: 503 });
          }

          const rows = await queryDuckDbRows(
            backend.duckdbPath,
            `
              WITH base AS (
                SELECT
                  symbol,
                  try_cast(date AS DATE) AS date,
                  try_cast(close AS DOUBLE) AS close,
                  lag(try_cast(close AS DOUBLE)) OVER (PARTITION BY symbol ORDER BY try_cast(date AS DATE)) AS prev_close,
                  row_number() OVER (PARTITION BY symbol ORDER BY try_cast(date AS DATE) DESC) AS rn
                FROM ohlcv
              )
              SELECT symbol, date, close, prev_close
              FROM base
              WHERE rn = 1
            `,
            []
          );

          const movers = rows
            .map((raw) => {
              const symbol = String(raw?.symbol ?? "").trim().toUpperCase();
              const date = normalizeDuckDbDateKey(raw?.date);
              const close = normalizeDuckDbNumber(raw?.close);
              const prevClose = normalizeDuckDbNumber(raw?.prev_close);
              if (!symbol || !date || close === null || prevClose === null || prevClose === 0) return null;
              return { symbol, close, volume: 0, date, change_percent: ((close - prevClose) / prevClose) * 100 };
            })
            .filter(Boolean)
            .sort((a, b) => (b?.change_percent ?? 0) - (a?.change_percent ?? 0))
            .slice(0, 20);

          return NextResponse.json({ gainers: movers, count: movers.length });
        }

        const movers = computeMovers(await loadOHLCVData())
          .sort((a, b) => b.change_percent - a.change_percent)
          .slice(0, 20);
        return NextResponse.json({ gainers: movers, count: movers.length });
      }

      case "losers": {
        if (lowMemoryMode) {
          return NextResponse.json(
            { error: "losers action is disabled in low-memory mode" },
            { status: 503 }
          );
        }

        if (backend.active === "duckdb") {
          const probe = await queryDuckDbRows(backend.duckdbPath, "SELECT 1 AS ok FROM ohlcv LIMIT 1");
          if (probe.length === 0) {
            return NextResponse.json({ error: "OHLCV dataset unavailable (duckdb table ohlcv is empty)." }, { status: 503 });
          }

          const rows = await queryDuckDbRows(
            backend.duckdbPath,
            `
              WITH base AS (
                SELECT
                  symbol,
                  try_cast(date AS DATE) AS date,
                  try_cast(close AS DOUBLE) AS close,
                  lag(try_cast(close AS DOUBLE)) OVER (PARTITION BY symbol ORDER BY try_cast(date AS DATE)) AS prev_close,
                  row_number() OVER (PARTITION BY symbol ORDER BY try_cast(date AS DATE) DESC) AS rn
                FROM ohlcv
              )
              SELECT symbol, date, close, prev_close
              FROM base
              WHERE rn = 1
            `,
            []
          );

          const movers = rows
            .map((raw) => {
              const symbol = String(raw?.symbol ?? "").trim().toUpperCase();
              const date = normalizeDuckDbDateKey(raw?.date);
              const close = normalizeDuckDbNumber(raw?.close);
              const prevClose = normalizeDuckDbNumber(raw?.prev_close);
              if (!symbol || !date || close === null || prevClose === null || prevClose === 0) return null;
              return { symbol, close, volume: 0, date, change_percent: ((close - prevClose) / prevClose) * 100 };
            })
            .filter(Boolean)
            .sort((a, b) => (a?.change_percent ?? 0) - (b?.change_percent ?? 0))
            .slice(0, 20);

          return NextResponse.json({ losers: movers, count: movers.length });
        }

        const movers = computeMovers(await loadOHLCVData())
          .sort((a, b) => a.change_percent - b.change_percent)
          .slice(0, 20);
        return NextResponse.json({ losers: movers, count: movers.length });
      }

      case "search": {
        const query = String(searchParams.get("q") ?? "").trim().toLowerCase();
        const stocks = await loadStockMetadata();
        if (!query) {
          return NextResponse.json({ results: [], count: 0 });
        }
        const results = stocks.filter((stock) => {
          const symbol = stock.symbol.toLowerCase();
          const organName = String(stock.organName ?? "").toLowerCase();
          return symbol.includes(query) || organName.includes(query);
        });
        return NextResponse.json({ results, count: results.length });
      }
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch data", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
