export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  symbol?: string;
  createdAt: string;
  acknowledged: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  symbol?: string;
  enabled: boolean;
  createdAt: string;
}

export interface AlertsFeedResponse {
  alerts: AlertItem[];
  polledAt: string;
}

export interface AlertRulesListResponse {
  rules: AlertRule[];
  total: number;
}

export interface CreateAlertRuleInput {
  name: string;
  condition: string;
  symbol?: string;
  enabled?: boolean;
}

export interface CreateAlertRuleResponse {
  rule: AlertRule;
}
