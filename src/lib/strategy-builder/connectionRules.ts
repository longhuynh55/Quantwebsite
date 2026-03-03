export const STRATEGY_BUILDER_CONNECTION_RULES: Record<string, readonly string[]> = {
  dataSource: ["indicator", "filter", "math", "sort", "weighting", "signal"],
  indicator: ["filter", "signal", "sort", "math", "conditional", "merge", "output"],
  filter: ["signal", "sort", "weighting", "conditional", "merge", "output"],
  signal: ["output", "weighting", "merge", "risk", "backtest"],
  output: [],
  weighting: ["signal", "output", "risk", "backtest"],
  conditional: ["signal", "filter", "indicator", "output", "merge"],
  sort: ["filter", "signal", "weighting", "output"],
  math: ["filter", "indicator", "signal", "conditional", "output"],
  merge: ["signal", "output", "risk", "weighting", "backtest"],
  risk: ["output", "backtest"],
  backtest: [],
};

export function isConnectionTypeAllowed(sourceType: string, targetType: string): boolean {
  const allowedTargets = STRATEGY_BUILDER_CONNECTION_RULES[sourceType];
  if (!allowedTargets) {
    return false;
  }
  return allowedTargets.includes(targetType);
}

