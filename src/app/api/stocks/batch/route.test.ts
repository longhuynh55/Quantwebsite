/** @jest-environment node */

const mockLoadOHLCVForSymbols = jest.fn();
const mockGetDatasetLoadStatus = jest.fn();
const mockCheckRateLimit = jest.fn();
const mockCreateRateLimitKey = jest.fn();
const mockGetClientIdentifier = jest.fn();

jest.mock("@/lib/data", () => ({
  loadOHLCVForSymbols: (...args: unknown[]) => mockLoadOHLCVForSymbols(...args),
  getDatasetLoadStatus: (...args: unknown[]) => mockGetDatasetLoadStatus(...args),
}));

jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  createRateLimitKey: (...args: unknown[]) => mockCreateRateLimitKey(...args),
  getClientIdentifier: (...args: unknown[]) => mockGetClientIdentifier(...args),
}));

import { GET } from "./route";

describe("GET /api/stocks/batch", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockCreateRateLimitKey.mockReturnValue("stocks:batch:test");
    mockGetClientIdentifier.mockReturnValue("client-test");
    mockCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 99,
      resetTime: Date.now() + 60_000,
    });
    mockGetDatasetLoadStatus.mockReturnValue({
      dataset: "ohlcv",
      status: "unknown",
      updatedAt: new Date(),
    });
  });

  it("returns 400 when symbols are missing", async () => {
    const response = await GET(new Request("http://localhost/api/stocks/batch") as Request);

    expect(response.status).toBe(400);
  });

  it("returns 503 when dataset status is error and no data returned", async () => {
    mockLoadOHLCVForSymbols.mockResolvedValue(new Map());
    mockGetDatasetLoadStatus.mockReturnValue({
      dataset: "ohlcv",
      status: "error",
      reason: "missing_file",
      message: "ohlcv source missing",
      updatedAt: new Date(),
    });

    const response = await GET(
      new Request("http://localhost/api/stocks/batch?symbols=VNM,VCB&limit=5") as Request
    );

    expect(response.status).toBe(503);
    const json = (await response.json()) as { dataFailureReason?: string };
    expect(json.dataFailureReason).toBe("missing_file");
  });

  it("returns data per symbol on success", async () => {
    const now = new Date("2026-01-02T00:00:00.000Z");
    mockLoadOHLCVForSymbols.mockResolvedValue(
      new Map([
        [
          "VNM",
          [
            { symbol: "VNM", date: now, open: 1, high: 2, low: 1, close: 2, volume: 100 },
            { symbol: "VNM", date: now, open: 2, high: 3, low: 2, close: 3, volume: 200 },
          ],
        ],
        ["VCB", []],
      ])
    );

    const response = await GET(
      new Request("http://localhost/api/stocks/batch?symbols=VNM,VCB&limit=1") as Request
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { data: Record<string, unknown[]> };
    expect(json.data.VNM).toHaveLength(1);
    expect(json.data.VCB).toHaveLength(0);
  });
});
