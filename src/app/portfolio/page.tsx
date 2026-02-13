"use client";

import { useState, useRef } from "react";
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
  SkeletonStats,
  SkeletonChart,
  ErrorState,
} from "@/components/ui";
import { showSuccess, showError } from "@/components/ui/toast";
import { BarChart, CorrelationMatrix } from "@/components/charts";
import { formatPercent } from "@/lib/utils";
import { Plus, Trash2, PieChart as PieChartIcon, Settings } from "lucide-react";

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

  const MAX_SYMBOLS = 10;

  // AbortController for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

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
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (symbols.length < 2) {
      const msg = "Add at least 2 symbols";
      setError(msg);
      showError("Validation error", msg);
      return;
    }
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols, method }),
        signal: abortControllerRef.current.signal,
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
        showError("Optimization failed", data.error);
      } else {
        setResult(data);
        showSuccess("Portfolio optimized", `Sharpe ratio: ${data.sharpeRatio?.toFixed(2) || 'N/A'}`);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const msg = "Failed to optimize portfolio";
      setError(msg);
      showError("Optimization failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Portfolio Optimization</h1>
        <p className="text-gray-600 dark:text-gray-400">Build optimized portfolios using Mean-Variance, Risk Parity, or Equal Weight</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Assets</CardTitle>
          <CardDescription>Add 2-10 symbols to optimize</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {symbols.map((sym) => (
              <Badge key={sym} variant="secondary" className="flex items-center gap-1 py-1 px-3">
                {sym}
                <button onClick={() => removeSymbol(sym)} className="ml-1 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newSymbol} onChange={(e) => setNewSymbol(e.target.value.toUpperCase())} placeholder="Add symbol..." onKeyDown={(e) => e.key === "Enter" && addSymbol()} className="w-32" />
            <Button onClick={addSymbol} variant="outline" size="icon"><Plus className="w-4 h-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Method</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Method</label>
              <Select value={method} onChange={(e) => setMethod(e.target.value)} options={[{ value: "mean_variance", label: "Mean-Variance (Markowitz)" }, { value: "risk_parity", label: "Risk Parity" }, { value: "equal_weight", label: "Equal Weight" }]} />
            </div>
            <Button onClick={optimize} disabled={loading || symbols.length < 2}>
              {loading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div> : <PieChartIcon className="w-4 h-4 mr-2" />}Optimize
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && !loading && (
        <ErrorState
          message="Optimization failed"
          description={error}
          onRetry={optimize}
          className="mb-6"
        />
      )}

      {/* Loading State */}
      {loading && (
        <>
          <SkeletonStats count={3} className="mb-6" />
          <SkeletonChart height={300} className="mb-6" />
        </>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {result.expectedReturn !== undefined && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card><CardContent className="p-4"><p className="text-sm text-gray-500 dark:text-gray-400">Expected Return</p><p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatPercent(result.expectedReturn)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-sm text-gray-500 dark:text-gray-400">Volatility</p><p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatPercent(result.volatility)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-sm text-gray-500 dark:text-gray-400">Sharpe Ratio</p><p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{result.sharpeRatio?.toFixed(2)}</p></CardContent></Card>
            </div>
          )}

          <Card className="mb-6">
            <CardHeader><CardTitle>Portfolio Allocation</CardTitle></CardHeader>
            <CardContent>
              <BarChart data={result.allocations.map((a) => ({ name: a.symbol, value: a.weight * 100 }))} height={300} />
              <div className="mt-4 space-y-2">
                {result.allocations.map((a) => (
                  <div key={a.symbol} className="flex justify-between items-center">
                    <span className="font-medium text-gray-900 dark:text-white">{a.symbol}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{formatPercent(a.weight)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {result.assetStats && (
            <Card className="mb-6">
              <CardHeader><CardTitle>Asset Statistics</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Expected Return</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Volatility</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {result.assetStats.map((stat) => (
                        <tr key={stat.symbol}>
                          <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{stat.symbol}</td>
                          <td className="px-4 py-2 text-right text-green-600 dark:text-green-400">{formatPercent(stat.meanReturn)}</td>
                          <td className="px-4 py-2 text-right text-orange-600 dark:text-orange-400">{formatPercent(stat.volatility)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Correlation Matrix */}
          {result.correlationMatrix && result.correlationMatrix.matrix.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Correlation Matrix</CardTitle>
                <CardDescription>Correlation between assets in the portfolio</CardDescription>
              </CardHeader>
              <CardContent>
                <CorrelationMatrix
                  symbols={result.correlationMatrix.symbols}
                  matrix={result.correlationMatrix.matrix}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
