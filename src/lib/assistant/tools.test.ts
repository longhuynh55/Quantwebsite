/** @jest-environment node */

import type { AssistantQueryPlan } from "@/lib/assistant/planner";
import { runGroundingTools } from "@/lib/assistant/tools";

const ORIGINAL_FETCH = global.fetch;

function buildPlan(overrides: Partial<AssistantQueryPlan>): AssistantQueryPlan {
  return {
    intent: "mixed",
    confidence: "high",
    source: "signal",
    symbols: [],
    filters: {},
    steps: [],
    summary: "test-plan",
    ...overrides,
  };
}

describe("assistant tools orchestration", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it("applies queryPlan filters to valuationRanking fetch", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          asOfDate: "2024-12-31",
          requestedDate: "2024-12-31",
          metric: "pb",
          order: "asc",
          rows: [
            {
              rank: 1,
              symbol: "VNM",
              metricValue: 1.2,
              pb: 1.2,
              priceDate: "2024-12-31",
            },
          ],
          warnings: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await runGroundingTools({
      baseUrl: "http://127.0.0.1:3000",
      message: "Top PE latest",
      queryPlan: buildPlan({
        intent: "valuation_ranking",
        filters: {
          date: "2024-12-31",
          metric: "pb",
          order: "asc",
          limit: 7,
          exchange: "HOSE",
        },
        steps: [
          {
            tool: "valuationRanking",
            endpoint: "/api/analytics/valuation-rankings",
            reason: "test",
            required: true,
          },
        ],
      }),
    });

    const [rawUrl] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    const url = new URL(rawUrl);
    expect(url.pathname).toBe("/api/analytics/valuation-rankings");
    expect(url.searchParams.get("date")).toBe("2024-12-31");
    expect(url.searchParams.get("metric")).toBe("pb");
    expect(url.searchParams.get("order")).toBe("asc");
    expect(url.searchParams.get("limit")).toBe("7");
    expect(url.searchParams.get("exchange")).toBe("HOSE");
  });

  it("applies queryPlan filters to icbSnapshot fetch", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          asOfDate: "2024-12-31",
          requestedDate: "2024-12-31",
          exchange: "HOSE",
          groups: [],
          warnings: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await runGroundingTools({
      baseUrl: "http://127.0.0.1:3000",
      message: "ICB snapshot latest",
      queryPlan: buildPlan({
        intent: "icb_snapshot",
        filters: {
          date: "2024-12-31",
          icbLevel: "2",
          icb: "Banks",
          limit: 5,
          exchange: "HOSE",
        },
        steps: [
          {
            tool: "icbSnapshot",
            endpoint: "/api/analytics/icb-snapshot",
            reason: "test",
            required: true,
          },
        ],
      }),
    });

    const [rawUrl] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    const url = new URL(rawUrl);
    expect(url.pathname).toBe("/api/analytics/icb-snapshot");
    expect(url.searchParams.get("date")).toBe("2024-12-31");
    expect(url.searchParams.get("icbLevel")).toBe("2");
    expect(url.searchParams.get("icb")).toBe("Banks");
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("exchange")).toBe("HOSE");
  });

  it("does not execute marketSnapshot for symbol-less fundamentals intent", async () => {
    const result = await runGroundingTools({
      baseUrl: "http://127.0.0.1:3000",
      message: "Phan tich BCTC/BCTN/LCTT quy gan nhat",
      queryPlan: buildPlan({
        intent: "fundamentals",
        steps: [
          {
            tool: "marketSnapshot",
            endpoint: "/api/market-overview",
            reason: "fallback",
            required: false,
          },
        ],
      }),
    });

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(0);
    expect(result.usedTools.some((tool) => tool.name === "fundamentalSnapshot" && tool.status === "skipped")).toBe(true);
  });

  it("does not run backtesting with implicit VNM fallback when symbol is missing", async () => {
    const result = await runGroundingTools({
      baseUrl: "http://127.0.0.1:3000",
      message: "Backtest SMA crossover",
      queryPlan: buildPlan({
        intent: "backtesting",
        steps: [
          {
            tool: "backtestSummary",
            endpoint: "/api/backtesting",
            reason: "test",
            required: true,
          },
        ],
      }),
      contextSnapshot: { page: "backtesting" },
    });

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(0);
    expect(result.usedTools.some((tool) => tool.name === "backtestSummary" && tool.status === "skipped")).toBe(true);
  });
});
