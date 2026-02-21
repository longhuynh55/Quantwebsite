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

// Generate performance data
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

// Memoized stats component
const ChartStats = React.memo(function ChartStats({
  data,
}: {
  data: ReturnType<typeof generatePerformanceData>;
}) {
  const lastValue = data[data.length - 1]?.value ?? 100;

  return (
    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-800 mt-4">
      <div className="text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">30 ngày</p>
        <p className="font-semibold text-green-600 dark:text-green-400">
          +{(lastValue - 100).toFixed(2)}%
        </p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">Max Drawdown</p>
        <p className="font-semibold text-red-600 dark:text-red-400">-5.2%</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">Sharpe</p>
        <p className="font-semibold text-gray-900 dark:text-gray-100">1.85</p>
      </div>
    </div>
  );
});

function PerformanceChartWidgetBase() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Memoize data generation
  const data = React.useMemo(() => generatePerformanceData(), []);

  // Memoize theme-dependent colors
  const colors = React.useMemo(
    () => ({
      gridColor: isDark ? "#374151" : "#E5E7EB",
      textColor: isDark ? "#9CA3AF" : "#6B7280",
      backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
      benchmarkColor: isDark ? "#6B7280" : "#9CA3AF",
    }),
    [isDark]
  );

  // Memoize tooltip formatter
  const tooltipFormatter = React.useCallback(
    (value: number, name: string) => [
      `${value.toFixed(2)}%`,
      name === "value" ? "Danh mục" : "VN-Index",
    ],
    []
  );

  return (
    <div className="h-full flex flex-col">
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Danh mục</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">VN-Index</span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
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
              stroke="#3B82F6"
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

      {/* Stats */}
      <ChartStats data={data} />
    </div>
  );
}

export const PerformanceChartWidget = React.memo(PerformanceChartWidgetBase);
