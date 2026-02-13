"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
  SkeletonStats,
  SkeletonChart,
  ErrorState,
  NoResultsState,
} from "@/components/ui";
import { showSuccess, showError } from "@/components/ui/toast";
import { LineChart } from "@/components/charts";
import { formatPercent, formatCurrency } from "@/lib/utils";
import { Search, Shield, AlertTriangle, TrendingDown } from "lucide-react";

interface RiskMetrics {
  var95: number;
  var99: number;
  cvar95: number;
  cvar99: number;
  maxDrawdown: number;
  avgDrawdown: number;
  drawdownDuration: number;
  volatility: number;
  beta: number;
  trackingError: number;
  informationRatio: number;
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
  drawdowns: DrawdownPoint[];
  rollingVolatility: VolatilityPoint[];
}

export default function RiskPage() {
  const [symbol, setSymbol] = useState("AAA");
  const [searchInput, setSearchInput] = useState("AAA");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskResult | null>(null);
  const [error, setError] = useState("");

  // Fix stale closure: pass symbol directly instead of relying on state
  const analyzeRiskForSymbol = useCallback(async (sym: string) => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`/api/risk?symbol=${encodeURIComponent(sym)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      showSuccess("Risk analysis complete", `Analyzed ${sym} - VaR 95%: ${formatPercent(data.metrics?.var95 ?? 0)}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to analyze risk";
      setError(errorMessage);
      showError("Analysis failed", errorMessage);
      console.error("Risk analysis error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(() => {
    const newSymbol = searchInput.trim().toUpperCase();
    if (newSymbol) {
      setSymbol(newSymbol);
      // Pass symbol directly to avoid stale closure
      analyzeRiskForSymbol(newSymbol);
    }
  }, [searchInput, analyzeRiskForSymbol]);

  const handleRetry = useCallback(() => {
    if (symbol) {
      analyzeRiskForSymbol(symbol);
    }
  }, [symbol, analyzeRiskForSymbol]);

  // Load initial data on mount
  useEffect(() => {
    analyzeRiskForSymbol(symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Risk Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Analyze and visualize risk metrics including VaR, drawdowns, and volatility</p>
        </div>
        <div className="flex gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            placeholder="Enter symbol..."
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-32"
            maxLength={10}
          />
          <Button onClick={handleSearch} disabled={loading}>
            <Search className="w-4 h-4 mr-2" />
            Analyze
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && !loading && (
        <ErrorState
          message="Risk analysis failed"
          description={error}
          onRetry={handleRetry}
          className="mb-6"
        />
      )}

      {/* Loading State */}
      {loading && (
        <>
          <SkeletonStats count={6} className="mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <SkeletonChart height={250} />
            <SkeletonChart height={250} />
          </div>
        </>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">VaR (95%)</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatPercent(result.metrics.var95)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">VaR (99%)</p>
                <p className="text-xl font-bold text-red-700 dark:text-red-500">{formatPercent(result.metrics.var99)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">CVaR (95%)</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatPercent(result.metrics.cvar95)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Max Drawdown</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatPercent(result.metrics.maxDrawdown)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Volatility</p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{formatPercent(result.metrics.volatility)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Beta</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {isFinite(result.metrics.beta) ? result.metrics.beta.toFixed(2) : "N/A"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                  Drawdown History
                </CardTitle>
                <CardDescription>Historical drawdowns over the past year</CardDescription>
              </CardHeader>
              <CardContent>
                {result.drawdowns && result.drawdowns.length > 0 ? (
                  <LineChart
                    data={result.drawdowns.map((d) => ({
                      date: new Date(d.date).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }),
                      value: -d.drawdown * 100
                    }))}
                    color="#ef4444"
                    height={250}
                    showArea
                  />
                ) : (
                  <NoResultsState
                    title="No drawdown data"
                    description="No drawdown history available"
                    className="h-[250px]"
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  Rolling Volatility
                </CardTitle>
                <CardDescription>21-day rolling annualized volatility</CardDescription>
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
                    height={250}
                  />
                ) : (
                  <NoResultsState
                    title="No volatility data"
                    description="No rolling volatility available"
                    className="h-[250px]"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Value at Risk (VaR)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  VaR estimates the maximum expected loss at a given confidence level.
                  For a $10,000 investment in {result.symbol}:
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    <span className="text-gray-900 dark:text-white">95% Confidence (1-day)</span>
                    <span className="font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(10000 * result.metrics.var95)}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 bg-red-100 dark:bg-red-900/30 rounded">
                    <span className="text-gray-900 dark:text-white">99% Confidence (1-day)</span>
                    <span className="font-bold text-red-700 dark:text-red-400">
                      {formatCurrency(10000 * result.metrics.var99)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Other Risk Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Average Drawdown</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatPercent(result.metrics.avgDrawdown)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Max DD Duration</span>
                    <span className="font-medium text-gray-900 dark:text-white">{result.metrics.drawdownDuration} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Tracking Error</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatPercent(result.metrics.trackingError)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Information Ratio</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {isFinite(result.metrics.informationRatio)
                        ? result.metrics.informationRatio.toFixed(2)
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Benchmark</span>
                    <Badge variant="outline">{result.benchmark}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Empty State */}
      {!result && !loading && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Shield className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">Enter a symbol to analyze risk metrics</p>
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              Analyze {symbol}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
