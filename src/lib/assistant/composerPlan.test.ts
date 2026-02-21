import { defaultArgsForTool, draftComposerPlan } from "./composerPlan";

describe("composerPlan", () => {
  it("drafts backtest plan from objective keywords", () => {
    const plan = draftComposerPlan("Run backtest for FPT with SMA crossover", {
      page: "backtesting",
      symbol: "VCB",
    });

    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.toolName).toBe("backtest_run");
    expect(plan.arguments).toEqual({
      symbol: "FPT",
      strategy: "sma_crossover",
      executionModel: "next_open",
    });
  });

  it("drafts valuation ranking plan with metric/order", () => {
    const plan = draftComposerPlan("Top 5 stocks by PB thấp nhất ngày 2025-12-31", {
      page: "home",
    });

    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.toolName).toBe("valuation_rankings");
    expect(plan.arguments).toMatchObject({
      metric: "pb",
      order: "asc",
      limit: 5,
      date: "2025-12-31",
    });
  });

  it("falls back to finance analysis default when no strong keyword", () => {
    const plan = draftComposerPlan("Analyze this symbol for me", {
      page: "charts",
      symbol: "VNM",
    });

    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.toolName).toBe("finance_analysis");
    expect(plan.arguments).toEqual({
      symbol: "VNM",
      task: "fundamental",
    });
  });

  it("returns default args per tool", () => {
    const backtestArgs = defaultArgsForTool("backtest_run", { page: "backtesting", symbol: "HPG" });
    const riskArgs = defaultArgsForTool("risk_metrics", { page: "risk", symbol: "VCB" });

    expect(backtestArgs).toEqual({
      symbol: "HPG",
      strategy: "sma_crossover",
      executionModel: "next_open",
    });
    expect(riskArgs).toEqual({
      symbol: "VCB",
      benchmark: "VNINDEX",
    });
  });
});

