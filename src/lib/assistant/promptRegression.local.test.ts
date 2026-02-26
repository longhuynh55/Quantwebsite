import { buildAssistantQueryPlan } from "./planner";
import { collectRequiredSignals, getCandidateSymbols } from "./signals";
import { evaluateAssistantPolicy } from "./policy";

describe("assistant prompt regression local matrix", () => {
  it("parses diverse valid dates", () => {
    const d1 = buildAssistantQueryPlan({
      message: "Gia dong VCB ngay 02/01/2025",
      baselineOnlyMode: false,
      contextSnapshot: { page: "home" },
    });
    const d2 = buildAssistantQueryPlan({
      message: "Gia dong VCB ngay 15/03/2024",
      baselineOnlyMode: false,
      contextSnapshot: { page: "home" },
    });
    const d3 = buildAssistantQueryPlan({
      message: "Gia dong VCB ngay 29/02/2024",
      baselineOnlyMode: false,
      contextSnapshot: { page: "home" },
    });
    expect(d1.filters.date).toBe("2025-01-02");
    expect(d2.filters.date).toBe("2024-03-15");
    expect(d3.filters.date).toBe("2024-02-29");
  });

  it("rejects invalid dates", () => {
    const d1 = buildAssistantQueryPlan({
      message: "Gia dong VCB ngay 29/02/2023",
      baselineOnlyMode: false,
      contextSnapshot: { page: "home" },
    });
    const d2 = buildAssistantQueryPlan({
      message: "Gia dong VCB ngay 31/04/2025",
      baselineOnlyMode: false,
      contextSnapshot: { page: "home" },
    });
    expect(d1.filters.date).toBeUndefined();
    expect(d2.filters.date).toBeUndefined();
  });

  it("blocks invalid calendar date at policy layer", () => {
    const result = evaluateAssistantPolicy({
      message: "Gia dong VCB ngay 31/04/2025",
      contextSnapshot: { page: "home" },
      grounding: {
        facts: [],
        citations: [],
        usedTools: [],
        messageBlocks: [],
        groundingSource: "none",
      },
    });
    expect(result.reasonCode).toBe("invalid_date_not_supported");
    expect(result.shouldBypassLlm).toBe(true);
  });

  it("parses Vietnamese natural-language date", () => {
    const plan = buildAssistantQueryPlan({
      message: "Gia dong VCB ngay 31 thang 12 nam 2025",
      baselineOnlyMode: false,
      contextSnapshot: { page: "home" },
    });
    expect(plan.filters.date).toBe("2025-12-31");
  });

  it("resolves lowercase and mixed-case symbols", () => {
    const lower = getCandidateSymbols("gia dong cua vcb ngay 31/12/2025", { page: "analysis" });
    const mixed = getCandidateSymbols("Gia dong cua co phieu VCb ngay 31/12/2025", { page: "analysis" });
    expect(lower).toContain("VCB");
    expect(mixed).toContain("VCB");
  });

  it("routes HOSE ranking query as stock snapshot signal", () => {
    const signals = collectRequiredSignals({
      message: "Top 10 co phieu HOSE theo close ngay 30/06/2025",
      contextSnapshot: { page: "home" },
      baselineOnlyMode: false,
    });
    const tools = signals.map((x) => x.tool);
    expect(tools).toContain("stockSnapshot");
  });

  it("routes HNX ranking to stock snapshot scope (guard handled at route layer)", () => {
    const signals = collectRequiredSignals({
      message: "Top 10 co phieu HNX theo volume ngay 30/06/2025",
      contextSnapshot: { page: "home" },
      baselineOnlyMode: false,
    });
    const tools = signals.map((x) => x.tool);
    expect(tools).toContain("stockSnapshot");
  });

  it("keeps market-overview query on marketSnapshot", () => {
    const plan = buildAssistantQueryPlan({
      message: "Cho toi market overview VNINDEX, top gainer va top loser",
      baselineOnlyMode: false,
      contextSnapshot: { page: "home" },
    });
    expect(plan.intent).toBe("market");
    expect(plan.steps.some((s) => s.tool === "marketSnapshot")).toBe(true);
  });

  it("blocks future-date numeric policy without grounded data", () => {
    const result = evaluateAssistantPolicy({
      message: "Gia dong VCB ngay 01/01/2027",
      contextSnapshot: { page: "home" },
      grounding: {
        facts: [],
        citations: [],
        usedTools: [],
        messageBlocks: [],
        groundingSource: "none",
      },
    });
    expect(result.shouldBypassLlm).toBe(true);
    expect(result.reasonCode).toBe("future_date_not_supported");
  });

  it("does not carry date from history unless explicit cue", () => {
    const noCarry = buildAssistantQueryPlan({
      message: "Gia mo cua thi sao?",
      conversationHistory: "Gia dong cua VCB ngay 31/12/2025",
      baselineOnlyMode: false,
      contextSnapshot: { page: "home" },
    });
    const carry = buildAssistantQueryPlan({
      message: "Giu nguyen ngay truoc, gia mo cua thi sao?",
      conversationHistory: "Gia dong cua VCB ngay 31/12/2025",
      baselineOnlyMode: false,
      contextSnapshot: { page: "home" },
    });
    expect(noCarry.filters.date).toBeUndefined();
    expect(carry.filters.date).toBe("2025-12-31");
  });
});
