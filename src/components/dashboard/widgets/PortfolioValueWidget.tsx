"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";

// Mock data - in production this would come from API
const MOCK_PORTFOLIO = {
  totalValue: 1250000000, // 1.25 billion VND
  dayChange: 25000000, // 25 million VND
  dayChangePercent: 2.04,
  weekChange: 5.2,
  monthChange: 12.8,
};

// Memoized period change component
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
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={cn(
          "font-semibold text-sm",
          isPositive
            ? "text-green-600 dark:text-green-400"
            : "text-red-600 dark:text-red-400"
        )}
      >
        {isPositive ? "+" : ""}
        {value}%
      </p>
    </div>
  );
});

function PortfolioValueWidgetBase() {
  // Memoize currency formatter
  const formatCurrency = React.useCallback((value: number) => {
    if (value >= 1e9) {
      return `${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `${(value / 1e6).toFixed(2)}M`;
    }
    return value.toLocaleString("vi-VN");
  }, []);

  const isPositive = MOCK_PORTFOLIO.dayChange >= 0;

  return (
    <div className="h-full flex flex-col">
      {/* Main Value */}
      <div className="flex-1 flex flex-col justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          Tổng giá trị danh mục
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">
            <AnimatedNumber
              value={MOCK_PORTFOLIO.totalValue / 1e6}
              decimals={2}
            />
            M
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">VND</span>
        </div>

        {/* Day Change */}
        <div
          className={cn(
            "flex items-center gap-2 mt-3",
            isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}
        >
          {isPositive ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <TrendingDown className="h-4 w-4" />
          )}
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

      {/* Period Changes */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
        <PeriodChange label="1 tuần" value={MOCK_PORTFOLIO.weekChange} />
        <PeriodChange label="1 tháng" value={MOCK_PORTFOLIO.monthChange} />
      </div>
    </div>
  );
}

export const PortfolioValueWidget = React.memo(PortfolioValueWidgetBase);
