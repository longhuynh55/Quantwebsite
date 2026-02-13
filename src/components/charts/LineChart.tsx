"use client";

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
  BarChart as RechartsBarChart,
  Bar,
} from "recharts";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface LineChartProps {
  data: { date: string; value: number; name?: string }[];
  color?: string;
  showGrid?: boolean;
  height?: number;
  format?: "number" | "percent" | "currency";
  showArea?: boolean;
}

export function LineChart({
  data,
  color = "#3b82f6",
  showGrid = true,
  height = 300,
  format = "number",
  showArea = false,
}: LineChartProps) {
  const formatValue = (value: number) => {
    switch (format) {
      case "percent":
        return formatPercent(value);
      case "currency":
        return formatCurrency(value);
      default:
        return value.toLocaleString();
    }
  };

  const ChartComponent = showArea ? AreaChart : RechartsLineChart;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartComponent data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
          tickFormatter={formatValue}
        />
        <Tooltip
          formatter={(value: number) => [formatValue(value), "Value"]}
          contentStyle={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "8px" }}
        />
        {showArea ? (
          <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.1} />
        ) : (
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
        )}
      </ChartComponent>
    </ResponsiveContainer>
  );
}

interface BarChartProps {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  horizontal?: boolean;
}

export function BarChart({ data, height = 300, horizontal = false }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} layout={horizontal ? "vertical" : "horizontal"}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
          </>
        )}
        <Tooltip
          contentStyle={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "8px" }}
        />
        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

interface MultiLineChartProps {
  data: Record<string, string | number | null | undefined>[];
  lines: { dataKey: string; color: string; name: string }[];
  xKey?: string;
  height?: number;
  format?: "number" | "percent" | "currency";
}

export function MultiLineChart({
  data,
  lines,
  xKey = "date",
  height = 300,
  format = "number",
}: MultiLineChartProps) {
  const formatValue = (value: number) => {
    switch (format) {
      case "percent":
        return formatPercent(value);
      case "currency":
        return formatCurrency(value);
      default:
        return value.toLocaleString();
    }
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={formatValue} />
        <Tooltip
          formatter={(value: number, name: string) => [formatValue(value), name]}
          contentStyle={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "8px" }}
        />
        <Legend />
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
