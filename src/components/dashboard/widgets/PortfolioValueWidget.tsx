"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";

const MOCK_PORTFOLIO = {
  totalValue: 1250000000,
  dayChange: 25000000,
  dayChangePercent: 2.04,
  weekChange: 5.2,
  monthChange: 12.8,
};

const PeriodChange = React.memo(function PeriodChange({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const isPositive = value >= 0;

  return (
    <div>
      <p className="text-xs text-stone-500 dark:text-neutral-400">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold",
          isPositive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
        )}
      >
        {isPositive ? "+" : ""}
        {value}%
      </p>
    </div>
  );
});

function PortfolioValueWidgetBase() {
  const formatCurrency = React.useCallback((value: number) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    return value.toLocaleString("vi-VN");
  }, []);

  const isPositive = MOCK_PORTFOLIO.dayChange >= 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col justify-center">
        <p className="mb-1 text-sm text-stone-500 dark:text-neutral-400">Total portfolio value</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-stone-900 dark:text-white">
            <AnimatedNumber value={MOCK_PORTFOLIO.totalValue / 1e6} decimals={2} />M
          </span>
          <span className="text-sm text-stone-500 dark:text-neutral-400">VND</span>
        </div>

        <div
          className={cn(
            "mt-3 flex items-center gap-2",
            isPositive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
          )}
        >
          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          <span className="font-semibold">
            {isPositive ? "+" : ""}
            {formatCurrency(MOCK_PORTFOLIO.dayChange)} VND
          </span>
          <span className="text-sm opacity-80">
            ({isPositive ? "+" : ""}
            {MOCK_PORTFOLIO.dayChangePercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-stone-200 pt-4 dark:border-neutral-800">
        <PeriodChange label="1W" value={MOCK_PORTFOLIO.weekChange} />
        <PeriodChange label="1M" value={MOCK_PORTFOLIO.monthChange} />
      </div>
    </div>
  );
}

export const PortfolioValueWidget = React.memo(PortfolioValueWidgetBase);
