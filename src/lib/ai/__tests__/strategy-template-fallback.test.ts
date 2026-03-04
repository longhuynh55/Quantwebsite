import { buildStrategyTemplateFallback } from "@/lib/ai/strategy-template-fallback";

describe("strategy-template-fallback", () => {
  it("builds RSI template for RSI prompts and keeps requested symbol", () => {
    const strategy = buildStrategyTemplateFallback(
      "Tao chien luoc RSI mean reversion cho VNM, mua RSI < 30, ban RSI > 70",
      "timeout"
    );

    expect(strategy.name).toContain("VNM");
    expect(strategy.nodes).toHaveLength(4);
    expect(strategy.nodes[0].type).toBe("dataSource");
    expect(strategy.nodes[1].type).toBe("indicator");
    expect(strategy.nodes[1].data.label).toContain("RSI");
    expect(strategy.edges).toHaveLength(3);
    expect(strategy.explanation).toContain("Fallback reason: timeout");
  });

  it("builds MACD template for MACD prompts", () => {
    const strategy = buildStrategyTemplateFallback(
      "Build a MACD trend following strategy for FPT timeframe 1h",
      "upstream"
    );

    expect(strategy.name).toContain("FPT");
    expect(strategy.nodes[1].data.label).toContain("MACD");
    expect(strategy.nodes[0].data.config.timeframe).toBe("1h");
    expect(strategy.explanation).toContain("Fallback reason: upstream");
  });

  it("falls back to baseline template and default symbol when no symbol is found", () => {
    const strategy = buildStrategyTemplateFallback(
      "Tao chien luoc ngan gon de demo",
      "schema_unavailable"
    );

    expect(strategy.name).toContain("VNM");
    expect(strategy.nodes.length).toBeGreaterThanOrEqual(4);
    expect(strategy.edges.length).toBeGreaterThanOrEqual(3);
    expect(strategy.explanation).toContain("Fallback reason: schema_unavailable");
  });
});

