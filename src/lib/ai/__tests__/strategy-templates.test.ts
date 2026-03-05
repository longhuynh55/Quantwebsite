import {
    matchTemplate,
    extractStocks,
    extractParams,
    getTemplates,
} from "../strategy-templates";

// ────────────────────────────────────────────
// Invariant checker (mirrors route.ts)
// ────────────────────────────────────────────

function validateStrategyInvariants(strategy: {
    nodes: Array<{ type: string }>;
    edges: Array<{ from: number; to: number }>;
}): string | null {
    if (strategy.nodes.length < 2) return "strategy_requires_at_least_two_nodes";
    if (strategy.edges.length < 1) return "strategy_requires_at_least_one_edge";
    if (!strategy.nodes.some((n) => n.type === "dataSource")) return "strategy_requires_data_source_node";
    if (!strategy.nodes.some((n) => n.type === "output")) return "strategy_requires_output_node";

    const adjacency = new Map<number, number[]>();
    for (let i = 0; i < strategy.nodes.length; i += 1) adjacency.set(i, []);
    for (const edge of strategy.edges) adjacency.get(edge.from)?.push(edge.to);

    const queue: number[] = [];
    const visited = new Set<number>();
    strategy.nodes.forEach((n, i) => { if (n.type === "dataSource") queue.push(i); });
    while (queue.length > 0) {
        const c = queue.shift()!;
        if (visited.has(c)) continue;
        visited.add(c);
        for (const t of adjacency.get(c) ?? []) if (!visited.has(t)) queue.push(t);
    }
    if (!strategy.nodes.some((n, i) => n.type === "output" && visited.has(i))) {
        return "strategy_output_not_reachable_from_data_source";
    }
    return null;
}

// ────────────────────────────────────────────
// extractStocks
// ────────────────────────────────────────────

describe("extractStocks", () => {
    it("extracts HOSE symbols from prompt", () => {
        expect(extractStocks("RSI cho VNM và VCB")).toEqual(["VNM", "VCB"]);
    });

    it("returns ['VNM'] as default when no symbols found", () => {
        expect(extractStocks("chiến lược theo tin tức")).toEqual(["VNM"]);
    });

    it("excludes common English words (RSI, EMA, BUY, etc.)", () => {
        const result = extractStocks("RSI for BUY signal EMA");
        expect(result).not.toContain("RSI");
        expect(result).not.toContain("BUY");
        expect(result).not.toContain("EMA");
    });

    it("deduplicates symbols", () => {
        expect(extractStocks("VNM RSI VNM MACD VNM")).toEqual(["VNM"]);
    });

    it("extracts lowercase symbols and normalizes to uppercase", () => {
        expect(extractStocks("rsi cho vnm va fpt")).toEqual(["VNM", "FPT"]);
    });
});

// ────────────────────────────────────────────
// extractParams
// ────────────────────────────────────────────

describe("extractParams", () => {
    it("extracts period from prompt", () => {
        expect(extractParams("RSI period 20")).toEqual({ period: 20 });
    });

    it("extracts stoploss and takeprofit", () => {
        const result = extractParams("stoploss 5 takeprofit 15");
        expect(result.stopLoss).toBe(5);
        expect(result.takeProfit).toBe(15);
    });

    it("returns empty object when no params found", () => {
        expect(extractParams("RSI cho VNM")).toEqual({});
    });
});

// ────────────────────────────────────────────
// matchTemplate
// ────────────────────────────────────────────

describe("matchTemplate", () => {
    it("matches RSI prompt with enough keywords", () => {
        // RSI keywords: ["rsi", "mean reversion", "quá bán", "oversold", "đảo chiều"]
        // Need ≥4 of 5 = 80%
        const result = matchTemplate("RSI mean reversion quá bán oversold cho VNM");
        expect(result).not.toBeNull();
        expect(result!.name).toBe("RSI Mean Reversion");
    });

    it("matches MACD prompt with enough keywords", () => {
        // MACD keywords: ["macd", "crossover", "giao cắt", "tín hiệu macd"]
        // Need ≥4 of 4 = 100% ("macd" appears in 2 keywords)
        const result = matchTemplate("MACD crossover giao cắt tín hiệu macd VCB");
        expect(result).not.toBeNull();
        expect(result!.name).toBe("MACD Crossover");
    });

    it("matches Bollinger prompt with enough keywords", () => {
        // Bollinger keywords: ["bollinger", "band", "breakout", "phá vỡ", "dải bollinger"]
        // Need ≥4 of 5 = 80%
        const result = matchTemplate("bollinger band breakout phá vỡ cho FPT");
        expect(result).not.toBeNull();
        expect(result!.name).toBe("Bollinger Band Breakout");
    });

    it("extracts stock symbols into template output", () => {
        const result = matchTemplate("MACD crossover giao cắt tín hiệu macd cho FPT");
        expect(result).not.toBeNull();
        expect(result!.nodes[0].config.stocks).toEqual(["FPT"]);
    });

    it("returns null for unrecognizable prompts", () => {
        expect(matchTemplate("chiến lược theo tin tức tài chính doanh nghiệp")).toBeNull();
    });

    it("returns null when confidence < threshold", () => {
        // Only 1 keyword match out of many = low score
        expect(matchTemplate("rsi kết hợp với volume breakout và bollinger phức tạp")).toBeNull();
    });
});

// ────────────────────────────────────────────
// Template output validity
// ────────────────────────────────────────────

describe("template output validity", () => {
    const templates = getTemplates();

    it.each(templates.map((t) => [t.id, t] as const))(
        "template '%s' produces valid AiStrategyResponse format",
        (_, template) => {
            const result = template.build(["VNM"], {});
            expect(typeof result.name).toBe("string");
            expect(result.name.length).toBeGreaterThan(0);
            expect(Array.isArray(result.nodes)).toBe(true);
            expect(Array.isArray(result.edges)).toBe(true);
        }
    );

    it.each(templates.map((t) => [t.id, t] as const))(
        "template '%s' has dataSource as first node",
        (_, template) => {
            const result = template.build(["VNM"], {});
            expect(result.nodes[0].type).toBe("dataSource");
        }
    );

    it.each(templates.map((t) => [t.id, t] as const))(
        "template '%s' has output node",
        (_, template) => {
            const result = template.build(["VNM"], {});
            expect(result.nodes.some((n) => n.type === "output")).toBe(true);
        }
    );

    it.each(templates.map((t) => [t.id, t] as const))(
        "template '%s' passes validateStrategyInvariants",
        (_, template) => {
            const result = template.build(["VNM"], {});
            expect(validateStrategyInvariants(result)).toBeNull();
        }
    );

    it.each(templates.map((t) => [t.id, t] as const))(
        "template '%s' has no self-loop edges",
        (_, template) => {
            const result = template.build(["VNM"], {});
            for (const edge of result.edges) {
                expect(edge.from).not.toBe(edge.to);
            }
        }
    );

    it.each(templates.map((t) => [t.id, t] as const))(
        "template '%s' edges reference valid node indices",
        (_, template) => {
            const result = template.build(["VNM"], {});
            for (const edge of result.edges) {
                expect(edge.from).toBeGreaterThanOrEqual(0);
                expect(edge.from).toBeLessThan(result.nodes.length);
                expect(edge.to).toBeGreaterThanOrEqual(0);
                expect(edge.to).toBeLessThan(result.nodes.length);
            }
        }
    );
});
