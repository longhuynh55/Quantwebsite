"use client";

import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  Badge,
  DataTable,
  TickerMenu,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  SkeletonStats,
  SkeletonChart,
  ErrorState,
  PageTransition,
  ErrorBoundary,
} from "@/components/ui";
import { showSuccess, showError } from "@/components/ui/toast";
import { BarChart, CorrelationMatrix } from "@/components/charts";
import { formatPercent } from "@/lib/utils";
import { Plus, Trash2, PieChart as PieChartIcon, Settings, Activity, BarChart3, Shield, Layers, RefreshCw, Info, TrendingUp } from "lucide-react";

interface Allocation {
  symbol: string;
  weight: number;
  expectedReturn: number;
}

interface OptimizationResult {
  method: string;
  allocations: Allocation[];
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  diversificationRatio?: number;
  effectiveN?: number;
  benchmark?: string;
  asOfDate?: string;
  effectiveUniverse?: string[];
  excludedSymbols?: Array<{ symbol: string; reason: string }>;
  correlationMatrix?: { symbols: string[]; matrix: number[][] };
  assetStats?: { symbol: string; meanReturn: number; volatility: number }[];
}

export default function PortfolioPage() {
  const [symbols, setSymbols] = useState<string[]>(["AAA", "ACB", "VIC", "VNM", "FPT"]);
  const [newSymbol, setNewSymbol] = useState("");
  const [method, setMethod] = useState("mean_variance");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const MAX_SYMBOLS = 10;

  // AbortController for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const addSymbol = () => {
    if (symbols.length >= MAX_SYMBOLS) {
      const msg = `Maximum ${MAX_SYMBOLS} symbols allowed`;
      setError(msg);
      showError("Limit reached", msg);
      return;
    }
    if (newSymbol.trim() && !symbols.includes(newSymbol.toUpperCase())) {
      setSymbols([...symbols, newSymbol.toUpperCase()]);
      setNewSymbol("");
      setError("");
    }
  };

  const removeSymbol = (sym: string) => {
    setSymbols(symbols.filter((s) => s !== sym));
  };

  const optimize = async () => {
    if (symbols.length < 2) {
      const msg = "Add at least 2 symbols";
      setError(msg);
      setStatusMessage("Portfolio optimization validation failed: add at least 2 symbols.");
      showError("Validation error", msg);
      return;
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
    setStatusMessage(`Optimizing portfolio for ${symbols.length} symbols...`);

    try {
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols, method }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        if (requestId !== requestSeqRef.current) {
          return;
        }
        const errorMessage = String(data?.error || `HTTP error! status: ${response.status}`);
        setError(errorMessage);
        setStatusMessage("Portfolio optimization failed.");
        showError("Optimization failed", errorMessage);
      } else {
        if (requestId !== requestSeqRef.current) {
          return;
        }
        setResult(data);
        setStatusMessage("Portfolio optimization completed.");
        showSuccess("Portfolio optimized", `Sharpe ratio: ${data.sharpeRatio?.toFixed(2) || 'N/A'}`);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (requestId !== requestSeqRef.current) {
        return;
      }
      const msg = "Failed to optimize portfolio";
      setError(msg);
      setStatusMessage("Portfolio optimization failed.");
      showError("Optimization failed", msg);
    } finally {
      if (requestId === requestSeqRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <PageTransition variant="slideUp">
      <div className="max-w-full space-y-8">
        <p className="sr-only" role="status" aria-live="polite">{statusMessage}</p>
        
        {/* Header */}
        <header className="mb-12 pb-8 border-b border-stone-200 dark:border-neutral-800">
          {/* Kicker with emerald accent */}
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
            <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
              Quantitative Finance
            </span>
          </div>

          {/* Headline - Serif, dramatic */}
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight">
            Portfolio Optimization
          </h1>

          {/* Subheadline */}
          <p className="font-sans text-base text-stone-600 dark:text-neutral-400 max-w-2xl leading-relaxed mt-4">
            Construct mathematically optimal portfolios based on historical risk/return profiles
          </p>

          <div className="mt-6 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="border-stone-200 dark:border-neutral-800"
              onClick={() => {
                setResult(null);
                setSymbols(["AAA", "ACB", "VIC", "VNM", "FPT"]);
              }}
            >
              Reset Universe
            </Button>
          </div>
        </header>

        {/* Optimization Engine Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 bg-stone-100/50 dark:bg-neutral-900/50 border-stone-100 dark:border-neutral-800 overflow-hidden">
            <CardHeader className="pb-2 border-b border-stone-100 dark:border-neutral-800/50 mb-4 bg-white/50 dark:bg-neutral-900/50">
              <CardTitle className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-widest flex items-center">
                <Layers className="w-3 h-3 mr-2 text-emerald-600" />
                Asset Universe ({symbols.length}/{MAX_SYMBOLS})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-6 min-h-[40px]">
                {symbols.map((sym) => (
                  <Badge key={sym} variant="secondary" className="flex items-center gap-1.5 py-1.5 px-3 bg-white dark:bg-neutral-800 border-stone-200 dark:border-neutral-700 text-stone-900 dark:text-white group transition-all hover:border-red-200 dark:hover:border-red-900/50">
                    <span className="font-bold text-xs">{sym}</span>
                    <button onClick={() => removeSymbol(sym)} className="ml-1 text-stone-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {symbols.length === 0 && (
                  <span className="text-xs text-stone-400 italic py-2">No assets selected. Add tickers below.</span>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                    placeholder="Enter Stock Ticker (e.g. FPT)"
                    onKeyDown={(e) => e.key === "Enter" && addSymbol()}
                    className="bg-white dark:bg-neutral-800 border-stone-200 dark:border-neutral-700 font-bold uppercase"
                  />
                </div>
                <Button onClick={addSymbol} variant="outline" className="border-stone-200 dark:border-neutral-700 px-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-700 dark:bg-emerald-800 border-none text-white flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest flex items-center">
                <Settings className="w-3 h-3 mr-2" />
                Solver Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest px-1">Optimization Method</label>
                  <Select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    options={[
                      { value: "mean_variance", label: "Mean-Variance (Markowitz)" },
                      { value: "min_variance", label: "Minimum Volatility" },
                      { value: "risk_parity", label: "Risk Parity" },
                      { value: "equal_weight", label: "Equally Weighted" }
                    ]}
                    className="bg-emerald-500 dark:bg-emerald-700 border-emerald-400 dark:border-emerald-500 text-white text-xs font-bold"
                  />
                </div>
                <p className="text-[10px] text-emerald-100/70 leading-relaxed italic px-1">
                  {method === 'mean_variance' && "Maximizes expected return for a given level of risk."}
                  {method === 'min_variance' && "Constructs the lowest risk portfolio regardless of returns."}
                  {method === 'risk_parity' && "Equalizes the risk contribution of each asset."}
                  {method === 'equal_weight' && "Simple 1/N allocation across all selected instruments."}
                </p>
              </div>
              <Button
                onClick={optimize}
                disabled={loading || symbols.length < 2}
                className="w-full mt-6 h-12 bg-white text-emerald-700 hover:bg-emerald-50 dark:hover:bg-white font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <div className="animate-spin w-5 h-5 border-2 border-emerald-700 border-t-transparent mr-2"></div>
                ) : (
                  <PieChartIcon className="w-5 h-5 mr-2 fill-current" />
                )}
                Run Optimizer
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        {loading && (
          <div className="space-y-6">
            <SkeletonStats count={5} />
            <SkeletonChart height={400} />
          </div>
        )}

        {error && !loading && (
          <ErrorState message="Optimization failed" description={error} onRetry={optimize} />
        )}

        {result && !loading && (
          <ErrorBoundary
            fallback={
              <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-center">
                <p className="text-red-600 dark:text-red-400 font-medium mb-2">
                  Error displaying portfolio results
                </p>
                <p className="text-sm text-stone-600 dark:text-neutral-400 mb-4">
                  The results couldn&apos;t be rendered. Please try running the optimization again.
                </p>
                <Button size="sm" onClick={optimize}>
                  Retry Optimization
                </Button>
              </div>
            }
          >
            <div className="space-y-6">
              {/* Performance Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Card className="bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">Exp. Return</span>
                    </div>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatPercent(result.expectedReturn)}</p>
                  </CardContent>
                </Card>

                <Card className="bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">Volatility</span>
                    </div>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatPercent(result.volatility)}</p>
                  </CardContent>
                </Card>

                <Card className="bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                      <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">Sharpe Ratio</span>
                    </div>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{result.sharpeRatio?.toFixed(2)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">Diversification</span>
                    </div>
                    <p className="text-lg font-bold text-stone-900 dark:text-white">
                      {Number.isFinite(result.diversificationRatio) ? Number(result.diversificationRatio).toFixed(2) : "N/A"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">Effective N</span>
                    </div>
                    <p className="text-lg font-bold text-stone-900 dark:text-white">
                      {Number.isFinite(result.effectiveN) ? Number(result.effectiveN).toFixed(2) : "N/A"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="allocation" className="w-full">
              <div className="flex items-center justify-between mb-4 bg-stone-100/50 dark:bg-neutral-900/50 p-1.5 border border-stone-100 dark:border-neutral-800">
                <TabsList className="bg-transparent border-none">
                  <TabsTrigger value="allocation" className="data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 text-xs font-bold">
                    <PieChartIcon className="w-3.5 h-3.5 mr-2" />
                    Portfolio Weights
                  </TabsTrigger>
                  <TabsTrigger value="metrics" className="data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 text-xs font-bold">
                    <Activity className="w-3.5 h-3.5 mr-2" />
                    Asset Metrics
                  </TabsTrigger>
                  <TabsTrigger value="risk" className="data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 text-xs font-bold">
                    <Shield className="w-3.5 h-3.5 mr-2" />
                    Risk Analysis
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2 pr-2">
                  <span className="text-[10px] text-stone-400 font-medium mr-2">Ref: {result.benchmark || 'VN-INDEX'} - {result.asOfDate ? String(result.asOfDate).slice(0, 10) : 'Live'}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Refresh data">
                    <RefreshCw className="w-3.5 h-3.5 text-stone-400" />
                  </Button>
                </div>
              </div>

              <TabsContent value="allocation" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold text-stone-500 uppercase tracking-wider">Optimal Weights Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BarChart data={result.allocations.map((a) => ({ name: a.symbol, value: a.weight * 100 }))} height={300} />
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden">
                    <DataTable
                      data={result.allocations}
                      columns={[
                        {
                          header: "Asset",
                          accessorKey: "symbol",
                          sortable: true,
                          cell: (a) => (
                            <TickerMenu symbol={a.symbol}>
                              <div className="flex items-center gap-3 group/ticker">
                                <div className="w-2 h-2 bg-emerald-500" />
                                <span className="font-bold group-hover/ticker:underline">{a.symbol}</span>
                              </div>
                            </TickerMenu>
                          ),
                          width: "30%",
                        },
                        {
                          header: "Weight",
                          accessorKey: "weight",
                          sortable: true,
                          align: "right",
                          cell: (a) => <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatPercent(a.weight)}</span>,
                          width: "35%",
                        },
                        {
                          header: "Exp. Return",
                          accessorKey: "expectedReturn",
                          sortable: true,
                          align: "right",
                          cell: (a) => <span className="font-mono text-green-600">{formatPercent(a.expectedReturn)}</span>,
                          width: "35%",
                        },
                      ]}
                      height="300px"
                    />
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="metrics" className="mt-0">
                <Card className="overflow-hidden border-none">
                  <DataTable
                    data={result.assetStats || []}
                    columns={[
                      {
                        header: "Symbol",
                        accessorKey: "symbol",
                        sortable: true,
                        cell: (s) => (
                          <TickerMenu symbol={s.symbol}>
                            <span className="font-bold hover:underline cursor-pointer">{s.symbol}</span>
                          </TickerMenu>
                        ),
                        width: "30%",
                      },
                      {
                        header: "Mean Return (Ann.)",
                        accessorKey: "meanReturn",
                        sortable: true,
                        align: "right",
                        cell: (s) => <span className="font-mono text-green-600 font-medium">{formatPercent(s.meanReturn)}</span>,
                        width: "35%",
                      },
                      {
                        header: "Volatility (Ann.)",
                        accessorKey: "volatility",
                        sortable: true,
                        align: "right",
                        cell: (s) => <span className="font-mono text-amber-600 font-medium">{formatPercent(s.volatility)}</span>,
                        width: "35%",
                      },
                    ]}
                    height="400px"
                  />
                </Card>
              </TabsContent>

              <TabsContent value="risk" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="text-xs font-bold text-stone-500 uppercase tracking-wider">Asset Correlation Matrix</CardTitle>
                        <CardDescription className="text-[10px]">Quantifying the linear relationship between asset returns</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {result.correlationMatrix && (
                          <CorrelationMatrix
                            symbols={result.correlationMatrix.symbols}
                            matrix={result.correlationMatrix.matrix}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-xs font-bold text-stone-500 uppercase">System Insights</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-start gap-3 p-3 bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30">
                          <Info className="w-4 h-4 text-emerald-600 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Optimal Diversification</p>
                            <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 leading-relaxed">
                              The {method.replace('_', ' ')} solver identified {result.allocations.filter(a => a.weight > 0.01).length} active positions.
                            </p>
                          </div>
                        </div>
                        
                        {Array.isArray(result.excludedSymbols) && result.excludedSymbols.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-stone-400 uppercase px-1">Exclusions</p>
                            <div className="flex flex-wrap gap-1.5">
                              {result.excludedSymbols.slice(0, 10).map((item) => (
                                <Badge key={item.symbol} variant="outline" className="text-[9px] py-0 border-amber-200 text-amber-700 bg-amber-50/50" title={item.reason}>
                                  {item.symbol}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            </div>
          </ErrorBoundary>
        )}
      </div>
    </PageTransition>
  );
}
