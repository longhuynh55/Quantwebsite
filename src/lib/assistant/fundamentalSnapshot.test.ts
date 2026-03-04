/** @jest-environment node */

import { runGroundingTools } from "@/lib/assistant/tools";

const ORIGINAL_FETCH = global.fetch;

function mockFundamentalsPayload(period: string) {
  return {
    symbol: "AAA",
    period,
    availablePeriods: ["2024Q3", period],
    incomeStatement: {
      period,
      fields: {
        revenue_bn_vnd: 2193500753373,
        net_profit_for_the_year: 62021846963,
        profit_before_tax: 101552618209,
        eps_basis: 1500,
      },
      labels: {
        revenue_bn_vnd: "Revenue (Bn. VND)",
        net_profit_for_the_year: "Net Profit For the Year",
        profit_before_tax: "Profit before tax",
        eps_basis: "EPS_basis",
      },
    },
    balanceSheet: {
      period,
      fields: {
        total_assets_bn_vnd: 12891604733753,
        liabilities_bn_vnd: 6812374373990,
        owner_s_equity_bn_vnd: 6079230359763,
      },
      labels: {
        total_assets_bn_vnd: "TOTAL ASSETS (Bn. VND)",
        liabilities_bn_vnd: "LIABILITIES (Bn. VND)",
        owner_s_equity_bn_vnd: "OWNER'S EQUITY(Bn.VND)",
      },
    },
    cashFlow: {
      period,
      fields: {
        net_cash_inflows_outflows_from_operating_activities: 296512345697,
        purchase_of_fixed_assets: -564143687806,
      },
      labels: {
        net_cash_inflows_outflows_from_operating_activities: "Net cash inflows/outflows from operating activities",
        purchase_of_fixed_assets: "Purchase of fixed assets",
      },
    },
    confidence: "high",
    warnings: [],
    coverage: { coverageRatio: 1 },
  };
}

describe("Assistant fundamentalSnapshot grounding", () => {
  beforeEach(() => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      const parsed = new URL(url);
      if (parsed.pathname.endsWith("/api/fundamentals")) {
        const period = parsed.searchParams.get("period") ?? "latest";
        return new Response(JSON.stringify(mockFundamentalsPayload(period)), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it("maps bare year to YYYYQ4 in assistant tool calls", async () => {
    const result = await runGroundingTools({
      baseUrl: "http://localhost",
      message: "BCTC AAA 2024",
      contextSnapshot: { page: "home" },
    });

    const called = (global.fetch as jest.Mock).mock.calls
      .map((args) => String(args[0]))
      .find((url) => url.includes("/api/fundamentals"));
    expect(called).toBeTruthy();
    expect(String(called)).toContain("period=2024Q4");

    const fundamentalTool = result.usedTools.find((tool) => tool.name === "fundamentalSnapshot");
    expect(fundamentalTool?.status).toBe("success");

    const table = result.messageBlocks.find((block) => block.type === "table" && block.title?.includes("Fundamentals Snapshot"));
    expect(table).toBeTruthy();
  });

  it("maps FY token to YYYYQ4 in assistant tool calls", async () => {
    const result = await runGroundingTools({
      baseUrl: "http://localhost",
      message: "Cho toi BCTN AAA FY2025 va loi nhuan truoc thue.",
      contextSnapshot: { page: "home" },
    });

    const called = (global.fetch as jest.Mock).mock.calls
      .map((args) => String(args[0]))
      .find((url) => url.includes("/api/fundamentals"));
    expect(called).toBeTruthy();
    expect(String(called)).toContain("period=2025Q4");

    const fundamentalTool = result.usedTools.find((tool) => tool.name === "fundamentalSnapshot");
    expect(fundamentalTool?.status).toBe("success");
  });

  it("highlights profit_before_tax when user asks 'truoc thue'", async () => {
    const result = await runGroundingTools({
      baseUrl: "http://localhost",
      message: "Cho toi loi nhuan truoc thue AAA nam 2024 (BCTN).",
      contextSnapshot: { page: "charts" },
    });

    const table = result.messageBlocks.find((block) => block.type === "table") as
      | { type: "table"; rows?: Array<Array<string | number | null>> }
      | undefined;
    expect(table?.rows?.some((row) => String(row[1]).toLowerCase().includes("profit before tax"))).toBe(true);
  });

  it("routes noisy lowercase fundamentals prompt to /api/fundamentals with resolved symbol", async () => {
    await runGroundingTools({
      baseUrl: "http://localhost",
      message: "dm cho toi bctc aaa 2024, uu tien lnst + dong tien hddd, viet ngan gon",
      contextSnapshot: { page: "home" },
    });

    const called = (global.fetch as jest.Mock).mock.calls
      .map((args) => String(args[0]))
      .find((url) => url.includes("/api/fundamentals"));
    expect(called).toBeTruthy();
    expect(String(called)).toContain("symbol=AAA");
    expect(String(called)).toContain("period=2024Q4");
  });
});
