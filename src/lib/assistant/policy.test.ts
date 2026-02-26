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
});
