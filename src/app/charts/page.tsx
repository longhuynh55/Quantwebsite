"use client";

import { Suspense, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Badge,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  SkeletonChart,
  SkeletonStats,
  ErrorState,
  NoResultsState,
} from "@/components/ui";
import { showError } from "@/components/ui/toast";
import { CandlestickChart, TimeRangeSelector, OHLCVData } from "@/components/charts";
import { formatCurrency, formatPercent } from "@/lib/utils";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Calendar,
} from "lucide-react";

const TIME_RANGES = [
  { label: "1M", value: "30" },
  { label: "3M", value: "90" },
  { label: "6M", value: "180" },
  { label: "1Y", value: "365" },
  { label: "All", value: "all" },
];

interface StockPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
}

interface StockMetadataLite {
  symbol: string;
  status?: string;
  exchange?: string;
  listingPhase?: string;
  organName?: string;
  icbName4?: string;
}

type FundamentalsValue = number | string | null;

interface FundamentalsSnapshot {
  period: string;
  fields: Record<string, FundamentalsValue>;
  labels: Record<string, string>;
}

interface FundamentalsResponse {
  symbol: string;
  period: string;
  availablePeriods: string[];
  balanceSheet: FundamentalsSnapshot | null;
  incomeStatement: FundamentalsSnapshot | null;
  cashFlow: FundamentalsSnapshot | null;
}

function ChartsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [symbol, setSymbol] = useState("AAA");
  const [searchInput, setSearchInput] = useState("AAA");
  const [data, setData] = useState<StockPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("365");
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [stockMeta, setStockMeta] = useState<StockMetadataLite | null>(null);

  const [fundamentals, setFundamentals] = useState<FundamentalsResponse | null>(null);
  const [fundLoading, setFundLoading] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);
  const [fundPeriod, setFundPeriod] = useState<string>("latest");
  const [fundSearch, setFundSearch] = useState("");
  const fundamentalsAbortRef = useRef<AbortController | null>(null);
  const fundamentalsRequestSeqRef = useRef(0);

  // Initialize symbol from URL params
  useEffect(() => {
    const symbolFromQuery = searchParams.get("symbol")?.trim().toUpperCase();
    if (symbolFromQuery && symbolFromQuery !== symbol) {
      setSymbol(symbolFromQuery);
      setSearchInput(symbolFromQuery);
    }
  }, [searchParams, symbol]);

  // Fetch data
  useEffect(() => {
    let isMounted = true;

    async function fetchData(sym: string) {
      setLoading(true);
      setError(null);
      try {
        const limitParam = timeRange === "all" ? "all" : String(parseInt(timeRange, 10));
        const response = await fetch(`/api/stocks?symbol=${sym}&limit=${encodeURIComponent(limitParam)}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        if (isMounted) {
          if (result.data && result.data.length > 0) {
            setData(result.data);
            setStockMeta(result.metadata || null);
          } else if (result.error) {
            setError(result.error);
            setData([]);
            setStockMeta(null);
            showError("Data error", result.error);
          } else {
            setData([]);
            setStockMeta(null);
            setError("No data available for this symbol");
            showError("No data", `No data available for symbol "${sym}"`);
          }
        }
      } catch (err) {
        console.error("Failed to fetch chart data:", err);
        if (isMounted) {
          const errorMessage = "Failed to load chart data. Please try again.";
          setError(errorMessage);
          setData([]);
          setStockMeta(null);
          showError("Loading failed", errorMessage);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (symbol) {
      fetchData(symbol);
    }

    return () => {
      isMounted = false;
    };
  }, [symbol, timeRange, refreshCounter]);

  const handleSearch = useCallback(() => {
    const newSymbol = searchInput.trim().toUpperCase();
    if (!newSymbol) return;

    if (newSymbol !== symbol) {
      setSymbol(newSymbol);
      router.push(`/charts?symbol=${newSymbol}`, { scroll: false });
    } else {
      setRefreshCounter((prev) => prev + 1);
    }
  }, [searchInput, symbol, router]);

  const loadFundamentals = useCallback(async (sym: string, period: string) => {
    const requestSeq = fundamentalsRequestSeqRef.current + 1;
    fundamentalsRequestSeqRef.current = requestSeq;
    fundamentalsAbortRef.current?.abort();
    const controller = new AbortController();
    fundamentalsAbortRef.current = controller;

    setFundLoading(true);
    setFundError(null);
    try {
      const response = await fetch(
        `/api/fundamentals?symbol=${encodeURIComponent(sym)}&statement=all&period=${encodeURIComponent(period)}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        const maybe = await response.json().catch(() => null);
        const msg = maybe?.error || `HTTP error! status: ${response.status}`;
        if (requestSeq !== fundamentalsRequestSeqRef.current || controller.signal.aborted) {
          return;
        }
        if (response.status === 404) {
          setFundamentals(null);
          setFundError(msg);
          return;
        }
        throw new Error(msg);
      }

      const result: FundamentalsResponse = await response.json();
      if (requestSeq !== fundamentalsRequestSeqRef.current || controller.signal.aborted) {
        return;
      }
      setFundamentals(result);
      setFundPeriod(result.period || period);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (requestSeq !== fundamentalsRequestSeqRef.current || controller.signal.aborted) {
        return;
      }
      console.error("Failed to fetch fundamentals:", err);
      const msg = err instanceof Error ? err.message : "Failed to load fundamentals";
      setFundamentals(null);
      setFundError(msg);
    } finally {
      if (requestSeq === fundamentalsRequestSeqRef.current) {
        setFundLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      fundamentalsAbortRef.current?.abort();
    };
  }, []);

  // Fetch fundamentals when symbol changes (separate from OHLCV time range).
  useEffect(() => {
    if (!symbol) return;
    setFundSearch("");
    setFundPeriod("latest");
    setFundamentals(null);
    setFundError(null);
    loadFundamentals(symbol, "latest");
  }, [symbol, loadFundamentals]);

  const fundamentalsPeriodOptions = useMemo(() => {
    if (!fundamentals?.availablePeriods || fundamentals.availablePeriods.length === 0) {
      const fallbackLabel = fundPeriod === "latest" ? "Latest" : fundPeriod;
      return [{ value: fundPeriod, label: fallbackLabel }];
    }

    // Most recent first
    const sorted = [...fundamentals.availablePeriods].sort((a, b) => b.localeCompare(a));
    return sorted.map((p) => ({ value: p, label: p }));
  }, [fundamentals?.availablePeriods, fundPeriod]);

  const handleFundamentalsPeriodChange = useCallback(
    (nextPeriod: string) => {
      setFundPeriod(nextPeriod);
      if (!symbol) return;
      loadFundamentals(symbol, nextPeriod);
    },
    [symbol, loadFundamentals]
  );

  // Convert data to chart format
  const chartData: OHLCVData[] = useMemo(() => {
    return data.map((d) => ({
      // Use the UTC date-part to avoid timezone-driven day shifts on the client.
      time: d.date.length >= 10 ? d.date.slice(0, 10) : d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    }));
  }, [data]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (data.length === 0) return null;

    const lastPrice = data[data.length - 1].close;
    const firstPrice = data[0].close;
    const totalReturn = firstPrice !== 0 ? (lastPrice - firstPrice) / firstPrice : 0;

    const prices = data.map((d) => d.close);
    const highestPrice = Math.max(...prices);
    const lowestPrice = Math.min(...prices);

    const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;

    // Calculate volatility (annualized)
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const avgReturn = returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : 0;
    const variance = returns.length > 0
      ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      : 0;
    const volatility = returns.length > 0
      ? Math.sqrt(variance * 252) * 100 // Annualized
      : 0;

    return {
      lastPrice,
      totalReturn,
      highestPrice,
      lowestPrice,
      avgVolume,
      volatility,
      periodDays: data.length,
    };
  }, [data]);

  const lastPrice = data.length > 0 ? data[data.length - 1].close : 0;
  const prevPrice = data.length > 1 ? data[data.length - 2].close : lastPrice;
  const dailyChange = prevPrice > 0 ? ((lastPrice - prevPrice) / prevPrice) * 100 : 0;

  const fundQuery = fundSearch.trim().toLowerCase();

  const formatFundamentalValue = (value: FundamentalsValue): string => {
    if (value === null) return "-";
    if (typeof value === "number") return value.toLocaleString();
    return value;
  };

  const renderFundamentalsTable = (snapshot: FundamentalsSnapshot | null) => {
    if (!snapshot) {
      return (
        <NoResultsState
          title="No data for this period"
          description="This statement is missing for the selected quarter."
          className="py-10"
        />
      );
    }

    const rows = Object.keys(snapshot.fields).map((key) => ({
      key,
      label: snapshot.labels[key] || key,
      value: snapshot.fields[key],
    }));

    const filtered = fundQuery
      ? rows.filter((r) => r.key.toLowerCase().includes(fundQuery) || r.label.toLowerCase().includes(fundQuery))
      : rows;

    if (filtered.length === 0) {
      return (
        <NoResultsState
          title="No fields matched"
          description="Try a different filter keyword."
          className="py-10"
        />
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="py-2 pr-4 text-left font-medium text-gray-600 dark:text-gray-300">Field</th>
              <th className="py-2 text-right font-medium text-gray-600 dark:text-gray-300">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((r) => (
              <tr key={r.key} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-2 pr-4 text-gray-700 dark:text-gray-200">
                  <span className="block font-medium">{r.label}</span>
                  <span className="block text-xs text-gray-400 dark:text-gray-500 font-mono">{r.key}</span>
                </td>
                <td className="py-2 text-right text-gray-900 dark:text-gray-100 font-mono">
                  {formatFundamentalValue(r.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Interactive Charts</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Analyze individual stocks with professional candlestick charts
            </p>
            {stockMeta?.organName ? (
              <p
                className="mt-2 text-sm text-gray-700 dark:text-gray-300 line-clamp-1"
                title={stockMeta.organName}
              >
                {stockMeta.organName}
              </p>
            ) : null}
            {(stockMeta?.icbName4 || stockMeta?.status) ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {stockMeta.icbName4 ? (
                  <Badge variant="outline" className="max-w-full">
                    <span className="line-clamp-1" title={stockMeta.icbName4}>
                      {stockMeta.icbName4}
                    </span>
                  </Badge>
                ) : null}
                {stockMeta.status ? (
                  <Badge variant={stockMeta.status === "ACTIVE" ? "success" : "secondary"}>
                    {stockMeta.status}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Time Range Selector */}
            <TimeRangeSelector
              ranges={TIME_RANGES}
              selected={timeRange}
              onChange={setTimeRange}
            />

            {/* Search */}
            <div className="flex gap-2">
              <div className="relative">
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Enter symbol..."
                  className="w-32 pl-3"
                  maxLength={10}
                />
              </div>
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && !loading && (
        <ErrorState
          message="Failed to load chart"
          description={error}
          onRetry={() => setRefreshCounter((prev) => prev + 1)}
          className="mb-6"
        />
      )}

      {/* Stats Cards - Show skeleton while loading */}
      {loading ? (
        <SkeletonStats count={6} className="mb-6" />
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 border-blue-100 dark:border-blue-800">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Symbol</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{symbol}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Price</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.lastPrice.toFixed(2)}</p>
              <div className={`flex items-center text-xs font-medium ${dailyChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {dailyChange >= 0 ? (
                  <TrendingUp className="w-3 h-3 mr-1" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-1" />
                )}
                {dailyChange >= 0 ? "+" : ""}
                {dailyChange.toFixed(2)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Period Return</p>
              <p className={`text-xl font-bold ${stats.totalReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {formatPercent(stats.totalReturn)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">52W High / Low</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {stats.highestPrice.toFixed(2)} / {stats.lowestPrice.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Volatility</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.volatility.toFixed(1)}%</p>
              <p className="text-xs text-gray-400">Annualized</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Volume</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(stats.avgVolume)}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Chart */}
      {loading ? (
        <SkeletonChart height={450} className="border border-gray-200 dark:border-gray-700 rounded-xl" />
      ) : chartData.length > 0 ? (
        <CandlestickChart
          data={chartData}
          symbol={symbol}
          height={450}
          showVolume={true}
          indicators={[
            { type: "sma", period: 20, color: "#f59e0b" },
            { type: "ema", period: 50, color: "#8b5cf6" },
          ]}
        />
      ) : error ? null : (
        <NoResultsState
          title="No chart data available"
          description="Enter a valid stock symbol to view the chart"
          className="h-96 bg-gray-50 dark:bg-gray-800/50 rounded-xl"
        />
      )}

      {/* Period Info */}
      {data.length > 0 && !loading && (
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>
              {data[0]?.date
                ? new Date(data[0].date).toLocaleDateString(undefined, { timeZone: "UTC" })
                : "N/A"}{" "}
              -{" "}
              {data[data.length - 1]?.date
                ? new Date(data[data.length - 1].date).toLocaleDateString(undefined, { timeZone: "UTC" })
                : "N/A"}
            </span>
          </div>
          <Badge variant="outline">{data.length} trading days</Badge>
        </div>
      )}

      {/* Fundamentals */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Fundamentals (Quarterly)</CardTitle>
          <CardDescription>Balance Sheet, Income Statement, Cash Flow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-end gap-3 mb-4">
            <div className="w-full md:w-44">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Period
              </label>
              <Select
                value={fundPeriod}
                onChange={(e) => handleFundamentalsPeriodChange(e.target.value)}
                options={fundamentalsPeriodOptions}
                disabled={fundLoading || fundamentalsPeriodOptions.length === 0}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filter Fields
              </label>
              <Input
                value={fundSearch}
                onChange={(e) => setFundSearch(e.target.value)}
                placeholder="Search by name or key..."
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => loadFundamentals(symbol, fundPeriod || "latest")}
                disabled={fundLoading || !symbol}
              >
                {fundLoading ? (
                  <div className="animate-spin w-4 h-4 border-2 border-gray-900 dark:border-gray-100 border-t-transparent rounded-full" />
                ) : (
                  "Reload"
                )}
              </Button>
            </div>
          </div>

          {fundError ? (
            <NoResultsState
              title="Fundamentals unavailable"
              description={fundError}
              className="py-10"
            />
          ) : fundamentals ? (
            <Tabs defaultValue="is">
              <TabsList className="mb-4">
                <TabsTrigger value="is">Income Statement</TabsTrigger>
                <TabsTrigger value="bs">Balance Sheet</TabsTrigger>
                <TabsTrigger value="cf">Cash Flow</TabsTrigger>
              </TabsList>

              <TabsContent value="is">
                {renderFundamentalsTable(fundamentals.incomeStatement)}
              </TabsContent>
              <TabsContent value="bs">
                {renderFundamentalsTable(fundamentals.balanceSheet)}
              </TabsContent>
              <TabsContent value="cf">
                {renderFundamentalsTable(fundamentals.cashFlow)}
              </TabsContent>
            </Tabs>
          ) : (
            <NoResultsState
              title="No fundamentals loaded"
              description="Select a stock symbol to load quarterly fundamentals."
              className="py-10"
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function ChartsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="h-9 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
            <div className="h-5 w-72 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
      <SkeletonStats count={6} className="mb-6" />
      <SkeletonChart height={450} className="border border-gray-200 dark:border-gray-700 rounded-xl" />
    </div>
  );
}

export default function ChartsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Suspense fallback={<ChartsLoading />}>
        <ChartsContent />
      </Suspense>
    </div>
  );
}
