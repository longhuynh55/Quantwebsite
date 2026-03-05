import type { AssistantQueryPlan } from "./planner";
import { evaluateAssistantPolicy } from "./policy";

describe("evaluateAssistantPolicy recommendation grounding", () => {
  const emptyGrounding = {
    facts: [],
    citations: [],
    usedTools: [],
    messageBlocks: [],
    groundingSource: "none",
  };

  it("forces fallback for recommendation prompts without grounding evidence", () => {
    const result = evaluateAssistantPolicy({
      message: "Khuyen nghi mua VNM ngan han",
      contextSnapshot: { page: "home" },
      grounding: emptyGrounding,
    });

    expect(result.status).toBe("fallback");
    expect(result.shouldBypassLlm).toBe(true);
    expect(result.groundingRequired).toBe(true);
    expect(result.groundingSatisfied).toBe(false);
  });

  it("allows grounded recommendation when required tool evidence exists", () => {
    const queryPlan: AssistantQueryPlan = {
      intent: "valuation",
      confidence: "high",
      source: "signal",
      symbols: ["VNM"],
      filters: {},
      steps: [
        {
          tool: "stockSnapshot",
          endpoint: "/api/stocks",
          reason: "grounded",
          required: true,
        },
      ],
      summary: "intent=valuation | source=signal | symbols=VNM | tools=stockSnapshot",
    };
    const result = evaluateAssistantPolicy({
      message: "Khuyen nghi mua VNM",
      contextSnapshot: { page: "home" },
      queryPlan,
      grounding: {
        facts: ["VNM close=80,000"],
        citations: [
          {
            id: "c1",
            sourceType: "api",
            title: "stocks",
            endpoint: "/api/stocks?symbol=VNM",
            symbol: "VNM",
          },
        ],
        usedTools: [
          {
            name: "stockSnapshot",
            status: "success",
            evidenceCount: 1,
            warningCount: 0,
          },
        ],
        messageBlocks: [],
        groundingSource: "/api/stocks?symbol=VNM",
      },
    });

    expect(result.status).toBe("ok");
    expect(result.shouldBypassLlm).toBe(false);
    expect(result.groundingSatisfied).toBe(true);
  });

  it("returns skipped-required-tool reason when a required tool is skipped", () => {
    const queryPlan: AssistantQueryPlan = {
      intent: "valuation",
      confidence: "high",
      source: "signal",
      symbols: ["VNM"],
      filters: {},
      steps: [
        {
          tool: "stockSnapshot",
          endpoint: "/api/stocks",
          reason: "grounded",
          required: true,
        },
      ],
      summary: "intent=valuation | source=signal | symbols=VNM | tools=stockSnapshot",
    };
    const result = evaluateAssistantPolicy({
      message: "Khuyen nghi mua VNM",
      contextSnapshot: { page: "home" },
      queryPlan,
      grounding: {
        facts: [],
        citations: [],
        usedTools: [
          {
            name: "stockSnapshot",
            status: "skipped",
            evidenceCount: 0,
            warningCount: 0,
          },
        ],
        messageBlocks: [],
        groundingSource: "none",
      },
    });

    expect(result.status).toBe("fallback");
    expect(result.reasonCode).toBe("required_tool_skipped");
    expect(result.shouldBypassLlm).toBe(true);
    expect(result.groundingSatisfied).toBe(false);
  });

  it("blocks invalid calendar date prompts before grounding", () => {
    const result = evaluateAssistantPolicy({
      message: "Gia dong VCB ngay 31/04/2025",
      contextSnapshot: { page: "home" },
      grounding: emptyGrounding,
    });

    expect(result.shouldBypassLlm).toBe(true);
    expect(result.reasonCode).toBe("invalid_date_not_supported");
    expect(result.status === "shadow_blocked" || result.status === "fallback").toBe(true);
  });

  it("blocks English buy/sell recommendation prompts without grounding", () => {
    const result = evaluateAssistantPolicy({
      message: "Should I buy VNM this week?",
      contextSnapshot: { page: "home" },
      grounding: emptyGrounding,
    });

    expect(result.status).toBe("fallback");
    expect(result.shouldBypassLlm).toBe(true);
    expect(result.groundingRequired).toBe(true);
  });

  it("does not block non-financial invalid-date educational prompts", () => {
    const result = evaluateAssistantPolicy({
      message: "Vi sao ngay 31/04/2025 khong ton tai trong lich?",
      contextSnapshot: { page: "home" },
      grounding: emptyGrounding,
    });

    expect(result.status).toBe("ok");
    expect(result.shouldBypassLlm).toBe(false);
    expect(result.reasonCode).toBeUndefined();
  });

  it("enforces symbol grounding for single-symbol requests", () => {
    const queryPlan: AssistantQueryPlan = {
      intent: "stock_snapshot",
      confidence: "high",
      source: "signal",
      symbols: ["VNM"],
      filters: {},
      steps: [
        {
          tool: "stockSnapshot",
          endpoint: "/api/stocks",
          reason: "grounded",
          required: true,
        },
      ],
      summary: "intent=stock_snapshot | source=signal | symbols=VNM | tools=stockSnapshot",
    };

    const result = evaluateAssistantPolicy({
      message: "Gia dong cua VNM la bao nhieu?",
      contextSnapshot: { page: "home" },
      queryPlan,
      grounding: {
        facts: ["HPG close=30,000"],
        citations: [
          {
            id: "c1",
            sourceType: "api",
            title: "stocks",
            endpoint: "/api/stocks?symbol=HPG",
            symbol: "HPG",
          },
        ],
        usedTools: [
          {
            name: "stockSnapshot",
            status: "success",
            evidenceCount: 1,
            warningCount: 0,
            requestParams: { symbol: "HPG" },
          },
        ],
        messageBlocks: [],
        groundingSource: "/api/stocks?symbol=HPG",
      },
    });

    expect(result.status).toBe("fallback");
    expect(result.reasonCode).toBe("missing_symbol_grounding");
    expect(result.groundingSatisfied).toBe(false);
  });

  it("allows partial multi-symbol response when missing symbols were dropped by fanout", () => {
    const queryPlan: AssistantQueryPlan = {
      intent: "stock_snapshot",
      confidence: "high",
      source: "signal",
      symbols: ["HPG", "FPT", "MBB"],
      filters: {},
      steps: [
        {
          tool: "stockSnapshot",
          endpoint: "/api/stocks",
          reason: "grounded",
          required: true,
        },
      ],
      summary: "intent=stock_snapshot | source=signal | symbols=HPG,FPT,MBB | tools=stockSnapshot",
    };

    const result = evaluateAssistantPolicy({
      message: "Compare close price of HPG, FPT, MBB in 2021",
      contextSnapshot: { page: "home" },
      queryPlan,
      grounding: {
        facts: ["HPG close=30,000", "FPT close=90,000"],
        citations: [
          {
            id: "c1",
            sourceType: "api",
            title: "stocks",
            endpoint: "/api/stocks?symbol=HPG",
            symbol: "HPG",
          },
          {
            id: "c2",
            sourceType: "api",
            title: "stocks",
            endpoint: "/api/stocks?symbol=FPT",
            symbol: "FPT",
          },
        ],
        usedTools: [
          {
            name: "stockSnapshot",
            status: "success",
            evidenceCount: 2,
            warningCount: 0,
            requestParams: { symbol: "HPG" },
          },
          {
            name: "stockSnapshot",
            status: "success",
            evidenceCount: 2,
            warningCount: 0,
            requestParams: { symbol: "FPT" },
          },
        ],
        messageBlocks: [
          {
            type: "text",
            title: "Symbol Coverage Notice",
            content: "Symbol grounding coverage notice: dropped_symbols=MBB",
          },
        ],
        groundingSource: "/api/stocks?symbol=HPG",
        symbolDiagnostics: {
          requestedSymbols: ["HPG", "FPT", "MBB"],
          symbolTargets: ["HPG", "FPT"],
          groundedSymbols: ["HPG", "FPT"],
          droppedSymbols: ["MBB"],
          requestsUniverseStockRanking: false,
        },
      },
    });

    expect(result.status).toBe("ok");
    expect(result.shouldBypassLlm).toBe(false);
    expect(result.dataConfidence).toBe("medium");
    expect(result.reasonCode).toBe("missing_symbol_grounding");
  });

  it("returns shadow_blocked for ambiguous symbols in shadow mode", () => {
    const originalMode = process.env.ASSISTANT_POLICY_MODE;
    process.env.ASSISTANT_POLICY_MODE = "shadow";
    const result = evaluateAssistantPolicy({
      message: "So sanh close API vs HTTP",
      contextSnapshot: { page: "home" },
      grounding: emptyGrounding,
    });
    process.env.ASSISTANT_POLICY_MODE = originalMode;

    expect(result.reasonCode).toBe("ambiguous_symbol_not_supported");
    expect(result.status).toBe("shadow_blocked");
    expect(result.shadowBlocked).toBe(true);
  });

  it("requires exact endpoint path match for citations", () => {
    const queryPlan: AssistantQueryPlan = {
      intent: "stock_snapshot",
      confidence: "high",
      source: "signal",
      symbols: ["VNM"],
      filters: {},
      steps: [
        {
          tool: "stockSnapshot",
          endpoint: "/api/stocks",
          reason: "grounded",
          required: true,
        },
      ],
      summary: "intent=stock_snapshot | source=signal | symbols=VNM | tools=stockSnapshot",
    };

    const result = evaluateAssistantPolicy({
      message: "Gia dong cua VNM",
      contextSnapshot: { page: "home" },
      queryPlan,
      grounding: {
        facts: ["VNM close=80000"],
        citations: [
          {
            id: "c1",
            sourceType: "api",
            title: "stocks-history",
            endpoint: "/api/stocks-history?symbol=VNM",
            symbol: "VNM",
          },
        ],
        usedTools: [
          {
            name: "stockSnapshot",
            status: "success",
            evidenceCount: 1,
            warningCount: 0,
          },
        ],
        messageBlocks: [],
        groundingSource: "/api/stocks-history?symbol=VNM",
      },
    });

    expect(result.status === "fallback" || result.status === "shadow_blocked").toBe(true);
    expect(result.reasonCode).toBe("missing_citation");
  });

  it("accepts absolute citation URLs when endpoint path matches exactly", () => {
    const queryPlan: AssistantQueryPlan = {
      intent: "stock_snapshot",
      confidence: "high",
      source: "signal",
      symbols: ["VNM"],
      filters: {},
      steps: [
        {
          tool: "stockSnapshot",
          endpoint: "/api/stocks",
          reason: "grounded",
          required: true,
        },
      ],
      summary: "intent=stock_snapshot | source=signal | symbols=VNM | tools=stockSnapshot",
    };

    const result = evaluateAssistantPolicy({
      message: "Gia dong cua VNM",
      contextSnapshot: { page: "home" },
      queryPlan,
      grounding: {
        facts: ["VNM close=80000"],
        citations: [
          {
            id: "c1",
            sourceType: "api",
            title: "stocks",
            endpoint: "https://quantvn.example.com/api/stocks?symbol=VNM",
            symbol: "VNM",
          },
        ],
        usedTools: [
          {
            name: "stockSnapshot",
            status: "success",
            evidenceCount: 1,
            warningCount: 0,
          },
        ],
        messageBlocks: [],
        groundingSource: "/api/stocks?symbol=VNM",
      },
    });

    expect(result.status).toBe("ok");
    expect(result.groundingSatisfied).toBe(true);
  });
});
