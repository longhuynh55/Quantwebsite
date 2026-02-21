import { useState, useEffect } from "react";
import { STRATEGY_PARAM_DEFAULTS } from "../constants";

export function useStrategyParams(strategy: string) {
  const [strategyParams, setStrategyParams] = useState<Record<string, string>>({});

  useEffect(() => {
    const defaults = STRATEGY_PARAM_DEFAULTS[strategy as string] || {};
    const nextParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(defaults)) {
      nextParams[key] = String(value);
    }
    const timeoutId = window.setTimeout(() => {
      setStrategyParams(nextParams);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [strategy]);

  return { strategyParams, setStrategyParams };
}
