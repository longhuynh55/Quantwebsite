/** @jest-environment node */

import path from "path";
import { GET as stocksGET } from "@/app/api/stocks/route";
import {
  clearCache as clearDataCache,
  loadOHLCVData,
  loadOHLCVForSymbol,
  loadStockMetadata,
  type OHLCV,
} from "@/lib/data";
import { getDataBackendStatus } from "@/lib/dataBackend";
import { toDateKey } from "@/lib/dataPolicy";
import { hasDuckDbNodeBinding } from "@/lib/duckdbClient";

type JsonRecord = Record<string, unknown>;

async function readJson(response: Response): Promise<JsonRecord> {
  return (await response.json()) as JsonRecord;
}

function findAsOfRow(series: OHLCV[], asOfDateKey: string): { row: OHLCV; exactDateMatch: boolean } | null {
  for (let index = series.length - 1; index >= 0; index -= 1) {
    const row = series[index];
    const key = toDateKey(row.date);
    if (key > asOfDateKey) continue;
    return { row, exactDateMatch: key === asOfDateKey };
  }
  return null;
}

function installInternalApiFetchMock() {
  const originalFetch = global.fetch;
  global.fetch = (jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);

    // Only allow mocked internal API calls. If anything tries to call external providers in tests, fail fast.
    const allowedOrigins = new Set(["http://127.0.0.1:3000", "http://localhost", "http://localhost:3000"]);
    if (!allowedOrigins.has(url.origin)) {
      throw new Error(`Unexpected fetch origin in query-fidelity tests: ${url.origin} (${url.href})`);
    }

    if (url.pathname === "/api/stocks") {
      return await stocksGET(request);
    }

    return new Response(JSON.stringify({ error: `Unhandled mocked route: ${url.pathname}` }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }) as unknown) as typeof fetch;

  return () => {
    global.fetch = originalFetch;
  };
}

describe("Assistant Query Fidelity (DuckDB source of truth)", () => {
  const ORIGINAL_ENV = process.env;
  let restoreFetch: (() => void) | null = null;
  let hasDuckdb = false;

  beforeAll(async () => {
    process.env = { ...ORIGINAL_ENV };

    hasDuckdb = await hasDuckDbNodeBinding();
    if (!hasDuckdb) {
      // Local Windows dev may not have the native duckdb binding installed.
      // The suite is meant to run in Docker/CI where the binding is present.
      // Keep a trivial assertion so the suite doesn't silently do nothing.
      expect(hasDuckdb).toBe(false);
      return;
    }

    const dataDir = path.join(process.cwd(), "public", "data");
    process.env.DATA_DIR = dataDir;
    process.env.DATA_BACKEND = "duckdb";
    process.env.DATA_BACKEND_STRICT = "true";
    process.env.DATA_MANIFEST_STRICT = "true";

    // Avoid provider/network calls during assistant tests.
    process.env.ASSISTANT_BASELINE_ONLY = "true";
    process.env.ASSISTANT_TOOL_BASE_URL = "http://127.0.0.1:3000";

    clearDataCache();
    const status = await getDataBackendStatus();
    expect(status.active).toBe("duckdb");

    restoreFetch = installInternalApiFetchMock();
  });

  afterAll(() => {
    if (restoreFetch) restoreFetch();
    process.env = ORIGINAL_ENV;
  });

  it("GET /api/stocks snapshot matches DuckDB OHLCV row (symbol + date)", async () => {
    if (!hasDuckdb) {
      return;
    }
    const symbol = "VNM";
    const date = "2020-01-02";

    const oracleSeries = await loadOHLCVForSymbol(symbol);
    const oracleRow = oracleSeries.find((row) => toDateKey(row.date) === date);
    expect(oracleRow).toBeTruthy();

    const response = await stocksGET(
      new Request(`http://localhost/api/stocks?symbol=${symbol}&date=${date}&limit=1`, {
        method: "GET",
        headers: { "x-trace-id": "test-stocks-snapshot" },
      })
    );
    expect(response.status).toBe(200);
    const json = await readJson(response);

    const data = Array.isArray(json.data) ? (json.data as Array<Record<string, unknown>>) : [];
    expect(String(json.symbol ?? "")).toBe(symbol);
    expect(String(json.asOfDate ?? "")).toBe(date);
    expect(data).toHaveLength(1);
    expect(typeof data[0]?.close).toBe("number");
    expect(typeof data[0]?.volume).toBe("number");

    expect(Number(data[0].close)).toBeCloseTo((oracleRow as OHLCV).close, 6);
    expect(Number(data[0].volume)).toBeCloseTo((oracleRow as OHLCV).volume, 6);
  });

  it("GET /api/stocks series range matches DuckDB-filtered series (symbol + from/to)", async () => {
    if (!hasDuckdb) {
      return;
    }
    const symbol = "VNM";
    const from = "2020-01-02";
    const to = "2020-01-10";

    const oracleSeries = await loadOHLCVForSymbol(symbol);
    const oracleFiltered = oracleSeries.filter((row) => {
      const key = toDateKey(row.date);
      return key >= from && key <= to;
    });
    expect(oracleFiltered.length).toBeGreaterThan(0);

    const response = await stocksGET(
      new Request(`http://localhost/api/stocks?symbol=${symbol}&from=${from}&to=${to}&limit=all`, {
        method: "GET",
        headers: { "x-trace-id": "test-stocks-range" },
      })
    );
    expect(response.status).toBe(200);
    const json = await readJson(response);
    const data = Array.isArray(json.data) ? (json.data as Array<Record<string, unknown>>) : [];

    expect(String(json.symbol ?? "")).toBe(symbol);
    expect(String(json.from ?? "")).toBe(from);
    expect(String(json.to ?? "")).toBe(to);
    expect(data.length).toBe(oracleFiltered.length);
  });

  it("GET /api/stocks universe ranking matches DuckDB oracle (top N by volume)", async () => {
    if (!hasDuckdb) {
      return;
    }
    const date = "2020-01-02";
    const limit = 10;
    const metric = "volume";
    const order: "asc" | "desc" = "desc";

    const universe = (await loadStockMetadata())
      .filter((stock) => String(stock.exchange ?? "").toUpperCase() === "HOSE")
      .filter((stock) => String(stock.status ?? "").toUpperCase() === "ACTIVE");

    // NOTE: This loads the full OHLCV map (heavy) but mirrors how /api/stocks currently serves ranking snapshots.
    const ohlcvMap = await loadOHLCVData();

    const candidates: Array<{ symbol: string; date: string; volume: number }> = [];
    for (const stock of universe) {
      const series = ohlcvMap.get(stock.symbol);
      if (!series || series.length === 0) continue;
      const point = findAsOfRow(series, date);
      if (!point) continue;
      candidates.push({ symbol: stock.symbol, date: toDateKey(point.row.date), volume: point.row.volume });
    }

    candidates.sort((a, b) => {
      const diff = b.volume - a.volume;
      if (diff !== 0) return diff;
      return a.symbol.localeCompare(b.symbol);
    });

    const oracleTop = candidates.slice(0, limit);
    expect(oracleTop.length).toBeGreaterThan(0);

    const response = await stocksGET(
      new Request(`http://localhost/api/stocks?exchange=HOSE&metric=${metric}&order=${order}&date=${date}&limit=${limit}`, {
        method: "GET",
        headers: { "x-trace-id": "test-stocks-ranking" },
      })
    );
    expect(response.status).toBe(200);
    const json = await readJson(response);
    const rows = Array.isArray(json.stocks) ? (json.stocks as Array<Record<string, unknown>>) : [];

    expect(String(json.exchange ?? "")).toBe("HOSE");
    expect(String(json.asOfDate ?? "")).toBe(date);
    expect(rows.length).toBe(limit);

    const apiTopSymbols = rows.map((row) => String(row.symbol ?? ""));
    const oracleTopSymbols = oracleTop.map((row) => row.symbol);
    expect(apiTopSymbols).toEqual(oracleTopSymbols);
  });

  it("POST /api/assistant (baseline-only) uses grounded stock-universe ranking and returns citations", async () => {
    if (!hasDuckdb) {
      return;
    }
    const prompt = "Top 5 co phieu HOSE theo khoi luong ngay 2020-01-02 la gi?";

    // route.ts computes BASELINE_ONLY_MODE at import time, so import only after env is configured in beforeAll.
    const { POST: assistantPOST } = await import("@/app/api/assistant/route");

    const response = await assistantPOST(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          preferences: { detailLevel: "short", language: "vi" },
          contextSnapshot: { page: "screener" },
        }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(200);
    const json = await readJson(response);
    expect(json.success).toBe(true);

    const citations = Array.isArray(json.citations) ? (json.citations as Array<Record<string, unknown>>) : [];
    expect(citations.length).toBeGreaterThan(0);
    expect(
      citations.some((c) => String(c.url ?? "").includes("/api/stocks?exchange=HOSE"))
    ).toBe(true);

    const usedTools = Array.isArray(json.usedTools) ? (json.usedTools as Array<Record<string, unknown>>) : [];
    expect(usedTools.some((t) => String(t.name ?? "") === "stockSnapshot")).toBe(true);
    expect(usedTools.some((t) => String(t.status ?? "") === "success")).toBe(true);
  });
});
