import type { AlertItem, AlertRule, AlertSeverity } from "@/lib/alerts/types";

export type AlertComparisonOperator = ">" | ">=" | "<" | "<=" | "==" | "!=";

export interface ParsedAlertCondition {
  metric: string;
  operator: AlertComparisonOperator;
  threshold: number;
  isPercent: boolean;
}

export interface AlertSnapshotContext {
  metrics?: Record<string, unknown>;
  symbols?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

export interface AlertRuleEvaluationResult {
  rule: AlertRule;
  parsedCondition: ParsedAlertCondition | null;
  actualValue: number | null;
  triggered: boolean;
}

interface EvaluateAlertRulesInput {
  rules: AlertRule[];
  snapshot: AlertSnapshotContext;
  now?: Date;
}

const CONDITION_PATTERN =
  /^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*(>=|<=|==|!=|=|>|<)\s*(-?\d[\d,]*(?:\.\d+)?)\s*(%)?\s*$/;

export function parseAlertCondition(condition: string): ParsedAlertCondition | null {
  const matched = CONDITION_PATTERN.exec(condition);
  if (!matched) return null;

  const rawMetric = matched[1];
  const rawOperator = matched[2];
  const rawThreshold = matched[3];
  const isPercent = matched[4] === "%";
  const threshold = Number.parseFloat(rawThreshold.replaceAll(",", ""));

  if (!Number.isFinite(threshold)) return null;

  const operator = normalizeOperator(rawOperator);
  if (!operator) return null;

  return {
    metric: rawMetric,
    operator,
    threshold,
    isPercent,
  };
}

export function evaluateRuleCondition(
  rule: AlertRule,
  snapshot: AlertSnapshotContext
): AlertRuleEvaluationResult {
  if (!rule.enabled) {
    return {
      rule,
      parsedCondition: null,
      actualValue: null,
      triggered: false,
    };
  }

  const parsedCondition = parseAlertCondition(rule.condition);
  if (!parsedCondition) {
    return {
      rule,
      parsedCondition: null,
      actualValue: null,
      triggered: false,
    };
  }

  const value = resolveMetricValue(rule, parsedCondition.metric, snapshot);
  if (value == null) {
    return {
      rule,
      parsedCondition,
      actualValue: null,
      triggered: false,
    };
  }

  const normalizedActual = parsedCondition.isPercent ? normalizePercentValue(value) : value;
  const triggered = compare(normalizedActual, parsedCondition.operator, parsedCondition.threshold);

  return {
    rule,
    parsedCondition,
    actualValue: normalizedActual,
    triggered,
  };
}

export function evaluateAlertRules({
  rules,
  snapshot,
  now = new Date(),
}: EvaluateAlertRulesInput): AlertItem[] {
  const createdAt = now.toISOString();

  return rules
    .map((rule) => evaluateRuleCondition(rule, snapshot))
    .filter((result) => result.triggered && result.parsedCondition && result.actualValue != null)
    .map((result) => {
      const parsed = result.parsedCondition as ParsedAlertCondition;
      const actualValue = result.actualValue as number;

      return {
        id: `alert-eval-${result.rule.id}`,
        title: `${result.rule.name} triggered`,
        message: buildAlertMessage(result.rule, parsed, actualValue),
        severity: inferSeverity(result.rule, parsed.metric),
        symbol: result.rule.symbol,
        acknowledged: false,
        createdAt,
      };
    });
}

function resolveMetricValue(
  rule: AlertRule,
  metric: string,
  snapshot: AlertSnapshotContext
): number | null {
  if (rule.symbol) {
    const symbolMetrics = snapshot.symbols?.[rule.symbol];
    const symbolValue = toFiniteNumber(symbolMetrics?.[metric]);
    if (symbolValue != null) return symbolValue;
  }

  const metricsMapValue = toFiniteNumber(snapshot.metrics?.[metric]);
  if (metricsMapValue != null) return metricsMapValue;

  const rootMetricValue = toFiniteNumber(snapshot[metric]);
  if (rootMetricValue != null) return rootMetricValue;

  if (rule.symbol) {
    const dottedKey = `${rule.symbol}.${metric}`;
    const dottedValueFromMetrics = toFiniteNumber(snapshot.metrics?.[dottedKey]);
    if (dottedValueFromMetrics != null) return dottedValueFromMetrics;

    const dottedValueFromRoot = toFiniteNumber(snapshot[dottedKey]);
    if (dottedValueFromRoot != null) return dottedValueFromRoot;
  }

  return null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replaceAll(",", "").replaceAll("%", "");
    if (!normalized) return null;
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizePercentValue(value: number): number {
  if (Math.abs(value) <= 1) return value * 100;
  return value;
}

function compare(left: number, operator: AlertComparisonOperator, right: number): boolean {
  switch (operator) {
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
  }
}

function normalizeOperator(operator: string): AlertComparisonOperator | null {
  switch (operator) {
    case ">":
    case ">=":
    case "<":
    case "<=":
    case "==":
    case "!=":
      return operator;
    case "=":
      return "==";
    default:
      return null;
  }
}

function inferSeverity(rule: AlertRule, metric: string): AlertSeverity {
  const source = `${rule.name} ${metric}`.toLowerCase();
  if (source.includes("drawdown") || source.includes("risk")) return "critical";
  if (source.includes("volume")) return "info";
  return "warning";
}

function buildAlertMessage(
  rule: AlertRule,
  parsedCondition: ParsedAlertCondition,
  actualValue: number
): string {
  const symbolPrefix = rule.symbol ? `${rule.symbol} ` : "";
  const actualText = formatValue(actualValue, parsedCondition.isPercent);
  const thresholdText = formatValue(parsedCondition.threshold, parsedCondition.isPercent);
  return `${symbolPrefix}${parsedCondition.metric} is ${actualText} (rule: ${parsedCondition.metric} ${parsedCondition.operator} ${thresholdText}).`;
}

function formatValue(value: number, isPercent: boolean): string {
  if (isPercent) return `${trimTrailingZeros(value)}%`;
  return trimTrailingZeros(value);
}

function trimTrailingZeros(value: number): string {
  const rounded = Number(value.toFixed(4));
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
}
