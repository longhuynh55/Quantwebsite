"use client";

import { useMemo, useId } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatDate, cn } from "@/lib/utils";

export interface DrawdownChartProps {
  equityCurve: { date: Date; equity: number }[];
  height?: number;
  className?: string;
}

interface DrawdownDataPoint {
  date: string;
  drawdown: number;
  runningMax: number;
  equity: number;
  isMaxDrawdown: boolean;
}

interface DrawdownPeriod {
  startDate: Date;
  endDate: Date;
  maxDrawdown: number;
}

interface CurrentPeriodTracker {
  startIndex: number;
  maxDrawdown: number;
  maxDrawdownIndex: number;
}

/**
 * Calculate drawdown series from equity curve
 * Drawdown = (current_equity - running_max) / running_max
 * Returns negative percentage values for underwater visualization
 */
function calculateDrawdownData(
  equityCurve: { date: Date; equity: number }[]
): { data: DrawdownDataPoint[]; maxDrawdown: number; maxDrawdownDate: Date | null; drawdownPeriods: DrawdownPeriod[] } {
  if (!equityCurve || equityCurve.length === 0) {
    return { data: [], maxDrawdown: 0, maxDrawdownDate: null, drawdownPeriods: [] };
  }

  let runningMax = -Infinity;
  let maxDrawdown = 0;
  let maxDrawdownDate: Date | null = null;
  const data: DrawdownDataPoint[] = [];
  const drawdownPeriods: DrawdownPeriod[] = [];
  let currentPeriod: CurrentPeriodTracker | null = null;

  for (let index = 0; index < equityCurve.length; index++) {
    const point = equityCurve[index];
    // Update running maximum
    if (point.equity > runningMax) {
      runningMax = point.equity;
    }

    // Calculate drawdown as negative percentage
    const drawdown = runningMax > 0 ? ((point.equity - runningMax) / runningMax) * 100 : 0;

    // Track maximum drawdown
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownDate = point.date;
    }

    // Track drawdown periods
    if (drawdown < 0) {
      if (!currentPeriod) {
        currentPeriod = { startIndex: index, maxDrawdown: drawdown, maxDrawdownIndex: index };
      } else if (drawdown < currentPeriod.maxDrawdown) {
        currentPeriod.maxDrawdown = drawdown;
        currentPeriod.maxDrawdownIndex = index;
      }
    } else if (currentPeriod) {
      // End of drawdown period
      drawdownPeriods.push({
        startDate: equityCurve[currentPeriod.startIndex].date,
        endDate: equityCurve[index - 1].date,
        maxDrawdown: currentPeriod.maxDrawdown,
      });
      currentPeriod = null;
    }

    data.push({
      date: formatDate(point.date),
      drawdown: Math.min(0, drawdown), // Ensure non-positive
      runningMax,
      equity: point.equity,
      isMaxDrawdown: drawdown === maxDrawdown && drawdown < 0,
    });
  }

  // Handle case where we're still in a drawdown period at the end
  if (currentPeriod) {
    drawdownPeriods.push({
      startDate: equityCurve[currentPeriod.startIndex].date,
      endDate: equityCurve[equityCurve.length - 1].date,
      maxDrawdown: currentPeriod.maxDrawdown,
    });
  }

  return { data, maxDrawdown, maxDrawdownDate, drawdownPeriods };
}

/**
 * Custom tooltip component for drawdown chart
 */
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: DrawdownDataPoint;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload[0]) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="bg-white dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-lg shadow-lg p-3 min-w-[180px]">
      <p className="text-xs text-stone-500 dark:text-neutral-400 mb-2">{data.date}</p>
      <div className="space-y-1">
        <div className="flex justify-between items-center gap-4">
          <span className="text-sm text-stone-600 dark:text-neutral-300">Drawdown</span>
          <span className={cn(
            "text-sm font-semibold",
            data.drawdown < -20 ? "text-red-600 dark:text-red-400" :
            data.drawdown < -10 ? "text-orange-500 dark:text-orange-400" :
            "text-red-500 dark:text-red-300"
          )}>
            {data.drawdown.toFixed(2)}%
          </span>
        </div>
        <div className="flex justify-between items-center gap-4">
          <span className="text-sm text-stone-600 dark:text-neutral-300">Equity</span>
          <span className="text-sm font-medium text-stone-900 dark:text-neutral-100">
            ${data.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between items-center gap-4">
          <span className="text-sm text-stone-600 dark:text-neutral-300">Peak</span>
          <span className="text-sm font-medium text-stone-900 dark:text-neutral-100">
            ${data.runningMax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Max Drawdown Annotation Component
 */
interface MaxDrawdownAnnotationProps {
  maxDrawdown: number;
  maxDrawdownDate: Date | null;
}

function MaxDrawdownAnnotation({ maxDrawdown, maxDrawdownDate }: MaxDrawdownAnnotationProps) {
  if (!maxDrawdownDate || maxDrawdown >= 0) return null;

  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <svg
          className="w-4 h-4 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
          />
        </svg>
        <span className="text-sm font-medium text-red-700 dark:text-red-400">
          Max Drawdown: {maxDrawdown.toFixed(2)}%
        </span>
        {maxDrawdownDate && (
          <span className="text-xs text-red-600 dark:text-red-500">
            ({formatDate(maxDrawdownDate)})
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Drawdown severity legend
 */
function DrawdownLegend() {
  return (
    <div className="flex items-center gap-4 mt-3 text-xs text-stone-500 dark:text-neutral-400">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-red-200 dark:bg-red-900/40" />
        <span>0% to -10%</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-red-400 dark:bg-red-700/60" />
        <span>-10% to -20%</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm bg-red-600 dark:bg-red-500/80" />
        <span>Below -20%</span>
      </div>
    </div>
  );
}

export function DrawdownChart({
  equityCurve,
  height = 250,
  className,
}: DrawdownChartProps) {
  // Generate unique IDs for gradients to prevent collisions
  const uniqueId = useId();
  const gradientId = `drawdownGradient-${uniqueId}`;
  const strokeGradientId = `drawdownStrokeGradient-${uniqueId}`;
  const patternId = `severeDrawdownPattern-${uniqueId}`;

  const { data, maxDrawdown, maxDrawdownDate, drawdownPeriods } = useMemo(
    () => calculateDrawdownData(equityCurve),
    [equityCurve]
  );

  // Calculate y-axis domain
  const yAxisDomain = useMemo(() => {
    if (data.length === 0) return [0, 0];
    const minDrawdown = Math.min(...data.map((d) => d.drawdown));
    // Add some padding to the bottom
    const paddedMin = Math.floor(minDrawdown / 5) * 5 - 5;
    return [Math.min(0, paddedMin), 0];
  }, [data]);

  // Determine color based on drawdown severity
  const getDrawdownColor = (drawdown: number): string => {
    if (drawdown <= -20) return "#dc2626"; // red-600
    if (drawdown <= -10) return "#f87171"; // red-400
    return "#fecaca"; // red-200
  };

  // Create gradient stops for the area fill
  const gradientStops = useMemo(() => {
    if (data.length === 0) return [];

    // Sample key points for gradient
    const stops: { offset: string; color: string; opacity: number }[] = [];
    const samplePoints = [0, 0.25, 0.5, 0.75, 1];

    samplePoints.forEach((ratio) => {
      const index = Math.floor(ratio * (data.length - 1));
      const point = data[index];
      if (point) {
        const color = getDrawdownColor(point.drawdown);
        stops.push({
          offset: `${ratio * 100}%`,
          color,
          opacity: 0.6,
        });
      }
    });

    return stops;
  }, [data]);

  if (!equityCurve || equityCurve.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-stone-50 dark:bg-neutral-800/50 rounded-lg border border-stone-200 dark:border-neutral-700",
          className
        )}
        style={{ height }}
      >
        <p className="text-stone-500 dark:text-neutral-400">No equity curve data available</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-stone-50 dark:bg-neutral-800/50 rounded-lg border border-stone-200 dark:border-neutral-700",
          className
        )}
        style={{ height }}
      >
        <p className="text-stone-500 dark:text-neutral-400">Unable to calculate drawdown</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <MaxDrawdownAnnotation
        maxDrawdown={maxDrawdown}
        maxDrawdownDate={maxDrawdownDate}
      />

      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                <stop offset="50%" stopColor="#f87171" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#fecaca" stopOpacity={0.2} />
              </linearGradient>
              <linearGradient id={strokeGradientId} x1="0" y1="0" x2="1" y2="0">
                {gradientStops.map((stop, index) => (
                  <stop
                    key={index}
                    offset={stop.offset}
                    stopColor={stop.color}
                    stopOpacity={stop.opacity}
                  />
                ))}
              </linearGradient>
              {/* Severe drawdown pattern */}
              <pattern
                id={patternId}
                patternUnits="userSpaceOnUse"
                width="4"
                height="4"
              >
                <path
                  d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-red-800 dark:text-red-300"
                  opacity="0.3"
                />
              </pattern>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e7eb"
              className="dark:stroke-gray-700"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              className="dark:[&_.recharts-cartesian-axis-tick]:fill-gray-400"
              tickMargin={8}
              interval="preserveStartEnd"
              minTickGap={50}
            />

            <YAxis
              domain={yAxisDomain}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              className="dark:[&_.recharts-cartesian-axis-tick]:fill-gray-400"
              tickFormatter={(value) => `${value.toFixed(0)}%`}
              width={45}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Reference line at 0% */}
            <ReferenceLine
              y={0}
              stroke="#9ca3af"
              strokeWidth={1}
              strokeDasharray="5 5"
              className="dark:stroke-gray-600"
            />

            {/* Reference lines for significant drawdown levels */}
            {maxDrawdown < -10 && (
              <ReferenceLine
                y={-10}
                stroke="#f97316"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.5}
              />
            )}
            {maxDrawdown < -20 && (
              <ReferenceLine
                y={-20}
                stroke="#dc2626"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.5}
              />
            )}

            {/* Main drawdown area */}
            <Area
              type="monotone"
              dataKey="drawdown"
              stroke="#ef4444"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              className="dark:stroke-red-500"
              dot={false}
              activeDot={{
                r: 4,
                fill: "#ef4444",
                stroke: "#fff",
                strokeWidth: 2,
                className: "dark:fill-red-400",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Overlay for severe drawdown periods */}
        {drawdownPeriods.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {drawdownPeriods.map((period, index) => {
              if (period.maxDrawdown > -15) return null; // Only highlight significant periods

              // Calculate position based on date range
              const startIndex = equityCurve.findIndex(
                (p) => formatDate(p.date) === formatDate(period.startDate)
              );
              const endIndex = equityCurve.findIndex(
                (p) => formatDate(p.date) === formatDate(period.endDate)
              );

              if (startIndex === -1 || endIndex === -1) return null;

              const leftPercent = (startIndex / equityCurve.length) * 100;
              const widthPercent = ((endIndex - startIndex + 1) / equityCurve.length) * 100;

              return (
                <div
                  key={index}
                  className="absolute top-0 bottom-0 bg-red-500/5 dark:bg-red-900/10"
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    marginLeft: "45px", // Account for y-axis
                    marginRight: "10px",
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      <DrawdownLegend />

      {/* Summary statistics */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-stone-200 dark:border-neutral-700">
        <div>
          <p className="text-xs text-stone-500 dark:text-neutral-400 uppercase tracking-wider">
            Max Drawdown
          </p>
          <p className={cn(
            "text-lg font-semibold mt-1",
            maxDrawdown < -20 ? "text-red-600 dark:text-red-400" :
            maxDrawdown < -10 ? "text-orange-500 dark:text-orange-400" :
            "text-stone-900 dark:text-neutral-100"
          )}>
            {maxDrawdown.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-stone-500 dark:text-neutral-400 uppercase tracking-wider">
            Drawdown Periods
          </p>
          <p className="text-lg font-semibold text-stone-900 dark:text-neutral-100 mt-1">
            {drawdownPeriods.length}
          </p>
        </div>
        <div>
          <p className="text-xs text-stone-500 dark:text-neutral-400 uppercase tracking-wider">
            Severe Periods
          </p>
          <p className="text-lg font-semibold text-stone-900 dark:text-neutral-100 mt-1">
            {drawdownPeriods.filter((p) => p.maxDrawdown < -15).length}
          </p>
        </div>
      </div>
    </div>
  );
}

export default DrawdownChart;

