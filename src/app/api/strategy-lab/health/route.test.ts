import { GET } from "@/app/api/strategy-lab/health/route";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/lib/strategy-lab/orchestrator", () => ({
  getStrategyLabHealthSnapshot: jest.fn(async () => ({
    scheduler: { queuedInScheduler: 0 },
    store: {
      runs: { total: 1, queued: 0, running: 0, succeeded: 1, failed: 0, cancelled: 0 },
      jobs: { total: 1, queued: 0, running: 0, succeeded: 1, failed: 0, cancelled: 0 },
      results: 1,
      events: 3,
      lastRunUpdatedAt: "2026-02-21T00:00:00.000Z",
    },
  })),
}));

jest.mock("@/lib/data", () => ({
  loadOHLCVForSymbol: jest.fn(),
}));

const dataModule = jest.requireMock("@/lib/data") as {
  loadOHLCVForSymbol: jest.Mock;
};

describe("GET /api/strategy-lab/health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 when data probe succeeds", async () => {
    dataModule.loadOHLCVForSymbol.mockResolvedValue([
      { symbol: "VNM", date: new Date("2025-01-01"), open: 1, high: 1, low: 1, close: 1, volume: 1 },
    ]);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      data: { dataProbe: { rows: number; error: string | null } };
    };

    expect(body.ok).toBe(true);
    expect(body.data.dataProbe.rows).toBeGreaterThan(0);
    expect(body.data.dataProbe.error).toBeNull();
  });

  it("returns 503 when data probe returns no rows", async () => {
    dataModule.loadOHLCVForSymbol.mockResolvedValue([]);

    const response = await GET();
    expect(response.status).toBe(503);
    const body = (await response.json()) as {
      ok: boolean;
      data: { dataProbe: { rows: number; error: string | null } };
    };

    expect(body.ok).toBe(false);
    expect(body.data.dataProbe.rows).toBe(0);
    expect(body.data.dataProbe.error).toMatch(/No OHLCV rows/i);
  });

  it("returns 503 with error details when data probe throws", async () => {
    dataModule.loadOHLCVForSymbol.mockRejectedValue(new Error("CSV not reachable"));

    const response = await GET();
    expect(response.status).toBe(503);
    const body = (await response.json()) as {
      ok: boolean;
      data: {
        runtime: { store: { runs: { total: number } } };
        dataProbe: { symbol: string; rows: number; error: string | null };
      };
    };

    expect(body.ok).toBe(false);
    expect(body.data.runtime.store.runs.total).toBe(1);
    expect(body.data.dataProbe.symbol).toBe("VNM");
    expect(body.data.dataProbe.rows).toBe(0);
    expect(body.data.dataProbe.error).toBe("CSV not reachable");
  });
});
