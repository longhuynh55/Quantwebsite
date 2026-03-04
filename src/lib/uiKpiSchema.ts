export const UI_KPI_METRICS = [
  "preset_reuse",
  "watchlist_interaction",
  "assistant_contextual_action_ctr",
  "strategy_builder_interaction",
  "strategy_builder_ai_assist",
] as const;

export type UiKpiMetric = (typeof UI_KPI_METRICS)[number];

export const STRATEGY_BUILDER_INTERACTION_EVENTS = [
  "template_applied",
  "ai_strategy_applied",
] as const;

export type StrategyBuilderInteractionEvent =
  (typeof STRATEGY_BUILDER_INTERACTION_EVENTS)[number];

export const STRATEGY_BUILDER_AI_ASSIST_EVENTS = [
  "generate_apply_success",
  "generate_apply_cancelled",
  "generate_apply_failed",
] as const;

export type StrategyBuilderAiAssistEvent =
  (typeof STRATEGY_BUILDER_AI_ASSIST_EVENTS)[number];

const STRATEGY_BUILDER_INTERACTION_EVENT_SET = new Set<string>(
  STRATEGY_BUILDER_INTERACTION_EVENTS
);
const STRATEGY_BUILDER_AI_ASSIST_EVENT_SET = new Set<string>(
  STRATEGY_BUILDER_AI_ASSIST_EVENTS
);

export function isUiKpiMetric(value: string): value is UiKpiMetric {
  return (UI_KPI_METRICS as readonly string[]).includes(value);
}

export function isUiKpiEventAllowed(metric: UiKpiMetric, event: string): boolean {
  if (metric === "strategy_builder_interaction") {
    return STRATEGY_BUILDER_INTERACTION_EVENT_SET.has(event);
  }
  if (metric === "strategy_builder_ai_assist") {
    return STRATEGY_BUILDER_AI_ASSIST_EVENT_SET.has(event);
  }
  return true;
}
