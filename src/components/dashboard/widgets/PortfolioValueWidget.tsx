"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { useWatchlistStore } from "@/lib/stores/watchlistStore";
import { fetchStockSeriesBatch, toNumber, type StockOhlcvRow } from "./api";

const BASE_CAPITAL_PER_SYMBOL = 250_000_000;
const DEFAULT_SYMBOLS = ["VNM", "FPT", "VCB", "VIC", "MWG"];

type PortfolioStats = {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  weekChange: number;
  monthChange: number;
  modeledSymbols: number;
};

const EMPTY_PORTFOLIO: PortfolioStats = {
  totalValue: 0,
  dayChange: 0,
  dayChangePercent: 0,
  weekChange: 0,
  monthChange: 0,
  modeledSymbols: 0,
};

function resolveRow(rows: StockOhlcvRow[], indexFromEnd: number): StockOhlcvRow | null {
  if (rows.length === 0) return null;
  const index = rows.length - indexFromEnd;
  if (index >= 0) return rows[index];
  return rows[0] ?? null;
}

function calculatePortfolioStats(seriesCollection: StockOhlcvRow[][]): PortfolioStats {
  let totalValue = 0;
  let totalPrevValue = 0;
  let totalWeekBase = 0;
  let totalMonthBase = 0;
  let modeledSymbols = 0;

  for (const rows of seriesCollection) {
    if (rows.length === 0) continue;

    const latest = resolveRow(rows, 1);
    const previous = resolveRow(rows, 2);
    const weekBase = resolveRow(rows, 6);
    const monthBase = resolveRow(rows, 22);
    if (!latest || !previous || !weekBase || !monthBase) continue;

    const monthBaseClose = toNumber(monthBase.close);
    const latestClose = toNumber(latest.close);
    const previousClose = toNumber(previous.close);
    const weekClose = toNumber(weekBase.close);
    if (monthBaseClose <= 0 || latestClose <= 0) continue;

    const units = BASE_CAPITAL_PER_SYMBOL / monthBaseClose;
    totalValue += units * latestClose;
    totalPrevValue += units * (previousClose > 0 ? previousClose : latestClose);
    totalWeekBase += units * (weekClose > 0 ? weekClose : latestClose);
    totalMonthBase += units * monthBaseClose;
    modeledSymbols += 1;
  }

  const dayChange = totalValue - totalPrevValue;
  const dayChangePercent = totalPrevValue > 0 ? (dayChange / totalPrevValue) * 100 : 0;
  const weekChange = totalWeekBase > 0 ? ((totalValue - totalWeekBase) / totalWeekBase) * 100 : 0;
  const monthChange = totalMonthBase > 0 ? ((totalValue - totalMonthBase) / totalMonthBase) * 100 : 0;

  return {
    totalValue,
    dayChange,
    dayChangePercent,
    weekChange,
    monthChange,
    modeledSymbols,
  };
}

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
  const { symbols } = useWatchlistStore();
  const [portfolio, setPortfolio] = React.useState<PortfolioStats>(EMPTY_PORTFOLIO);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const displaySymbols = React.useMemo(
    () =>
      (symbols.length > 0 ? symbols : DEFAULT_SYMBOLS)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 12),
    [symbols]
  );

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadPortfolio() {
      if (displaySymbols.length === 0) {
        setPortfolio(EMPTY_PORTFOLIO);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const batch = await fetchStockSeriesBatch(displaySymbols, 30, controller.signal);
        const seriesCollection = displaySymbols.map((symbol) => batch[symbol] ?? []);
        if (controller.signal.aborted) return;
        setPortfolio(calculatePortfolioStats(seriesCollection));
        setLoading(false);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setPortfolio(EMPTY_PORTFOLIO);
        setLoading(false);
        setError(loadError instanceof Error ? loadError.message : "Failed to load portfolio basket");
      }
    }

    loadPortfolio();
    return () => controller.abort();
  }, [displaySymbols]);

  const formatCurrency = React.useCallback((value: number) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    return value.toLocaleString("vi-VN");
  }, []);

  const isPositive = portfolio.dayChange >= 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col justify-center">
        <p className="mb-1 text-sm text-stone-500 dark:text-neutral-400">Total portfolio value</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-stone-900 dark:text-white">
            <AnimatedNumber value={portfolio.totalValue / 1e6} decimals={2} />M
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
            {formatCurrency(portfolio.dayChange)} VND
          </span>
          <span className="text-sm opacity-80">
            ({isPositive ? "+" : ""}
            {portfolio.dayChangePercent.toFixed(2)}%)
          </span>
        </div>
        <p className="mt-2 text-xs text-stone-500 dark:text-neutral-500">
          {loading
            ? "Updating watchlist basket..."
            : `Proxy basket (${portfolio.modeledSymbols}/${displaySymbols.length} symbols, equal notional)`}
        </p>
        {error && <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-stone-200 pt-4 dark:border-neutral-800">
        <PeriodChange label="1W" value={portfolio.weekChange} />
        <PeriodChange label="1M" value={portfolio.monthChange} />
      </div>
    </div>
  );
}

export const PortfolioValueWidget = React.memo(PortfolioValueWidgetBase);
