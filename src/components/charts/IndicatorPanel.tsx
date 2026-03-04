"use client";

import { useEffect, useRef, useMemo } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  HistogramData,
  ColorType,
  type Time,
} from "lightweight-charts";
import { cn } from "@/lib/utils";
import {
  calculateRSI,
  calculateMACD,
  calculateStochastic,
  type OHLCV,
  INDICATOR_COLORS,
} from "@/lib/technical-indicators";

interface IndicatorPanelProps {
  data: OHLCV[];
  indicator: "rsi" | "macd" | "stochastic";
  height?: number;
  className?: string;
}

export function IndicatorPanel({
  data,
  indicator,
  height = 100,
  className,
}: IndicatorPanelProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<ISeriesApi<"Line" | "Histogram">[]>([]);
  const { resolvedTheme } = useTheme();

  // Calculate indicator data
  const indicatorData = useMemo(() => {
    if (!data || data.length === 0) return null;

    switch (indicator) {
      case "rsi":
        return {
          type: "rsi" as const,
          values: calculateRSI(data, 14),
        };
      case "macd":
        return {
          type: "macd" as const,
          values: calculateMACD(data, 12, 26, 9),
        };
      case "stochastic":
        return {
          type: "stochastic" as const,
          values: calculateStochastic(data, 14, 3),
        };
      default:
        return null;
    }
  }, [data, indicator]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const isDark = resolvedTheme === "dark";

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? "#0a0f1a" : "#fafaf9" },
        textColor: isDark ? "#57534e" : "#78716c",
        fontSize: 10,
        fontFamily: "IBM Plex Mono, monospace",
      },
      grid: {
        vertLines: { color: isDark ? "#1c1917" : "#f5f5f4" },
        horzLines: { color: isDark ? "#1c1917" : "#f5f5f4" },
      },
      rightPriceScale: {
        borderColor: isDark ? "#1c1917" : "#e7e5e4",
      },
      timeScale: {
        borderColor: isDark ? "#1c1917" : "#e7e5e4",
        visible: false,
      },
      handleScale: {
        axisPressedMouseMove: false,
      },
    });

    chartRef.current = chart;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      // Clear series refs before removing chart
      seriesRefs.current = [];
      chart.remove();
      chartRef.current = null;
    };
  }, [height, resolvedTheme]);

  // Update indicator data
  useEffect(() => {
    if (!chartRef.current || !indicatorData) return;

    // Clear existing series properly
    seriesRefs.current.forEach((series) => {
      try {
        chartRef.current?.removeSeries(series);
      } catch {
        // Series might already be removed
      }
    });
    seriesRefs.current = [];

    const isDark = resolvedTheme === "dark";
    const newSeries: ISeriesApi<"Line" | "Histogram">[] = [];

    if (indicatorData.type === "rsi") {
      // RSI Line
      const rsiSeries = chartRef.current.addLineSeries({
        color: INDICATOR_COLORS.rsiLine,
        lineWidth: 2,
        crosshairMarkerVisible: false,
      });

      const rsiLineData = indicatorData.values.map((d) => ({
        time: d.time,
        value: d.value,
      }));

      rsiSeries.setData(rsiLineData);
      newSeries.push(rsiSeries);

    } else if (indicatorData.type === "macd") {
      // MACD Line
      const macdSeries = chartRef.current.addLineSeries({
        color: INDICATOR_COLORS.macdLine,
        lineWidth: 2,
        crosshairMarkerVisible: false,
      });

      // Signal Line
      const signalSeries = chartRef.current.addLineSeries({
        color: INDICATOR_COLORS.macdSignal,
        lineWidth: 2,
        crosshairMarkerVisible: false,
      });

      // Histogram
      const histogramSeries = chartRef.current.addHistogramSeries({
        color: INDICATOR_COLORS.macdHistogramPos,
        priceFormat: { type: "price" },
      });

      const macdData = indicatorData.values as Array<{
        time: Time;
        macd: number;
        signal: number;
        histogram: number;
      }>;

      macdSeries.setData(macdData.map((d) => ({ time: d.time, value: d.macd })));
      signalSeries.setData(macdData.map((d) => ({ time: d.time, value: d.signal })));

      const histogramData: HistogramData[] = macdData.map((d) => ({
        time: d.time,
        value: d.histogram,
        color: d.histogram >= 0
          ? (isDark ? "rgba(16, 185, 129, 0.5)" : "rgba(16, 185, 129, 0.4)")
          : (isDark ? "rgba(220, 38, 38, 0.5)" : "rgba(220, 38, 38, 0.4)"),
      }));

      histogramSeries.setData(histogramData);
      newSeries.push(macdSeries, signalSeries, histogramSeries);

    } else if (indicatorData.type === "stochastic") {
      // %K Line
      const kSeries = chartRef.current.addLineSeries({
        color: INDICATOR_COLORS.stochasticK,
        lineWidth: 2,
        crosshairMarkerVisible: false,
      });

      // %D Line
      const dSeries = chartRef.current.addLineSeries({
        color: INDICATOR_COLORS.stochasticD,
        lineWidth: 2,
        lineStyle: 2,
        crosshairMarkerVisible: false,
      });

      const stochData = indicatorData.values as Array<{
        time: Time;
        k: number;
        d: number;
      }>;

      kSeries.setData(stochData.map((d) => ({ time: d.time, value: d.k })));
      dSeries.setData(stochData.map((d) => ({ time: d.time, value: d.d })));
      newSeries.push(kSeries, dSeries);
    }

    seriesRefs.current = newSeries;
  }, [indicatorData, resolvedTheme]);

  // Get indicator info
  const getIndicatorInfo = () => {
    switch (indicator) {
      case "rsi":
        const rsiValues = indicatorData?.values as Array<{
          time: Time;
          value: number;
        }> | undefined;
        return {
          name: "RSI (14)",
          lastValue: rsiValues?.[rsiValues.length - 1]?.value,
          format: (v: number) => v.toFixed(1),
          levels: [
            { value: 70, label: "Overbought", color: "text-red-600 dark:text-red-400" },
            { value: 30, label: "Oversold", color: "text-emerald-600 dark:text-emerald-400" },
          ],
        };
      case "macd":
        const macdData = indicatorData?.values as Array<{
          time: Time;
          macd: number;
          signal: number;
          histogram: number;
        }> | undefined;
        const lastMacd = macdData?.[macdData.length - 1];
        return {
          name: "MACD (12,26,9)",
          lastValue: lastMacd?.macd,
          signal: lastMacd?.signal,
          histogram: lastMacd?.histogram,
          format: (v: number) => v.toFixed(3),
        };
      case "stochastic":
        const stochData = indicatorData?.values as Array<{
          time: Time;
          k: number;
          d: number;
        }> | undefined;
        const lastStoch = stochData?.[stochData.length - 1];
        return {
          name: "Stochastic (14,3)",
          lastValue: lastStoch?.k,
          signal: lastStoch?.d,
          format: (v: number) => v.toFixed(1),
          levels: [
            { value: 80, label: "Overbought", color: "text-red-600 dark:text-red-400" },
            { value: 20, label: "Oversold", color: "text-emerald-600 dark:text-emerald-400" },
          ],
        };
      default:
        return { name: "", format: (v: number) => v.toString() };
    }
  };

  const info = getIndicatorInfo();

  return (
    <div className={cn("border-t border-stone-200 dark:border-neutral-800", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-stone-50 dark:bg-neutral-900 border-b border-stone-100 dark:border-neutral-800">
        <span className="text-xs font-medium text-stone-600 dark:text-neutral-400 font-mono">
          {info.name}
        </span>
        <div className="flex items-center gap-4 text-xs font-mono">
          {info.lastValue !== undefined && (
            <span className="text-stone-900 dark:text-neutral-100">
              {indicator === "macd" ? "MACD" : indicator === "stochastic" ? "%K" : ""}: {info.format(info.lastValue)}
            </span>
          )}
          {info.signal !== undefined && (
            <span className="text-stone-500 dark:text-neutral-400">
              {indicator === "macd" ? "Signal" : "%D"}: {info.format(info.signal)}
            </span>
          )}
          {info.histogram !== undefined && (
            <span className={cn(
              info.histogram >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}>
              Hist: {info.histogram >= 0 ? "+" : ""}{info.format(info.histogram)}
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}

/**
 * Combined Indicator Panels
 */
interface IndicatorPanelsProps {
  data: OHLCV[];
  indicators: Array<"rsi" | "macd" | "stochastic">;
  className?: string;
}

export function IndicatorPanels({ data, indicators, className }: IndicatorPanelsProps) {
  if (indicators.length === 0) return null;

  return (
    <div className={cn("border-t border-stone-200 dark:border-neutral-800", className)}>
      {indicators.map((indicator, index) => (
        <IndicatorPanel
          key={indicator}
          data={data}
          indicator={indicator}
          height={indicator === "macd" ? 120 : 100}
          className={index > 0 ? "border-t border-stone-200 dark:border-neutral-800" : ""}
        />
      ))}
    </div>
  );
}

export default IndicatorPanel;
