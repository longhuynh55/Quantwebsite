/** @jest-environment node */

jest.mock("@/lib/data", () => ({
  loadOHLCVForSymbol: jest.fn(),
  loadStockMetadata: jest.fn(),
}));

import { GET } from "./route";
import { loadOHLCVForSymbol, loadStockMetadata } from "@/lib/data";

type MockFn<T extends (...args: never[]) => unknown> = jest.MockedFunction<T>;

describe("GET /api/data/stocks/[symbol]", () => {
  const mockedLoadOHLCVForSymbol = loadOHLCVForSymbol as MockFn<typeof loadOHLCVForSymbol>;
  const mockedLoadStockMetadata = loadStockMetadata as MockFn<typeof loadStockMetadata>;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns stock payload with stats", async () => {
    mockedLoadOHLCVForSymbol.mockResolvedValue([
      {
        symbol: "VNM",
        date: new Date("2024-01-01"),
        open: 10,
        high: 10,
        low: 9,
        close: 10,
        volume: 100,
      },
      {
        symbol: "VNM",
        date: new Date("2024-01-02"),
        open: 11,
        high: 12,
        low: 10,
        close: 12,
        volume: 120,
      },
    ]);

    mockedLoadStockMetadata.mockResolvedValue([
      {
        symbol: "VNM",
        exchange: "HOSE",
        status: "ACTIVE",
        dataRows: 2,
        source: "csv",
        firstDate: new Date("2024-01-01"),
        lastDate: new Date("2024-01-02"),
        totalTradingDays: 2,
        avgVolume: 110,
        listingPhase: "LISTED",
        icbName3: "Consumer",
        icbName4: "Food",
      },
    ]);

    const response = await GET(new Request("http://localhost/api/data/stocks/VNM"), {
      params: Promise.resolve({ symbol: "VNM" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.symbol).toBe("VNM");
    expect(json.count).toBe(2);
    expect(json.stats).toEqual(
      expect.objectContaining({
        latest_price: 12,
        latest_date: "2024-01-02",
        latest_volume: 120,
        sector: "Consumer",
        industry: "Food",
      })
    );
  });

  it("returns 404 when stock does not exist", async () => {
    mockedLoadOHLCVForSymbol.mockResolvedValue([]);
    mockedLoadStockMetadata.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/data/stocks/MISSING"), {
      params: Promise.resolve({ symbol: "MISSING" }),
    });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Stock not found");
  });
});