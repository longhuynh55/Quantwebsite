import { buildAssistantQueryPlan } from "./planner";

describe("planner noisy fundamentals debug", () => {
  it("prints plan for noisy prompts", () => {
    const prompts = [
      "acb 2025q2 d/e voi current ratio bn?",
      "fpt 2025q4 ocf fcf eps pbt di",
      "vnm bctn 2024q3 net margin gross margin",
    ];
    for (const message of prompts) {
      const plan = buildAssistantQueryPlan({
        message,
        contextSnapshot: { page: "analysis" },
        baselineOnlyMode: false,
      });
      // eslint-disable-next-line no-console
      console.log("DBG", message, JSON.stringify({ symbols: plan.symbols, intent: plan.intent, steps: plan.steps.map((s) => ({tool: s.tool, required: s.required})) }));
    }
    expect(true).toBe(true);
  });
});
