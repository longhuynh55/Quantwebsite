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
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between border-b border-gray-100 dark:border-slate-800/50 mb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Performance Metrics
          </CardTitle>
          <Activity className="w-3.5 h-3.5 text-blue-500" />
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">Profit Factor</span>
            <span className="text-xs font-bold font-mono">
              {formatMetric(result.metrics.profitFactor, (v) => v.toFixed(2))}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">Average Return</span>
            <span
              className={cn(
                "text-xs font-bold font-mono",
                (result.metrics.avgReturn ?? 0) >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {formatMetric(result.metrics.avgReturn, formatPercent)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">Average Win / Loss</span>
            <div className="text-xs font-bold font-mono">
              <span className="text-green-600">
                {formatMetric(result.metrics.avgWin, formatPercent)}
              </span>{" "}
              <span className="text-gray-300 mx-1">/</span>{" "}
              <span className="text-red-600">
                {formatMetric(result.metrics.avgLoss, formatPercent)}
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">Best / Worst Trade</span>
            <div className="text-xs font-bold font-mono">
              <span className="text-green-600">
                {formatMetric(result.metrics.bestTrade, formatPercent)}
              </span>{" "}
              <span className="text-gray-300 mx-1">/</span>{" "}
              <span className="text-red-600">
                {formatMetric(result.metrics.worstTrade, formatPercent)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between border-b border-gray-100 dark:border-slate-800/50 mb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Risk & Exposure
          </CardTitle>
          <Shield className="w-3.5 h-3.5 text-blue-500" />
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">Max DD Duration</span>
            <span className="text-xs font-bold font-mono">{result.metrics.maxDrawdownDuration ?? 0} days</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">Turnover Ratio</span>
            <span className="text-xs font-bold font-mono">
              {formatMetric(result.metrics.turnover, formatPercent)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">Initial Capital</span>
            <span className="text-xs font-bold font-mono">{formatCurrency(result.initialCapital)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">Final Portfolio Value</span>
            <span
              className={cn(
                "text-xs font-bold font-mono",
                (result.metrics.netReturn ?? 0) >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
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
