"use client";

import { Suspense, useState, useEffect, useMemo, useCallback, useRef } from "react";

// Force dynamic rendering to avoid useSearchParams issues during build
export const dynamic = 'force-dynamic';
import { useSearchParams } from "next/navigation";
import { uiFeatureFlags } from "@/lib/featureFlags";
import { useUrlState } from "@/lib/hooks";
import { useAssistantStore } from "@/lib/stores/assistantStore";
import { useWatchlistStore } from "@/lib/stores/watchlistStore";
import { trackUiKpiEvent } from "@/lib/uiKpi";
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
  ErrorBoundary,
} from "@/components/ui";
import { showError } from "@/components/ui/toast";
import { CandlestickChart, TimeRangeSelector, OHLCVData, MultiLineChart } from "@/components/charts";
import { formatCurrency, formatPercent } from "@/lib/utils";
import {
  Search,
  Star,
  TrendingUp,
  TrendingDown,
  Calendar,
  X,
} from "lucide-react";

const TIME_RANGES = [
  { label: "1M", value: "30" },
  { label: "3M", value: "90" },
  { label: "6M", value: "180" },
  { label: "1Y", value: "365" },
  { label: "All", value: "all" },
];

const COMPARE_SYMBOL_LIMIT = 5;
const HOSE_EXCHANGE = "HOSE";
const COMPARE_LINE_COLORS = ["#047857", "#0f766e", "#b45309", "#57534e", "#0f766e"];

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

interface CompareSeries {
  symbol: string;
  data: StockPoint[];
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

function normalizeSymbolList(raw: string | null | undefined, limit: number): string[] {
  if (typeof raw !== "string") return [];
  const seen = new Set<string>();
  const symbols: string[] = [];
  for (const token of raw.split(/[,\s;|]+/)) {
    const normalized = token.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,10}$/.test(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    symbols.push(normalized);
    if (symbols.length >= limit) break;
  }
  return symbols;
}

function mergeUniqueSymbolLists(lists: string[][], limit: number): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const list of lists) {
    for (const candidate of list) {
      const normalized = candidate.trim().toUpperCase();
      if (!/^[A-Z0-9]{1,10}$/.test(normalized)) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      merged.push(normalized);
      if (merged.length >= limit) return merged;
    }
  }
  return merged;
}

function ChartsContent() {
  const searchParams = useSearchParams();
  const [symbol, setSymbol] = useUrlState<string>("symbol", "AAA");
  const [compareSymbolsParam, setCompareSymbolsParam] = useUrlState<string>("compare", "");
  const [timeRange, setTimeRange] = useUrlState<string>("timeRange", "365");
  const [searchInput, setSearchInput] = useState(symbol);
  const [compareInput, setCompareInput] = useState("");
  const [compareInputLoading, setCompareInputLoading] = useState(false);
  const setContext = useAssistantStore((state) => state.setContext);
  const setConversationScope = useAssistantStore((state) => state.setConversationScope);
  const watchlistSymbols = useWatchlistStore((state) => state.symbols);
  const addSymbolsToWatchlist = useWatchlistStore((state) => state.addSymbols);
  const toggleWatchlistSymbol = useWatchlistStore((state) => state.toggleSymbol);
  const queryWatchlistSymbols = useMemo(
    () => (uiFeatureFlags.watchlistBridge ? normalizeSymbolList(searchParams.get("watchlist"), 30) : []),
    [searchParams]
  );
  const assistantWatchlistSymbols = useMemo(
    () => (uiFeatureFlags.watchlistBridge ? mergeUniqueSymbolLists([queryWatchlistSymbols, watchlistSymbols], 30) : []),
    [queryWatchlistSymbols, watchlistSymbols]
  );
  const compareSymbols = useMemo(() => {
    const parsed = normalizeSymbolList(compareSymbolsParam, COMPARE_SYMBOL_LIMIT);
    return mergeUniqueSymbolLists([[symbol], parsed], COMPARE_SYMBOL_LIMIT);
  }, [compareSymbolsParam, symbol]);
  const compareExtraSymbols = useMemo(
    () => compareSymbols.filter((candidate) => candidate !== symbol),
    [compareSymbols, symbol]
  );
  
  // Sync search input with symbol from URL
  useEffect(() => {
    setSearchInput(symbol);
  }, [symbol]);

  useEffect(() => {
    if (!uiFeatureFlags.watchlistBridge) return;
    if (queryWatchlistSymbols.length === 0) return;
    addSymbolsToWatchlist(queryWatchlistSymbols);
  }, [addSymbolsToWatchlist, queryWatchlistSymbols]);

  useEffect(() => {
    setContext({ page: "charts", symbol });
  }, [setContext, symbol]);

  useEffect(() => {
    const scopeFilters: Record<string, unknown> = {
      symbol,
      timeRange,
    };
    if (uiFeatureFlags.watchlistBridge && assistantWatchlistSymbols.length > 0) {
      scopeFilters.symbols = assistantWatchlistSymbols;
      scopeFilters.watchlist = assistantWatchlistSymbols.join(",");
      scopeFilters.watchlistCount = assistantWatchlistSymbols.length;
    }
    if (uiFeatureFlags.watchlistBridge && queryWatchlistSymbols.length > 0) {
      scopeFilters.watchlistQuerySource = true;
      scopeFilters.contextSource = "watchlist_query";
    }

    setConversationScope({
      symbol,
      symbols: assistantWatchlistSymbols.length > 0 ? assistantWatchlistSymbols : undefined,
      timeframe: timeRange,
      filters: scopeFilters,
    });
  }, [assistantWatchlistSymbols, queryWatchlistSymbols, setConversationScope, symbol, timeRange]);

  const [data, setData] = useState<StockPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [stockMeta, setStockMeta] = useState<StockMetadataLite | null>(null);
  const [compareSeries, setCompareSeries] = useState<CompareSeries[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareIssues, setCompareIssues] = useState<string[]>([]);

  const [fundamentals, setFundamentals] = useState<FundamentalsResponse | null>(null);
  const [fundLoading, setFundLoading] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);
  const [fundPeriod, setFundPeriod] = useState<string>("latest");
  const [fundSearch, setFundSearch] = useState("");
  const fundamentalsAbortRef = useRef<AbortController | null>(null);
  const fundamentalsRequestSeqRef = useRef(0);

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

  useEffect(() => {
    let isMounted = true;

    async function fetchCompareSeries(symbols: string[]) {
      if (symbols.length === 0) {
        setCompareSeries([]);
        setCompareIssues([]);
        return;
      }

      setCompareLoading(true);
      setCompareIssues([]);
      try {
        const limitParam = timeRange === "all" ? "all" : String(parseInt(timeRange, 10));
        const results = await Promise.all(
          symbols.map(async (candidate) => {
            try {
              const response = await fetch(
                `/api/stocks?symbol=${encodeURIComponent(candidate)}&limit=${encodeURIComponent(limitParam)}`
              );
              if (!response.ok) {
                const maybe = await response.json().catch(() => null);
                const message = maybe?.error || `Failed to load ${candidate}`;
                return { symbol: candidate, error: message };
              }

              const result = await response.json();
              const exchangeValue = String(result?.metadata?.exchange ?? HOSE_EXCHANGE).trim().toUpperCase();
              if (exchangeValue && exchangeValue !== HOSE_EXCHANGE) {
                return { symbol: candidate, error: `${candidate} is listed on ${exchangeValue}.` };
              }
              if (!Array.isArray(result.data) || result.data.length === 0) {
                return { symbol: candidate, error: `No chart data available for ${candidate}.` };
              }

              return { symbol: candidate, data: result.data as StockPoint[] };
            } catch {
              return { symbol: candidate, error: `Failed to load ${candidate}.` };
            }
          })
        );

        if (!isMounted) return;

        const nextSeries: CompareSeries[] = [];
        const nextIssues: string[] = [];

        for (const item of results) {
          if ("error" in item) {
            nextIssues.push(item.error);
          } else {
            nextSeries.push({ symbol: item.symbol, data: item.data });
          }
        }

        setCompareSeries(nextSeries);
        setCompareIssues(nextIssues);
      } finally {
        if (isMounted) {
          setCompareLoading(false);
        }
      }
    }

    fetchCompareSeries(compareExtraSymbols);

    return () => {
      isMounted = false;
    };
  }, [compareExtraSymbols, refreshCounter, timeRange]);

  const handleSearch = useCallback(() => {
    const newSymbol = searchInput.trim().toUpperCase();
    if (!newSymbol) return;

    if (newSymbol !== symbol) {
      setSymbol(newSymbol);
    } else {
      setRefreshCounter((prev) => prev + 1);
    }
  }, [searchInput, symbol, setSymbol]);

  const handleAddCompareSymbol = useCallback(async () => {
    const candidate = compareInput.trim().toUpperCase();
    if (!candidate) return;
    if (!/^[A-Z0-9]{1,10}$/.test(candidate)) {
      showError("Invalid symbol", "Use 1-10 uppercase letters or digits.");
      return;
    }
    if (compareSymbols.includes(candidate)) {
      showError("Already selected", `${candidate} is already in the compare set.`);
      return;
    }
    if (compareSymbols.length >= COMPARE_SYMBOL_LIMIT) {
      showError("Limit reached", `You can compare up to ${COMPARE_SYMBOL_LIMIT} symbols.`);
      return;
    }

    setCompareInputLoading(true);
    try {
      const response = await fetch(`/api/stocks?symbol=${encodeURIComponent(candidate)}&limit=1`);
      if (!response.ok) {
        const maybe = await response.json().catch(() => null);
        showError("Symbol unavailable", maybe?.error || `Could not validate ${candidate}.`);
        return;
      }

      const result = await response.json();
      const exchangeValue = String(result?.metadata?.exchange ?? HOSE_EXCHANGE).trim().toUpperCase();
      if (exchangeValue && exchangeValue !== HOSE_EXCHANGE) {
        showError("HOSE-only compare", `${candidate} is listed on ${exchangeValue}.`);
        return;
      }

      setCompareSymbolsParam([...compareExtraSymbols, candidate].join(","));
      setCompareInput("");
    } catch {
      showError("Validation failed", `Could not validate ${candidate}.`);
    } finally {
      setCompareInputLoading(false);
    }
  }, [compareInput, compareSymbols, compareExtraSymbols, setCompareSymbolsParam]);

  const handleRemoveCompareSymbol = useCallback(
    (target: string) => {
      setCompareSymbolsParam(compareExtraSymbols.filter((candidate) => candidate !== target).join(","));
    },
    [compareExtraSymbols, setCompareSymbolsParam]
  );

  const handleClearCompareSymbols = useCallback(() => {
    setCompareSymbolsParam("");
  }, [setCompareSymbolsParam]);

  const handleWatchlistSelect = useCallback(
    (nextSymbol: string) => {
      if (!uiFeatureFlags.watchlistBridge) return;
      if (!nextSymbol) return;
      const normalized = nextSymbol.trim().toUpperCase();
      setSearchInput(normalized);
      setSymbol(normalized);
      trackUiKpiEvent({
        metric: "watchlist_interaction",
        event: "watchlist_selected_symbol",
        page: "charts",
        source: "charts_watchlist_dropdown",
        symbol: normalized,
        count: 1,
      });
    },
    [setSymbol]
  );

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

  const comparePrimarySupported = useMemo(() => {
    if (!stockMeta?.exchange) return true;
    return stockMeta.exchange.trim().toUpperCase() === HOSE_EXCHANGE;
  }, [stockMeta?.exchange]);

  const compareChartLines = useMemo(() => {
    const lineSymbols: string[] = [];
    if (comparePrimarySupported && data.length > 0) {
      lineSymbols.push(symbol);
    }
    for (const series of compareSeries) {
      if (!lineSymbols.includes(series.symbol)) {
        lineSymbols.push(series.symbol);
      }
    }
    return lineSymbols.slice(0, COMPARE_SYMBOL_LIMIT).map((item, index) => ({
      dataKey: item,
      name: item,
      color: COMPARE_LINE_COLORS[index % COMPARE_LINE_COLORS.length],
    }));
  }, [comparePrimarySupported, compareSeries, data.length, symbol]);

  const compareChartData = useMemo(() => {
    const seriesInput: CompareSeries[] = [];
    if (comparePrimarySupported && data.length > 0) {
      seriesInput.push({ symbol, data });
    }
    for (const series of compareSeries) {
      seriesInput.push(series);
    }

    const dataByDate = new Map<string, Record<string, string | number | null | undefined>>();
    for (const series of seriesInput) {
      const baseClose = series.data[0]?.close;
      if (!Number.isFinite(baseClose) || !baseClose) continue;
      for (const point of series.data) {
        const dateKey = point.date.length >= 10 ? point.date.slice(0, 10) : point.date;
        const row = dataByDate.get(dateKey) ?? { date: dateKey };
        row[series.symbol] = ((point.close - baseClose) / baseClose) * 100;
        dataByDate.set(dateKey, row);
      }
    }

    return Array.from(dataByDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [comparePrimarySupported, compareSeries, data, symbol]);

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

  const isCurrentSymbolInWatchlist = uiFeatureFlags.watchlistBridge && watchlistSymbols.includes(symbol);
  const watchlistOptions = useMemo(
    () => (uiFeatureFlags.watchlistBridge ? watchlistSymbols.map((item) => ({ value: item, label: item })) : []),
    [watchlistSymbols]
  );

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
          <thead className="border-b border-stone-200 dark:border-neutral-700">
            <tr>
              <th className="py-2 pr-4 text-left font-medium text-stone-600 dark:text-neutral-300">Field</th>
              <th className="py-2 text-right font-medium text-stone-600 dark:text-neutral-300">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-neutral-700">
            {filtered.map((r) => (
              <tr key={r.key} className="hover:bg-stone-100 dark:hover:bg-neutral-800/50">
                <td className="py-2 pr-4 text-stone-700 dark:text-neutral-200">
                  <span className="block font-medium">{r.label}</span>
                  <span className="block text-xs text-stone-500 dark:text-neutral-400 font-mono">{r.key}</span>
                </td>
                <td className="py-2 text-right text-stone-900 dark:text-white font-mono">
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
      <header className="mb-12 pb-8 border-b border-stone-200 dark:border-neutral-800">
        {/* Kicker */}
        <div className="flex items-center gap-3 mb-4">
          <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
          <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
            Technical Analysis
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight">
              Interactive Charts
            </h1>
            <p className="text-stone-600 dark:text-neutral-400 mt-2">
              Analyze individual stocks with professional candlestick charts
            </p>
            {stockMeta?.organName ? (
              <p
                className="mt-2 text-sm text-stone-700 dark:text-neutral-300 line-clamp-1"
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
        </div>
      </header>

      <div className="mb-6 flex flex-col gap-3 border border-stone-200 bg-stone-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/60 sm:flex-row sm:items-center sm:justify-between">
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
                  className="w-32 border-stone-300 bg-white pl-3 dark:border-neutral-700 dark:bg-neutral-950"
                  maxLength={10}
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={loading}
                className="bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {loading ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
              {uiFeatureFlags.watchlistBridge ? (
                <Button
                  variant="outline"
                  className="border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
                  onClick={() => {
                    const action = isCurrentSymbolInWatchlist ? "removed" : "added";
                    toggleWatchlistSymbol(symbol);
                    trackUiKpiEvent({
                      metric: "watchlist_interaction",
                      event: "watchlist_toggled",
                      page: "charts",
                      source: `charts_header_${action}`,
                      symbol,
                      count: 1,
                    });
                  }}
                  title={isCurrentSymbolInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                >
                  <Star className={`w-4 h-4 ${isCurrentSymbolInWatchlist ? "fill-yellow-400 text-yellow-500" : ""}`} />
                </Button>
              ) : null}
            </div>
            {uiFeatureFlags.watchlistBridge && watchlistOptions.length > 0 ? (
              <div className="min-w-32">
                <Select
                  value={symbol}
                  onChange={(event) => handleWatchlistSelect(event.target.value)}
                  options={watchlistOptions}
                  className="border-stone-300 bg-white text-stone-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
                />
              </div>
            ) : uiFeatureFlags.watchlistBridge ? (
              <div className="text-xs text-stone-500 dark:text-neutral-400 self-center">
                Watchlist is empty
              </div>
            ) : null}
          </div>

      {/* Compare Picker */}
      <Card className="mb-6 overflow-hidden border-stone-200 dark:border-neutral-800">
        <div className="h-px bg-emerald-700 dark:bg-emerald-500" />
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <p className="font-semibold text-stone-900 dark:text-white">HOSE Compare (max {COMPARE_SYMBOL_LIMIT})</p>
                <p className="text-sm text-stone-600 dark:text-neutral-400">
                  Add symbols to compare normalized performance. HOSE symbols only.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={compareInput}
                  onChange={(event) => setCompareInput(event.target.value.toUpperCase())}
                  onKeyDown={(event) => event.key === "Enter" && void handleAddCompareSymbol()}
                  placeholder="Add HOSE symbol..."
                  maxLength={10}
                  className="w-44 border-stone-300 bg-white dark:border-neutral-700 dark:bg-neutral-950"
                  disabled={compareInputLoading || compareSymbols.length >= COMPARE_SYMBOL_LIMIT}
                />
                <Button
                  onClick={() => void handleAddCompareSymbol()}
                  disabled={compareInputLoading || compareSymbols.length >= COMPARE_SYMBOL_LIMIT}
                  className="bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  {compareInputLoading ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent" />
                  ) : (
                    "Add"
                  )}
                </Button>
                {compareExtraSymbols.length > 0 ? (
                  <Button
                    variant="outline"
                    onClick={handleClearCompareSymbols}
                    className="border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {compareSymbols.map((item) => {
                const isPrimary = item === symbol;
                return (
                  <Badge key={item} variant={isPrimary ? "success" : "outline"} className="flex items-center gap-2">
                    <span>{isPrimary ? `${item} (Primary)` : item}</span>
                    {!isPrimary ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveCompareSymbol(item)}
                        className="inline-flex items-center justify-center hover:text-rose-600 dark:hover:text-rose-400"
                        aria-label={`Remove ${item}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    ) : null}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

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
          <Card className="relative overflow-hidden border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="absolute inset-x-0 top-0 h-px bg-emerald-600/80 dark:bg-emerald-500/70" />
            <CardContent className="p-4">
              <p className="text-xs text-stone-500 dark:text-neutral-400 mb-1">Symbol</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{symbol}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-stone-500 dark:text-neutral-400 mb-1">Price</p>
              <p className="text-xl font-bold text-stone-900 dark:text-white">{stats.lastPrice.toFixed(2)}</p>
              <div
                className={`flex items-center text-xs font-medium ${dailyChange >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}
              >
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
              <p className="text-xs text-stone-500 dark:text-neutral-400 mb-1">Period Return</p>
              <p
                className={`text-xl font-bold ${stats.totalReturn >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}
              >
                {formatPercent(stats.totalReturn)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-stone-500 dark:text-neutral-400 mb-1">52W High / Low</p>
              <p className="text-sm font-bold text-stone-900 dark:text-white">
                {stats.highestPrice.toFixed(2)} / {stats.lowestPrice.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-stone-500 dark:text-neutral-400 mb-1">Volatility</p>
              <p className="text-xl font-bold text-stone-900 dark:text-white">{stats.volatility.toFixed(1)}%</p>
              <p className="text-xs text-stone-400">Annualized</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-stone-500 dark:text-neutral-400 mb-1">Avg Volume</p>
              <p className="text-lg font-bold text-stone-900 dark:text-white">{formatCurrency(stats.avgVolume)}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Chart */}
      {loading ? (
        <SkeletonChart height={450} className="border border-stone-200 dark:border-neutral-700" />
      ) : chartData.length > 0 ? (
        <ErrorBoundary
          fallback={
            <div className="border border-rose-200 bg-rose-50/70 p-8 text-center dark:border-rose-900/40 dark:bg-rose-900/10">
              <p className="mb-2 font-medium text-rose-700 dark:text-rose-400">
                Error displaying chart
              </p>
              <p className="text-sm text-stone-600 dark:text-neutral-400 mb-4">
                The chart could not be rendered. Please try refreshing or selecting a different symbol.
              </p>
              <Button size="sm" onClick={() => setRefreshCounter(prev => prev + 1)}>
                Retry
              </Button>
            </div>
          }
        >
          <CandlestickChart
          data={chartData}
          symbol={symbol}
          height={450}
          showVolume={true}
          indicators={[
            { type: "sma", period: 20, color: "#d97706" },
            { type: "ema", period: 50, color: "#047857" },
          ]}
        />
        </ErrorBoundary>
      ) : error ? null : (
        <NoResultsState
          title="No chart data available"
          description="Enter a valid stock symbol to view the chart"
          className="h-96 bg-stone-100 dark:bg-neutral-800/50"
        />
      )}

      {/* Compare Canvas */}
      <Card className="mt-6 overflow-hidden border-stone-200 dark:border-neutral-800">
        <div className="h-px bg-emerald-700 dark:bg-emerald-500" />
        <CardHeader className="border-b border-stone-200 bg-stone-50/70 dark:border-neutral-800 dark:bg-neutral-900/60">
          <CardTitle className="font-serif text-lg text-stone-900 dark:text-white">Compare Performance</CardTitle>
          <CardDescription>Normalized return (%) from each symbol&apos;s first visible data point.</CardDescription>
        </CardHeader>
        <CardContent>
          {!comparePrimarySupported ? (
            <div className="mb-3 text-sm text-amber-700 dark:text-amber-400">
              {symbol} is listed on {stockMeta?.exchange}. Compare canvas supports HOSE symbols only.
            </div>
          ) : null}
          {compareIssues.length > 0 ? (
            <div className="mb-3 text-sm text-amber-700 dark:text-amber-400">
              {compareIssues[0]}
            </div>
          ) : null}
          {loading || compareLoading ? (
            <SkeletonChart height={320} />
          ) : compareChartData.length > 0 && compareChartLines.length > 0 ? (
            <MultiLineChart
              data={compareChartData}
              lines={compareChartLines}
              xKey="date"
              height={320}
              format="percent"
              showCrosshair={true}
            />
          ) : (
            <NoResultsState
              title="No compare data available"
              description="Add up to 5 HOSE symbols to compare on one canvas."
              className="py-10"
            />
          )}
        </CardContent>
      </Card>

      {/* Period Info */}
      {data.length > 0 && !loading && (
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-stone-500 dark:text-neutral-400">
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
      <ErrorBoundary
        fallback={
          <Card className="mt-8 border-rose-200 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-900/10">
            <CardContent className="p-8 text-center">
              <p className="mb-2 font-medium text-rose-700 dark:text-rose-400">
                Error loading fundamentals
              </p>
              <p className="text-sm text-stone-600 dark:text-neutral-400">
                Please try reloading the fundamentals data.
              </p>
            </CardContent>
          </Card>
        }
      >
        <Card className="mt-8 overflow-hidden border-stone-200 dark:border-neutral-800">
        <div className="h-px bg-emerald-700 dark:bg-emerald-500" />
        <CardHeader className="border-b border-stone-200 bg-stone-50/70 dark:border-neutral-800 dark:bg-neutral-900/60">
          <CardTitle className="font-serif text-lg text-stone-900 dark:text-white">Fundamentals (Quarterly)</CardTitle>
          <CardDescription>Balance Sheet, Income Statement, Cash Flow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-end gap-3 mb-4">
            <div className="w-full md:w-44">
              <label className="block text-sm font-medium text-stone-700 dark:text-neutral-300 mb-1">
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
              <label className="block text-sm font-medium text-stone-700 dark:text-neutral-300 mb-1">
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
                  <div className="animate-spin w-4 h-4 border-2 border-stone-900 dark:border-neutral-100 border-t-transparent" />
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
      </ErrorBoundary>
    </>
  );
}

function ChartsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="h-9 w-48 bg-stone-200 dark:bg-neutral-700 animate-pulse mb-2" />
            <div className="h-5 w-72 bg-stone-200 dark:bg-neutral-700 animate-pulse" />
          </div>
        </div>
      </div>
      <SkeletonStats count={6} className="mb-6" />
      <SkeletonChart height={450} className="border border-stone-200 dark:border-neutral-700" />
    </div>
  );
}

export default function ChartsPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<ChartsLoading />}>
        <ChartsContent />
      </Suspense>
    </div>
  );
}
