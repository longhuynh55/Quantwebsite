"use client";

import { Suspense } from "react";
import { useUrlState, useUrlStateObject } from "@/lib/hooks";
import {
  Card,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
  SkeletonStats,
  SkeletonChart,
  ErrorState,
  PageTransition,
  ErrorBoundary,
} from "@/components/ui";
import { Download, Settings2, Activity } from "lucide-react";
import { StrategyConfig } from "./types";
import { ADVANCED_CONFIG_PRESETS } from "./constants";
import {
  StrategySelector,
  BacktestControls,
  StrategyParams,
  ExecutionConfig,
  ResultsSummary,
  ResultsCharts,
  ResultsTable,
  DiagnosticsTab,
  DetailedStats,
} from "./components";
import { useBacktest, useStrategyParams, useDailyReturns } from "./hooks";

function BacktestingPageContent() {
  const [symbol, setSymbol] = useUrlState<string>("symbol", "AAA");
  const [strategy, setStrategy] = useUrlState<string>("strategy", "sma_crossover");
  const [capital, setCapital] = useUrlState<string>("capital", "100000");

  const [config, setConfig] = useUrlStateObject<StrategyConfig>({
    executionModel: "next_open",
    feeBps: "15",
    sellTaxBps: "10",
    slippageBps: "5",
    lotSize: "1",
  });

  const { strategyParams, setStrategyParams } = useStrategyParams(strategy);

  const { loading, result, error, statusMessage, runBacktest, clearResult } = useBacktest({
    symbol,
    strategy,
    capital,
    strategyParams,
    config,
  });

  const dailyReturns = useDailyReturns(result);

  const handleResetAll = () => {
    clearResult();
    setSymbol("AAA");
    setStrategy("sma_crossover");
  };

  const applyAdvancedPreset = (presetKey: "low_cost" | "realistic" | "stress") => {
    const preset = ADVANCED_CONFIG_PRESETS.find((item) => item.key === presetKey);
    if (!preset) return;
    setConfig({
      executionModel: preset.executionModel,
      feeBps: preset.feeBps,
      sellTaxBps: preset.sellTaxBps,
      slippageBps: preset.slippageBps,
      lotSize: preset.lotSize,
    });
  };

  const handleStrategyParamChange = (key: string, value: string) => {
    setStrategyParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfigChange = (updates: Partial<StrategyConfig>) => {
    setConfig(updates);
  };

  return (
    <PageTransition variant="slideUp">
      <div className="max-w-full space-y-8">
        <p className="sr-only" role="status" aria-live="polite">
          {statusMessage}
        </p>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Strategy Backtesting
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Validate trading hypotheses on historical HOSE market data
            </p>
          </div>
          <BacktestControls onRun={runBacktest} loading={loading} onReset={handleResetAll} />
        </div>

        {/* Configuration Panel */}
        <Card className="border-none shadow-none bg-transparent">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <StrategySelector
              symbol={symbol}
              onSymbolChange={setSymbol}
              strategy={strategy}
              onStrategyChange={setStrategy}
              capital={capital}
              onCapitalChange={setCapital}
            />
          </div>

          {/* Settings Tabs */}
          <Tabs defaultValue="strategy" className="mt-6">
            <div className="flex items-center gap-4 mb-4 overflow-x-auto pb-1 no-scrollbar">
              <TabsList className="bg-gray-100 dark:bg-slate-900 rounded-xl p-1 h-10 border border-gray-200 dark:border-slate-800">
                <TabsTrigger
                  value="strategy"
                  className="rounded-lg px-4 text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600"
                >
                  <Settings2 className="w-3.5 h-3.5 mr-2" />
                  Strategy Parameters
                </TabsTrigger>
                <TabsTrigger
                  value="execution"
                  className="rounded-lg px-4 text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600"
                >
                  <Activity className="w-3.5 h-3.5 mr-2" />
                  Execution & Costs
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="strategy" className="mt-0">
              <StrategyParams
                strategyParams={strategyParams}
                onStrategyParamChange={handleStrategyParamChange}
              />
            </TabsContent>

            <TabsContent value="execution" className="mt-0">
              <ExecutionConfig
                config={config}
                onConfigChange={handleConfigChange}
                onPresetApply={applyAdvancedPreset}
              />
            </TabsContent>
          </Tabs>
        </Card>

        {error && !loading && (
          <ErrorState message="Backtest failed" description={error} onRetry={runBacktest} className="mb-6" />
        )}

        {loading && (
          <>
            <SkeletonStats count={6} className="mb-6" />
            <SkeletonChart height={300} className="mb-6" />
          </>
        )}

        {result && !loading && (
          <ErrorBoundary
            fallback={
              <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-center">
                <p className="text-red-600 dark:text-red-400 font-medium mb-2">
                  Error displaying backtest results
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  The results couldn&apos;t be rendered. Please try running the backtest again.
                </p>
                <Button size="sm" onClick={runBacktest}>
                  Retry Backtest
                </Button>
              </div>
            }
          >
            <div className="space-y-6">
              {/* Performance Summary Grid */}
              <ResultsSummary result={result} />

              <Tabs defaultValue="charts" className="w-full">
                <div className="flex items-center justify-between mb-4 bg-gray-50/50 dark:bg-slate-900/50 p-1.5 rounded-xl border border-gray-100 dark:border-slate-800">
                  <TabsList className="bg-transparent border-none">
                    <TabsTrigger
                      value="charts"
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm"
                    >
                      Analysis Charts
                    </TabsTrigger>
                    <TabsTrigger
                      value="trades"
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm"
                    >
                      Trade Log
                    </TabsTrigger>
                    <TabsTrigger
                      value="diagnostics"
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm"
                    >
                      Diagnostics
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex items-center gap-2 pr-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg">
                      <Download className="w-3.5 h-3.5 mr-2" />
                      PDF Report
                    </Button>
                  </div>
                </div>

                <TabsContent value="charts" className="space-y-6 mt-0">
                  <ResultsCharts result={result} dailyReturns={dailyReturns} />
                </TabsContent>

                <TabsContent value="trades" className="mt-0">
                  <ResultsTable result={result} symbol={symbol} />
                </TabsContent>

                <TabsContent value="diagnostics" className="mt-0">
                  <DiagnosticsTab result={result} />
                </TabsContent>
              </Tabs>

              {/* Detailed Stats Row */}
              <DetailedStats result={result} />
            </div>
          </ErrorBoundary>
        )}
      </div>
    </PageTransition>
  );
}

export default function BacktestingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500 dark:text-slate-400">Loading backtesting workspace...</div>}>
      <BacktestingPageContent />
    </Suspense>
  );
}
