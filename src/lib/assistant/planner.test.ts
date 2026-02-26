import { buildAssistantQueryPlan } from "./planner";

describe("buildAssistantQueryPlan exchange/limit normalization", () => {
  it("extracts HNX exchange from message for ranking-like query", () => {
    const plan = buildAssistantQueryPlan({
      message: "Top 10 co phieu HNX theo khoi luong hom nay",
      baselineOnlyMode: false,
    });

    expect(plan.filters.exchange).toBe("HNX");
    expect(plan.filters.metric).toBe("volume");
    expect(plan.filters.limit).toBe(10);
  });

  it("extracts UPCOM exchange from context filters", () => {
    const plan = buildAssistantQueryPlan({
      message: "xep hang co phieu theo volume",
      contextSnapshot: {
        page: "screener",
        filters: {
          exchange: "UPCOM",
          metric: "volume",
          top: 12,
        },
      },
      baselineOnlyMode: false,
    });

    expect(plan.filters.exchange).toBe("UPCOM");
    expect(plan.filters.metric).toBe("volume");
    expect(plan.filters.limit).toBe(12);
  });

  it("clamps top limit to 50", () => {
    const plan = buildAssistantQueryPlan({
      message: "Top 99 co phieu HOSE theo gia dong cua",
      baselineOnlyMode: false,
    });

    expect(plan.filters.exchange).toBe("HOSE");
    expect(plan.filters.limit).toBe(50);
  });

  it("classifies broad market overview as market intent", () => {
    const plan = buildAssistantQueryPlan({
      message: "Cho toi market overview: VNINDEX, top gainer va top loser hien tai.",
      contextSnapshot: { page: "home" },
      baselineOnlyMode: false,
    });

    expect(plan.intent).toBe("market");
    expect(plan.source).toBe("signal");
    expect(plan.steps.some((step) => step.tool === "marketSnapshot")).toBe(true);
    expect(plan.steps.some((step) => step.tool === "fundamentalSnapshot")).toBe(false);
  });

  it("keeps symbol extraction clean for BCTN latest prompt", () => {
    const plan = buildAssistantQueryPlan({
      message: "Cho BCTN moi nhat cua VNM, chi tra doanh thu va loi nhuan sau thue.",
      contextSnapshot: { page: "home" },
      baselineOnlyMode: false,
    });

    expect(plan.intent).toBe("fundamentals");
    expect(plan.symbols).toContain("VNM");
    expect(plan.symbols).not.toContain("MOI");
    expect(plan.source).toBe("signal");
  });

  it("marks ambiguous metric fallback source explicitly", () => {
    const plan = buildAssistantQueryPlan({
      message: "PE hien tai la bao nhieu?",
      contextSnapshot: { page: "home" },
      baselineOnlyMode: false,
    });

    expect(plan.source).toBe("fallback");
    expect(plan.summary).toContain("source=fallback");
  });

  it("classifies mixed-case symbol date close query as stock snapshot", () => {
    const plan = buildAssistantQueryPlan({
      message: "Gia dong cua co phieu VCb ngay 31/12/2025",
      contextSnapshot: { page: "home" },
      baselineOnlyMode: false,
    });

    expect(plan.intent).toBe("stock_snapshot");
    expect(plan.symbols).toContain("VCB");
    expect(plan.filters.date).toBe("2025-12-31");
    expect(plan.steps.some((step) => step.tool === "stockSnapshot")).toBe(true);
    expect(plan.steps.some((step) => step.tool === "marketSnapshot")).toBe(false);
  });
});
