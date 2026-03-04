import type { AssistantQueryPlan } from "./planner";
import { evaluateAssistantPolicy } from "./policy";

const emptyGrounding = {
  facts: [],
  citations: [],
  usedTools: [],
  messageBlocks: [],
  groundingSource: "none",
};

describe("policy audit repros", () => {
  it("blocks non-numeric invalid-date prompt", () => {
    const result = evaluateAssistantPolicy({
      message: "Vi sao ngay 31/04/2025 khong ton tai trong lich?",
      contextSnapshot: { page: "home" },
      grounding: emptyGrounding,
    });

    expect(result.reasonCode).toBe("invalid_date_not_supported");
    expect(result.shouldBypassLlm).toBe(true);
  });

  it("does not enforce recommendation for plain English buy phrasing", () => {
    const result = evaluateAssistantPolicy({
      message: "Should I buy VNM this week?",
      contextSnapshot: { page: "home" },
      grounding: emptyGrounding,
    });

    expect(result.status).toBe("ok");
    expect(result.groundingRequired).toBe(false);
  });

  it("does not enforce recommendation for spaced stop loss phrase", () => {
    const result = evaluateAssistantPolicy({
      message: "Set stop loss 5% for VNM",
      contextSnapshot: { page: "home" },
      grounding: emptyGrounding,
    });

    expect(result.status).toBe("ok");
    expect(result.groundingRequired).toBe(false);
  });

  it("accepts single-symbol grounding even when evidence is for another symbol", () => {
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

    expect(result.status).toBe("ok");
    expect(result.groundingSatisfied).toBe(true);
  });

  it("returns fallback instead of shadow_blocked for ambiguous symbol in shadow mode", () => {
    const originalMode = process.env.ASSISTANT_POLICY_MODE;
    process.env.ASSISTANT_POLICY_MODE = "shadow";
    const result = evaluateAssistantPolicy({
      message: "So sanh close API vs HTTP",
      contextSnapshot: { page: "home" },
      grounding: emptyGrounding,
    });
    process.env.ASSISTANT_POLICY_MODE = originalMode;

    expect(result.reasonCode).toBe("ambiguous_symbol_not_supported");
    expect(result.status).toBe("fallback");
    expect(result.shadowBlocked).toBe(false);
  });
});
