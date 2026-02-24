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
      <div className="max-w-full space-y-6">
        <p className="sr-only" role="status" aria-live="polite">
          {statusMessage}
        </p>

        {/* Header */}
        <header className="mb-12 pb-8 border-b border-stone-200 dark:border-neutral-800">
          {/* Kicker with emerald accent */}
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
            <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
              Research Workspace
            </span>
          </div>

          {/* Headline - Serif, dramatic */}
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight">
            Strategy Backtesting
          </h1>

          {/* Subheadline */}
          <p className="font-sans text-base text-stone-600 dark:text-neutral-400 max-w-2xl leading-relaxed mt-4">
            Validate trading hypotheses on historical HOSE market data.
          </p>

          <div className="mt-6 flex justify-end">
            <BacktestControls onRun={runBacktest} loading={loading} onReset={handleResetAll} />
          </div>
        </header>

        {/* Configuration Panel */}
        <Card className="overflow-hidden border border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <div className="h-px bg-emerald-700 dark:bg-emerald-500" />
          <div className="space-y-6 p-5 sm:p-6">
            <div className="space-y-2 border-b border-stone-200 pb-4 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="h-px w-8 bg-emerald-700 dark:bg-emerald-500" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-neutral-500">
                  Configuration
                </p>
              </div>
              <h2 className="font-serif text-xl font-semibold text-stone-900 dark:text-white">
                Model and Parameters
              </h2>
              <p className="text-sm text-stone-600 dark:text-neutral-400">
                Set symbols, strategy rules, and execution assumptions before running a backtest.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
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
            <Tabs defaultValue="strategy" className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-px w-7 bg-stone-300 dark:bg-neutral-700" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-neutral-500">
                  Parameter Groups
                </p>
              </div>

              <div className="overflow-x-auto pb-1 no-scrollbar">
                <TabsList className="h-11 border border-stone-200 bg-stone-100/80 p-1 dark:border-neutral-700 dark:bg-neutral-900/80">
                  <TabsTrigger
                    value="strategy"
                    className="px-4 text-xs font-semibold uppercase tracking-wide text-stone-600 data-[state=active]:bg-white data-[state=active]:text-emerald-700 dark:text-neutral-300 dark:data-[state=active]:bg-neutral-950 dark:data-[state=active]:text-emerald-400"
                  >
                    <Settings2 className="mr-2 h-3.5 w-3.5" />
                    Strategy Parameters
                  </TabsTrigger>
                  <TabsTrigger
                    value="execution"
                    className="px-4 text-xs font-semibold uppercase tracking-wide text-stone-600 data-[state=active]:bg-white data-[state=active]:text-emerald-700 dark:text-neutral-300 dark:data-[state=active]:bg-neutral-950 dark:data-[state=active]:text-emerald-400"
                  >
                    <Activity className="mr-2 h-3.5 w-3.5" />
                    Execution and Costs
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
          </div>
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
              <div className="border border-rose-200 bg-rose-50/70 p-6 text-center dark:border-rose-900/40 dark:bg-rose-900/10">
                <p className="mb-2 font-medium text-rose-700 dark:text-rose-400">
                  Error displaying backtest results
                </p>
                <p className="mb-4 text-sm text-stone-600 dark:text-neutral-400">
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
                <div className="mb-4 overflow-hidden border border-stone-200 bg-stone-50/80 p-2 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <TabsList className="h-10 border border-stone-200 bg-white/80 p-1 dark:border-neutral-700 dark:bg-neutral-950/80">
                      <TabsTrigger
                        value="charts"
                        className="px-4 text-xs font-semibold uppercase tracking-wide text-stone-600 data-[state=active]:bg-white data-[state=active]:text-emerald-700 dark:text-neutral-300 dark:data-[state=active]:bg-neutral-900 dark:data-[state=active]:text-emerald-400"
                      >
                        Analysis Charts
                      </TabsTrigger>
                      <TabsTrigger
                        value="trades"
                        className="px-4 text-xs font-semibold uppercase tracking-wide text-stone-600 data-[state=active]:bg-white data-[state=active]:text-emerald-700 dark:text-neutral-300 dark:data-[state=active]:bg-neutral-900 dark:data-[state=active]:text-emerald-400"
                      >
                        Trade Log
                      </TabsTrigger>
                      <TabsTrigger
                        value="diagnostics"
                        className="px-4 text-xs font-semibold uppercase tracking-wide text-stone-600 data-[state=active]:bg-white data-[state=active]:text-emerald-700 dark:text-neutral-300 dark:data-[state=active]:bg-neutral-900 dark:data-[state=active]:text-emerald-400"
                      >
                        Diagnostics
                      </TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-2 px-1 sm:px-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-stone-300 bg-white text-xs text-stone-700 hover:border-stone-400 hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600"
                      >
                        <Download className="mr-2 h-3.5 w-3.5" />
                        PDF Report
                      </Button>
                    </div>
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
    <Suspense
      fallback={<div className="p-6 text-sm text-stone-500 dark:text-neutral-400">Loading backtesting workspace...</div>}
    >
      <BacktestingPageContent />
    </Suspense>
  );
}
