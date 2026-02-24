/** @jest-environment node */

jest.mock("@/lib/data", () => ({
  loadStockMetadata: jest.fn(),
  loadOHLCVData: jest.fn(),
  loadIndexData: jest.fn(),
}));

jest.mock("@/lib/dataDir", () => ({
  __esModule: true,
  resolveDataDir: jest.fn(() => ({ path: "/mock-data", source: "env" })),
}));

import { GET } from "./route";
import { loadStockMetadata, loadOHLCVData, loadIndexData } from "@/lib/data";
import { resolveDataDir } from "@/lib/dataDir";

type MockFn<T extends (...args: never[]) => unknown> = jest.MockedFunction<T>;

describe("GET /api/data", () => {
  const mockedLoadStockMetadata = loadStockMetadata as MockFn<typeof loadStockMetadata>;
  const mockedLoadOHLCVData = loadOHLCVData as MockFn<typeof loadOHLCVData>;
  const mockedLoadIndexData = loadIndexData as MockFn<typeof loadIndexData>;
  const mockedResolveDataDir = resolveDataDir as MockFn<typeof resolveDataDir>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolveDataDir.mockReturnValue({ path: "/mock-data", source: "env" });
  });

  it("returns stats payload", async () => {
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
        avgVolume: 100,
        listingPhase: "LISTED",
      },
    ]);

    mockedLoadOHLCVData.mockResolvedValue(
      new Map([
        [
          "VNM",
          [
            {
              symbol: "VNM",
              date: new Date("2024-01-01"),
              open: 1,
              high: 2,
              low: 1,
              close: 2,
              volume: 100,
            },
          ],
        ],
      ])
    );

    mockedLoadIndexData.mockResolvedValue([
      {
        symbol: "VNINDEX",
        date: new Date("2024-01-01"),
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 1,
      },
    ]);

    const response = await GET(new Request("http://localhost/api/data?action=stats"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      stocks: 1,
      ohlcvRecords: 1,
      indices: 1,
      dataDir: "/mock-data",
      available: true,
    });
  });

  it("returns latest prices", async () => {
    mockedLoadOHLCVData.mockResolvedValue(
      new Map([
        [
          "VNM",
          [
            {
              symbol: "VNM",
              date: new Date("2024-01-01"),
              open: 10,
              high: 10,
              low: 9,
              close: 10,
              volume: 1,
            },
            {
              symbol: "VNM",
              date: new Date("2024-01-02"),
              open: 11,
              high: 11,
              low: 10,
              close: 11,
              volume: 2,
            },
          ],
        ],
      ])
    );

    const response = await GET(new Request("http://localhost/api/data?action=latest"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.count).toBe(1);
    expect(json.prices[0]).toEqual(
      expect.objectContaining({
        symbol: "VNM",
        close: 11,
        volume: 2,
        date: "2024-01-02",
      })
    );
  });

  it("returns 400 for invalid action", async () => {
    const response = await GET(new Request("http://localhost/api/data?action=unknown"));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid action");
  });

  it("returns search results for matching symbol", async () => {
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
        avgVolume: 100,
        listingPhase: "LISTED",
      },
      {
        symbol: "FPT",
        exchange: "HOSE",
        status: "ACTIVE",
        dataRows: 2,
        source: "csv",
        firstDate: new Date("2024-01-01"),
        lastDate: new Date("2024-01-02"),
        totalTradingDays: 2,
        avgVolume: 100,
        listingPhase: "LISTED",
      },
    ]);

    const response = await GET(new Request("http://localhost/api/data?action=search&q=vn"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.count).toBe(1);
    expect(json.results[0].symbol).toBe("VNM");
  });
});
