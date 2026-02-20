"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  SkeletonStats,
  SkeletonChart,
  ErrorState,
  NoResultsState,
  PageTransition,
} from "@/components/ui";
import { showSuccess, showError } from "@/components/ui/toast";
import { LineChart, DrawdownChart, MonthlyReturnsHeatmap } from "@/components/charts";
import { formatPercent, formatCurrency } from "@/lib/utils";
import { Play } from "lucide-react";

const STRATEGIES = [
  { value: "sma_crossover", label: "SMA Crossover" },
  { value: "ema_crossover", label: "EMA Crossover" },
  { value: "rsi_mean_reversion", label: "RSI Mean Reversion" },
  { value: "bollinger_bands", label: "Bollinger Band Breakout" },
  { value: "momentum", label: "Momentum Strategy" },
];

const STRATEGY_PARAM_DEFAULTS: Record<string, Record<string, number>> = {
  sma_crossover: { shortPeriod: 10, longPeriod: 20 },
  ema_crossover: { shortPeriod: 10, longPeriod: 20 },
  rsi_mean_reversion: { period: 14, oversold: 30, overbought: 70 },
  bollinger_bands: { period: 20, stdDev: 2 },
  momentum: { lookback: 20, threshold: 0.05 },
};

const PARAM_LABELS: Record<string, string> = {
  shortPeriod: "Short Period",
  longPeriod: "Long Period",
  period: "Period",
  oversold: "Oversold",
  overbought: "Overbought",
  stdDev: "Std Dev",
  lookback: "Lookback",
  threshold: "Threshold",
};

const ADVANCED_CONFIG_PRESETS: Array<{
  key: "low_cost" | "realistic" | "stress";
  label: string;
  executionModel: "next_open" | "same_close";
  feeBps: string;
  sellTaxBps: string;
  slippageBps: string;
  lotSize: string;
}> = [
  {
    key: "low_cost",
    label: "Low Cost",
    executionModel: "same_close",
    feeBps: "5",
    sellTaxBps: "5",
    slippageBps: "2",
    lotSize: "1",
  },
  {
    key: "realistic",
    label: "Realistic",
    executionModel: "next_open",
    feeBps: "15",
    sellTaxBps: "10",
    slippageBps: "5",
    lotSize: "1",
  },
  {
    key: "stress",
    label: "Stress",
    executionModel: "next_open",
    feeBps: "30",
    sellTaxBps: "10",
    slippageBps: "15",
    lotSize: "1",
  },
];

interface BacktestMetrics {
  totalReturn: number;
  netReturn: number;
  grossReturn: number;
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
  turnover: number;
  exposureRatio: number;
}

interface BacktestResult {
  symbol: string;
  strategy: string;
  initialCapital: number;
  metrics: BacktestMetrics;
  equityCurve: { date: Date; equity: number }[];
  configApplied: {
    executionModel: "next_open" | "same_close";
    costs: { feeBps: number; sellTaxBps: number; slippageBps: number };
    positionSizing: { mode: "all_in"; lotSize: number };
  };
  diagnostics: {
    coverageRatio: number;
    largestGapDays: number;
    droppedRows: number;
    usableRows: number;
    warnings: string[];
  };
}

interface EquityPointApi {
  date: string;
  equity: number;
}

const formatMetric = (value: number | undefined | null, formatter: (v: number) => string, fallback: string = "N/A"): string => {
  if (value === undefined || value === null || !Number.isFinite(value)) return fallback;
  return formatter(value);
};

function getExecutionModelLabel(model: "next_open" | "same_close" | undefined): string {
  if (model === "same_close") return "Signal t, fill t close";
  return "Signal t, fill t+1 open";
}

export default function BacktestingPage() {
  const [symbol, setSymbol] = useState("AAA");
  const [strategy, setStrategy] = useState("sma_crossover");
  const [capital, setCapital] = useState("100000");
  const [configMode, setConfigMode] = useState<"simple" | "advanced">("simple");

  const [executionModel, setExecutionModel] = useState<"next_open" | "same_close">("next_open");
  const [feeBps, setFeeBps] = useState("15");
  const [sellTaxBps, setSellTaxBps] = useState("10");
  const [slippageBps, setSlippageBps] = useState("5");
  const [lotSize, setLotSize] = useState("1");
  const [strategyParams, setStrategyParams] = useState<Record<string, string>>({ shortPeriod: "10", longPeriod: "20" });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const defaults = STRATEGY_PARAM_DEFAULTS[strategy] || {};
    const nextParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(defaults)) {
      nextParams[key] = String(value);
    }
    setStrategyParams(nextParams);
  }, [strategy]);

  const applyAdvancedPreset = useCallback((presetKey: "low_cost" | "realistic" | "stress") => {
    const preset = ADVANCED_CONFIG_PRESETS.find((item) => item.key === presetKey);
    if (!preset) return;
    setExecutionModel(preset.executionModel);
    setFeeBps(preset.feeBps);
    setSellTaxBps(preset.sellTaxBps);
    setSlippageBps(preset.slippageBps);
    setLotSize(preset.lotSize);
  }, []);

  const dailyReturns = useMemo(() => {
    if (!result?.equityCurve || result.equityCurve.length < 2) return [];

    const returns: { date: string; return: number }[] = [];
    for (let i = 1; i < result.equityCurve.length; i++) {
      const prevEquity = result.equityCurve[i - 1].equity;
      const currEquity = result.equityCurve[i].equity;
      const dailyReturn = prevEquity > 0 ? (currEquity - prevEquity) / prevEquity : 0;
      returns.push({
        date: result.equityCurve[i].date.toISOString().split("T")[0],
        return: dailyReturn,
      });
    }

    return returns;
  }, [result?.equityCurve]);

  const runBacktest = useCallback(async () => {
    const trimmedSymbol = symbol.trim().toUpperCase();
    if (!trimmedSymbol) {
      const msg = "Please enter a symbol";
      setError(msg);
      setStatusMessage("Backtest validation failed: missing symbol.");
      showError("Validation error", msg);
      return;
    }

    const capitalNum = Number(capital);
    if (!Number.isFinite(capitalNum) || capitalNum <= 0) {
      const msg = "Please enter a valid capital amount";
      setError(msg);
      setStatusMessage("Backtest validation failed: invalid capital.");
      showError("Validation error", msg);
      return;
    }

    const payload: Record<string, unknown> = {
      symbol: trimmedSymbol,
      strategy,
      capital: capitalNum,
    };

    if (configMode === "advanced") {
      const parsedParams: Record<string, number> = {};
      for (const [key, value] of Object.entries(strategyParams)) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
          const msg = `Invalid value for ${PARAM_LABELS[key] ?? key}`;
          setError(msg);
          setStatusMessage(`Backtest validation failed: invalid ${PARAM_LABELS[key] ?? key}.`);
          showError("Validation error", msg);
          return;
        }
        parsedParams[key] = parsed;
      }

      const fee = Number(feeBps);
      const tax = Number(sellTaxBps);
      const slippage = Number(slippageBps);
      const lots = Number(lotSize);
      if (!Number.isFinite(fee) || !Number.isFinite(tax) || !Number.isFinite(slippage) || !Number.isFinite(lots)) {
        const msg = "Advanced configuration contains invalid numeric values";
        setError(msg);
        setStatusMessage("Backtest validation failed: invalid advanced configuration.");
        showError("Validation error", msg);
        return;
      }

      payload.params = parsedParams;
      payload.executionModel = executionModel;
      payload.feeBps = fee;
      payload.sellTaxBps = tax;
      payload.slippageBps = slippage;
      payload.lotSize = lots;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;

    setLoading(true);
    setError("");
    setResult(null);
    setStatusMessage(`Running ${strategy} backtest for ${trimmedSymbol}...`);

    try {
      const response = await fetch("/api/backtesting", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `HTTP error! status: ${response.status}`);
      }

      const equityCurve = (data.equityCurve || []).map((point: EquityPointApi) => ({
        date: new Date(point.date),
        equity: point.equity,
      }));

      if (requestId !== requestSeqRef.current) {
        return;
      }
      setResult({
        ...data,
        symbol: trimmedSymbol,
        equityCurve,
      });

      const netReturn = data?.metrics?.netReturn ?? data?.metrics?.totalReturn ?? 0;
      setStatusMessage(`Backtest completed for ${trimmedSymbol}.`);
      showSuccess("Backtest complete", `${strategy} strategy on ${trimmedSymbol} returned ${formatPercent(netReturn)}`);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      if (requestId !== requestSeqRef.current) {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : "Failed to run backtest";
      setError(errorMessage);
      setStatusMessage(`Backtest failed for ${trimmedSymbol}.`);
      showError("Backtest failed", errorMessage);
      console.error("Backtest error:", err);
    } finally {
      if (requestId === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [symbol, strategy, capital, configMode, strategyParams, executionModel, feeBps, sellTaxBps, slippageBps, lotSize]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <PageTransition variant="slideUp">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="sr-only" role="status" aria-live="polite">{statusMessage}</p>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Strategy Backtesting</h1>
          <p className="text-gray-600 dark:text-gray-400">Test trading strategies on historical HOSE data</p>
        </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configure Backtest</CardTitle>
          <CardDescription>
            Use Simple mode for quick runs. Advanced mode enables strategy params and realistic execution/cost settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={configMode} onValueChange={(value) => setConfigMode(value as "simple" | "advanced")}>
            <TabsList className="mb-4">
              <TabsTrigger value="simple">Simple</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="simple">
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
                  <Input type="number" value={capital} onChange={(e) => setCapital(e.target.value)} placeholder="100000" min="1" />
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
            </TabsContent>

            <TabsContent value="advanced">
              <div className="space-y-6">
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
                    <Input type="number" value={capital} onChange={(e) => setCapital(e.target.value)} placeholder="100000" min="1" />
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

                <div>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Strategy Parameters</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {Object.entries(strategyParams).map(([key, value]) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{PARAM_LABELS[key] ?? key}</label>
                        <Input
                          type="number"
                          value={value}
                          onChange={(e) => setStrategyParams((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Execution & Costs</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {ADVANCED_CONFIG_PRESETS.map((preset) => (
                      <Button
                        key={preset.key}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyAdvancedPreset(preset.key)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Execution Model</label>
                      <Select
                        value={executionModel}
                        onChange={(e) => setExecutionModel(e.target.value as "next_open" | "same_close")}
                        options={[
                          { value: "next_open", label: "Signal t -> Fill t+1 Open" },
                          { value: "same_close", label: "Signal t -> Fill t Close" },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Fee (bps)</label>
                      <Input type="number" value={feeBps} onChange={(e) => setFeeBps(e.target.value)} min="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Sell Tax (bps)</label>
                      <Input type="number" value={sellTaxBps} onChange={(e) => setSellTaxBps(e.target.value)} min="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Slippage (bps)</label>
                      <Input type="number" value={slippageBps} onChange={(e) => setSlippageBps(e.target.value)} min="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Lot Size</label>
                      <Input type="number" value={lotSize} onChange={(e) => setLotSize(e.target.value)} min="1" />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {error && !loading && (
        <ErrorState
          message="Backtest failed"
          description={error}
          onRetry={runBacktest}
          className="mb-6"
        />
      )}

      {loading && (
        <>
          <SkeletonStats count={6} className="mb-6" />
          <SkeletonChart height={300} className="mb-6" />
        </>
      )}

      {result && !loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
            <Card><CardContent className="p-4"><p className="text-sm text-gray-500 dark:text-gray-400">Net Return</p><p className={`text-xl font-bold ${(result.metrics.netReturn ?? result.metrics.totalReturn ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{formatMetric(result.metrics.netReturn ?? result.metrics.totalReturn, formatPercent)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-gray-500 dark:text-gray-400">Gross Return</p><p className="text-xl font-bold text-gray-900 dark:text-white">{formatMetric(result.metrics.grossReturn, formatPercent)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-gray-500 dark:text-gray-400">CAGR</p><p className={`text-xl font-bold ${(result.metrics.cagr ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{formatMetric(result.metrics.cagr, formatPercent)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-gray-500 dark:text-gray-400">Sharpe</p><p className="text-xl font-bold text-gray-900 dark:text-white">{formatMetric(result.metrics.sharpeRatio, (v) => v.toFixed(2))}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-gray-500 dark:text-gray-400">Max Drawdown</p><p className="text-xl font-bold text-red-600 dark:text-red-400">{formatMetric(result.metrics.maxDrawdown, formatPercent)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-gray-500 dark:text-gray-400">Win Rate</p><p className="text-xl font-bold text-gray-900 dark:text-white">{formatMetric(result.metrics.winRate, formatPercent)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-gray-500 dark:text-gray-400">Trades</p><p className="text-xl font-bold text-gray-900 dark:text-white">{result.metrics.totalTrades ?? 0}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-gray-500 dark:text-gray-400">Exposure</p><p className="text-xl font-bold text-gray-900 dark:text-white">{formatMetric(result.metrics.exposureRatio, formatPercent)}</p></CardContent></Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Execution Summary</CardTitle>
              <CardDescription>
                {getExecutionModelLabel(result.configApplied?.executionModel)} | Fee {result.configApplied?.costs?.feeBps ?? 0} bps |
                Sell Tax {result.configApplied?.costs?.sellTaxBps ?? 0} bps | Slippage {result.configApplied?.costs?.slippageBps ?? 0} bps
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Usable Rows</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{result.diagnostics?.usableRows ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Coverage Ratio</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatPercent(result.diagnostics?.coverageRatio ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Largest Gap</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{result.diagnostics?.largestGapDays ?? 0} days</p>
                </div>
              </div>

              {Array.isArray(result.diagnostics?.warnings) && result.diagnostics.warnings.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data Warnings</p>
                  <div className="flex flex-wrap gap-2">
                    {result.diagnostics.warnings.map((warning, index) => (
                      <Badge key={`${warning}-${index}`} className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        {warning}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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
                    value: e.equity,
                  }))}
                  color="#3b82f6"
                  height={300}
                  format="currency"
                  showArea
                />
              ) : (
                <NoResultsState title="No equity curve data" description="Run a backtest to see the equity curve" className="h-[300px]" />
              )}
            </CardContent>
          </Card>

          {result.equityCurve && result.equityCurve.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Drawdown Analysis</CardTitle>
                <CardDescription>Underwater periods showing decline from peak equity</CardDescription>
              </CardHeader>
              <CardContent>
                <DrawdownChart equityCurve={result.equityCurve} height={250} />
              </CardContent>
            </Card>
          )}

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
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Profit Factor</span><span className="font-medium text-gray-900 dark:text-white">{formatMetric(result.metrics.profitFactor, (v) => v.toFixed(2))}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Average Return</span><span className={`font-medium ${(result.metrics.avgReturn ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{formatMetric(result.metrics.avgReturn, formatPercent)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Average Win</span><span className="font-medium text-green-600 dark:text-green-400">{formatMetric(result.metrics.avgWin, formatPercent)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Average Loss</span><span className="font-medium text-red-600 dark:text-red-400">{formatMetric(result.metrics.avgLoss, formatPercent)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Best Trade</span><span className="font-medium text-green-600 dark:text-green-400">{formatMetric(result.metrics.bestTrade, formatPercent)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Worst Trade</span><span className="font-medium text-red-600 dark:text-red-400">{formatMetric(result.metrics.worstTrade, formatPercent)}</span></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Risk & Capital</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Sortino Ratio</span><span className="font-medium text-gray-900 dark:text-white">{formatMetric(result.metrics.sortinoRatio, (v) => v.toFixed(2))}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Max DD Duration</span><span className="font-medium text-gray-900 dark:text-white">{result.metrics.maxDrawdownDuration ?? 0} days</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Turnover</span><span className="font-medium text-gray-900 dark:text-white">{formatMetric(result.metrics.turnover, formatPercent)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Initial Capital</span><span className="font-medium text-gray-900 dark:text-white">{formatCurrency(result.initialCapital)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Final Value (Net)</span><span className={`font-medium ${(result.metrics.netReturn ?? result.metrics.totalReturn ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{formatCurrency(result.initialCapital * (1 + (result.metrics.netReturn ?? result.metrics.totalReturn ?? 0)))}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
      </div>
    </PageTransition>
  );
}
