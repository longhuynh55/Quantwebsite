"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useWatchlistStore } from "@/lib/stores/watchlistStore";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const MOCK_PRICES: Record<string, { price: number; change: number; volume: number }> = {
  VNM: { price: 76.5, change: 1.2, volume: 1250000 },
  FPT: { price: 128.0, change: -0.5, volume: 890000 },
  VCB: { price: 92.5, change: 0.8, volume: 2100000 },
  VIC: { price: 68.0, change: 2.1, volume: 1560000 },
  MWG: { price: 48.5, change: -1.5, volume: 3200000 },
};

const DEFAULT_SYMBOLS = ["VNM", "FPT", "VCB", "VIC", "MWG"];

const WatchlistRow = React.memo(function WatchlistRow({
  symbol,
  data,
}: {
  symbol: string;
  data: { price: number; change: number; volume: number };
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

  const displaySymbols = React.useMemo(() => (symbols.length > 0 ? symbols : DEFAULT_SYMBOLS), [symbols]);

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
              const data = MOCK_PRICES[symbol] || { price: 0, change: 0, volume: 0 };
              return <WatchlistRow key={symbol} symbol={symbol} data={data} />;
            })}
          </tbody>
        </table>
      </div>

      {symbols.length === 0 && (
        <p className="mt-2 text-center text-xs text-stone-500 dark:text-neutral-500">Add symbols to your watchlist to display data.</p>
      )}
    </div>
  );
}

export const WatchlistWidget = React.memo(WatchlistWidgetBase);
