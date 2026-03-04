import { evaluateAssistantPolicy } from "./policy";

const emptyGrounding = { facts: [], citations: [], usedTools: [], messageBlocks: [], groundingSource: "none" };

describe("policy audit mode repro", () => {
  const originalMode = process.env.ASSISTANT_POLICY_MODE;
  afterAll(() => {
    process.env.ASSISTANT_POLICY_MODE = originalMode;
  });

  it("buy phrasing remains ok in enforce_high_risk", () => {
    process.env.ASSISTANT_POLICY_MODE = "enforce_high_risk";
    const result = evaluateAssistantPolicy({ message: "Should I buy VNM this week?", contextSnapshot: { page: "home" }, grounding: emptyGrounding });
    expect(result.status).toBe("ok");
    expect(result.reasonCode).toBeUndefined();
  });

  it("stop loss phrasing remains ok in enforce_high_risk", () => {
    process.env.ASSISTANT_POLICY_MODE = "enforce_high_risk";
    const result = evaluateAssistantPolicy({ message: "Set stop loss 5% for VNM", contextSnapshot: { page: "home" }, grounding: emptyGrounding });
    expect(result.status).toBe("ok");
    expect(result.reasonCode).toBe("insufficient_grounding");
  });
});
