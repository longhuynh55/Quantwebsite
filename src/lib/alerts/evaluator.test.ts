import type { AlertRule } from "@/lib/alerts/types";
import {
  evaluateAlertRules,
  evaluateRuleCondition,
  parseAlertCondition,
} from "@/lib/alerts/evaluator";

function createRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: "rule-test",
    name: "Test rule",
    condition: "price > 95,000",
    symbol: "VCB",
    enabled: true,
    createdAt: "2026-02-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseAlertCondition", () => {
  it("parses numeric literals with separators", () => {
    const parsed = parseAlertCondition("price > 95,000");

    expect(parsed).toEqual({
      metric: "price",
      operator: ">",
      threshold: 95000,
      isPercent: false,
    });
  });

  it("parses percent thresholds and normalizes '=' operator", () => {
    const parsed = parseAlertCondition("portfolio_drawdown = 4%");

    expect(parsed).toEqual({
      metric: "portfolio_drawdown",
      operator: "==",
      threshold: 4,
      isPercent: true,
    });
  });

  it("returns null for invalid conditions", () => {
    expect(parseAlertCondition("price >> 95,000")).toBeNull();
    expect(parseAlertCondition("price > abc")).toBeNull();
    expect(parseAlertCondition("price")).toBeNull();
  });
});

describe("evaluateRuleCondition", () => {
  it("evaluates symbol-scoped metrics", () => {
    const result = evaluateRuleCondition(createRule(), {
      symbols: {
        VCB: { price: 95_500 },
      },
    });

    expect(result.triggered).toBe(true);
    expect(result.actualValue).toBe(95500);
    expect(result.parsedCondition?.metric).toBe("price");
  });

  it("handles percentage metrics stored as ratios", () => {
    const result = evaluateRuleCondition(
      createRule({
        id: "rule-dd",
        name: "Drawdown guard",
        condition: "portfolio_drawdown >= 4%",
        symbol: undefined,
      }),
      {
        metrics: {
          portfolio_drawdown: 0.042,
        },
      }
    );

    expect(result.triggered).toBe(true);
    expect(result.actualValue).toBeCloseTo(4.2, 5);
  });
});

describe("evaluateAlertRules", () => {
  it("returns alerts only for triggered, enabled, valid rules", () => {
    const rules: AlertRule[] = [
      createRule({
        id: "rule-triggered",
        name: "VCB breakout",
        condition: "price > 95,000",
        symbol: "VCB",
      }),
      createRule({
        id: "rule-not-triggered",
        name: "FPT breakout",
        condition: "price > 130,000",
        symbol: "FPT",
      }),
      createRule({
        id: "rule-disabled",
        name: "Disabled rule",
        enabled: false,
      }),
      createRule({
        id: "rule-invalid",
        name: "Invalid condition",
        condition: "price >>> 95,000",
      }),
    ];

    const alerts = evaluateAlertRules({
      rules,
      snapshot: {
        symbols: {
          VCB: { price: 95_500 },
          FPT: { price: 120_000 },
        },
      },
      now: new Date("2026-02-20T12:00:00.000Z"),
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      id: "alert-eval-rule-triggered",
      title: "VCB breakout triggered",
      severity: "warning",
      symbol: "VCB",
      acknowledged: false,
      createdAt: "2026-02-20T12:00:00.000Z",
    });
    expect(alerts[0].message).toContain("price is 95500");
    expect(alerts[0].message).toContain("price > 95000");
  });
});
