/** @jest-environment node */

const mockLoadOHLCVForSymbol = jest.fn();
const mockLoadIndexData = jest.fn();
const mockHasSufficientDataQuality = jest.fn();
const mockGetDataQualityReport = jest.fn();
const mockGetDatasetLoadStatus = jest.fn();

const mockCalculateRiskMetrics = jest.fn();
const mockCalculateDrawdown = jest.fn();
const mockCalculateRollingVolatility = jest.fn();

const mockCheckRateLimit = jest.fn();
const mockCreateRateLimitKey = jest.fn();
const mockGetClientIdentifier = jest.fn();

jest.mock("@/lib/data", () => ({
  loadOHLCVForSymbol: (...args: unknown[]) => mockLoadOHLCVForSymbol(...args),
  loadIndexData: (...args: unknown[]) => mockLoadIndexData(...args),
  hasSufficientDataQuality: (...args: unknown[]) => mockHasSufficientDataQuality(...args),
  getDataQualityReport: (...args: unknown[]) => mockGetDataQualityReport(...args),
  getDatasetLoadStatus: (...args: unknown[]) => mockGetDatasetLoadStatus(...args),
}));

jest.mock("@/lib/quant/risk", () => ({
  calculateRiskMetrics: (...args: unknown[]) => mockCalculateRiskMetrics(...args),
  calculateDrawdown: (...args: unknown[]) => mockCalculateDrawdown(...args),
  calculateRollingVolatility: (...args: unknown[]) => mockCalculateRollingVolatility(...args),
}));

jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  createRateLimitKey: (...args: unknown[]) => mockCreateRateLimitKey(...args),
  getClientIdentifier: (...args: unknown[]) => mockGetClientIdentifier(...args),
}));

import { GET } from "./route";

type OhlcvPoint = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
};

function buildSeries(symbol: string, points = 40, start = 100): OhlcvPoint[] {
  return Array.from({ length: points }).map((_, index) => {
    const close = start + index;
    return {
      date: new Date(Date.UTC(2025, 0, index + 1)),
      open: close - 1,
      high: close + 1,
      low: close - 2,
      close,
      volume: 1_000_000 + index * 1000,
      symbol,
    };
  });
}

describe("GET /api/risk", () => {
  beforeEach(() => {
    jest.resetAllMocks();

    mockGetClientIdentifier.mockReturnValue("client-test");
    mockCreateRateLimitKey.mockImplementation((scope: string, id: string) => `${scope}:${id}`);
    mockCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 59,
      resetTime: Date.now() + 60_000,
    });

    mockLoadOHLCVForSymbol.mockResolvedValue(buildSeries("VNM", 45, 100));
    mockLoadIndexData.mockResolvedValue(buildSeries("VNINDEX", 45, 120));

    mockCalculateRiskMetrics.mockReturnValue({
      var95: 0.01,
      var99: 0.02,
      cvar95: 0.015,
      cvar99: 0.025,
      downsideDeviation: 0.2,
      sortinoRatio: 0.3,
      tailLossRatio95: 1.1,
      maxDrawdown: 0.12,
      avgDrawdown: 0.04,
      drawdownDuration: 20,
      volatility: 0.22,
      beta: 0.9,
      trackingError: 0.1,
      informationRatio: 0.2,
    });
    mockCalculateDrawdown.mockReturnValue({
      drawdowns: Array.from({ length: 45 }).map(() => ({ drawdown: 0.1, duration: 5 })),
      maxDrawdown: 0.1,
    });
    mockCalculateRollingVolatility.mockReturnValue(Array.from({ length: 44 }).map(() => 0.2));
  });

  it("allows request when OHLCV report is unavailable but load status is not error", async () => {
    mockHasSufficientDataQuality.mockImplementation((dataset: string) => dataset === "index");
    mockGetDataQualityReport.mockImplementation((dataset: string) => {
      if (dataset === "index") {
        return {
          dataset: "index",
          totalRows: 100,
          acceptedRows: 99,
          rejectedRows: 1,
          acceptedRatio: 0.99,
          rejectionReasons: {},
          parseErrorCount: 0,
          generatedAt: new Date(),
        };
      }
      return null;
    });
    mockGetDatasetLoadStatus.mockReturnValue({
      dataset: "ohlcv",
      status: "ok",
      backend: "duckdb",
      source: "duckdb:test:ohlcv",
      updatedAt: new Date(),
    });

    const response = await GET(new Request("http://localhost/api/risk?symbol=VNM&benchmark=VNINDEX"));

    expect(response.status).toBe(200);
    const json = (await response.json()) as { metrics?: Record<string, unknown> };
    expect(json.metrics?.volatility).toBe(0.22);
  });

  it("returns 503 when OHLCV load status is error and report is unavailable", async () => {
    mockHasSufficientDataQuality.mockReturnValue(false);
    mockGetDataQualityReport.mockReturnValue(null);
    mockGetDatasetLoadStatus.mockReturnValue({
      dataset: "ohlcv",
      status: "error",
      reason: "quality_gate_failed",
      message: "Data quality gate failed for ohlcv.",
      backend: "duckdb",
      source: "duckdb:test:ohlcv",
      updatedAt: new Date(),
    });

    const response = await GET(new Request("http://localhost/api/risk?symbol=VNM&benchmark=VNINDEX"));

    expect(response.status).toBe(503);
    const json = (await response.json()) as { error?: string };
    expect(json.error).toContain("Data quality check failed for ohlcv");
  });

  it("returns 503 when index report is unavailable", async () => {
    mockHasSufficientDataQuality.mockImplementation((dataset: string) => dataset === "ohlcv");
    mockGetDataQualityReport.mockReturnValue(null);
    mockGetDatasetLoadStatus.mockReturnValue({
      dataset: "index",
      status: "ok",
      backend: "duckdb",
      source: "duckdb:test:index",
      updatedAt: new Date(),
    });

    const response = await GET(new Request("http://localhost/api/risk?symbol=VNM&benchmark=VNINDEX"));

    expect(response.status).toBe(503);
    const json = (await response.json()) as { error?: string };
    expect(json.error).toBe("Data quality check failed for index: report unavailable");
  });

  it("returns 503 instead of 404 when symbol data is empty due OHLCV load error", async () => {
    mockLoadOHLCVForSymbol.mockResolvedValue([]);
    mockGetDatasetLoadStatus.mockReturnValue({
      dataset: "ohlcv",
      status: "error",
      reason: "duckdb_query_failed",
      message: "Failed to query ohlcv table",
      backend: "duckdb",
      source: "duckdb:test:ohlcv",
      updatedAt: new Date(),
    });

    const response = await GET(new Request("http://localhost/api/risk?symbol=VNM&benchmark=VNINDEX"));

    expect(response.status).toBe(503);
    const json = (await response.json()) as { error?: string; dataFailureReason?: string | null };
    expect(json.error).toContain("Failed to query ohlcv table");
    expect(json.dataFailureReason).toBe("duckdb_query_failed");
  });
});
