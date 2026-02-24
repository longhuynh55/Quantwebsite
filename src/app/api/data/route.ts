import { NextResponse } from "next/server";
import { loadIndexData, loadOHLCVData, loadStockMetadata, type OHLCV } from "@/lib/data";
import { loadRuntimeDataManifest } from "@/lib/dataManifest";
import { toDateKey } from "@/lib/dataPolicy";
import { resolveDataDir } from "@/lib/dataDir";
import { isLowMemoryModeEnabled } from "@/lib/runtimeMode";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = normalizeAction(searchParams.get("action"));

  if (!action) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const lowMemoryMode = isLowMemoryModeEnabled();

    switch (action) {
      case "stats": {
        const [stocks, indices, manifest] = await Promise.all([
          loadStockMetadata(),
          loadIndexData(),
          loadRuntimeDataManifest(),
        ]);

        let ohlcvRecords = 0;
        if (lowMemoryMode) {
          const manifestRows = manifest?.datasets?.ohlcv?.acceptedRows;
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
