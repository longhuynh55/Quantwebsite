"use client";

import * as React from "react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { useTheme } from "next-themes";
import { useWatchlistStore } from "@/lib/stores/watchlistStore";
import {
  fetchJson,
  fetchStockSeriesBatch,
  toNumber,
  type MarketOverviewResponse,
  type StockOhlcvRow,
} from "./api";

const DEFAULT_SYMBOLS = ["VNM", "FPT", "VCB", "VIC", "MWG"];
const FALLBACK_SERIES_LENGTH = 30;

interface PerformancePoint {
  date: string;
  value: number;
  benchmark: number;
}

function formatPointDate(raw: string | Date): string {
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function buildNormalizedSeries(rows: StockOhlcvRow[], limit: number): number[] {
  if (rows.length === 0) return [];
  const slice = rows.slice(-Math.max(2, limit));
  const base = toNumber(slice[0]?.close);
  if (base <= 0) return [];
  return slice.map((row) => (toNumber(row.close) / base) * 100);
}

function buildPortfolioSeries(seriesCollection: StockOhlcvRow[][], length: number): number[] {
  if (length <= 0) return [];

  const normalized = seriesCollection
    .map((rows) => buildNormalizedSeries(rows, length))
    .filter((series) => series.length > 0);

  if (normalized.length === 0) return [];

  return Array.from({ length }, (_, index) => {
    const values: number[] = [];
    for (const series of normalized) {
      const offset = length - series.length;
      const localIndex = index - offset;
      if (localIndex >= 0 && localIndex < series.length) {
        values.push(series[localIndex]);
      }
    }
    if (values.length === 0) return 100;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
}

function calculateMaxDrawdown(values: number[]): number {
  if (values.length < 2) return 0;
  let peak = values[0];
  let maxDrawdown = 0;
  for (const value of values) {
    if (value > peak) peak = value;
    if (peak <= 0) continue;
    const drawdown = ((value - peak) / peak) * 100;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  return maxDrawdown;
}

function calculateSharpe(values: number[]): number {
  if (values.length < 3) return 0;
  const returns: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1];
    const current = values[i];
    if (prev > 0) {
      returns.push((current - prev) / prev);
    }
  }
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, item) => sum + item, 0) / returns.length;
  const variance =
    returns.reduce((sum, item) => sum + (item - mean) * (item - mean), 0) / (returns.length - 1);
  const stdDev = Math.sqrt(Math.max(variance, 0));
  if (stdDev <= 0) return 0;
  return (mean / stdDev) * Math.sqrt(252);
}

const ChartStats = React.memo(function ChartStats({
  data,
}: {
  data: PerformancePoint[];
}) {
  const values = React.useMemo(() => data.map((item) => item.value), [data]);
  const firstValue = values[0] ?? 100;
  const lastValue = values[values.length - 1] ?? firstValue;
  const periodReturn = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
  const maxDrawdown = calculateMaxDrawdown(values);
  const sharpe = calculateSharpe(values);

  return (
    <div className="mt-4 grid grid-cols-3 gap-4 border-t border-stone-200 pt-4 dark:border-neutral-800">
      <div className="text-center">
        <p className="text-xs text-stone-500 dark:text-neutral-400">30D</p>
        <p
          className={`font-semibold ${
            periodReturn >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
          }`}
        >
          {periodReturn >= 0 ? "+" : ""}
          {periodReturn.toFixed(2)}%
        </p>
      </div>
      <div className="text-center">
        <p className="text-xs text-stone-500 dark:text-neutral-400">Max Drawdown</p>
        <p className="font-semibold text-rose-700 dark:text-rose-400">{maxDrawdown.toFixed(2)}%</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-stone-500 dark:text-neutral-400">Sharpe</p>
        <p className="font-semibold text-stone-900 dark:text-white">{sharpe.toFixed(2)}</p>
      </div>
    </div>
  );
});

function PerformanceChartWidgetBase() {
  const { resolvedTheme } = useTheme();
  const { symbols } = useWatchlistStore();
  const isDark = resolvedTheme === "dark";
  const [data, setData] = React.useState<PerformancePoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const displaySymbols = React.useMemo(
    () =>
      (symbols.length > 0 ? symbols : DEFAULT_SYMBOLS)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 8),
    [symbols]
  );

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadPerformance() {
      setLoading(true);
      setError(null);
      try {
        const overview = await fetchJson<MarketOverviewResponse>("/api/market-overview", controller.signal);
        const benchmarkTrend = Array.isArray(overview.marketTrend) ? overview.marketTrend : [];
        const trendLength = benchmarkTrend.length > 0 ? benchmarkTrend.length : FALLBACK_SERIES_LENGTH;

        const batch = await fetchStockSeriesBatch(displaySymbols, trendLength, controller.signal);
        const seriesCollection = displaySymbols.map((symbol) => batch[symbol] ?? []);
        if (controller.signal.aborted) return;

        const portfolioValues = buildPortfolioSeries(seriesCollection, trendLength);
        const nextData: PerformancePoint[] = [];

        if (benchmarkTrend.length > 0) {
          for (let index = 0; index < benchmarkTrend.length; index += 1) {
            const benchmarkValue = toNumber(benchmarkTrend[index]?.value, 100);
            nextData.push({
              date: String(benchmarkTrend[index]?.date ?? ""),
              benchmark: benchmarkValue,
              value: portfolioValues[index] ?? benchmarkValue,
            });
          }
        } else {
          const fallbackSeries = seriesCollection.find((rows) => rows.length > 1) ?? [];
          const normalized = buildNormalizedSeries(fallbackSeries, trendLength);
          for (let index = 0; index < normalized.length; index += 1) {
            const row = fallbackSeries[fallbackSeries.length - normalized.length + index];
            nextData.push({
              date: row ? formatPointDate(row.date) : `T${index + 1}`,
              benchmark: normalized[index],
              value: portfolioValues[index] ?? normalized[index],
            });
          }
        }

        setData(nextData);
        setLoading(false);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setLoading(false);
        setError(loadError instanceof Error ? loadError.message : "Failed to load performance data");
        setData([]);
      }
    }

    loadPerformance();
    return () => controller.abort();
  }, [displaySymbols]);

  const colors = React.useMemo(
    () => ({
      gridColor: isDark ? "#2a2a2a" : "#d6d3d1",
      textColor: isDark ? "#a3a3a3" : "#78716c",
      backgroundColor: isDark ? "#171717" : "#ffffff",
      benchmarkColor: isDark ? "#737373" : "#a8a29e",
      portfolioColor: "#065f46",
      portfolioFillTop: "#10b981",
      portfolioFillBottom: "#10b981",
    }),
    [isDark]
  );

  const tooltipFormatter = React.useCallback(
    (value: number, name: string) => [`${value.toFixed(2)}%`, name === "value" ? "Portfolio" : "VN-Index"],
    []
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-600" />
          <span className="text-xs text-stone-500 dark:text-neutral-400">Portfolio</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-stone-400" />
          <span className="text-xs text-stone-500 dark:text-neutral-400">VN-Index</span>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors.portfolioFillTop} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={colors.portfolioFillBottom} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.gridColor} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: colors.textColor }}
                axisLine={{ stroke: colors.gridColor }}
                tickLine={{ stroke: colors.gridColor }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: colors.textColor }}
                axisLine={{ stroke: colors.gridColor }}
                tickLine={{ stroke: colors.gridColor }}
                domain={["auto", "auto"]}
                tickFormatter={(value) => `${value.toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: colors.backgroundColor,
                  border: `1px solid ${colors.gridColor}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: colors.textColor }}
                formatter={tooltipFormatter}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={colors.portfolioColor}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
              <Line
                type="monotone"
                dataKey="benchmark"
                stroke={colors.benchmarkColor}
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-stone-300 text-xs text-stone-500 dark:border-neutral-700 dark:text-neutral-400">
            {loading ? "Loading performance..." : "No performance data available."}
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-center text-xs text-rose-700 dark:text-rose-300">{error}</p>}
      <ChartStats data={data} />
    </div>
  );
}

export const PerformanceChartWidget = React.memo(PerformanceChartWidgetBase);
