"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Mock data - in production this would come from API
const MARKET_INDICES = [
  {
    name: "VN-Index",
    value: 1285.45,
    change: 12.35,
    changePercent: 0.97,
    volume: "856.2M",
  },
  {
    name: "VN30-Index",
    value: 1425.80,
    change: 8.52,
    changePercent: 0.60,
    volume: "425.1M",
  },
  {
    name: "HNX-Index",
    value: 245.32,
    change: -2.15,
    changePercent: -0.87,
    volume: "125.8M",
  },
];

const MARKET_STATS = {
  advancing: 245,
  declining: 189,
  unchanged: 78,
  ceiling: 45,
  floor: 23,
  totalVolume: "1.1B",
  totalValue: "28.5T",
};

// Memoized index card component
const IndexCard = React.memo(function IndexCard({
  index,
}: {
  index: (typeof MARKET_INDICES)[0];
}) {
  const isPositive = index.change >= 0;

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <div>
        <p className="font-semibold text-gray-900 dark:text-gray-100">
          {index.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          KL: {index.volume}
        </p>
      </div>
      <div className="text-right">
        <p className="font-bold text-gray-900 dark:text-gray-100">
          {index.value.toFixed(2)}
        </p>
        <p
          className={cn(
            "text-sm font-medium",
            isPositive
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          )}
        >
          {isPositive ? "+" : ""}
          {index.change.toFixed(2)} ({isPositive ? "+" : ""}
          {index.changePercent.toFixed(2)}%)
        </p>
      </div>
    </div>
  );
});

// Memoized market stats component
const MarketStatsDisplay = React.memo(function MarketStatsDisplay({
  stats,
}: {
  stats: typeof MARKET_STATS;
}) {
  const totalStocks = stats.advancing + stats.declining + stats.unchanged;

  // Memoize percentage calculations
  const percentages = React.useMemo(
    () => ({
      advancing: (stats.advancing / totalStocks) * 100,
      unchanged: (stats.unchanged / totalStocks) * 100,
      declining: (stats.declining / totalStocks) * 100,
    }),
    [totalStocks, stats.advancing, stats.unchanged, stats.declining]
  );

  return (
    <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-800">
      {/* Advance/Decline */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-2 flex rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
          <div
            className="bg-green-500"
            style={{ width: `${percentages.advancing}%` }}
          />
          <div
            className="bg-yellow-500"
            style={{ width: `${percentages.unchanged}%` }}
          />
          <div
            className="bg-red-500"
            style={{ width: `${percentages.declining}%` }}
          />
        </div>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-green-600 dark:text-green-400">
          Tăng: {stats.advancing}
        </span>
        <span className="text-yellow-600 dark:text-yellow-400">
          Không đổi: {stats.unchanged}
        </span>
        <span className="text-red-600 dark:text-red-400">
          Giảm: {stats.declining}
        </span>
      </div>

      {/* Volume & Value */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
          <p className="text-xs text-gray-500 dark:text-gray-400">Tổng KL</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {stats.totalVolume}
          </p>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
          <p className="text-xs text-gray-500 dark:text-gray-400">Tổng GT</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {stats.totalValue} VND
          </p>
        </div>
      </div>
    </div>
  );
});

function MarketOverviewWidgetBase() {
  return (
    <div className="h-full flex flex-col">
      {/* Indices */}
      <div className="space-y-3 mb-4">
        {MARKET_INDICES.map((index) => (
          <IndexCard key={index.name} index={index} />
        ))}
      </div>

      {/* Market Stats */}
      <MarketStatsDisplay stats={MARKET_STATS} />
    </div>
  );
}

export const MarketOverviewWidget = React.memo(MarketOverviewWidgetBase);
