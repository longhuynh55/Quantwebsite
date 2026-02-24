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

const generatePerformanceData = () => {
  const data = [];
  let value = 100;
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    value += (Math.random() - 0.45) * 3;
    data.push({
      date: date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
      value: Math.max(80, value),
      benchmark: 100 + (Math.random() - 0.5) * 10,
    });
  }
  return data;
};

const ChartStats = React.memo(function ChartStats({
  data,
}: {
  data: ReturnType<typeof generatePerformanceData>;
}) {
  const lastValue = data[data.length - 1]?.value ?? 100;

  return (
      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-stone-200 pt-4 dark:border-neutral-800">
      <div className="text-center">
        <p className="text-xs text-stone-500 dark:text-neutral-400">30D</p>
        <p className="font-semibold text-emerald-700 dark:text-emerald-400">+{(lastValue - 100).toFixed(2)}%</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-stone-500 dark:text-neutral-400">Max Drawdown</p>
        <p className="font-semibold text-rose-700 dark:text-rose-400">-5.2%</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-stone-500 dark:text-neutral-400">Sharpe</p>
        <p className="font-semibold text-stone-900 dark:text-white">1.85</p>
      </div>
    </div>
  );
});

function PerformanceChartWidgetBase() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const data = React.useMemo(() => generatePerformanceData(), []);

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
      </div>

      <ChartStats data={data} />
    </div>
  );
}

export const PerformanceChartWidget = React.memo(PerformanceChartWidgetBase);
