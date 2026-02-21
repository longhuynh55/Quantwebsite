import type {
  AlertItem,
  AlertRule,
  AlertSeverity,
  CreateAlertRuleInput,
} from "@/lib/alerts/types";
import { evaluateAlertRules, type AlertSnapshotContext } from "@/lib/alerts/evaluator";

interface MockAlertTemplate {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  symbol?: string;
  acknowledged: boolean;
  ageMinutes: number;
}

const alertTemplates: MockAlertTemplate[] = [
  {
    id: "alert-mock-price-1",
    title: "Price threshold reached",
    message: "VCB crossed your upper-bound threshold at 95,500 VND.",
    severity: "warning",
    symbol: "VCB",
    acknowledged: false,
    ageMinutes: 3,
  },
  {
    id: "alert-mock-volume-1",
    title: "Volume spike detected",
    message: "FPT intraday volume is 1.8x above its 20-session baseline.",
    severity: "info",
    symbol: "FPT",
    acknowledged: false,
    ageMinutes: 12,
  },
  {
    id: "alert-mock-risk-1",
    title: "Risk guardrail triggered",
    message: "Portfolio drawdown exceeded 4.0% daily guardrail.",
    severity: "critical",
    acknowledged: true,
    ageMinutes: 35,
  },
];

const alertRules: AlertRule[] = [
  {
    id: "rule-mock-1",
    name: "VCB breakout",
    condition: "price > 95,000",
    symbol: "VCB",
    enabled: true,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "rule-mock-2",
    name: "Daily drawdown guard",
    condition: "portfolio_drawdown >= 4%",
    enabled: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

let pollCounter = 0;

const mockSnapshotContext: AlertSnapshotContext = {
  metrics: {
    portfolio_drawdown: 4.2,
    market_breadth: 0.38,
  },
  symbols: {
    VCB: {
      price: 95_650,
      volume_ratio_20d: 1.4,
    },
    FPT: {
      price: 120_400,
      volume_ratio_20d: 1.9,
    },
  },
};

export function listMockAlerts(): AlertItem[] {
  pollCounter += 1;
  const now = Date.now();

  return alertTemplates.map((template, index) => ({
    id: template.id,
    title: template.title,
    message: template.message,
    severity: template.severity,
    symbol: template.symbol,
    acknowledged: template.acknowledged,
    createdAt: new Date(
      now - (template.ageMinutes + pollCounter + index) * 60 * 1000
    ).toISOString(),
  }));
}

export function listAlertRules(): AlertRule[] {
  return [...alertRules].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

export function listEvaluatedMockAlerts(now: Date = new Date()): AlertItem[] {
  return evaluateAlertRules({
    rules: listAlertRules(),
    snapshot: mockSnapshotContext,
    now,
  });
}

export function createAlertRule(input: CreateAlertRuleInput): AlertRule {
  const rule: AlertRule = {
    id: createMockId("rule"),
    name: input.name,
    condition: input.condition,
    symbol: input.symbol,
    enabled: input.enabled ?? true,
    createdAt: new Date().toISOString(),
  };

  alertRules.unshift(rule);
  return rule;
}

function createMockId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
