import { sanitizeGeneratedStrategyForBuilder, generatedStrategyToBuilderGraph } from "./strategy-builder-adapter";
import type { GeneratedStrategy } from "@/lib/ai/strategy-generator";

const makeStrategy = (partial?: Partial<GeneratedStrategy>): GeneratedStrategy => ({
  nodes: [],
  edges: [],
  explanation: "test",
  ...partial,
});

describe("strategy-builder-adapter", () => {
  test("sanitizes missing ids/positions and drops invalid edges", () => {
    const input = makeStrategy({
      nodes: [
        {
          // missing id + invalid position
          id: "",
          type: "dataSource",
          position: { x: Number.NaN, y: Infinity },
          data: {
            type: "dataSource",
            label: "Data",
            // @ts-expect-error testing invalid inputs
            config: { stocks: "VNM, FPT", timeframe: "1d" },
          },
        },
        {
          id: "n2",
          type: "indicator",
          position: { x: 300, y: 100 },
          data: {
            type: "indicator",
            label: "RSI",
            config: { indicatorType: "rsi", period: -10 },
          },
        },
      ],
      edges: [
        { id: "e1", source: "missing", target: "n2" },
        { id: "e2", source: "n2", target: "also-missing" },
        { id: "e3", source: "n2", target: "n2" },
      ],
    });

    const out = sanitizeGeneratedStrategyForBuilder(input);
    expect(out.strategy.nodes).toHaveLength(2);
    expect(out.strategy.nodes[0].id).toBeTruthy();
    expect(Number.isFinite(out.strategy.nodes[0].position.x)).toBe(true);
    expect(Number.isFinite(out.strategy.nodes[0].position.y)).toBe(true);
    expect(out.strategy.nodes[1].data.config.period).toBeGreaterThan(0);
    expect(out.strategy.edges).toHaveLength(1);
    expect(out.strategy.edges[0].source).toBe(out.strategy.nodes[1].id);
    expect(out.strategy.edges[0].target).toBe(out.strategy.nodes[1].id);
    expect(out.warnings.length).toBeGreaterThan(0);
  });

  test("converts to builder graph with stable ids and animated edges", () => {
    const input = makeStrategy({
      name: "AI Test",
      nodes: [
        {
          id: "ds",
          type: "dataSource",
          position: { x: 80, y: 100 },
          data: { type: "dataSource", label: "Market Data", config: { stocks: ["VNM"], timeframe: "1d" } },
        },
        {
          id: "ind",
          type: "indicator",
          position: { x: 340, y: 100 },
          data: { type: "indicator", label: "RSI(14)", config: { indicatorType: "rsi", period: 14 } },
        },
      ],
      edges: [{ id: "e1", source: "ds", target: "ind" }],
    });

    const out = generatedStrategyToBuilderGraph(input);
    expect(out.name).toBe("AI Test");
    expect(out.nodes.map((n) => n.id)).toEqual(["ds", "ind"]);
    expect(out.edges).toHaveLength(1);
    expect(out.edges[0].animated).toBe(true);
  });
});
