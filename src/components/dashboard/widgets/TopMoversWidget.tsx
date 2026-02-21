"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

// Mock data - in production this would come from API
const MOCK_GAINERS = [
  { symbol: "HQC", price: 12.8, change: 6.9, volume: 5200000 },
  { symbol: "ROS", price: 45.5, change: 6.5, volume: 3100000 },
  { symbol: "VND", price: 28.2, change: 5.8, volume: 8900000 },
  { symbol: "PVS", price: 18.5, change: 5.2, volume: 4500000 },
  { symbol: "PVD", price: 42.3, change: 4.8, volume: 2100000 },
];

const MOCK_LOSERS = [
  { symbol: "REE", price: 85.5, change: -5.2, volume: 1200000 },
  { symbol: "DHG", price: 92.0, change: -4.8, volume: 890000 },
  { symbol: "HT1", price: 28.5, change: -4.2, volume: 2300000 },
  { symbol: "NT2", price: 35.0, change: -3.8, volume: 1500000 },
  { symbol: "PGC", price: 22.5, change: -3.5, volume: 3400000 },
];

// Memoized mover row component
const MoverRow = React.memo(function MoverRow({
  item,
  index,
  isGainer,
}: {
  item: (typeof MOCK_GAINERS)[0];
  index: number;
  isGainer: boolean;
}) {
  const isPositive = item.change >= 0;

  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "w-5 h-5 rounded flex items-center justify-center text-xs font-bold",
            index < 3
              ? isGainer
                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
              : "bg-gray-100 dark:bg-gray-800 text-gray-500"
          )}
        >
          {index + 1}
        </span>
        <div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {item.symbol}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
            {(item.volume / 1000).toFixed(0)}K
          </span>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium text-gray-900 dark:text-gray-100">
          {item.price.toFixed(2)}
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
          {item.change.toFixed(2)}%
        </p>
      </div>
    </div>
  );
});

function TopMoversWidgetBase() {
  const [activeTab, setActiveTab] = React.useState<"gainers" | "losers">("gainers");

  // Memoize active tab data
  const data = React.useMemo(
    () => (activeTab === "gainers" ? MOCK_GAINERS : MOCK_LOSERS),
    [activeTab]
  );

  // Memoize tab handlers
  const handleGainersClick = React.useCallback(() => setActiveTab("gainers"), []);
  const handleLosersClick = React.useCallback(() => setActiveTab("losers"), []);

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-4">
        <button
          onClick={handleGainersClick}
          className={cn(
            "flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1",
            activeTab === "gainers"
              ? "text-green-600 dark:text-green-400 border-b-2 border-green-500"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          )}
        >
          <TrendingUp className="h-4 w-4" />
          Tăng mạnh
        </button>
        <button
          onClick={handleLosersClick}
          className={cn(
            "flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1",
            activeTab === "losers"
              ? "text-red-600 dark:text-red-400 border-b-2 border-red-500"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          )}
        >
          <TrendingDown className="h-4 w-4" />
          Giảm mạnh
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto space-y-2">
        {data.map((item, index) => (
          <MoverRow
            key={item.symbol}
            item={item}
            index={index}
            isGainer={activeTab === "gainers"}
          />
        ))}
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
        HOSE - Cập nhật lúc 14:30
      </p>
    </div>
  );
}

export const TopMoversWidget = React.memo(TopMoversWidgetBase);
