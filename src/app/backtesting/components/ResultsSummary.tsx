import { Card, CardContent } from "@/components/ui";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Shield,
  History,
} from "lucide-react";
import { formatPercent, cn } from "@/lib/utils";
import { formatMetric } from "../constants";
import { BacktestResult } from "../types";

interface ResultsSummaryProps {
  result: BacktestResult;
}

export function ResultsSummary({ result }: ResultsSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9">
      <Card className="relative overflow-hidden border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <div className="absolute inset-x-0 top-0 h-px bg-emerald-600/80 dark:bg-emerald-500/70" />
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">
              Net Return
            </span>
          </div>
          <p
            className={cn(
              "text-lg font-bold",
              (result.metrics.netReturn ?? 0) >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-700 dark:text-rose-400"
            )}
          >
            {formatPercent(result.metrics.netReturn ?? 0)}
          </p>
        </CardContent>
      </Card>

      <Card className="border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3.5 h-3.5 text-stone-500 dark:text-neutral-400" />
            <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">
              CAGR
            </span>
          </div>
          <p className="text-lg font-bold text-stone-900 dark:text-neutral-100">
            {formatPercent(result.metrics.cagr ?? 0)}
          </p>
        </CardContent>
      </Card>

      <Card className="border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-3.5 h-3.5 text-stone-500 dark:text-neutral-400" />
            <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">
              Sharpe
            </span>
          </div>
          <p className="text-lg font-bold text-stone-900 dark:text-neutral-100">
            {formatMetric(result.metrics.sharpeRatio, (v) => v.toFixed(2))}
          </p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border-rose-200/70 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/10">
        <div className="absolute inset-x-0 top-0 h-px bg-rose-500/80 dark:bg-rose-500/60" />
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
            <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">
              Max Drawdown
            </span>
          </div>
          <p className="text-lg font-bold text-rose-700 dark:text-rose-400">
            {formatPercent(result.metrics.maxDrawdown ?? 0)}
          </p>
        </CardContent>
      </Card>

      <Card className="border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3.5 h-3.5 text-stone-500 dark:text-neutral-400" />
            <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">
              Win Rate
            </span>
          </div>
          <p className="text-lg font-bold text-stone-900 dark:text-neutral-100">
            {formatPercent(result.metrics.winRate ?? 0)}
          </p>
        </CardContent>
      </Card>

      <Card className="border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <History className="w-3.5 h-3.5 text-stone-500 dark:text-neutral-400" />
            <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">
              Total Trades
            </span>
          </div>
          <p className="text-lg font-bold text-stone-900 dark:text-neutral-100">
            {result.metrics.totalTrades ?? 0}
          </p>
        </CardContent>
      </Card>

      <Card className="border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-3.5 h-3.5 text-stone-500 dark:text-neutral-400" />
            <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">
              Profit Factor
            </span>
          </div>
          <p className="text-lg font-bold text-stone-900 dark:text-neutral-100">
            {formatMetric(result.metrics.profitFactor, (v) => v.toFixed(2))}
          </p>
        </CardContent>
      </Card>

      <Card className="border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3.5 h-3.5 text-stone-500 dark:text-neutral-400" />
            <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">
              Exposure
            </span>
          </div>
          <p className="text-lg font-bold text-stone-900 dark:text-neutral-100">
            {formatPercent(result.metrics.exposureRatio ?? 0)}
          </p>
        </CardContent>
      </Card>

      <Card className="border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-stone-500 dark:text-neutral-400" />
            <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">
              Sortino
            </span>
          </div>
          <p className="text-lg font-bold text-stone-900 dark:text-neutral-100">
            {formatMetric(result.metrics.sortinoRatio, (v) => v.toFixed(2))}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
