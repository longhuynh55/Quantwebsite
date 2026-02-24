import { Card, CardContent, CardHeader, CardTitle, NoResultsState } from "@/components/ui";
import { LineChart, DrawdownChart, MonthlyReturnsHeatmap } from "@/components/charts";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { BacktestResult } from "../types";

interface ResultsChartsProps {
  result: BacktestResult;
  dailyReturns: { date: string; return: number }[];
}

export function ResultsCharts({ result, dailyReturns }: ResultsChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="overflow-hidden border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="h-px bg-emerald-700 dark:bg-emerald-500" />
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-stone-900 dark:text-neutral-100">
            <TrendingUp className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            Equity Curve
          </CardTitle>
        </CardHeader>
        <CardContent>
          {result.equityCurve && result.equityCurve.length > 0 ? (
            <LineChart
              data={result.equityCurve.map((e) => ({
                date: e.date.toLocaleDateString("en-US", {
                  timeZone: "UTC",
                  month: "short",
                  year: "2-digit",
                }),
                value: e.equity,
              }))}
              color="#047857"
              height={300}
              format="currency"
              showArea
            />
          ) : (
            <NoResultsState
              title="No equity curve data"
              description="Run a backtest to see the equity curve"
              className="h-[300px]"
            />
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="h-px bg-rose-500 dark:bg-rose-500/70" />
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-stone-900 dark:text-neutral-100">
            <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            Drawdown Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DrawdownChart equityCurve={result.equityCurve} height={300} />
        </CardContent>
      </Card>

      {dailyReturns.length > 0 && (
        <Card className="overflow-hidden border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 lg:col-span-2">
          <div className="h-px bg-stone-400/80 dark:bg-neutral-600/80" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-stone-900 dark:text-neutral-100">
              <BarChart3 className="w-4 h-4 text-stone-500 dark:text-neutral-400" />
              Monthly Performance Heatmap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyReturnsHeatmap returns={dailyReturns} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
