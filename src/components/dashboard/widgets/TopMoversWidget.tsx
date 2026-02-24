"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { fetchJson, fetchStockSeriesBatch, normalizePercent, toNumber, type MarketOverviewResponse } from "./api";

interface MoverItem {
  symbol: string;
  price: number;
  change: number;
  volume: number;
}

interface MoversState {
  gainers: MoverItem[];
  losers: MoverItem[];
  degradedMode: string | null;
  loading: boolean;
  error: string | null;
}

const EMPTY_MOVERS_STATE: MoversState = {
  gainers: [],
  losers: [],
  degradedMode: null,
  loading: true,
  error: null,
};

async function enrichMovers(
  movers: Array<{ symbol?: string; change?: number }> | undefined,
  signal: AbortSignal
): Promise<MoverItem[]> {
  const normalized = (movers ?? [])
    .map((item) => ({
      symbol: String(item.symbol ?? "").trim().toUpperCase(),
      change: toNumber(item.change),
    }))
    .filter((item) => item.symbol.length > 0)
    .slice(0, 5);

  if (normalized.length === 0) return [];

  try {
    const symbols = normalized.map((item) => item.symbol);
    const batch = await fetchStockSeriesBatch(symbols, 1, signal);
    return normalized.map((item) => {
      const rows = batch[item.symbol] ?? [];
      const latest = rows.length > 0 ? rows[rows.length - 1] : null;
      return {
        symbol: item.symbol,
        price: toNumber(latest?.close),
        volume: toNumber(latest?.volume),
        change: normalizePercent(item.change),
      };
    });
  } catch {
    return normalized.map((item) => ({
      symbol: item.symbol,
      price: 0,
      volume: 0,
      change: normalizePercent(item.change),
    }));
  }
}

const MoverRow = React.memo(function MoverRow({
  item,
  index,
  isGainer,
}: {
  item: MoverItem;
  index: number;
  isGainer: boolean;
}) {
  const isPositive = item.change >= 0;

  return (
    <div className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-stone-100 dark:hover:bg-neutral-900/60">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded text-xs font-bold",
            index < 3
              ? isGainer
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
              : "bg-stone-100 text-stone-500 dark:bg-neutral-800 dark:text-neutral-400"
          )}
        >
          {index + 1}
        </span>
        <div>
          <span className="font-semibold text-stone-900 dark:text-white">{item.symbol}</span>
          <span className="ml-2 text-xs text-stone-500 dark:text-neutral-400">{(item.volume / 1000).toFixed(0)}K</span>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium text-stone-900 dark:text-white">{item.price.toFixed(2)}</p>
        <p
          className={cn(
            "text-sm font-medium",
            isPositive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
          )}
        >
          {isPositive ? "+" : ""}
          {item.change.toFixed(2)}%
        </p>
      </div>
    </div>
  );
});

function TopMoversWidgetBase() {
  const [activeTab, setActiveTab] = React.useState<"gainers" | "losers">("gainers");
  const [state, setState] = React.useState<MoversState>(EMPTY_MOVERS_STATE);

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadMovers() {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const overview = await fetchJson<MarketOverviewResponse>("/api/market-overview", controller.signal);
        const [gainers, losers] = await Promise.all([
          enrichMovers(overview.topGainers, controller.signal),
          enrichMovers(overview.topLosers, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setState({
          gainers,
          losers,
          degradedMode: typeof overview.degradedMode === "string" ? overview.degradedMode : null,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load movers",
        }));
      }
    }

    loadMovers();
    return () => controller.abort();
  }, []);

  const data = React.useMemo(
    () => (activeTab === "gainers" ? state.gainers : state.losers),
    [activeTab, state.gainers, state.losers]
  );

  const handleGainersClick = React.useCallback(() => setActiveTab("gainers"), []);
  const handleLosersClick = React.useCallback(() => setActiveTab("losers"), []);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex border-b border-stone-200 dark:border-neutral-800">
        <button
          onClick={handleGainersClick}
          className={cn(
            "flex flex-1 items-center justify-center gap-1 py-2 text-sm font-medium transition-colors",
            activeTab === "gainers"
              ? "border-b-2 border-emerald-600 text-emerald-700 dark:text-emerald-400"
              : "text-stone-500 hover:text-stone-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          )}
        >
          <TrendingUp className="h-4 w-4" />
          Top Gainers
        </button>
        <button
          onClick={handleLosersClick}
          className={cn(
            "flex flex-1 items-center justify-center gap-1 py-2 text-sm font-medium transition-colors",
            activeTab === "losers"
              ? "border-b-2 border-rose-500 text-rose-700 dark:text-rose-400"
              : "text-stone-500 hover:text-stone-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          )}
        >
          <TrendingDown className="h-4 w-4" />
          Top Losers
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-auto">
        {data.length > 0 &&
          data.map((item, index) => (
            <MoverRow key={`${activeTab}-${item.symbol}`} item={item} index={index} isGainer={activeTab === "gainers"} />
          ))}
        {!state.loading && data.length === 0 && (
          <div className="rounded-lg border border-dashed border-stone-300 p-3 text-xs text-stone-500 dark:border-neutral-700 dark:text-neutral-400">
            {state.degradedMode === "low_memory"
              ? "Top movers are unavailable in low-memory mode."
              : "No mover data available."}
          </div>
        )}
        {state.error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            {state.error}
          </div>
        )}
      </div>

      <p className="mt-2 text-center text-xs text-stone-500 dark:text-neutral-500">
        {state.loading ? "Updating movers..." : "Source: /api/market-overview + /api/stocks"}
      </p>
    </div>
  );
}

export const TopMoversWidget = React.memo(TopMoversWidgetBase);
