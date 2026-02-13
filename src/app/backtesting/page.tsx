"use client";

import { useState, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  SkeletonStats,
  SkeletonChart,
  ErrorState,
  NoResultsState,
} from "@/components/ui";
import { showSuccess, showError } from "@/components/ui/toast";
import { LineChart, DrawdownChart, MonthlyReturnsHeatmap } from "@/components/charts";
import { formatPercent, formatCurrency } from "@/lib/utils";
import { Play } from "lucide-react";
import { useMemo } from "react";

const STRATEGIES = [
  { value: "sma_crossover", label: "SMA Crossover" },
  { value: "ema_crossover", label: "EMA Crossover" },
  { value: "rsi_mean_reversion", label: "RSI Mean Reversion" },
  { value: "bollinger_bands", label: "Bollinger Band Breakout" },
  { value: "momentum", label: "Momentum Strategy" },
];

interface BacktestMetrics {
  totalReturn: number;
  cagr: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  avgReturn: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  sortinoRatio: number;
  maxDrawdownDuration: number;
}

interface BacktestResult {
  symbol: string;
  strategy: string;
  initialCapital: number;
  metrics: BacktestMetrics;
  equityCurve: { date: Date; equity: number }[];
}

interface EquityPointApi {
  date: string;
  equity: number;
}

const formatMetric = (value: number | undefined | null, formatter: (v: number) => string, fallback: string = "N/A"): string => {
  if (value === undefined || value === null || !isFinite(value)) return fallback;
  return formatter(value);
};

export default function BacktestingPage() {
  const [symbol, setSymbol] = useState("AAA");
  const [strategy, setStrategy] = useState("sma_crossover");
  const [capital, setCapital] = useState("100000");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState("");

  // AbortController for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Calculate daily returns from equity curve for heatmap
  const dailyReturns = useMemo(() => {
    if (!result?.equityCurve || result.equityCurve.length < 2) return [];

    const returns: { date: string; return: number }[] = [];
    for (let i = 1; i < result.equityCurve.length; i++) {
      const prevEquity = result.equityCurve[i - 1].equity;
      const currEquity = result.equityCurve[i].equity;
      const dailyReturn = prevEquity > 0 ? (currEquity - prevEquity) / prevEquity : 0;
      returns.push({
        date: result.equityCurve[i].date.toISOString().split('T')[0],
        return: dailyReturn,
      });
    }
    return returns;
  }, [result?.equityCurve]);

  const runBacktest = useCallback(async () => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Validate inputs
    const trimmedSymbol = symbol.trim().toUpperCase();
    if (!trimmedSymbol) {
      const msg = "Please enter a symbol";
      setError(msg);
      showError("Validation error", msg);
      return;
    }

    const capitalNum = parseFloat(capital);
    if (isNaN(capitalNum) || capitalNum <= 0) {
      const msg = "Please enter a valid capital amount";
      setError(msg);
      showError("Validation error", msg);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        `/api/backtesting?symbol=${encodeURIComponent(trimmedSymbol)}&strategy=${strategy}&capital=${capitalNum}`,
        { signal: abortControllerRef.current.signal }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const equityCurve = (data.equityCurve || []).map((e: EquityPointApi) => ({
        date: new Date(e.date),
        equity: e.equity,
      }));

      setResult({
        ...data,
        symbol: trimmedSymbol,
        equityCurve: equityCurve, // Show full equity curve for complete backtest visualization
      });
      showSuccess("Backtest complete", `${strategy} strategy on ${trimmedSymbol} returned ${formatPercent(data.metrics?.totalReturn ?? 0)}`);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : "Failed to run backtest";
      setError(errorMessage);
      showError("Backtest failed", errorMessage);
      console.error("Backtest error:", err);
    } finally {
      setLoading(false);
    }
  }, [symbol, strategy, capital]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Strategy Backtesting</h1>
        <p className="text-gray-600 dark:text-gray-400">Test trading strategies on historical HOSE data</p>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Configure Backtest</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Symbol</label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g., AAA"
                maxLength={10}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Strategy</label>
              <Select value={strategy} onChange={(e) => setStrategy(e.target.value)} options={STRATEGIES} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Initial Capital</label>
              <Input
                type="number"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                placeholder="100000"
                min="1"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={runBacktest} disabled={loading} className="w-full">
                {loading ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Run Backtest
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && !loading && (
        <ErrorState
          message="Backtest failed"
          description={error}
          onRetry={runBacktest}
          className="mb-6"
        />
      )}

      {/* Loading State */}
      {loading && (
        <>
          <SkeletonStats count={6} className="mb-6" />
          <SkeletonChart height={300} className="mb-6" />
        </>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Return</p>
                <p className={`text-xl font-bold ${(result.metrics.totalReturn ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatMetric(result.metrics.totalReturn, formatPercent)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">CAGR</p>
                <p className={`text-xl font-bold ${(result.metrics.cagr ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatMetric(result.metrics.cagr, formatPercent)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Sharpe Ratio</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatMetric(result.metrics.sharpeRatio, (v) => v.toFixed(2))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Max Drawdown</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">
                  {formatMetric(result.metrics.maxDrawdown, formatPercent)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Win Rate</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatMetric(result.metrics.winRate, formatPercent)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Trades</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{result.metrics.totalTrades ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Equity Curve</CardTitle>
              <CardDescription>Portfolio value over time starting from {formatCurrency(result.initialCapital)}</CardDescription>
            </CardHeader>
            <CardContent>
              {result.equityCurve && result.equityCurve.length > 0 ? (
                <LineChart
                  data={result.equityCurve.map((e) => ({
                    date: e.date.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", year: "2-digit" }),
                    value: e.equity
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

          {/* Drawdown Chart */}
          {result.equityCurve && result.equityCurve.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Drawdown Analysis</CardTitle>
                <CardDescription>Underwater periods showing decline from peak equity</CardDescription>
              </CardHeader>
              <CardContent>
                <DrawdownChart
                  equityCurve={result.equityCurve}
                  height={250}
                />
              </CardContent>
            </Card>
          )}

          {/* Monthly Returns Heatmap */}
          {dailyReturns.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Monthly Returns</CardTitle>
                <CardDescription>Performance breakdown by month and year</CardDescription>
              </CardHeader>
              <CardContent>
                <MonthlyReturnsHeatmap returns={dailyReturns} />
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Trade Statistics</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Profit Factor</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatMetric(result.metrics.profitFactor, (v) => v.toFixed(2))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Average Return</span>
                    <span className={`font-medium ${(result.metrics.avgReturn ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatMetric(result.metrics.avgReturn, formatPercent)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Average Win</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatMetric(result.metrics.avgWin, formatPercent)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Average Loss</span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {formatMetric(result.metrics.avgLoss, formatPercent)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Best Trade</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatMetric(result.metrics.bestTrade, formatPercent)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Worst Trade</span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {formatMetric(result.metrics.worstTrade, formatPercent)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Risk Metrics</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Sortino Ratio</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatMetric(result.metrics.sortinoRatio, (v) => isFinite(v) ? v.toFixed(2) : "Inf")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Max DD Duration</span>
                    <span className="font-medium text-gray-900 dark:text-white">{result.metrics.maxDrawdownDuration ?? 0} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Initial Capital</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(result.initialCapital)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Final Value</span>
                    <span className={`font-medium ${(result.metrics.totalReturn ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(result.initialCapital * (1 + (result.metrics.totalReturn ?? 0)))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
