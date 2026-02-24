import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Activity, Shield } from "lucide-react";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { formatMetric } from "../constants";
import { BacktestResult } from "../types";

interface DetailedStatsProps {
  result: BacktestResult;
}

export function DetailedStats({ result }: DetailedStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <CardHeader className="pb-2 flex flex-row items-center justify-between border-b border-stone-200 dark:border-neutral-800/70 mb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-neutral-500">
            Performance Metrics
          </CardTitle>
          <Activity className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-stone-500 dark:text-neutral-400">Profit Factor</span>
            <span className="text-xs font-bold font-mono">
              {formatMetric(result.metrics.profitFactor, (v) => v.toFixed(2))}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-stone-500 dark:text-neutral-400">Average Return</span>
            <span
              className={cn(
                "text-xs font-bold font-mono",
                (result.metrics.avgReturn ?? 0) >= 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-700 dark:text-rose-400"
              )}
            >
              {formatMetric(result.metrics.avgReturn, formatPercent)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-stone-500 dark:text-neutral-400">Average Win / Loss</span>
            <div className="text-xs font-bold font-mono">
              <span className="text-emerald-700 dark:text-emerald-400">
                {formatMetric(result.metrics.avgWin, formatPercent)}
              </span>{" "}
              <span className="text-stone-300 dark:text-neutral-600 mx-1">/</span>{" "}
              <span className="text-rose-700 dark:text-rose-400">
                {formatMetric(result.metrics.avgLoss, formatPercent)}
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-stone-500 dark:text-neutral-400">Best / Worst Trade</span>
            <div className="text-xs font-bold font-mono">
              <span className="text-emerald-700 dark:text-emerald-400">
                {formatMetric(result.metrics.bestTrade, formatPercent)}
              </span>{" "}
              <span className="text-stone-300 dark:text-neutral-600 mx-1">/</span>{" "}
              <span className="text-rose-700 dark:text-rose-400">
                {formatMetric(result.metrics.worstTrade, formatPercent)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <CardHeader className="pb-2 flex flex-row items-center justify-between border-b border-stone-200 dark:border-neutral-800/70 mb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-neutral-500">
            Risk & Exposure
          </CardTitle>
          <Shield className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-stone-500 dark:text-neutral-400">Max DD Duration</span>
            <span className="text-xs font-bold font-mono">{result.metrics.maxDrawdownDuration ?? 0} days</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-stone-500 dark:text-neutral-400">Turnover Ratio</span>
            <span className="text-xs font-bold font-mono">
              {formatMetric(result.metrics.turnover, formatPercent)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-stone-500 dark:text-neutral-400">Initial Capital</span>
            <span className="text-xs font-bold font-mono">{formatCurrency(result.initialCapital)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-stone-500 dark:text-neutral-400">Final Portfolio Value</span>
            <span
              className={cn(
                "text-xs font-bold font-mono",
                (result.metrics.netReturn ?? 0) >= 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-700 dark:text-rose-400"
              )}
            >
              {formatCurrency(result.initialCapital * (1 + (result.metrics.netReturn ?? 0)))}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
