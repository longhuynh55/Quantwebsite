import { INTENT_RESPONSE_FORMAT, INTENT_SYSTEM_PROMPT } from "../strategy-intent";

describe("INTENT_RESPONSE_FORMAT", () => {
    it("schema is valid JSON Schema (parseable)", () => {
        expect(INTENT_RESPONSE_FORMAT.type).toBe("json_schema");
        // Type narrowing for discriminated union
        if (INTENT_RESPONSE_FORMAT.type !== "json_schema") throw new Error("Expected json_schema");
        expect(INTENT_RESPONSE_FORMAT.json_schema).toBeDefined();
        expect(INTENT_RESPONSE_FORMAT.json_schema.name).toBe("strategy_intent");
        expect(INTENT_RESPONSE_FORMAT.json_schema.strict).toBe(true);
        expect(INTENT_RESPONSE_FORMAT.json_schema.schema).toBeDefined();
    });

    it("schema requires 'stocks' and 'pipeline'", () => {
        if (INTENT_RESPONSE_FORMAT.type !== "json_schema") throw new Error("Expected json_schema");
        const schema = INTENT_RESPONSE_FORMAT.json_schema.schema as Record<string, unknown>;
        const required = schema.required as string[];
        expect(required).toContain("stocks");
        expect(required).toContain("pipeline");
    });

    it("pipeline type enum matches all 10 non-auto types", () => {
        if (INTENT_RESPONSE_FORMAT.type !== "json_schema") throw new Error("Expected json_schema");
        const schema = INTENT_RESPONSE_FORMAT.json_schema.schema as Record<string, Record<string, Record<string, Record<string, Record<string, Record<string, string[]>>>>>>;
        const typeEnum = schema.properties.pipeline.items.properties.type.enum;
        const expected = [
            "indicator", "filter", "signal", "weighting",
            "conditional", "sort", "math", "merge", "risk", "backtest",
        ];
        expect(typeEnum).toEqual(expected);
    });
});

describe("INTENT_SYSTEM_PROMPT", () => {
    it("prompt instructs LLM to NOT generate dataSource/output nodes", () => {
        // Prompt should tell LLM these are auto-added
        expect(INTENT_SYSTEM_PROMPT.toLowerCase()).toContain("do not include");
    });

    it("prompt is reasonably small (under 600 characters)", () => {
        expect(INTENT_SYSTEM_PROMPT.length).toBeLessThan(600);
    });
});
