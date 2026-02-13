"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  LineData,
  ColorType,
  CrosshairMode,
  type Time,
  type TimeRangeChangeEventHandler,
} from "lightweight-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Button } from "@/components/ui";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  TrendingUp,
} from "lucide-react";

export interface OHLCVData {
  time: string; // Format: "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function timeToDate(time: Time): Date {
  if (typeof time === "number") {
    return new Date(time * 1000);
  }

  if (typeof time === "string") {
    // Parse YYYY-MM-DD as local date to avoid timezone-dependent day shifts.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(time);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      return new Date(year, month - 1, day);
    }
    return new Date(time);
  }

  // BusinessDay
  return new Date(time.year, time.month - 1, time.day);
}

interface IndicatorConfig {
  type: "sma" | "ema";
  period: number;
  color: string;
  data?: LineData[];
}

interface CandlestickChartProps {
  data: OHLCVData[];
  indicators?: IndicatorConfig[];
  height?: number;
  showVolume?: boolean;
  symbol?: string;
  onRangeChange?: (from: Date, to: Date) => void;
}

// Calculate Simple Moving Average
function calculateSMA(data: OHLCVData[], period: number): LineData[] {
  const result: LineData[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    result.push({
      time: data[i].time as Time,
      value: sum / period,
    });
  }
  return result;
}

// Calculate Exponential Moving Average
function calculateEMA(data: OHLCVData[], period: number): LineData[] {
  if (period <= 0) return [];
  if (data.length < period) return [];

  const result: LineData[] = [];
  const multiplier = 2 / (period + 1);

  // First EMA is SMA
  let sum = 0;
  for (let i = 0; i < period && i < data.length; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;
  result.push({
    time: data[period - 1].time as Time,
    value: ema,
  });

  // Calculate EMA for remaining data
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    result.push({
      time: data[i].time as Time,
      value: ema,
    });
  }

  return result;
}

export function CandlestickChart({
  data,
  indicators = [],
  height = 500,
  showVolume = true,
  symbol = "Stock",
  onRangeChange,
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

  const [isLoading] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(() => {
    const initialCount = indicators.length > 0 ? indicators.length : 2;
    return new Set(Array.from({ length: initialCount }, (_, i) => `indicator-${i}`));
  });

  // Default indicators
  const defaultIndicators: IndicatorConfig[] = useMemo(
    () =>
      indicators.length > 0
        ? indicators
        : [
            { type: "sma", period: 20, color: "#f59e0b" },
            { type: "sma", period: 50, color: "#8b5cf6" },
          ],
    [indicators]
  );

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const indicatorSeriesMap = indicatorSeriesRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: showVolume ? height + 100 : height,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#6b7280",
        fontSize: 12,
        fontFamily: "Inter, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "#f3f4f6" },
        horzLines: { color: "#f3f4f6" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#94a3b8",
          width: 1,
          style: 2,
          labelBackgroundColor: "#3b82f6",
        },
        horzLine: {
          color: "#94a3b8",
          width: 1,
          style: 2,
          labelBackgroundColor: "#3b82f6",
        },
      },
      rightPriceScale: {
        borderColor: "#e5e7eb",
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.25 : 0.1,
        },
      },
      timeScale: {
        borderColor: "#e5e7eb",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        vertTouchDrag: false,
      },
    });

    chartRef.current = chart;

    // Create candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Create volume series if enabled
    if (showVolume) {
      const volumeSeries = chart.addHistogramSeries({
        color: "#3b82f6",
        priceFormat: {
          type: "volume",
        },
        priceScaleId: "volume",
      });

      chart.priceScale("volume").applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      volumeSeriesRef.current = volumeSeries;
    }

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    // Subscribe to visible time range changes
    let visibleRangeHandler: TimeRangeChangeEventHandler<Time> | null = null;
    if (onRangeChange) {
      visibleRangeHandler = (range) => {
        if (!range) return;
        onRangeChange(timeToDate(range.from), timeToDate(range.to));
      };
      chart.timeScale().subscribeVisibleTimeRangeChange(visibleRangeHandler);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (visibleRangeHandler) {
        chart.timeScale().unsubscribeVisibleTimeRangeChange(visibleRangeHandler);
      }
      indicatorSeriesMap.clear();
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height, showVolume, onRangeChange]);

  // Update data
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current || !data.length) return;

    // Convert data to lightweight-charts format
    const candleData: CandlestickData[] = data.map((d) => ({
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    candlestickSeriesRef.current.setData(candleData);

    // Update volume data
    if (showVolume && volumeSeriesRef.current) {
      const volumeData: HistogramData[] = data.map((d) => ({
        time: d.time as Time,
        value: d.volume,
        color: d.close >= d.open ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)",
      }));
      volumeSeriesRef.current.setData(volumeData);
    }

    // Fit content
    chartRef.current.timeScale().fitContent();
  }, [data, showVolume]);

  // Update indicators
  useEffect(() => {
    if (!chartRef.current || !data.length) return;

    // Remove existing indicator series
    indicatorSeriesRef.current.forEach((series, key) => {
      if (!activeIndicators.has(key)) {
        chartRef.current?.removeSeries(series);
        indicatorSeriesRef.current.delete(key);
      }
    });

    // Add active indicator series
    defaultIndicators.forEach((indicator, index) => {
      const key = `indicator-${index}`;
      if (!activeIndicators.has(key)) return;

      if (!indicatorSeriesRef.current.has(key)) {
        const lineSeries = chartRef.current!.addLineSeries({
          color: indicator.color,
          lineWidth: 2,
          crosshairMarkerVisible: false,
        });
        indicatorSeriesRef.current.set(key, lineSeries);
      }

      const series = indicatorSeriesRef.current.get(key)!;
      const indicatorData =
        indicator.type === "sma"
          ? calculateSMA(data, indicator.period)
          : calculateEMA(data, indicator.period);
      series.setData(indicatorData);
    });
  }, [data, defaultIndicators, activeIndicators]);

  // Chart controls
  const handleZoomIn = useCallback(() => {
    if (!chartRef.current) return;
    const range = chartRef.current.timeScale().getVisibleRange();
    if (range) {
      const from = new Date(range.from as string).getTime();
      const to = new Date(range.to as string).getTime();
      const diff = to - from;
      const newFrom = from + diff * 0.25;
      const newTo = to - diff * 0.25;
      chartRef.current.timeScale().setVisibleRange({
        from: new Date(newFrom).toISOString().split("T")[0] as Time,
        to: new Date(newTo).toISOString().split("T")[0] as Time,
      });
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!chartRef.current) return;
    const range = chartRef.current.timeScale().getVisibleRange();
    if (range) {
      const from = new Date(range.from as string).getTime();
      const to = new Date(range.to as string).getTime();
      const diff = to - from;
      const newFrom = from - diff * 0.5;
      const newTo = to + diff * 0.5;
      chartRef.current.timeScale().setVisibleRange({
        from: new Date(newFrom).toISOString().split("T")[0] as Time,
        to: new Date(newTo).toISOString().split("T")[0] as Time,
      });
    }
  }, []);

  const handleReset = useCallback(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().fitContent();
  }, []);

  const toggleIndicator = useCallback((index: number) => {
    const key = `indicator-${index}`;
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Last price info
  const lastCandle = data[data.length - 1];
  const prevCandle = data[data.length - 2];
  const priceChange = lastCandle && prevCandle
    ? ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100
    : 0;

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 bg-gray-50 rounded-lg">
        <div className="text-center">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No chart data available</p>
          <p className="text-sm text-gray-400">Select a stock to view the chart</p>
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 border-b bg-gray-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-3">
              <span className="text-xl font-bold">{symbol}</span>
              <span className="text-2xl font-bold text-gray-900">
                {lastCandle?.close.toFixed(2)}
              </span>
              <span
                className={`text-sm font-medium ${
                  priceChange >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {priceChange >= 0 ? "+" : ""}
                {priceChange.toFixed(2)}%
              </span>
            </CardTitle>
            <div className="flex gap-4 text-xs text-gray-500 mt-1">
              <span>O: {lastCandle?.open.toFixed(2)}</span>
              <span>H: {lastCandle?.high.toFixed(2)}</span>
              <span>L: {lastCandle?.low.toFixed(2)}</span>
              <span>C: {lastCandle?.close.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Indicator toggles */}
            {defaultIndicators.map((indicator, index) => (
              <Button
                key={index}
                size="sm"
                variant={activeIndicators.has(`indicator-${index}`) ? "default" : "outline"}
                onClick={() => toggleIndicator(index)}
                className="text-xs h-7"
                style={{
                  borderColor: indicator.color,
                  color: activeIndicators.has(`indicator-${index}`)
                    ? "white"
                    : indicator.color,
                  backgroundColor: activeIndicators.has(`indicator-${index}`)
                    ? indicator.color
                    : "transparent",
                }}
              >
                {indicator.type.toUpperCase()}({indicator.period})
              </Button>
            ))}

            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Zoom controls */}
            <Button size="icon" variant="ghost" onClick={handleZoomIn} title="Zoom In">
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={handleZoomOut} title="Zoom Out">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={handleReset} title="Reset View">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        )}
        <div ref={chartContainerRef} className="w-full" />
      </CardContent>
    </Card>
  );
}

// Time Range Selector Component
interface TimeRangeSelectorProps {
  ranges: { label: string; value: string }[];
  selected: string;
  onChange: (value: string) => void;
}

export function TimeRangeSelector({
  ranges,
  selected,
  onChange,
}: TimeRangeSelectorProps) {
  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            selected === range.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
