"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useWatchlistStore } from "@/lib/stores/watchlistStore";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { fetchStockSeriesBatch, toNumber } from "./api";

const DEFAULT_SYMBOLS = ["VNM", "FPT", "VCB", "VIC", "MWG"];
const DEFAULT_ROW_DATA = { price: 0, change: 0, volume: 0 };

type WatchlistQuote = {
  price: number;
  change: number;
  volume: number;
};

const WatchlistRow = React.memo(function WatchlistRow({
  symbol,
  data,
}: {
  symbol: string;
  data: WatchlistQuote;
}) {
  const isPositive = data.change > 0;
  const isNegative = data.change < 0;

  const TrendIcon = React.useMemo(() => {
    if (isPositive) return TrendingUp;
    if (isNegative) return TrendingDown;
    return Minus;
  }, [isPositive, isNegative]);

  return (
    <tr className="last:border-0 border-b border-stone-100 transition-colors hover:bg-stone-100 dark:border-neutral-800 dark:hover:bg-neutral-900/60">
      <td className="py-2">
        <span className="font-semibold text-stone-900 dark:text-white">{symbol}</span>
      </td>
      <td className="py-2 text-right">
        <span
          className={cn(
            "font-medium",
            isPositive && "text-emerald-700 dark:text-emerald-400",
            isNegative && "text-rose-700 dark:text-rose-400",
            !isPositive && !isNegative && "text-stone-900 dark:text-white"
          )}
        >
          {data.price.toFixed(2)}
        </span>
      </td>
      <td className="py-2 text-right">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-sm font-medium",
            isPositive && "text-emerald-700 dark:text-emerald-400",
            isNegative && "text-rose-700 dark:text-rose-400",
            !isPositive && !isNegative && "text-stone-500 dark:text-neutral-400"
          )}
        >
          <TrendIcon className="h-3 w-3" />
          {isPositive && "+"}
          {data.change.toFixed(2)}%
        </span>
      </td>
      <td className="hidden py-2 text-right text-sm text-stone-500 dark:text-neutral-400 sm:table-cell">
        {(data.volume / 1000).toFixed(0)}K
      </td>
    </tr>
  );
});

function WatchlistWidgetBase() {
  const { symbols } = useWatchlistStore();
  const [quotes, setQuotes] = React.useState<Record<string, WatchlistQuote>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const displaySymbols = React.useMemo(
    () => (symbols.length > 0 ? symbols : DEFAULT_SYMBOLS).map((item) => item.trim().toUpperCase()).filter(Boolean).slice(0, 20),
    [symbols]
  );

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadQuotes() {
      if (displaySymbols.length === 0) {
        setQuotes({});
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const batch = await fetchStockSeriesBatch(displaySymbols, 2, controller.signal);
        const nextEntries = displaySymbols.map((symbol) => {
          const rows = batch[symbol] ?? [];
          const latest = rows.length > 0 ? rows[rows.length - 1] : null;
          const previous = rows.length > 1 ? rows[rows.length - 2] : null;
          const latestClose = toNumber(latest?.close);
          const previousClose = toNumber(previous?.close, latestClose);
          const change = previousClose > 0 ? ((latestClose - previousClose) / previousClose) * 100 : 0;
          const quote: WatchlistQuote = {
            price: latestClose,
            change,
            volume: toNumber(latest?.volume),
          };
          return [symbol, quote] as const;
        });
        if (controller.signal.aborted) return;
        setQuotes(Object.fromEntries(nextEntries));
        setLoading(false);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setLoading(false);
        setError(loadError instanceof Error ? loadError.message : "Failed to load watchlist quotes");
      }
    }

    loadQuotes();
    return () => controller.abort();
  }, [displaySymbols]);

  const tableHeader = React.useMemo(
    () => (
      <thead className="sticky top-0 bg-white dark:bg-neutral-900">
        <tr className="text-xs uppercase tracking-[0.12em] text-stone-500 dark:text-neutral-400">
          <th className="py-2 text-left font-medium">Ticker</th>
          <th className="py-2 text-right font-medium">Price</th>
          <th className="py-2 text-right font-medium">+/- %</th>
          <th className="hidden py-2 text-right font-medium sm:table-cell">Volume</th>
        </tr>
      </thead>
    ),
    []
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          {tableHeader}
          <tbody>
            {displaySymbols.map((symbol) => {
              const data = quotes[symbol] ?? DEFAULT_ROW_DATA;
              return <WatchlistRow key={symbol} symbol={symbol} data={data} />;
            })}
          </tbody>
        </table>
      </div>

      {loading && (
        <p className="mt-2 text-center text-xs text-stone-500 dark:text-neutral-500">Updating quotes...</p>
      )}
      {error && (
        <p className="mt-2 text-center text-xs text-rose-700 dark:text-rose-300">{error}</p>
      )}
      {symbols.length === 0 && (
        <p className="mt-2 text-center text-xs text-stone-500 dark:text-neutral-500">Add symbols to your watchlist to display data.</p>
      )}
    </div>
  );
}

export const WatchlistWidget = React.memo(WatchlistWidgetBase);
