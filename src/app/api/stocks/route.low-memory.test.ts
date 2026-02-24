/** @jest-environment node */

jest.mock("@/lib/data", () => ({
  getDatasetLoadStatus: jest.fn(),
  loadOHLCVData: jest.fn(),
  loadOHLCVForSymbol: jest.fn(),
  loadStockMetadata: jest.fn(),
}));

jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: jest.fn(() => ({
    allowed: true,
    remaining: 99,
    resetTime: Date.now() + 60_000,
  })),
  createRateLimitKey: jest.fn(() => "stocks:test"),
  getClientIdentifier: jest.fn(() => "test-client"),
}));

jest.mock("@/lib/analytics/universe", () => ({
  buildIcbSnapshot: jest.fn(),
  parseFlexibleDate: jest.fn((raw: string | null | undefined) => {
    if (!raw) return null;
    const value = new Date(raw);
    return Number.isNaN(value.getTime()) ? null : value;
  }),
  parseIcbLevel: jest.fn(() => "3"),
}));

import { GET } from "./route";
import { loadOHLCVData, loadStockMetadata } from "@/lib/data";

type MockFn<T extends (...args: never[]) => unknown> = jest.MockedFunction<T>;

function buildMetadata(symbol: string, exchange: string) {
  return {
    symbol,
    exchange,
    status: "ACTIVE",
    dataRows: 100,
    source: "csv",
    firstDate: new Date("2024-01-01"),
    lastDate: new Date("2024-12-31"),
    totalTradingDays: 200,
    avgVolume: 100_000,
    listingPhase: "LISTED",
  };
}

describe("GET /api/stocks low-memory guard", () => {
  const originalEnv = process.env;
  const mockedLoadOHLCVData = loadOHLCVData as MockFn<typeof loadOHLCVData>;
  const mockedLoadStockMetadata = loadStockMetadata as MockFn<typeof loadStockMetadata>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      DATA_BACKEND: "csv",
      DATA_LOW_MEMORY_MODE: "false",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns 503 for market-wide OHLCV snapshots in low-memory mode", async () => {
    mockedLoadStockMetadata.mockResolvedValue([buildMetadata("VNM", "HOSE")]);
    mockedLoadOHLCVData.mockResolvedValue(new Map());

    const response = await GET(
      new Request("http://localhost/api/stocks?exchange=HOSE&date=2024-12-31&limit=5")
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(String(payload.error ?? "")).toContain("disabled in low-memory mode");
    expect(mockedLoadOHLCVData).not.toHaveBeenCalled();
  });

  it("serves exchange-only metadata without loading full OHLCV map", async () => {
    mockedLoadStockMetadata.mockResolvedValue([
      buildMetadata("VNM", "HOSE"),
      buildMetadata("AAA", "HOSE"),
      buildMetadata("BBB", "HNX"),
    ]);
    mockedLoadOHLCVData.mockResolvedValue(new Map());

    const response = await GET(new Request("http://localhost/api/stocks?exchange=HOSE&limit=all"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.total).toBe(2);
    expect(payload.stocks.map((item: { symbol: string }) => item.symbol)).toEqual(["AAA", "VNM"]);
    expect(mockedLoadOHLCVData).not.toHaveBeenCalled();
  });
});
