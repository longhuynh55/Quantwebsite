"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useWatchlistStore } from "@/lib/stores/watchlistStore";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// Mock prices - in production this would come from real-time API
const MOCK_PRICES: Record<string, { price: number; change: number; volume: number }> = {
  VNM: { price: 76.5, change: 1.2, volume: 1250000 },
  FPT: { price: 128.0, change: -0.5, volume: 890000 },
  VCB: { price: 92.5, change: 0.8, volume: 2100000 },
  VIC: { price: 68.0, change: 2.1, volume: 1560000 },
  MWG: { price: 48.5, change: -1.5, volume: 3200000 },
};

// Default symbols when watchlist is empty
const DEFAULT_SYMBOLS = ["VNM", "FPT", "VCB", "VIC", "MWG"];

// Memoized watchlist row component
const WatchlistRow = React.memo(function WatchlistRow({
  symbol,
  data,
}: {
  symbol: string;
  data: { price: number; change: number; volume: number };
}) {
  const isPositive = data.change > 0;
  const isNegative = data.change < 0;

  // Memoize icon component
  const TrendIcon = React.useMemo(() => {
    if (isPositive) return TrendingUp;
    if (isNegative) return TrendingDown;
    return Minus;
  }, [isPositive, isNegative]);

  return (
    <tr className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <td className="py-2">
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {symbol}
        </span>
      </td>
      <td className="text-right py-2">
        <span
          className={cn(
            "font-medium",
            isPositive && "text-green-600 dark:text-green-400",
            isNegative && "text-red-600 dark:text-red-400",
            !isPositive && !isNegative && "text-gray-900 dark:text-gray-100"
          )}
        >
          {data.price.toFixed(2)}
        </span>
      </td>
      <td className="text-right py-2">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 font-medium text-sm",
            isPositive && "text-green-600 dark:text-green-400",
            isNegative && "text-red-600 dark:text-red-400",
            !isPositive && !isNegative && "text-gray-500"
          )}
        >
          <TrendIcon className="h-3 w-3" />
          {isPositive && "+"}
          {data.change.toFixed(2)}%
        </span>
      </td>
      <td className="text-right py-2 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
        {(data.volume / 1000).toFixed(0)}K
      </td>
    </tr>
  );
});

function WatchlistWidgetBase() {
  const { symbols } = useWatchlistStore();

  // Memoize display symbols
  const displaySymbols = React.useMemo(
    () => (symbols.length > 0 ? symbols : DEFAULT_SYMBOLS),
    [symbols]
  );

  // Memoize table header
  const tableHeader = React.useMemo(
    () => (
      <thead className="sticky top-0 bg-white dark:bg-gray-900">
        <tr className="text-xs text-gray-500 dark:text-gray-400">
          <th className="text-left py-2 font-medium">Mã</th>
          <th className="text-right py-2 font-medium">Giá</th>
          <th className="text-right py-2 font-medium">+/-%</th>
          <th className="text-right py-2 font-medium hidden sm:table-cell">KL</th>
        </tr>
      </thead>
    ),
    []
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          {tableHeader}
          <tbody>
            {displaySymbols.map((symbol) => {
              const data = MOCK_PRICES[symbol] || { price: 0, change: 0, volume: 0 };
              return (
                <WatchlistRow key={symbol} symbol={symbol} data={data} />
              );
            })}
          </tbody>
        </table>
      </div>

      {symbols.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
          Thêm cổ phiếu vào danh sách theo dõi để hiển thị
        </p>
      )}
    </div>
  );
}

export const WatchlistWidget = React.memo(WatchlistWidgetBase);
