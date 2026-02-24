"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

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
    value: 1425.8,
    change: 8.52,
    changePercent: 0.6,
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
  totalVolume: "1.1B",
  totalValue: "28.5T",
};

const IndexCard = React.memo(function IndexCard({
  index,
}: {
  index: (typeof MARKET_INDICES)[0];
}) {
  const isPositive = index.change >= 0;

  return (
    <div className="flex items-center justify-between border border-stone-200 bg-stone-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div>
        <p className="font-semibold text-stone-900 dark:text-white">{index.name}</p>
        <p className="text-xs text-stone-500 dark:text-neutral-400">Volume: {index.volume}</p>
      </div>
      <div className="text-right">
        <p className="font-bold text-stone-900 dark:text-white">{index.value.toFixed(2)}</p>
        <p
          className={cn(
            "text-sm font-medium",
            isPositive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
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

const MarketStatsDisplay = React.memo(function MarketStatsDisplay({
  stats,
}: {
  stats: typeof MARKET_STATS;
}) {
  const totalStocks = stats.advancing + stats.declining + stats.unchanged;

  const percentages = React.useMemo(
    () => ({
      advancing: (stats.advancing / totalStocks) * 100,
      unchanged: (stats.unchanged / totalStocks) * 100,
      declining: (stats.declining / totalStocks) * 100,
    }),
    [totalStocks, stats.advancing, stats.unchanged, stats.declining]
  );

  return (
    <div className="mt-auto border-t border-stone-200 pt-4 dark:border-neutral-800">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-neutral-800">
          <div className="bg-emerald-600" style={{ width: `${percentages.advancing}%` }} />
          <div className="bg-yellow-500" style={{ width: `${percentages.unchanged}%` }} />
          <div className="bg-rose-500" style={{ width: `${percentages.declining}%` }} />
        </div>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-emerald-700 dark:text-emerald-400">Adv: {stats.advancing}</span>
        <span className="text-yellow-600 dark:text-yellow-400">Flat: {stats.unchanged}</span>
        <span className="text-rose-700 dark:text-rose-400">Dec: {stats.declining}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="border border-stone-200 bg-stone-50 p-2 text-center dark:border-neutral-800 dark:bg-neutral-900/60">
          <p className="text-xs text-stone-500 dark:text-neutral-400">Total Vol</p>
          <p className="font-semibold text-stone-900 dark:text-white">{stats.totalVolume}</p>
        </div>
        <div className="border border-stone-200 bg-stone-50 p-2 text-center dark:border-neutral-800 dark:bg-neutral-900/60">
          <p className="text-xs text-stone-500 dark:text-neutral-400">Total Value</p>
          <p className="font-semibold text-stone-900 dark:text-white">{stats.totalValue} VND</p>
        </div>
      </div>
    </div>
  );
});

function MarketOverviewWidgetBase() {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 space-y-3">
        {MARKET_INDICES.map((index) => (
          <IndexCard key={index.name} index={index} />
        ))}
      </div>

      <MarketStatsDisplay stats={MARKET_STATS} />
    </div>
  );
}

export const MarketOverviewWidget = React.memo(MarketOverviewWidgetBase);
