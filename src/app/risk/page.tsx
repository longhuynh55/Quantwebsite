"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";

// Force dynamic rendering to avoid useSearchParams issues during build
export const dynamic = 'force-dynamic';
import { useUrlState } from "@/lib/hooks";
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  SkeletonStats,
  SkeletonChart,
  ErrorState,
  NoResultsState,
  PageTransition,
} from "@/components/ui";
import { showSuccess, showError } from "@/components/ui/toast";
import { LineChart } from "@/components/charts";
import { formatPercent, formatCurrency } from "@/lib/utils";
import { Search, Shield, AlertTriangle, TrendingDown, Activity, BarChart3, TrendingUp, Info, Zap, RefreshCw } from "lucide-react";

interface RiskMetrics {
  var95: number;
  var99: number;
  cvar95: number;
  cvar99: number;
  downsideDeviation: number;
  sortinoRatio: number;
  tailLossRatio95: number;
  maxDrawdown: number;
  avgDrawdown: number;
  drawdownDuration: number;
  volatility: number;
  beta: number;
  trackingError: number;
  informationRatio: number;
}

interface RiskAnalysis {
  currentDrawdown: number;
  currentDrawdownDuration: number;
  isUnderwater: boolean;
}

interface DrawdownPoint {
  date: string;
  drawdown: number;
}

interface VolatilityPoint {
  date: string;
  volatility: number;
}

interface RiskResult {
  symbol: string;
  benchmark: string;
  metrics: RiskMetrics;
  analysis?: RiskAnalysis;
  drawdowns: DrawdownPoint[];
  rollingVolatility: VolatilityPoint[];
}

function RiskPageContent() {
  const [symbol, setSymbol] = useUrlState<string>("symbol", "AAA");
  const [benchmark, setBenchmark] = useUrlState<string>("benchmark", "VNINDEX");
  const [searchInput, setSearchInput] = useState(symbol);
  
  // Sync search input with symbol from URL
  useEffect(() => {
    setSearchInput(symbol);
  }, [symbol]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskResult | null>(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const analyzeRiskForSymbol = useCallback(async (sym: string, selectedBenchmark: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;

    setLoading(true);
    setError("");
    setStatusMessage(`Analyzing risk metrics for ${sym} vs ${selectedBenchmark}...`);

    try {
      const response = await fetch(
        `/api/risk?symbol=${encodeURIComponent(sym)}&benchmark=${encodeURIComponent(selectedBenchmark)}`,
        {
        signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (requestId !== requestSeqRef.current) {
        return;
      }
      setResult(data);
      setStatusMessage(`Risk metrics updated for ${sym} vs ${selectedBenchmark}.`);
      showSuccess("Risk analysis complete", `Analyzed ${sym} vs ${selectedBenchmark} - VaR 95%: ${formatPercent(data.metrics?.var95 ?? 0)}`);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      if (requestId !== requestSeqRef.current) {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : "Failed to analyze risk";
      setError(errorMessage);
      setStatusMessage(`Risk analysis failed for ${sym} vs ${selectedBenchmark}.`);
      showError("Analysis failed", errorMessage);
      console.error("Risk analysis error:", err);
    } finally {
      if (requestId === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const handleSearch = useCallback(() => {
    const newSymbol = searchInput.trim().toUpperCase();
    if (newSymbol) {
      setSymbol(newSymbol);
      analyzeRiskForSymbol(newSymbol, benchmark);
    }
  }, [searchInput, analyzeRiskForSymbol, benchmark, setSymbol]);

  const handleRetry = useCallback(() => {
    if (symbol) {
      analyzeRiskForSymbol(symbol, benchmark);
    }
  }, [symbol, benchmark, analyzeRiskForSymbol]);

  // Load initial data on mount (or when symbol/benchmark from URL changes)
  useEffect(() => {
    analyzeRiskForSymbol(symbol, benchmark);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [analyzeRiskForSymbol, symbol, benchmark]);

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
              Risk Analytics
            </span>
          </div>

          {/* Headline - Serif, dramatic */}
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight">
            Risk Management
          </h1>

          {/* Subheadline */}
          <p className="font-sans text-base text-stone-600 dark:text-neutral-400 max-w-2xl leading-relaxed mt-4">
            Advanced volatility analysis and tail-risk quantification for HOSE equities
          </p>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 bg-stone-100/50 dark:bg-neutral-900/50 p-2 border border-stone-100 dark:border-neutral-800">
            <div className="flex gap-2">
              <label htmlFor="risk-ticker-input" className="sr-only">Ticker symbol</label>
              <Input
                id="risk-ticker-input"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                placeholder="TICKER"
                ariaLabel="Ticker symbol"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-24 bg-white dark:bg-neutral-800 border-stone-200 dark:border-neutral-700 font-bold uppercase h-9 text-xs"
                maxLength={10}
              />
              <Select
                value={benchmark}
                onChange={(e) => setBenchmark(e.target.value)}
                className="w-32 bg-white dark:bg-neutral-800 border-stone-200 dark:border-neutral-700 h-9 text-xs font-bold"
                options={[
                  { value: "VNINDEX", label: "VN-INDEX" },
                  { value: "VN100", label: "VN-100" },
                  { value: "VN30", label: "VN-30" },
                ]}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading} size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white h-9 font-bold px-4">
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-2" />}
              Analyze
            </Button>
          </div>
        </header>

        {/* Error State */}
        {error && !loading && (
          <ErrorState message="Risk analysis failed" description={error} onRetry={handleRetry} />
        )}

        {/* Results Section */}
        {loading && (
          <div className="space-y-6">
            <SkeletonStats count={6} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SkeletonChart height={300} />
              <SkeletonChart height={300} />
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-6">
            {/* Primary Risk Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card className="bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">VaR (95%)</span>
                  </div>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatPercent(result.metrics.var95)}</p>
                </CardContent>
              </Card>

              <Card className="bg-orange-50/50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                    <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">Volatility</span>
                  </div>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatPercent(result.metrics.volatility)}</p>
                </CardContent>
              </Card>

              <Card className="bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">Beta vs {result.benchmark}</span>
                  </div>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{isFinite(result.metrics.beta) ? result.metrics.beta.toFixed(2) : "N/A"}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">Max Drawdown</span>
                  </div>
                  <p className="text-lg font-bold text-stone-900 dark:text-white">{formatPercent(result.metrics.maxDrawdown)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">Sortino Ratio</span>
                  </div>
                  <p className="text-lg font-bold text-stone-900 dark:text-white">{isFinite(result.metrics.sortinoRatio) ? result.metrics.sortinoRatio.toFixed(2) : "N/A"}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="text-[10px] font-bold text-stone-500 dark:text-neutral-500 uppercase tracking-wider">Info Ratio</span>
                  </div>
                  <p className="text-lg font-bold text-stone-900 dark:text-white">{isFinite(result.metrics.informationRatio) ? result.metrics.informationRatio.toFixed(2) : "N/A"}</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="series" className="w-full">
              <div className="flex items-center justify-between mb-4 bg-stone-100/50 dark:bg-neutral-900/50 p-1.5 border border-stone-100 dark:border-neutral-800">
                <TabsList className="bg-transparent border-none">
                  <TabsTrigger value="series" className="data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 text-xs font-bold px-6">
                    Risk Time-Series
                  </TabsTrigger>
                  <TabsTrigger value="tail" className="data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 text-xs font-bold px-6">
                    Tail Risk Analysis
                  </TabsTrigger>
                  <TabsTrigger value="benchmarks" className="data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 text-xs font-bold px-6">
                    Benchmark Comparison
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2 pr-2">
                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">{result.symbol} vs {result.benchmark}</span>
                </div>
              </div>

              <TabsContent value="series" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center">
                        <TrendingDown className="w-3.5 h-3.5 mr-2 text-red-500" />
                        Drawdown History (%)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {result.drawdowns && result.drawdowns.length > 0 ? (
                        <LineChart
                          data={result.drawdowns.map((d) => ({
                            date: new Date(d.date).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }),
                            value: -d.drawdown * 100
                          }))}
                          color="#ef4444"
                          height={300}
                          showArea
                        />
                      ) : (
                        <NoResultsState title="No drawdown data" description="Insufficient history" className="h-[300px]" />
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center">
                        <AlertTriangle className="w-3.5 h-3.5 mr-2 text-amber-500" />
                        Rolling 21D Volatility (Ann.)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {result.rollingVolatility && result.rollingVolatility.length > 0 ? (
                        <LineChart
                          data={result.rollingVolatility
                            .filter((v) => v.volatility !== null && v.volatility > 0)
                            .slice(-100)
                            .map((v) => ({
                              date: new Date(v.date).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }),
                              value: v.volatility * 100
                            }))}
                          color="#f59e0b"
                          height={300}
                        />
                      ) : (
                        <NoResultsState title="No volatility data" description="Insufficient history" className="h-[300px]" />
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="tail" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Shield className="w-4 h-4 text-red-500" />
                        Value at Risk Quantification
                      </CardTitle>
                      <CardDescription className="text-[10px]">Estimated maximum loss for a $10,000 position over a 1-day horizon</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
                          <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">95% Confidence</p>
                          <p className="text-2xl font-bold text-red-700 dark:text-red-500">{formatCurrency(10000 * result.metrics.var95)}</p>
                          <p className="text-[10px] text-red-600/70 mt-1 italic">Expect to lose more than this only 5 out of 100 days.</p>
                        </div>
                        <div className="p-4 bg-red-100/50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40">
                          <p className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-widest mb-1">99% Confidence</p>
                          <p className="text-2xl font-bold text-red-800 dark:text-red-500">{formatCurrency(10000 * result.metrics.var99)}</p>
                          <p className="text-[10px] text-red-700/70 mt-1 italic">Extreme tail event proxy (1% probability.</p>
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t border-stone-100 dark:border-neutral-800">
                        <div className="flex items-center gap-2 mb-3">
                          <Info className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-xs font-bold text-stone-700 dark:text-neutral-300 uppercase">Conditional VaR (Expected Shortfall)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-stone-400 uppercase">CVaR (95%)</p>
                            <p className="text-sm font-bold font-mono">{formatPercent(result.metrics.cvar95)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-stone-400 uppercase">Tail Loss Ratio</p>
                            <p className="text-sm font-bold font-mono">{result.metrics.tailLossRatio95?.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xs font-bold text-stone-500 uppercase">Risk Assessment</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-stone-500">Current Status</span>
                          <Badge variant={result.analysis?.isUnderwater ? "secondary" : "outline"} className="text-[10px]">
                            {result.analysis?.isUnderwater ? "Underwater" : "Recovered"}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center font-mono">
                          <span className="text-xs text-stone-500">Current DD</span>
                          <span className="text-xs font-bold text-red-500">{formatPercent(result.analysis?.currentDrawdown ?? 0)}</span>
                        </div>
                        <div className="flex justify-between items-center font-mono">
                          <span className="text-xs text-stone-500">DD Duration</span>
                          <span className="text-xs font-bold">{result.analysis?.currentDrawdownDuration ?? 0} days</span>
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t border-stone-100 dark:border-neutral-800">
                        <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-2">Quant Insight</p>
                        <p className="text-[10px] text-stone-500 leading-relaxed italic">
                          {result.metrics.beta > 1.2 ? "High market sensitivity detected. Asset is aggressive relative to benchmark." : 
                           result.metrics.beta < 0.8 ? "Low market correlation. Potential defensive allocation candidate." :
                           "Market-neutral sensitivity. Beta is aligned with major indices."}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="benchmarks" className="mt-0">
                <Card className="border-stone-100 dark:border-neutral-800">
                  <CardHeader>
                    <CardTitle className="text-xs font-bold text-stone-500 uppercase tracking-wider">Benchmarking & Relative Risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-400 uppercase">Tracking Error</p>
                        <p className="text-xl font-bold font-mono">{formatPercent(result.metrics.trackingError)}</p>
                        <p className="text-[9px] text-stone-400 italic">Active risk vs {result.benchmark}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-400 uppercase">Information Ratio</p>
                        <p className="text-xl font-bold font-mono">{result.metrics.informationRatio?.toFixed(2)}</p>
                        <p className="text-[9px] text-stone-400 italic">Risk-adjusted active return</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-400 uppercase">Downside Dev.</p>
                        <p className="text-xl font-bold font-mono text-amber-600">{formatPercent(result.metrics.downsideDeviation)}</p>
                        <p className="text-[9px] text-stone-400 italic">Risk of negative returns only</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-400 uppercase">Benchmark</p>
                        <div className="flex items-center gap-2 pt-1">
                          <div className="w-2 h-2 bg-emerald-500" />
                          <span className="text-sm font-bold">{result.benchmark}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Empty State */}
        {!result && !loading && !error && (
          <Card className="border-dashed border-2 border-stone-200 dark:border-neutral-800 bg-stone-100/30 dark:bg-neutral-900/30">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 bg-white dark:bg-neutral-800 flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">Risk Quantification Engine</h3>
              <p className="text-sm text-stone-500 dark:text-neutral-400 mb-8 max-w-sm text-center">Enter a symbol above to calculate institutional-grade risk metrics and visualize volatility profiles.</p>
              <Button onClick={handleSearch} className="px-8 bg-emerald-700 hover:bg-emerald-800">
                Begin Analysis
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}

export default function RiskPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-stone-500 dark:text-neutral-400">Loading risk workspace...</div>}>
      <RiskPageContent />
    </Suspense>
  );
}
