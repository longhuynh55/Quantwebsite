"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Skeleton,
  ErrorState,
  NoResultsState,
} from "@/components/ui";
import { showSuccess, showError } from "@/components/ui/toast";
import { BarChart } from "@/components/charts";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

interface FactorExposure {
  symbol: string;
  momentum: number;
  value: number;
  volatility: number;
  size: number;
}

type FactorKey = keyof Omit<FactorExposure, "symbol">;

const FACTORS: { value: FactorKey; label: string; description: string }[] = [
  { value: "momentum", label: "Momentum", description: "12-1 month price momentum" },
  { value: "value", label: "Value", description: "Price relative to moving average proxy" },
  { value: "volatility", label: "Low Volatility", description: "Inverse volatility (low vol anomaly)" },
  { value: "size", label: "Size", description: "Volume-based size proxy" },
];

export default function FactorsPage() {
  const [selectedFactor, setSelectedFactor] = useState<FactorKey>("momentum");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topStocks, setTopStocks] = useState<FactorExposure[]>([]);
  const [bottomStocks, setBottomStocks] = useState<FactorExposure[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function fetchFactorData() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/factors?factor=${selectedFactor}&limit=50`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (isMounted) {
          if (data.error) {
            setError(data.error);
            showError("Data error", data.error);
          } else {
            setTopStocks(data.topStocks || []);
            setBottomStocks(data.bottomStocks || []);
            showSuccess("Factor data loaded", `Analyzed ${(data.topStocks || []).length} stocks by ${selectedFactor}`);
          }
        }
      } catch (err) {
        console.error("Failed to fetch factor data:", err);
        if (isMounted) {
          const errorMessage = "Failed to load factor data. Please try again.";
          setError(errorMessage);
          showError("Loading failed", errorMessage);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchFactorData();

    return () => {
      isMounted = false;
    };
  }, [selectedFactor]);

  const currentFactor = FACTORS.find((f) => f.value === selectedFactor);
  const getFactorValue = (stock: FactorExposure): number => stock[selectedFactor];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Factor Investing</h1>
        <p className="text-gray-600 dark:text-gray-400">Analyze stocks through factor lenses: momentum, value, volatility, and size</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {FACTORS.map((factor) => (
          <Card key={factor.value} className={`cursor-pointer transition-all ${selectedFactor === factor.value ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20" : "hover:shadow-md"}`} onClick={() => setSelectedFactor(factor.value)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2"><BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" /><h3 className="font-semibold text-gray-900 dark:text-white">{factor.label}</h3></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{factor.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error State */}
      {error && !loading && (
        <ErrorState
          message="Failed to load factor data"
          description={error}
          className="mb-6"
        />
      )}

      <Tabs defaultValue="rankings">
        <TabsList className="mb-6">
          <TabsTrigger value="rankings">Stock Rankings</TabsTrigger>
          <TabsTrigger value="explanation">How It Works</TabsTrigger>
        </TabsList>

        <TabsContent value="rankings">
          {/* Loading State */}
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-600" />Top {currentFactor?.label} Stocks</CardTitle>
                  <CardDescription>Highest factor exposure scores</CardDescription>
                </CardHeader>
                <CardContent>
                  {topStocks.length === 0 ? (
                    <NoResultsState
                      title="No stocks found"
                      description="No stocks match the current factor criteria"
                      className="py-8"
                    />
                  ) : (
                    <div className="space-y-2">
                      {topStocks.slice(0, 10).map((stock, i) => (
                        <div key={stock.symbol} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center text-sm font-bold">{i + 1}</span>
                            <Link href={`/charts?symbol=${stock.symbol}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">{stock.symbol}</Link>
                          </div>
                          <Badge variant="success">{getFactorValue(stock).toFixed(2)}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><TrendingDown className="w-5 h-5 text-red-600" />Lowest {currentFactor?.label} Stocks</CardTitle>
                  <CardDescription>Lowest factor exposure scores</CardDescription>
                </CardHeader>
                <CardContent>
                  {bottomStocks.length === 0 ? (
                    <NoResultsState
                      title="No stocks found"
                      description="No stocks match the current factor criteria"
                      className="py-8"
                    />
                  ) : (
                    <div className="space-y-2">
                      {bottomStocks.slice(0, 10).map((stock, i) => (
                        <div key={stock.symbol} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center text-sm font-bold">{i + 1}</span>
                            <Link href={`/charts?symbol=${stock.symbol}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">{stock.symbol}</Link>
                          </div>
                          <Badge variant="destructive">{getFactorValue(stock).toFixed(2)}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{currentFactor?.label} Distribution</CardTitle>
              <CardDescription>Top stocks by factor score</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : (
                <BarChart data={topStocks.slice(0, 10).map((s) => ({ name: s.symbol, value: getFactorValue(s) }))} height={250} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="explanation">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>What is Factor Investing?</CardTitle></CardHeader>
              <CardContent className="prose prose-sm dark:prose-invert">
                <p className="text-gray-600 dark:text-gray-400">Factor investing targets specific drivers of return across asset classes. These factors explain differences in stock returns.</p>
                <h4 className="font-semibold mt-4 text-gray-900 dark:text-white">Key Factors:</h4>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                  <li><strong>Momentum:</strong> Stocks that performed well tend to continue</li>
                  <li><strong>Value:</strong> Stocks trading below intrinsic value tend to outperform</li>
                  <li><strong>Low Volatility:</strong> Lower-risk stocks often provide better risk-adjusted returns</li>
                  <li><strong>Size:</strong> Smaller companies often outperform larger ones</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>How We Calculate Factors</CardTitle></CardHeader>
              <CardContent className="prose prose-sm dark:prose-invert">
                <p className="text-gray-600 dark:text-gray-400">Our factor calculations are adapted for the Vietnamese market:</p>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                  <li><strong>Momentum:</strong> 12-1 month price change</li>
                  <li><strong>Value:</strong> Price relative to 200-day SMA</li>
                  <li><strong>Volatility:</strong> Inverse of 63-day realized volatility</li>
                  <li><strong>Size:</strong> Log of average volume</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
