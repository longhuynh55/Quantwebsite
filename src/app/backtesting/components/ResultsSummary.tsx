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
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9 gap-4">
      <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
              Net Return
            </span>
          </div>
          <p
            className={cn(
              "text-lg font-bold",
              (result.metrics.netReturn ?? 0) >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            )}
          >
            {formatPercent(result.metrics.netReturn ?? 0)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
              CAGR
            </span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
            {formatPercent(result.metrics.cagr ?? 0)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
              Sharpe
            </span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
            {formatMetric(result.metrics.sharpeRatio, (v) => v.toFixed(2))}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-red-50/30 dark:bg-red-900/10 border-red-100/50 dark:border-red-900/20">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
              Max Drawdown
            </span>
          </div>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">
            {formatPercent(result.metrics.maxDrawdown ?? 0)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
              Win Rate
            </span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
            {formatPercent(result.metrics.winRate ?? 0)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
              Total Trades
            </span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
            {result.metrics.totalTrades ?? 0}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
              Profit Factor
            </span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
            {formatMetric(result.metrics.profitFactor, (v) => v.toFixed(2))}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
              Exposure
            </span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
            {formatPercent(result.metrics.exposureRatio ?? 0)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
              Sortino
            </span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
            {formatMetric(result.metrics.sortinoRatio, (v) => v.toFixed(2))}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
