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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
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
              color="#3b82f6"
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            Drawdown Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DrawdownChart equityCurve={result.equityCurve} height={300} />
        </CardContent>
      </Card>

      {dailyReturns.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-500" />
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
