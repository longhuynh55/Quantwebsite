"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

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

  const data = React.useMemo(() => (activeTab === "gainers" ? MOCK_GAINERS : MOCK_LOSERS), [activeTab]);

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
        {data.map((item, index) => (
          <MoverRow key={item.symbol} item={item} index={index} isGainer={activeTab === "gainers"} />
        ))}
      </div>

      <p className="mt-2 text-center text-xs text-stone-500 dark:text-neutral-500">HOSE update at 14:30</p>
    </div>
  );
}

export const TopMoversWidget = React.memo(TopMoversWidgetBase);
