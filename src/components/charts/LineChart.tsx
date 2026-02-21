"use client";

import * as React from "react";
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
  Brush,
  ReferenceLine,
} from "recharts";
import type { TooltipProps } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useDebouncedCallback } from "@/lib/hooks";
import { ChartTooltip } from "@/components/charts/enhanced/ChartTooltip";
import { ChartToolbar, type ChartToolbarProps } from "@/components/charts/enhanced/ChartToolbar";

interface Annotation {
  date: string;
  label: string;
  color?: string;
}

export interface LineChartProps {
  data: { date: string; value: number; name?: string }[];
  color?: string;
  showGrid?: boolean;
  height?: number;
  format?: "number" | "percent" | "currency";
  showArea?: boolean;
  showCrosshair?: boolean;
  enableZoom?: boolean;
  showToolbar?: boolean;
  annotations?: Annotation[];
  onRangeChange?: (from: Date, to: Date) => void;
  toolbarProps?: Partial<ChartToolbarProps>;
}

const LineChartInner = React.memo(function LineChart({
  data,
  color = "#3b82f6",
  showGrid = true,
  height = 300,
  format = "number",
  showArea = false,
  showCrosshair = false,
  enableZoom = false,
  showToolbar = false,
  annotations = [],
  onRangeChange,
  toolbarProps,
}: LineChartProps) {
  const chartRef = React.useRef<HTMLDivElement>(null);
  const [zoomDomain, setZoomDomain] = React.useState<{ startIndex: number; endIndex: number } | null>(null);

  // Reset zoom when data changes
  React.useEffect(() => {
    setZoomDomain(null);
  }, [data]);

  const formatValue = React.useCallback((value: number) => {
    switch (format) {
      case "percent":
        return formatPercent(value);
      case "currency":
        return formatCurrency(value);
      default:
        return value.toLocaleString();
    }
  }, [format]);

  // Debounced range change callback
  const debouncedRangeChange = useDebouncedCallback(
    (fromDate: Date, toDate: Date) => {
      onRangeChange?.(fromDate, toDate);
    },
    150
  );

  // Get visible data based on zoom
  const visibleData = React.useMemo(() => {
    if (!zoomDomain) return data;
    return data.slice(zoomDomain.startIndex, zoomDomain.endIndex + 1);
  }, [data, zoomDomain]);

  // Zoom in handler - reduces visible range by 20%
  const handleZoomIn = React.useCallback(() => {
    if (!zoomDomain) {
      const initialEnd = Math.floor(data.length * 0.8);
      setZoomDomain({ startIndex: 0, endIndex: initialEnd });
    } else {
      const range = zoomDomain.endIndex - zoomDomain.startIndex;
      const reduction = Math.floor(range * 0.2);
      const newStart = Math.min(zoomDomain.startIndex + reduction, zoomDomain.endIndex - 10);
      const newEnd = Math.max(zoomDomain.endIndex - reduction, newStart + 10);
      setZoomDomain({ startIndex: newStart, endIndex: newEnd });
    }
  }, [data.length, zoomDomain]);

  // Zoom out handler - increases visible range by 25%
  const handleZoomOut = React.useCallback(() => {
    if (!zoomDomain) return;
    const range = zoomDomain.endIndex - zoomDomain.startIndex;
    const increase = Math.floor(range * 0.25);
    const newStart = Math.max(zoomDomain.startIndex - increase, 0);
    const newEnd = Math.min(zoomDomain.endIndex + increase, data.length - 1);
    if (newStart === 0 && newEnd === data.length - 1) {
      setZoomDomain(null);
    } else {
      setZoomDomain({ startIndex: newStart, endIndex: newEnd });
    }
  }, [data.length, zoomDomain]);

  // Reset zoom handler
  const handleReset = React.useCallback(() => {
    setZoomDomain(null);
  }, []);

  // Export handler (placeholder - would need additional implementation for actual export)
  const handleExport = React.useCallback((format: "png" | "svg") => {
    console.log(`Export chart as ${format}`);
    // Implementation would use html2canvas or similar library
  }, []);

  // Fullscreen handler
  const handleFullscreen = React.useCallback(() => {
    if (chartRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        chartRef.current.requestFullscreen();
      }
    }
  }, []);

  // Handle brush change
  const handleBrushChange = React.useCallback(
    (range: { startIndex?: number; endIndex?: number }) => {
      if (range.startIndex !== undefined && range.endIndex !== undefined) {
        setZoomDomain({ startIndex: range.startIndex, endIndex: range.endIndex });

        // Use debounced callback with date validation
        if (data[range.startIndex] && data[range.endIndex]) {
          const fromDateStr = data[range.startIndex].date;
          const toDateStr = data[range.endIndex].date;
          // Validate dates before creating Date objects
          if (fromDateStr && toDateStr && !isNaN(new Date(fromDateStr).getTime()) && !isNaN(new Date(toDateStr).getTime())) {
            debouncedRangeChange(new Date(fromDateStr), new Date(toDateStr));
          }
        }
      }
    },
    [data, debouncedRangeChange]
  );

  const ChartComponent = showArea ? AreaChart : RechartsLineChart;

  // Custom tooltip component
  const renderTooltip = React.useCallback(
    (props: TooltipProps<number, string>) => {
      const payload = props.payload
        ?.map((item) => {
          const name = typeof item.name === "string" && item.name.trim()
            ? item.name
            : typeof item.dataKey === "string"
              ? item.dataKey
              : "Value";
          const value =
            typeof item.value === "number"
              ? item.value
              : typeof item.value === "string"
                ? Number(item.value)
                : 0;

          return {
            name,
            value: Number.isFinite(value) ? value : 0,
            color: typeof item.color === "string" ? item.color : "#64748b",
            dataKey: typeof item.dataKey === "string" ? item.dataKey : undefined,
          };
        })
        .filter((item) => item.name);

      const label = typeof props.label === "string" ? props.label : props.label != null ? String(props.label) : undefined;

      return <ChartTooltip active={props.active} payload={payload} label={label} formatter={formatValue} />;
    },
    [formatValue]
  );

  // Calculate toolbar height offset
  const toolbarHeight = showToolbar ? 44 : 0;
  const totalHeight = height + toolbarHeight;

  if (!data || data.length === 0) {
    return (
      <div className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center" style={{ height: totalHeight }}>
        <p className="text-sm text-gray-500 dark:text-gray-400">No chart data available</p>
      </div>
    );
  }

  return (
    <div ref={chartRef} className="w-full" style={{ height: totalHeight }}>
      {/* Toolbar */}
      {showToolbar && (
        <div className="mb-2 flex justify-end">
          <ChartToolbar
            onZoomIn={enableZoom ? handleZoomIn : undefined}
            onZoomOut={enableZoom && zoomDomain ? handleZoomOut : undefined}
            onReset={enableZoom && zoomDomain ? handleReset : undefined}
            onExport={handleExport}
            onFullscreen={handleFullscreen}
            showZoomControls={enableZoom}
            showExport={true}
            showFullscreen={true}
            {...toolbarProps}
          />
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={visibleData} className={showCrosshair ? "chart-crosshair" : undefined}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />}
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            className="dark:[&_.recharts-cartesian-axis-tick-text]:fill-gray-400"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            tickFormatter={formatValue}
            className="dark:[&_.recharts-cartesian-axis-tick-text]:fill-gray-400"
          />
          {renderTooltip !== null && <Tooltip content={renderTooltip as React.ComponentProps<typeof Tooltip>['content']} />}
          {/* Annotations as ReferenceLines */}
          {annotations.map((annotation, index) => (
            <ReferenceLine
              key={`annotation-${index}`}
              x={annotation.date}
              stroke={annotation.color || "#ef4444"}
              strokeDasharray="5 5"
              label={{
                value: annotation.label,
                position: "top",
                fill: annotation.color || "#ef4444",
                fontSize: 11,
                fontWeight: 500,
              }}
            />
          ))}
          {showArea ? (
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={0.1}
              className="dark:fill-opacity-20"
            />
          ) : (
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={showCrosshair ? { r: 4, strokeWidth: 2, fill: color } : false}
            />
          )}
          {/* Zoom brush */}
          {enableZoom && (
            <Brush
              dataKey="date"
              height={30}
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.1}
              onChange={handleBrushChange}
              className="chart-brush-selection dark:fill-blue-400"
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
});

LineChartInner.displayName = "LineChart";

export const LineChart = LineChartInner;

export interface BarChartProps {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  horizontal?: boolean;
}

export const BarChart = React.memo(function BarChart({ data, height = 300, horizontal = false }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} layout={horizontal ? "vertical" : "horizontal"}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 12 }} className="dark:[&_.recharts-cartesian-axis-tick-text]:fill-gray-400" />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} className="dark:[&_.recharts-cartesian-axis-tick-text]:fill-gray-400" />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} className="dark:[&_.recharts-cartesian-axis-tick-text]:fill-gray-400" />
            <YAxis tick={{ fontSize: 12 }} className="dark:[&_.recharts-cartesian-axis-tick-text]:fill-gray-400" />
          </>
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            borderRadius: "8px",
            color: "var(--foreground)",
          }}
        />
        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
});

BarChart.displayName = "BarChart";

export interface MultiLineChartProps {
  data: Record<string, string | number | null | undefined>[];
  lines: { dataKey: string; color: string; name: string }[];
  xKey?: string;
  height?: number;
  format?: "number" | "percent" | "currency";
  showCrosshair?: boolean;
  enableZoom?: boolean;
  showToolbar?: boolean;
  annotations?: Annotation[];
  onRangeChange?: (from: Date, to: Date) => void;
  toolbarProps?: Partial<ChartToolbarProps>;
}

export const MultiLineChart = React.memo(function MultiLineChart({
  data,
  lines,
  xKey = "date",
  height = 300,
  format = "number",
  showCrosshair = false,
  enableZoom = false,
  showToolbar = false,
  annotations = [],
  onRangeChange,
  toolbarProps,
}: MultiLineChartProps) {
  const chartRef = React.useRef<HTMLDivElement>(null);
  const [zoomDomain, setZoomDomain] = React.useState<{ startIndex: number; endIndex: number } | null>(null);

  // Reset zoom when data changes
  React.useEffect(() => {
    setZoomDomain(null);
  }, [data]);

  const formatValue = React.useCallback((value: number) => {
    switch (format) {
      case "percent":
        return formatPercent(value);
      case "currency":
        return formatCurrency(value);
      default:
        return value.toLocaleString();
    }
  }, [format]);

  // Debounced range change callback
  const debouncedRangeChange = useDebouncedCallback(
    (fromDate: Date, toDate: Date) => {
      onRangeChange?.(fromDate, toDate);
    },
    150
  );

  // Get visible data based on zoom
  const visibleData = React.useMemo(() => {
    if (!zoomDomain) return data;
    return data.slice(zoomDomain.startIndex, zoomDomain.endIndex + 1);
  }, [data, zoomDomain]);

  // Zoom in handler
  const handleZoomIn = React.useCallback(() => {
    if (!zoomDomain) {
      const initialEnd = Math.floor(data.length * 0.8);
      setZoomDomain({ startIndex: 0, endIndex: initialEnd });
    } else {
      const range = zoomDomain.endIndex - zoomDomain.startIndex;
      const reduction = Math.floor(range * 0.2);
      const newStart = Math.min(zoomDomain.startIndex + reduction, zoomDomain.endIndex - 10);
      const newEnd = Math.max(zoomDomain.endIndex - reduction, newStart + 10);
      setZoomDomain({ startIndex: newStart, endIndex: newEnd });
    }
  }, [data.length, zoomDomain]);

  // Zoom out handler
  const handleZoomOut = React.useCallback(() => {
    if (!zoomDomain) return;
    const range = zoomDomain.endIndex - zoomDomain.startIndex;
    const increase = Math.floor(range * 0.25);
    const newStart = Math.max(zoomDomain.startIndex - increase, 0);
    const newEnd = Math.min(zoomDomain.endIndex + increase, data.length - 1);
    if (newStart === 0 && newEnd === data.length - 1) {
      setZoomDomain(null);
    } else {
      setZoomDomain({ startIndex: newStart, endIndex: newEnd });
    }
  }, [data.length, zoomDomain]);

  // Reset zoom handler
  const handleReset = React.useCallback(() => {
    setZoomDomain(null);
  }, []);

  // Export handler
  const handleExport = React.useCallback((format: "png" | "svg") => {
    console.log(`Export chart as ${format}`);
  }, []);

  // Fullscreen handler
  const handleFullscreen = React.useCallback(() => {
    if (chartRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        chartRef.current.requestFullscreen();
      }
    }
  }, []);

  // Handle brush change
  const handleBrushChange = React.useCallback(
    (range: { startIndex?: number; endIndex?: number }) => {
      if (range.startIndex !== undefined && range.endIndex !== undefined) {
        setZoomDomain({ startIndex: range.startIndex, endIndex: range.endIndex });

        // Use debounced callback with date validation
        if (data[range.startIndex] && data[range.endIndex]) {
          const xKeyValue = data[range.startIndex][xKey];
          const endXKeyValue = data[range.endIndex][xKey];
          if (typeof xKeyValue === "string" && typeof endXKeyValue === "string") {
            // Validate dates before creating Date objects
            if (!isNaN(new Date(xKeyValue).getTime()) && !isNaN(new Date(endXKeyValue).getTime())) {
              debouncedRangeChange(new Date(xKeyValue), new Date(endXKeyValue));
            }
          }
        }
      }
    },
    [data, xKey, debouncedRangeChange]
  );

  // Custom tooltip component
  const renderTooltip = React.useCallback(
    (props: TooltipProps<number, string>) => {
      const payload = props.payload
        ?.map((item) => {
          const name = typeof item.name === "string" && item.name.trim()
            ? item.name
            : typeof item.dataKey === "string"
              ? item.dataKey
              : "Value";
          const value =
            typeof item.value === "number"
              ? item.value
              : typeof item.value === "string"
                ? Number(item.value)
                : 0;

          return {
            name,
            value: Number.isFinite(value) ? value : 0,
            color: typeof item.color === "string" ? item.color : "#64748b",
            dataKey: typeof item.dataKey === "string" ? item.dataKey : undefined,
          };
        })
        .filter((item) => item.name);

      const label = typeof props.label === "string" ? props.label : props.label != null ? String(props.label) : undefined;

      return <ChartTooltip active={props.active} payload={payload} label={label} formatter={formatValue} />;
    },
    [formatValue]
  );

  // Calculate toolbar height offset
  const toolbarHeight = showToolbar ? 44 : 0;
  const totalHeight = height + toolbarHeight;

  if (!data || data.length === 0) {
    return (
      <div className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center" style={{ height: totalHeight }}>
        <p className="text-sm text-gray-500 dark:text-gray-400">No chart data available</p>
      </div>
    );
  }

  return (
    <div ref={chartRef} className="w-full" style={{ height: totalHeight }}>
      {/* Toolbar */}
      {showToolbar && (
        <div className="mb-2 flex justify-end">
          <ChartToolbar
            onZoomIn={enableZoom ? handleZoomIn : undefined}
            onZoomOut={enableZoom && zoomDomain ? handleZoomOut : undefined}
            onReset={enableZoom && zoomDomain ? handleReset : undefined}
            onExport={handleExport}
            onFullscreen={handleFullscreen}
            showZoomControls={enableZoom}
            showExport={true}
            showFullscreen={true}
            {...toolbarProps}
          />
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={visibleData} className={showCrosshair ? "chart-crosshair" : undefined}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12 }}
            className="dark:[&_.recharts-cartesian-axis-tick-text]:fill-gray-400"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={formatValue}
            className="dark:[&_.recharts-cartesian-axis-tick-text]:fill-gray-400"
          />
          {renderTooltip !== null && <Tooltip content={renderTooltip as React.ComponentProps<typeof Tooltip>['content']} />}
          <Legend />
          {/* Annotations as ReferenceLines */}
          {annotations.map((annotation, index) => (
            <ReferenceLine
              key={`annotation-${index}`}
              x={annotation.date}
              stroke={annotation.color || "#ef4444"}
              strokeDasharray="5 5"
              label={{
                value: annotation.label,
                position: "top",
                fill: annotation.color || "#ef4444",
                fontSize: 11,
                fontWeight: 500,
              }}
            />
          ))}
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              activeDot={showCrosshair ? { r: 4, strokeWidth: 2, fill: line.color } : false}
            />
          ))}
          {/* Zoom brush */}
          {enableZoom && (
            <Brush
              dataKey={xKey}
              height={30}
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.1}
              onChange={handleBrushChange}
              className="chart-brush-selection dark:fill-blue-400"
            />
          )}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
});

MultiLineChart.displayName = "MultiLineChart";
