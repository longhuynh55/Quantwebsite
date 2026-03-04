import { getUiFeatureFlagSnapshot, uiFeatureFlags } from "@/lib/featureFlags";
import { logUiEvent } from "@/lib/frontendTelemetry";
import type {
  StrategyBuilderAiAssistEvent,
  StrategyBuilderInteractionEvent,
  UiKpiMetric,
} from "@/lib/uiKpiSchema";

type NonStrategyBuilderMetric = Exclude<
  UiKpiMetric,
  "strategy_builder_interaction" | "strategy_builder_ai_assist"
>;

interface UiKpiEventInputBase {
  page?: string;
  source?: string;
  symbol?: string;
  count?: number;
  detail?: Record<string, unknown>;
}

export type UiKpiEventInput =
  | (UiKpiEventInputBase & {
      metric: "strategy_builder_interaction";
      event: StrategyBuilderInteractionEvent;
    })
  | (UiKpiEventInputBase & {
      metric: "strategy_builder_ai_assist";
      event: StrategyBuilderAiAssistEvent;
    })
  | (UiKpiEventInputBase & {
      metric: NonStrategyBuilderMetric;
      event: string;
    });

type UiKpiEventPayload = UiKpiEventInput & {
  ts: string;
  featureFlags: ReturnType<typeof getUiFeatureFlagSnapshot>;
};

const KPI_ENDPOINT = "/api/telemetry/ui-kpi";

export function trackUiKpiEvent(input: UiKpiEventInput): void {
  const payload: UiKpiEventPayload = {
    ...input,
    ts: new Date().toISOString(),
    featureFlags: getUiFeatureFlagSnapshot(),
  };

  logUiEvent("info", `kpi.${input.event}`, payload as unknown as Record<string, unknown>);

  if (!uiFeatureFlags.uiKpiTelemetry) return;
  if (typeof window === "undefined") return;

  void sendUiKpi(payload);
}

async function sendUiKpi(payload: UiKpiEventPayload): Promise<void> {
  const body = JSON.stringify(payload);

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon(KPI_ENDPOINT, blob);
      if (sent) return;
    }
  } catch (error) {
    logUiEvent("debug", "kpi.beacon.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const response = await fetch(KPI_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body,
      keepalive: true,
      cache: "no-store",
    });
    if (!response.ok) {
      logUiEvent("debug", "kpi.fetch.non_ok", {
        status: response.status,
        statusText: response.statusText,
      });
    }
  } catch (error) {
    logUiEvent("debug", "kpi.fetch.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
