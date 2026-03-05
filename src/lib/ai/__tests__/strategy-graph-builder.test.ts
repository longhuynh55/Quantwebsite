import {
    buildFromIntent,
    isValidPipelineType,
    type StrategyIntent,
    type PipelineNodeType,
} from "../strategy-graph-builder";

// ────────────────────────────────────────────
// Helpers — mirrors invariant checks from route.ts
// ────────────────────────────────────────────

function validateStrategyInvariants(strategy: {
    nodes: Array<{ type: string; label: string; config: Record<string, unknown> }>;
    edges: Array<{ from: number; to: number }>;
}): string | null {
    if (!Array.isArray(strategy.nodes) || strategy.nodes.length < 2) {
        return "strategy_requires_at_least_two_nodes";
    }
    if (!Array.isArray(strategy.edges) || strategy.edges.length < 1) {
        return "strategy_requires_at_least_one_edge";
    }
    const hasDataSource = strategy.nodes.some((n) => n.type === "dataSource");
    const hasOutput = strategy.nodes.some((n) => n.type === "output");
    if (!hasDataSource) return "strategy_requires_data_source_node";
    if (!hasOutput) return "strategy_requires_output_node";

    const adjacency = new Map<number, number[]>();
    for (let i = 0; i < strategy.nodes.length; i += 1) {
        adjacency.set(i, []);
    }
    for (const edge of strategy.edges) {
        adjacency.get(edge.from)?.push(edge.to);
    }
    const queue: number[] = [];
    const visited = new Set<number>();
    for (let i = 0; i < strategy.nodes.length; i += 1) {
        if (strategy.nodes[i].type === "dataSource") queue.push(i);
    }
    while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        for (const target of adjacency.get(current) ?? []) {
            if (!visited.has(target)) queue.push(target);
        }
    }
    const reachableOutput = strategy.nodes.some(
        (n, i) => n.type === "output" && visited.has(i)
    );
    if (!reachableOutput) return "strategy_output_not_reachable_from_data_source";
    return null;
}

// ────────────────────────────────────────────
// isValidPipelineType
// ────────────────────────────────────────────

describe("isValidPipelineType", () => {
    const ALL_PIPELINE_TYPES: PipelineNodeType[] = [
        "indicator", "filter", "signal", "weighting", "conditional",
        "sort", "math", "merge", "risk", "backtest",
    ];

    it.each(ALL_PIPELINE_TYPES)("returns true for '%s'", (type) => {
        expect(isValidPipelineType(type)).toBe(true);
    });

    it("returns false for 'dataSource' (auto-added, not a pipeline type)", () => {
        expect(isValidPipelineType("dataSource")).toBe(false);
    });

    it("returns false for 'output' (auto-added, not a pipeline type)", () => {
        expect(isValidPipelineType("output")).toBe(false);
    });

    it("returns false for unknown types", () => {
        expect(isValidPipelineType("nonexistent")).toBe(false);
        expect(isValidPipelineType("")).toBe(false);
    });
});

// ────────────────────────────────────────────
// buildFromIntent — linear graph
// ────────────────────────────────────────────

describe("buildFromIntent — linear graph", () => {
    it("generates 3 nodes (dataSource, indicator, output) for single-step intent", () => {
        const intent: StrategyIntent = {
            stocks: ["VNM"],
            pipeline: [{ type: "indicator", config: { indicatorType: "rsi", period: 14 } }],
        };
        const result = buildFromIntent(intent);
        expect(result.nodes).toHaveLength(3);
        expect(result.nodes[0].type).toBe("dataSource");
        expect(result.nodes[1].type).toBe("indicator");
        expect(result.nodes[2].type).toBe("output");
    });

    it("auto-adds dataSource at index 0 with correct stocks", () => {
        const intent: StrategyIntent = {
            stocks: ["FPT", "VCB"],
            pipeline: [{ type: "filter" }],
        };
        const result = buildFromIntent(intent);
        expect(result.nodes[0].type).toBe("dataSource");
        expect(result.nodes[0].config.stocks).toEqual(["FPT", "VCB"]);
    });

    it("auto-adds output at last index with default metrics", () => {
        const intent: StrategyIntent = {
            stocks: ["VNM"],
            pipeline: [{ type: "indicator" }, { type: "signal" }],
        };
        const result = buildFromIntent(intent);
        const lastNode = result.nodes[result.nodes.length - 1];
        expect(lastNode.type).toBe("output");
        expect(lastNode.config.metrics).toEqual(["returns", "sharpe", "drawdown"]);
    });

    it("generates sequential edges {from:0,to:1}, {from:1,to:2}", () => {
        const intent: StrategyIntent = {
            stocks: ["VNM"],
            pipeline: [{ type: "indicator" }],
        };
        const result = buildFromIntent(intent);
        expect(result.edges).toEqual([
            { from: 0, to: 1 },
            { from: 1, to: 2 },
        ]);
    });

    it("uses VNM as default when stocks array is empty", () => {
        const intent: StrategyIntent = {
            stocks: [],
            pipeline: [{ type: "indicator" }],
        };
        const result = buildFromIntent(intent);
        expect(result.nodes[0].config.stocks).toEqual(["VNM"]);
    });

    it("uses '1d' as default when timeframe is invalid", () => {
        const intent: StrategyIntent = {
            stocks: ["VNM"],
            timeframe: "invalid",
            pipeline: [{ type: "indicator" }],
        };
        const result = buildFromIntent(intent);
        expect(result.nodes[0].config.timeframe).toBe("1d");
    });
});

// ────────────────────────────────────────────
// buildFromIntent — complex pipeline
// ────────────────────────────────────────────

describe("buildFromIntent — complex pipeline", () => {
    it("5-step pipeline → 7 nodes + 6 edges", () => {
        const intent: StrategyIntent = {
            stocks: ["VNM"],
            pipeline: [
                { type: "indicator", config: { indicatorType: "rsi", period: 14 } },
                { type: "filter", config: { filterType: "rsi_oversold", value: 30 } },
                { type: "signal", config: { signalType: "buy" } },
                { type: "risk", config: { method: "fixed" } },
                { type: "backtest", config: { initialCapital: 100000000 } },
            ],
        };
        const result = buildFromIntent(intent);
        expect(result.nodes).toHaveLength(7); // ds + 5 + out
        expect(result.edges).toHaveLength(6); // ds→ind, ind→filt, filt→sig, sig→risk, risk→bt, bt→out
    });

    it("accepts all 10 pipeline types", () => {
        const allTypes: PipelineNodeType[] = [
            "indicator", "filter", "signal", "weighting", "conditional",
            "sort", "math", "merge", "risk", "backtest",
        ];
        const intent: StrategyIntent = {
            stocks: ["VNM"],
            pipeline: allTypes.map((type) => ({ type })),
        };
        const result = buildFromIntent(intent);
        const pipelineTypes = result.nodes.slice(1, -1).map((n) => n.type);
        expect(pipelineTypes).toEqual(allTypes);
    });

    it("skips unknown types in pipeline", () => {
        const intent: StrategyIntent = {
            stocks: ["VNM"],
            pipeline: [
                { type: "indicator" as PipelineNodeType },
                { type: "nonexistent" as PipelineNodeType },
                { type: "signal" as PipelineNodeType },
            ],
        };
        const result = buildFromIntent(intent);
        // Should skip the unknown type: ds + indicator + signal + out = 4
        expect(result.nodes).toHaveLength(4);
        expect(result.nodes[1].type).toBe("indicator");
        expect(result.nodes[2].type).toBe("signal");
    });

    it("generates meaningful labels from config", () => {
        const intent: StrategyIntent = {
            stocks: ["VNM"],
            pipeline: [
                { type: "indicator", config: { indicatorType: "macd", period: 26 } },
                { type: "signal", config: { signalType: "sell" } },
            ],
        };
        const result = buildFromIntent(intent);
        expect(result.nodes[1].label).toBe("MACD(26)");
        expect(result.nodes[2].label).toBe("SELL Signal");
    });

    it("uses custom label when provided", () => {
        const intent: StrategyIntent = {
            stocks: ["VNM"],
            pipeline: [
                { type: "indicator", label: "My Custom RSI" },
            ],
        };
        const result = buildFromIntent(intent);
        expect(result.nodes[1].label).toBe("My Custom RSI");
    });

    it("enriches config with defaults for missing fields", () => {
        const intent: StrategyIntent = {
            stocks: ["VNM"],
            pipeline: [{ type: "indicator" }], // no config at all
        };
        const result = buildFromIntent(intent);
        expect(result.nodes[1].config.indicatorType).toBe("rsi");
        expect(result.nodes[1].config.period).toBe(14);
    });
});

// ────────────────────────────────────────────
// buildFromIntent — invariant guarantees
// ────────────────────────────────────────────

describe("buildFromIntent — invariant guarantees", () => {
    it("empty pipeline → still valid 2 nodes + 1 edge (dataSource → output)", () => {
        const intent: StrategyIntent = {
            stocks: ["VNM"],
            pipeline: [],
        };
        const result = buildFromIntent(intent);
        expect(result.nodes).toHaveLength(2);
        expect(result.edges).toEqual([{ from: 0, to: 1 }]);
    });

    it("no self-loop edges in any generated graph", () => {
        const intent: StrategyIntent = {
            stocks: ["VNM"],
            pipeline: [{ type: "indicator" }, { type: "filter" }, { type: "signal" }],
        };
        const result = buildFromIntent(intent);
        for (const edge of result.edges) {
            expect(edge.from).not.toBe(edge.to);
        }
    });

    it("no duplicate edges in generated graph", () => {
        const intent: StrategyIntent = {
            stocks: ["VNM"],
            pipeline: [
                { type: "indicator" },
                { type: "filter" },
                { type: "signal" },
                { type: "risk" },
                { type: "backtest" },
            ],
        };
        const result = buildFromIntent(intent);
        const signatures = result.edges.map((e) => `${e.from}->${e.to}`);
        expect(new Set(signatures).size).toBe(signatures.length);
    });

    it("passes validateStrategyInvariants for every pipeline length (0-10)", () => {
        const allTypes: PipelineNodeType[] = [
            "indicator", "filter", "signal", "weighting", "conditional",
            "sort", "math", "merge", "risk", "backtest",
        ];

        for (let len = 0; len <= 10; len += 1) {
            const intent: StrategyIntent = {
                stocks: ["VNM"],
                pipeline: allTypes.slice(0, len).map((type) => ({ type })),
            };
            const result = buildFromIntent(intent);
            const invariantError = validateStrategyInvariants(result);
            expect(invariantError).toBeNull();
        }
    });

    it("all edge indices are within valid node range", () => {
        const intent: StrategyIntent = {
            stocks: ["VNM", "FPT", "VCB"],
            pipeline: [
                { type: "indicator", config: { indicatorType: "rsi", period: 14 } },
                { type: "indicator", config: { indicatorType: "macd", period: 26 } },
                { type: "merge", config: { logic: "and" } },
                { type: "signal", config: { signalType: "buy" } },
                { type: "risk", config: { method: "kelly" } },
            ],
        };
        const result = buildFromIntent(intent);
        for (const edge of result.edges) {
            expect(edge.from).toBeGreaterThanOrEqual(0);
            expect(edge.from).toBeLessThan(result.nodes.length);
            expect(edge.to).toBeGreaterThanOrEqual(0);
            expect(edge.to).toBeLessThan(result.nodes.length);
        }
    });

    it("uses strategy name from intent or defaults to 'AI Strategy'", () => {
        expect(buildFromIntent({ stocks: ["VNM"], pipeline: [], name: "My RSI" }).name).toBe("My RSI");
        expect(buildFromIntent({ stocks: ["VNM"], pipeline: [] }).name).toBe("AI Strategy");
        expect(buildFromIntent({ stocks: ["VNM"], pipeline: [], name: "  " }).name).toBe("AI Strategy");
    });
});
