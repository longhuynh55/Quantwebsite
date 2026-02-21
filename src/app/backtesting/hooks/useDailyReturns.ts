import { useMemo } from "react";
import { BacktestResult } from "../types";

export function useDailyReturns(result: BacktestResult | null) {
  const equityCurve = result?.equityCurve;

  return useMemo(() => {
    if (!equityCurve || equityCurve.length < 2) return [];

    const returns: { date: string; return: number }[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prevEquity = equityCurve[i - 1].equity;
      const currEquity = equityCurve[i].equity;
      const dailyReturn = prevEquity > 0 ? (currEquity - prevEquity) / prevEquity : 0;
      returns.push({
        date: equityCurve[i].date.toISOString().split("T")[0],
        return: dailyReturn,
      });
    }

    return returns;
  }, [equityCurve]);
}
