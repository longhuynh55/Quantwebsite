import { StrategyOption, AdvancedConfigPreset } from "./types";

export const STRATEGIES: StrategyOption[] = [
  { value: "sma_crossover", label: "SMA Crossover" },
  { value: "ema_crossover", label: "EMA Crossover" },
  { value: "rsi_mean_reversion", label: "RSI Mean Reversion" },
  { value: "bollinger_bands", label: "Bollinger Band Breakout" },
  { value: "momentum", label: "Momentum Strategy" },
];

export const STRATEGY_PARAM_DEFAULTS: Record<string, Record<string, number>> = {
  sma_crossover: { shortPeriod: 10, longPeriod: 20 },
  ema_crossover: { shortPeriod: 10, longPeriod: 20 },
  rsi_mean_reversion: { period: 14, oversold: 30, overbought: 70 },
  bollinger_bands: { period: 20, stdDev: 2 },
  momentum: { lookback: 20, threshold: 0.05 },
};

export const PARAM_LABELS: Record<string, string> = {
  shortPeriod: "Short Period",
  longPeriod: "Long Period",
  period: "Period",
  oversold: "Oversold",
  overbought: "Overbought",
  stdDev: "Std Dev",
  lookback: "Lookback",
  threshold: "Threshold",
};

export const ADVANCED_CONFIG_PRESETS: AdvancedConfigPreset[] = [
  {
    key: "low_cost",
    label: "Low Cost",
    executionModel: "same_close",
    feeBps: "5",
    sellTaxBps: "5",
    slippageBps: "2",
    lotSize: "1",
  },
  {
    key: "realistic",
    label: "Realistic",
    executionModel: "next_open",
    feeBps: "15",
    sellTaxBps: "10",
    slippageBps: "5",
    lotSize: "1",
  },
  {
    key: "stress",
    label: "Stress",
    executionModel: "next_open",
    feeBps: "30",
    sellTaxBps: "10",
    slippageBps: "15",
    lotSize: "1",
  },
];

export function getExecutionModelLabel(model: "next_open" | "same_close" | undefined): string {
  if (model === "same_close") return "Signal t, fill t close";
  return "Signal t, fill t+1 open";
}

export function formatMetric(
  value: number | undefined | null,
  formatter: (v: number) => string,
  fallback: string = "N/A"
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return fallback;
  return formatter(value);
}
