export interface UiFeatureFlags {
  screenerPresets: boolean;
  watchlistBridge: boolean;
  assistantContextualActions: boolean;
  uiKpiTelemetry: boolean;
}

const DEFAULT_FLAGS: UiFeatureFlags = {
  screenerPresets: true,
  watchlistBridge: true,
  assistantContextualActions: true,
  uiKpiTelemetry: true,
};

export function resolveUiFeatureFlags(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): UiFeatureFlags {
  return {
    screenerPresets: parseBoolean(env.NEXT_PUBLIC_FF_SCREENER_PRESETS, DEFAULT_FLAGS.screenerPresets),
    watchlistBridge: parseBoolean(env.NEXT_PUBLIC_FF_WATCHLIST_BRIDGE, DEFAULT_FLAGS.watchlistBridge),
    assistantContextualActions: parseBoolean(
      env.NEXT_PUBLIC_FF_ASSISTANT_CONTEXTUAL_ACTIONS,
      DEFAULT_FLAGS.assistantContextualActions
    ),
    uiKpiTelemetry: parseBoolean(env.NEXT_PUBLIC_FF_UI_KPI_TELEMETRY, DEFAULT_FLAGS.uiKpiTelemetry),
  };
}

export const uiFeatureFlags: UiFeatureFlags = resolveUiFeatureFlags();

export function getUiFeatureFlagSnapshot(): UiFeatureFlags {
  return {
    ...uiFeatureFlags,
  };
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (typeof raw !== "string") return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}
