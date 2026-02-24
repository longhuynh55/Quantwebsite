/** @jest-environment node */

import { GET } from "@/app/api/fundamentals/route";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      status: init?.status ?? 200,
      headers: init?.headers ?? {},
      json: async () => body,
    }),
  },
}));

jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 1, resetTime: Date.now() + 60000 })),
  createRateLimitKey: jest.fn((key: string) => key),
  getClientIdentifier: jest.fn(() => "test-client"),
}));

jest.mock("@/lib/logger", () => ({
  createLogger: jest.fn(() => ({
    child: () => ({
      warn: jest.fn(),
      error: jest.fn(),
    }),
    warn: jest.fn(),
    error: jest.fn(),
  })),
  createTraceId: jest.fn(() => "trace-1"),
  toErrorMeta: jest.fn(() => ({})),
}));

jest.mock("@/lib/fundamentals", () => ({
  getAvailablePeriods: jest.fn(),
  getFundamentalsLoadDiagnostics: jest.fn(async () => ({
    bs: { statement: "bs", source: "bs.csv", totalRows: 1, skippedRows: 0, duplicatePeriodRows: 0, skippedSamples: [], generatedAt: "now" },
    is: { statement: "is", source: "is.csv", totalRows: 1, skippedRows: 0, duplicatePeriodRows: 0, skippedSamples: [], generatedAt: "now" },
    cf: { statement: "cf", source: "cf.csv", totalRows: 1, skippedRows: 0, duplicatePeriodRows: 0, skippedSamples: [], generatedAt: "now" },
  })),
  getFundamentalsSourceFiles: jest.fn(async () => ({ bs: "bs.csv", is: "is.csv", cf: "cf.csv" })),
  getStatementSnapshot: jest.fn(),
  resolveLatestPeriod: jest.fn(async () => "2024Q4"),
}));

const fundamentalsModule = jest.requireMock("@/lib/fundamentals") as {
  getAvailablePeriods: jest.Mock;
  getStatementSnapshot: jest.Mock;
  resolveLatestPeriod: jest.Mock;
};

describe("GET /api/fundamentals period parsing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps period=YYYY to YYYYQ4", async () => {
    fundamentalsModule.getAvailablePeriods.mockResolvedValue(["2024Q4"]);
    fundamentalsModule.getStatementSnapshot.mockResolvedValue({
      period: "2024Q4",
      fields: { revenue_bn_vnd: 1000000000000 },
      labels: { revenue_bn_vnd: "revenue (bn. vnd)" },
    });

    const response = await GET(new Request("http://localhost/api/fundamentals?symbol=AAA&period=2024&statement=is"));
    expect(response.status).toBe(200);
    const json = (await response.json()) as { symbol: string; period: string; incomeStatement: unknown };

    expect(json.symbol).toBe("AAA");
    expect(json.period).toBe("2024Q4");
    expect(json.incomeStatement).not.toBeNull();
    expect(fundamentalsModule.resolveLatestPeriod).not.toHaveBeenCalled();
  });

  it("returns 404 when mapped period is unavailable", async () => {
    fundamentalsModule.getAvailablePeriods.mockResolvedValue(["2023Q4"]);
    fundamentalsModule.getStatementSnapshot.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/fundamentals?symbol=AAA&period=2024&statement=is"));
    expect(response.status).toBe(404);
    const json = (await response.json()) as { error: string; period: string; availablePeriods: string[] };

    expect(json.period).toBe("2024Q4");
    expect(json.availablePeriods).toEqual(["2023Q4"]);
    expect(json.error).toMatch(/No fundamentals available/i);
  });
});

