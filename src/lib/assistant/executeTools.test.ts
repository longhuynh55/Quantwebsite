import {
  buildAssistantExecutePlan,
  validateAssistantExecuteRequest,
} from "./executeTools";

describe("executeTools", () => {
  it("rejects non-object body", () => {
    const result = validateAssistantExecuteRequest("not-an-object");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("requires approvalToken", () => {
    const result = validateAssistantExecuteRequest({
      toolName: "finance_analysis",
      arguments: { symbol: "VNM", task: "valuation" },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
  });

  it("accepts legacy finance analysis payload for backward compatibility", () => {
    const result = validateAssistantExecuteRequest({
      symbol: "vnm",
      task: "valuation",
      approvalToken: "token-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.toolName).toBe("finance_analysis");
    expect(result.args).toEqual({
      symbol: "VNM",
      task: "valuation",
    });
  });

  it("rejects finance analysis with invalid task", () => {
    const result = validateAssistantExecuteRequest({
      toolName: "finance_analysis",
      arguments: {
        symbol: "VNM",
        task: "invalid-task",
      },
      approvalToken: "token-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("rejects unknown tool name", () => {
    const result = validateAssistantExecuteRequest({
      toolName: "unknown_tool",
      arguments: {},
      approvalToken: "token-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("accepts risk args with optional benchmark and normalizes casing", () => {
    const result = validateAssistantExecuteRequest({
      toolName: "risk_metrics",
      arguments: {
        symbol: "fpt",
        benchmark: "vn30",
      },
      approvalToken: "token-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.args).toEqual({
      symbol: "FPT",
      benchmark: "VN30",
    });
  });

  it("enforces strict args schema for risk tool", () => {
    const result = validateAssistantExecuteRequest({
      toolName: "risk_metrics",
      arguments: {
        symbol: "FPT",
        benchmark: "VNINDEX",
        extra: "not-allowed",
      },
      approvalToken: "token-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("builds finance analysis execution plan", () => {
    const validation = validateAssistantExecuteRequest({
      toolName: "finance_analysis",
      arguments: {
        symbol: "VNM",
        task: "peer",
      },
      approvalToken: "token-1",
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const plan = buildAssistantExecutePlan(validation.toolName, validation.args);
    expect(plan.method).toBe("GET");
    expect(plan.path).toBe("/api/finance-analysis");
    expect(plan.query).toEqual({
      symbol: "VNM",
      type: "peer",
    });
  });

  it("builds risk execution plan without benchmark", () => {
    const validation = validateAssistantExecuteRequest({
      toolName: "risk_metrics",
      arguments: {
        symbol: "VNM",
      },
      approvalToken: "token-1",
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const plan = buildAssistantExecutePlan(validation.toolName, validation.args);
    expect(plan.method).toBe("GET");
    expect(plan.path).toBe("/api/risk");
    expect(plan.query).toEqual({
      symbol: "VNM",
    });
  });

  it("builds valuation ranking execution plan", () => {
    const validation = validateAssistantExecuteRequest({
      toolName: "valuation_rankings",
      arguments: {
        metric: "pe",
        order: "desc",
        limit: 20,
      },
      approvalToken: "token-1",
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const plan = buildAssistantExecutePlan(validation.toolName, validation.args);
    expect(plan.method).toBe("GET");
    expect(plan.path).toBe("/api/analytics/valuation-rankings");
    expect(plan.query).toEqual({
      exchange: "HOSE",
      metric: "pe",
      order: "desc",
      limit: "20",
    });
  });

  it("rejects valuation rankings without required metric", () => {
    const result = validateAssistantExecuteRequest({
      toolName: "valuation_rankings",
      arguments: {
        order: "desc",
      },
      approvalToken: "token-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("builds stock universe ranking plan with optional filters", () => {
    const validation = validateAssistantExecuteRequest({
      toolName: "stock_universe_ranking",
      arguments: {
        metric: "volume",
        order: "desc",
        limit: 15,
        date: "2025-12-31",
        icb: "Banks",
        icbLevel: "2",
      },
      approvalToken: "token-1",
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const plan = buildAssistantExecutePlan(validation.toolName, validation.args);
    expect(plan.method).toBe("GET");
    expect(plan.path).toBe("/api/stocks");
    expect(plan.query).toEqual({
      exchange: "HOSE",
      metric: "volume",
      order: "desc",
      limit: "15",
      date: "2025-12-31",
      icb: "Banks",
      icbLevel: "2",
    });
  });

  it("builds backtest execution plan with optional config", () => {
    const validation = validateAssistantExecuteRequest({
      toolName: "backtest_run",
      arguments: {
        symbol: "VCB",
        strategy: "sma_crossover",
        capital: 250000,
        params: { shortPeriod: 20, longPeriod: 50 },
        executionModel: "next_open",
        feeBps: 10,
        sellTaxBps: 10,
        slippageBps: 5,
        lotSize: 100,
      },
      approvalToken: "token-1",
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const plan = buildAssistantExecutePlan(validation.toolName, validation.args);
    expect(plan.method).toBe("POST");
    expect(plan.path).toBe("/api/backtesting");
    expect(plan.body).toEqual({
      symbol: "VCB",
      strategy: "sma_crossover",
      capital: 250000,
      params: { shortPeriod: 20, longPeriod: 50 },
      executionModel: "next_open",
      feeBps: 10,
      sellTaxBps: 10,
      slippageBps: 5,
      lotSize: 100,
    });
  });

  it("normalizes executionModel casing for backtest tool", () => {
    const validation = validateAssistantExecuteRequest({
      toolName: "backtest_run",
      arguments: {
        symbol: "VCB",
        strategy: "sma_crossover",
        executionModel: "SAME_CLOSE",
      },
      approvalToken: "token-1",
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const plan = buildAssistantExecutePlan(validation.toolName, validation.args);
    expect(plan.body).toEqual({
      symbol: "VCB",
      strategy: "sma_crossover",
      executionModel: "same_close",
    });
  });

  it("rejects backtest executionModel outside allowed enum", () => {
    const result = validateAssistantExecuteRequest({
      toolName: "backtest_run",
      arguments: {
        symbol: "VCB",
        strategy: "sma_crossover",
        executionModel: "t+2",
      },
      approvalToken: "token-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("rejects backtest execution plan with invalid strategy", () => {
    const result = validateAssistantExecuteRequest({
      toolName: "backtest_run",
      arguments: {
        symbol: "VCB",
        strategy: "invalid_strategy",
      },
      approvalToken: "token-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("builds icb snapshot plan", () => {
    const validation = validateAssistantExecuteRequest({
      toolName: "icb_snapshot",
      arguments: {
        date: "2025-12-31",
        limit: 30,
        icb: "Banks",
        icbLevel: "2",
      },
      approvalToken: "token-1",
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const plan = buildAssistantExecutePlan(validation.toolName, validation.args);
    expect(plan.method).toBe("GET");
    expect(plan.path).toBe("/api/stocks");
    expect(plan.query).toEqual({
      groupBy: "icb",
      exchange: "HOSE",
      date: "2025-12-31",
      limit: "30",
      icb: "Banks",
      icbLevel: "2",
    });
  });
});
