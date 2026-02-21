import { getUiFeatureFlagSnapshot, uiFeatureFlags } from "@/lib/featureFlags";
import { logUiEvent } from "@/lib/frontendTelemetry";

export type UiKpiMetric =
  | "preset_reuse"
  | "watchlist_interaction"
  | "assistant_contextual_action_ctr";

interface UiKpiEventInput {
  metric: UiKpiMetric;
  event: string;
  page?: string;
  source?: string;
  symbol?: string;
  count?: number;
  detail?: Record<string, unknown>;
}

interface UiKpiEventPayload extends UiKpiEventInput {
  ts: string;
  featureFlags: ReturnType<typeof getUiFeatureFlagSnapshot>;
}

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
    await fetch(KPI_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body,
      keepalive: true,
      cache: "no-store",
    });
  } catch (error) {
    logUiEvent("debug", "kpi.fetch.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
