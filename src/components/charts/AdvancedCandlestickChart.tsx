"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  ColorType,
  CrosshairMode,
  type Time,
} from "lightweight-charts";
import { cn } from "@/lib/utils";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  TrendingUp,
  ChevronDown,
  Activity,
  BarChart3,
  Gauge,
  Layers,
} from "lucide-react";
import {
  calculateSMA,
  calculateEMA,
  calculateWMA,
  calculateVWAP,
  calculateBollingerBands,
  type OHLCV,
  type IndicatorConfig,
  INDICATOR_COLORS,
  DEFAULT_INDICATOR_CONFIGS,
} from "@/lib/technical-indicators";

// Re-export OHLCV type
export type { OHLCV };

// Indicator types that need separate panes (not overlays)
const OSCILLATOR_TYPES = ['rsi', 'macd', 'stochastic', 'atr', 'obv', 'mfi'];

interface AdvancedCandlestickChartProps {
  data: OHLCV[];
  height?: number;
  showVolume?: boolean;
  symbol?: string;
  isLoading?: boolean;
  defaultIndicators?: string[];
}

// Indicator group definitions
const INDICATOR_GROUPS = {
  overlays: {
    label: "Overlay Indicators",
    description: "Displayed on main chart",
    indicators: ["sma20", "sma50", "sma200", "ema12", "ema26", "vwap", "bollinger"],
    icon: Layers,
  },
  oscillators: {
    label: "Oscillators",
    description: "Momentum indicators",
    indicators: ["rsi", "stochastic", "mfi"],
    icon: Gauge,
  },
  trend: {
    label: "Trend Indicators",
    description: "Trend direction analysis",
    indicators: ["macd", "atr"],
    icon: TrendingUp,
  },
  volume: {
    label: "Volume Indicators",
    description: "Volume-based analysis",
    indicators: ["obv"],
    icon: BarChart3,
  },
};

// Indicator display names
const INDICATOR_NAMES: Record<string, string> = {
  sma20: "SMA 20",
  sma50: "SMA 50",
  sma200: "SMA 200",
  ema12: "EMA 12",
  ema26: "EMA 26",
  vwap: "VWAP",
  bollinger: "Bollinger Bands",
  rsi: "RSI (14)",
  macd: "MACD (12,26,9)",
  stochastic: "Stochastic (14,3)",
  atr: "ATR (14)",
  obv: "OBV",
  mfi: "MFI (14)",
};

export function AdvancedCandlestickChart({
  data,
  height = 500,
  showVolume = true,
  symbol = "Stock",
  isLoading = false,
  defaultIndicators = ["sma20", "sma50"],
}: AdvancedCandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const overlaySeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const { resolvedTheme } = useTheme();

  // Active indicators state
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set(defaultIndicators));
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false);

  // Get indicator config with visibility
  const indicatorConfigs = useMemo(() => {
    const configs: Record<string, IndicatorConfig> = {};
    for (const [key, config] of Object.entries(DEFAULT_INDICATOR_CONFIGS)) {
      configs[key] = {
        ...config,
        visible: activeIndicators.has(key),
      };
    }
    return configs;
  }, [activeIndicators]);

  // Calculate indicator data - only for overlay indicators (skip oscillators)
  const indicatorData = useMemo(() => {
    if (!data || data.length === 0) return {};

    const result: Record<string, unknown> = {};

    for (const [key, config] of Object.entries(indicatorConfigs)) {
      if (!config.visible) continue;
      // Skip oscillator indicators - they need separate panes and are handled by IndicatorPanel
      if (OSCILLATOR_TYPES.includes(config.type)) continue;

      switch (config.type) {
        case 'sma':
          result[key] = calculateSMA(data, config.period || 20);
          break;
        case 'ema':
          result[key] = calculateEMA(data, config.period || 20);
          break;
        case 'wma':
          result[key] = calculateWMA(data, config.period || 20);
          break;
        case 'vwap':
          result[key] = calculateVWAP(data);
          break;
        case 'bollinger':
          result[key] = calculateBollingerBands(data, config.period || 20, config.stdDev || 2);
          break;
      }
    }

    return result;
  }, [data, indicatorConfigs]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const isDark = resolvedTheme === "dark";

    const chart = createChart(container, {
      width: container.clientWidth,
      height: showVolume ? height + 100 : height,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? "#0a0f1a" : "#ffffff" },
        textColor: isDark ? "#78716c" : "#78716c",
        fontSize: 11,
        fontFamily: "IBM Plex Mono, monospace",
      },
      grid: {
        vertLines: { color: isDark ? "#1c1917" : "#f5f5f4" },
        horzLines: { color: isDark ? "#1c1917" : "#f5f5f4" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: isDark ? "#44403c" : "#d6d3d1",
          width: 1,
          style: 2,
          labelBackgroundColor: "#059669",
        },
        horzLine: {
          color: isDark ? "#44403c" : "#d6d3d1",
          width: 1,
          style: 2,
          labelBackgroundColor: "#059669",
        },
      },
      rightPriceScale: {
        borderColor: isDark ? "#1c1917" : "#e7e5e4",
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.25 : 0.1,
        },
      },
      timeScale: {
        borderColor: isDark ? "#1c1917" : "#e7e5e4",
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
      upColor: "#10b981",
      downColor: "#dc2626",
      borderUpColor: "#10b981",
      borderDownColor: "#dc2626",
      wickUpColor: "#10b981",
      wickDownColor: "#dc2626",
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Create volume series
    if (showVolume) {
      const volumeSeries = chart.addHistogramSeries({
        color: "#059669",
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });

      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
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

    return () => {
      window.removeEventListener("resize", handleResize);
      // chart.remove() will clean up all series, no need to clear overlaySeriesRef here
      // The overlay effect will handle clearing when it re-runs
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height, showVolume, resolvedTheme]);

  // Update candlestick and volume data
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current || !data.length) return;

    const candleData: CandlestickData[] = data.map((d) => ({
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    candlestickSeriesRef.current.setData(candleData);

    if (showVolume && volumeSeriesRef.current) {
      const volumeData: HistogramData[] = data.map((d) => ({
        time: d.time as Time,
        value: d.volume,
        color: d.close >= d.open ? "rgba(16, 185, 129, 0.4)" : "rgba(220, 38, 38, 0.4)",
      }));
      volumeSeriesRef.current.setData(volumeData);
    }

    chartRef.current.timeScale().fitContent();
  }, [data, showVolume]);

  // Update overlay indicators
  useEffect(() => {
    if (!chartRef.current || !data.length) return;

    // Remove all existing overlay series
    overlaySeriesRef.current.forEach((series) => {
      try {
        chartRef.current?.removeSeries(series);
      } catch {
        // Series might not exist
      }
    });
    overlaySeriesRef.current.clear();

    // Add active overlay indicators
    for (const [key, config] of Object.entries(indicatorConfigs)) {
      if (!config.visible) continue;
      if (!indicatorData[key]) continue;

      // Skip non-overlay indicators (they would need separate panes)
      if (OSCILLATOR_TYPES.includes(config.type)) continue;

      try {
        if (config.type === 'bollinger') {
          // Add Bollinger Bands as three lines
          const bbData = indicatorData[key] as Array<{ time: Time; upper: number; middle: number; lower: number }>;

          const upperSeries = chartRef.current.addLineSeries({
            color: config.color || INDICATOR_COLORS.bollingerUpper,
            lineWidth: 1,
            crosshairMarkerVisible: false,
          });
          upperSeries.setData(bbData.map(d => ({ time: d.time, value: d.upper })));
          overlaySeriesRef.current.set(`${key}-upper`, upperSeries);

          const middleSeries = chartRef.current.addLineSeries({
            color: config.color || INDICATOR_COLORS.bollingerMiddle,
            lineWidth: 1,
            lineStyle: 2,
            crosshairMarkerVisible: false,
          });
          middleSeries.setData(bbData.map(d => ({ time: d.time, value: d.middle })));
          overlaySeriesRef.current.set(`${key}-middle`, middleSeries);

          const lowerSeries = chartRef.current.addLineSeries({
            color: config.color || INDICATOR_COLORS.bollingerLower,
            lineWidth: 1,
            crosshairMarkerVisible: false,
          });
          lowerSeries.setData(bbData.map(d => ({ time: d.time, value: d.lower })));
          overlaySeriesRef.current.set(`${key}-lower`, lowerSeries);
        } else {
          // Add line indicator
          const lineData = indicatorData[key] as Array<{ time: Time; value: number }>;
          const lineSeries = chartRef.current.addLineSeries({
            color: config.color || INDICATOR_COLORS.sma,
            lineWidth: config.type === 'vwap' ? 2 : 1,
            crosshairMarkerVisible: false,
          });
          lineSeries.setData(lineData);
          overlaySeriesRef.current.set(key, lineSeries);
        }
      } catch {
        // Handle series creation errors
      }
    }
  }, [data, indicatorConfigs, indicatorData]);

  // Chart controls
  const handleZoomIn = useCallback(() => {
    if (!chartRef.current) return;
    const range = chartRef.current.timeScale().getVisibleRange();
    if (range) {
      const from = new Date(range.from as string).getTime();
      const to = new Date(range.to as string).getTime();
      const diff = to - from;
      chartRef.current.timeScale().setVisibleRange({
        from: new Date(from + diff * 0.25).toISOString().split("T")[0] as Time,
        to: new Date(to - diff * 0.25).toISOString().split("T")[0] as Time,
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
      chartRef.current.timeScale().setVisibleRange({
        from: new Date(from - diff * 0.5).toISOString().split("T")[0] as Time,
        to: new Date(to + diff * 0.5).toISOString().split("T")[0] as Time,
      });
    }
  }, []);

  const handleReset = useCallback(() => {
    chartRef.current?.timeScale().fitContent();
  }, []);

  const toggleIndicator = useCallback((key: string) => {
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
      <div className="flex h-64 items-center justify-center bg-stone-50 text-stone-500 dark:bg-neutral-950 dark:text-neutral-400 border border-stone-200 dark:border-neutral-800">
        <div className="text-center">
          <TrendingUp className="mx-auto mb-3 h-12 w-12 text-stone-300 dark:text-neutral-700" />
          <p className="font-serif text-lg">No chart data available</p>
          <p className="text-sm text-stone-400 dark:text-neutral-500 mt-1">Select a stock to view the chart</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
      {/* Header */}
      <div className="border-b border-stone-200 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-900 px-4 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Symbol & Price Info */}
          <div className="flex items-center gap-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-serif text-xl font-bold text-stone-900 dark:text-neutral-100">{symbol}</span>
                <span className="font-serif text-2xl font-bold text-stone-900 dark:text-neutral-100">
                  {lastCandle?.close.toFixed(2)}
                </span>
                <span className={cn(
                  "text-sm font-medium px-2 py-0.5",
                  priceChange >= 0
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                )}>
                  {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                </span>
              </div>
              <div className="flex gap-4 text-xs text-stone-500 dark:text-neutral-500 font-mono mt-1">
                <span>O: {lastCandle?.open.toFixed(2)}</span>
                <span>H: {lastCandle?.high.toFixed(2)}</span>
                <span>L: {lastCandle?.low.toFixed(2)}</span>
                <span>C: {lastCandle?.close.toFixed(2)}</span>
                <span className="text-stone-400 dark:text-neutral-600">|</span>
                <span>Vol: {(lastCandle?.volume || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Active Indicators */}
            <div className="flex flex-wrap items-center gap-1">
              {Array.from(activeIndicators).map((key) => {
                const config = DEFAULT_INDICATOR_CONFIGS[key];
                if (!config) return null;
                return (
                  <button
                    key={key}
                    onClick={() => toggleIndicator(key)}
                    className="px-2 py-1 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: config.color || INDICATOR_COLORS.sma,
                      color: "white",
                    }}
                  >
                    {INDICATOR_NAMES[key]}
                    <span className="ml-1 opacity-70">×</span>
                  </button>
                );
              })}
            </div>

            {/* Indicator Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowIndicatorPanel(!showIndicatorPanel)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-stone-300 dark:border-neutral-700 text-stone-700 dark:text-neutral-300 hover:bg-stone-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <Activity className="w-3.5 h-3.5" />
                Indicators
                <ChevronDown className={cn("w-3 h-3 transition-transform", showIndicatorPanel && "rotate-180")} />
              </button>

              {/* Indicator Panel Dropdown */}
              {showIndicatorPanel && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 shadow-lg z-50">
                  <div className="p-2 border-b border-stone-200 dark:border-neutral-800">
                    <span className="text-xs font-medium text-stone-500 dark:text-neutral-500 uppercase tracking-wider">
                      Technical Indicators
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {Object.entries(INDICATOR_GROUPS).map(([groupKey, group]) => (
                      <div key={groupKey} className="border-b border-stone-100 dark:border-neutral-800 last:border-b-0">
                        <div className="px-3 py-2 bg-stone-50 dark:bg-neutral-800/50 flex items-center gap-2">
                          <group.icon className="w-3.5 h-3.5 text-stone-400 dark:text-neutral-500" />
                          <span className="text-xs font-medium text-stone-600 dark:text-neutral-400">{group.label}</span>
                        </div>
                        <div className="py-1">
                          {group.indicators.map((indicatorKey) => {
                            const config = DEFAULT_INDICATOR_CONFIGS[indicatorKey];
                            if (!config) return null;
                            const isActive = activeIndicators.has(indicatorKey);

                            return (
                              <button
                                key={indicatorKey}
                                onClick={() => toggleIndicator(indicatorKey)}
                                className={cn(
                                  "w-full px-3 py-2 text-left flex items-center justify-between transition-colors",
                                  isActive
                                    ? "bg-emerald-50 dark:bg-emerald-900/20"
                                    : "hover:bg-stone-50 dark:hover:bg-neutral-800"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3"
                                    style={{ backgroundColor: config.color || INDICATOR_COLORS.sma }}
                                  />
                                  <span className={cn(
                                    "text-sm",
                                    isActive
                                      ? "text-emerald-700 dark:text-emerald-400 font-medium"
                                      : "text-stone-700 dark:text-neutral-300"
                                  )}>
                                    {INDICATOR_NAMES[indicatorKey]}
                                  </span>
                                </div>
                                {isActive && (
                                  <span className="text-emerald-600 dark:text-emerald-400 text-xs">✓</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-stone-200 dark:bg-neutral-700 mx-1" />

            {/* Zoom Controls */}
            <button
              onClick={handleZoomIn}
              className="p-1.5 text-stone-500 hover:text-stone-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 text-stone-500 hover:text-stone-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 text-stone-500 hover:text-stone-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
              aria-label="Reset view"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 dark:bg-neutral-950/80">
            <div className="h-8 w-8 animate-spin border-2 border-emerald-600 border-t-transparent" />
          </div>
        )}
        <div ref={chartContainerRef} className="w-full" />
      </div>

      {/* Indicator Values Footer */}
      {activeIndicators.size > 0 && (
        <div className="border-t border-stone-200 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-900 px-4 py-2">
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            {Array.from(activeIndicators).map((key) => {
              const config = DEFAULT_INDICATOR_CONFIGS[key];
              const indicatorValues = indicatorData[key] as Array<{ time: Time; value: number }> | undefined;
              const lastValue = indicatorValues?.[indicatorValues.length - 1]?.value;

              if (!config || lastValue === undefined) return null;

              // Skip oscillator values (would need separate panes)
              if (OSCILLATOR_TYPES.includes(config.type)) return null;

              return (
                <div key={key} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2"
                    style={{ backgroundColor: config.color || INDICATOR_COLORS.sma }}
                  />
                  <span className="text-stone-500 dark:text-neutral-500">{INDICATOR_NAMES[key]}:</span>
                  <span className="text-stone-900 dark:text-neutral-100 font-medium">
                    {lastValue.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Click outside to close indicator panel */}
      {showIndicatorPanel && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowIndicatorPanel(false)}
        />
      )}
    </div>
  );
}

export default AdvancedCandlestickChart;
