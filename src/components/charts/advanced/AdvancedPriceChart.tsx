"use client";

import * as React from "react";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
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
  type MouseEventParams,
} from "lightweight-charts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  TrendingUp,
  Maximize2,
  Minimize2,
} from "lucide-react";

import { DrawingToolbar } from "./DrawingToolbar";
import { IndicatorOverlay, type IndicatorConfig } from "./IndicatorOverlay";
import {
  useDrawingManager,
  type Point,
  type TrendLineDrawing,
  type HorizontalLineDrawing,
  type FibonacciDrawing,
  type SupportResistanceDrawing,
  type TextDrawing,
} from "../hooks/useDrawingManager";

export interface OHLCVData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AdvancedPriceChartProps {
  data: OHLCVData[];
  symbol?: string;
  height?: number;
  showVolume?: boolean;
  showDrawingToolbar?: boolean;
  showIndicatorPanel?: boolean;
  indicators?: IndicatorConfig[];
  onIndicatorChange?: (indicators: IndicatorConfig[]) => void;
  onRangeChange?: (from: Date, to: Date) => void;
  chartId?: string;
  className?: string;
}

const FIBONACCI_COLORS = [
  "rgba(239, 68, 68, 0.5)", // 0
  "rgba(249, 115, 22, 0.5)", // 0.236
  "rgba(234, 179, 8, 0.5)", // 0.382
  "rgba(34, 197, 94, 0.5)", // 0.5
  "rgba(59, 130, 246, 0.5)", // 0.618
  "rgba(139, 92, 246, 0.5)", // 0.786
  "rgba(236, 72, 153, 0.5)", // 1
];

export function AdvancedPriceChart({
  data,
  symbol = "Stock",
  height = 500,
  showVolume = true,
  showDrawingToolbar = true,
  showIndicatorPanel = true,
  indicators: externalIndicators = [],
  onIndicatorChange,
  chartId = "default",
  className,
}: AdvancedPriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const { resolvedTheme } = useTheme();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading] = useState(false);

  // Internal indicators state
  const [internalIndicators, setInternalIndicators] = useState<IndicatorConfig[]>(
    () =>
      externalIndicators.length > 0
        ? externalIndicators
        : [
            {
              id: "sma-20",
              name: "SMA 20",
              type: "sma",
              color: "#f59e0b",
              lineWidth: 2,
              visible: true,
              parameters: { period: 20 },
            },
            {
              id: "sma-50",
              name: "SMA 50",
              type: "sma",
              color: "#8b5cf6",
              lineWidth: 2,
              visible: true,
              parameters: { period: 50 },
            },
          ]
  );

  const indicators = externalIndicators.length > 0 ? externalIndicators : internalIndicators;

  // Drawing manager hook
  const drawingManager = useDrawingManager(chartId);
  const {
    drawings,
    activeTool,
    isDrawing,
    currentDrawing,
    selectedDrawingId,
    zoom,
    setActiveTool,
    startDrawing,
    updateDrawing,
    completeDrawing,
    cancelDrawing,
    selectDrawing,
    deleteSelectedDrawing,
    undo,
    redo,
    canUndo,
    canRedo,
    clearAllDrawings,
    exportDrawings,
    importDrawings,
    zoomIn,
    zoomOut,
    resetZoom,
  } = drawingManager;

  // Memoize candle data transformation
  const candleData = useMemo<CandlestickData[]>(
    () =>
      data.map((d) => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })),
    [data]
  );

  // Memoize volume data transformation
  const volumeData = useMemo<HistogramData[]>(
    () =>
      data.map((d) => ({
        time: d.time as Time,
        value: d.volume,
        color: d.close >= d.open ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)",
      })),
    [data]
  );

  // Calculate indicator data
  const calculateSMA = useCallback(
    (data: OHLCVData[], period: number): LineData[] => {
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
    },
    []
  );

  const calculateEMA = useCallback(
    (data: OHLCVData[], period: number): LineData[] => {
      if (period <= 0 || data.length < period) return [];

      const result: LineData[] = [];
      const multiplier = 2 / (period + 1);

      let sum = 0;
      for (let i = 0; i < period; i++) {
        sum += data[i].close;
      }
      let ema = sum / period;
      result.push({
        time: data[period - 1].time as Time,
        value: ema,
      });

      for (let i = period; i < data.length; i++) {
        ema = (data[i].close - ema) * multiplier + ema;
        result.push({
          time: data[i].time as Time,
          value: ema,
        });
      }

      return result;
    },
    []
  );

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const isDark = resolvedTheme === "dark";

    const chart = createChart(container, {
      width: container.clientWidth,
      height: showVolume ? height + 100 : height,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? "#0f172a" : "#ffffff" },
        textColor: isDark ? "#94a3b8" : "#6b7280",
        fontSize: 12,
        fontFamily: "Inter, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: isDark ? "#1e293b" : "#f3f4f6" },
        horzLines: { color: isDark ? "#1e293b" : "#f3f4f6" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: isDark ? "#334155" : "#94a3b8",
          width: 1,
          style: 2,
          labelBackgroundColor: "#3b82f6",
        },
        horzLine: {
          color: isDark ? "#334155" : "#94a3b8",
          width: 1,
          style: 2,
          labelBackgroundColor: "#3b82f6",
        },
      },
      rightPriceScale: {
        borderColor: isDark ? "#1e293b" : "#e5e7eb",
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.25 : 0.1,
        },
      },
      timeScale: {
        borderColor: isDark ? "#1e293b" : "#e5e7eb",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        vertTouchDrag: false,
      },
    });

    chartRef.current = chart;
    const indicatorSeriesMap = indicatorSeriesRef.current;

    // Create candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Create volume series
    if (showVolume) {
      const volumeSeries = chart.addHistogramSeries({
        color: "#3b82f6",
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
      indicatorSeriesMap.clear();
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height, showVolume, resolvedTheme]);

  // Update chart data
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current || !data.length) return;

    candlestickSeriesRef.current.setData(candleData);

    if (showVolume && volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(volumeData);
    }

    chartRef.current.timeScale().fitContent();
  }, [candleData, data.length, volumeData, showVolume]);

  // Update indicators
  useEffect(() => {
    if (!chartRef.current || !data.length) return;

    // Remove old indicator series
    indicatorSeriesRef.current.forEach((series, key) => {
      const indicator = indicators.find((ind) => ind.id === key);
      if (!indicator || !indicator.visible) {
        chartRef.current?.removeSeries(series);
        indicatorSeriesRef.current.delete(key);
      }
    });

    // Add visible indicator series
    indicators.forEach((indicator) => {
      if (!indicator.visible) return;

      if (!indicatorSeriesRef.current.has(indicator.id)) {
        const lineSeries = chartRef.current!.addLineSeries({
          color: indicator.color,
          lineWidth: (indicator.lineWidth || 2) as 1 | 2 | 3 | 4,
          crosshairMarkerVisible: false,
        });
        indicatorSeriesRef.current.set(indicator.id, lineSeries);
      }

      const series = indicatorSeriesRef.current.get(indicator.id);
      if (!series) return;

      let indicatorData: LineData[] = [];
      const period = Number(indicator.parameters.period) || 20;

      switch (indicator.type) {
        case "sma":
          indicatorData = calculateSMA(data, period);
          break;
        case "ema":
          indicatorData = calculateEMA(data, period);
          break;
      }

      series.setData(indicatorData);
    });
  }, [data, indicators, calculateSMA, calculateEMA]);

  // Handle mouse events for drawing
  const handleChartClick = useCallback(
    (param: MouseEventParams | null) => {
      if (!param || !param.point || !param.time) return;

      const point: Point = {
        x: param.point.x,
        y: param.point.y,
        time: param.time as string,
        value: param.point.y, // Use y coordinate as proxy for price
      };

      if (!isDrawing) {
        if (activeTool !== "select") {
          startDrawing(point);
        } else {
          // Check if clicking on a drawing
          const clickedDrawing = drawings.find((d) => {
            // Simple hit test logic
            if (d.type === "horizontalLine") {
              const line = d as HorizontalLineDrawing;
              return Math.abs(point.y - line.price) < 0.5;
            }
            return false;
          });

          selectDrawing(clickedDrawing?.id || null);
        }
      } else {
        completeDrawing();
      }
    },
    [activeTool, isDrawing, startDrawing, completeDrawing, selectDrawing, drawings]
  );

  const handleChartMouseMove = useCallback(
    (param: MouseEventParams | null) => {
      if (!param || !param.point || !param.time || !isDrawing) return;

      const point: Point = {
        x: param.point.x,
        y: param.point.y,
        time: param.time as string,
        value: param.point.y, // Use y coordinate as proxy for price
      };

      updateDrawing(point);
    },
    [isDrawing, updateDrawing]
  );

  // Subscribe to chart mouse events
  useEffect(() => {
    if (!chartRef.current) return;

    chartRef.current.subscribeClick(handleChartClick);
    chartRef.current.subscribeCrosshairMove(handleChartMouseMove);

    return () => {
      chartRef.current?.unsubscribeClick(handleChartClick);
      chartRef.current?.unsubscribeCrosshairMove(handleChartMouseMove);
    };
  }, [handleChartClick, handleChartMouseMove]);

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
    zoomIn();
  }, [zoomIn]);

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
    zoomOut();
  }, [zoomOut]);

  const handleReset = useCallback(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().fitContent();
    resetZoom();
  }, [resetZoom]);

  const handleFullscreen = useCallback(() => {
    const container = chartContainerRef.current?.parentElement;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      container.requestFullscreen();
      setIsFullscreen(true);
    }
  }, []);

  const handleIndicatorToggle = useCallback(
    (id: string) => {
      const updated = indicators.map((ind) =>
        ind.id === id ? { ...ind, visible: !ind.visible } : ind
      );

      if (onIndicatorChange) {
        onIndicatorChange(updated);
      } else {
        setInternalIndicators(updated);
      }
    },
    [indicators, onIndicatorChange]
  );

  const handleIndicatorUpdate = useCallback(
    (id: string, updates: Partial<IndicatorConfig>) => {
      const updated = indicators.map((ind) =>
        ind.id === id ? { ...ind, ...updates } : ind
      );

      if (onIndicatorChange) {
        onIndicatorChange(updated);
      } else {
        setInternalIndicators(updated);
      }
    },
    [indicators, onIndicatorChange]
  );

  const handleIndicatorRemove = useCallback(
    (id: string) => {
      const updated = indicators.filter((ind) => ind.id !== id);

      if (onIndicatorChange) {
        onIndicatorChange(updated);
      } else {
        setInternalIndicators(updated);
      }
    },
    [indicators, onIndicatorChange]
  );

  const handleImportDrawings = useCallback(
    (jsonData: string) => {
      const success = importDrawings(jsonData);
      if (!success) {
        console.error("Failed to import drawings");
      }
    },
    [importDrawings]
  );

  // Last price info - memoized
  const { lastCandle, priceChange } = useMemo(() => {
    const last = data[data.length - 1];
    const prev = data[data.length - 2];
    const change =
      last && prev
        ? ((last.close - prev.close) / prev.close) * 100
        : 0;
    return { lastCandle: last, priceChange: change };
  }, [data]);

  // Memoize visible indicators
  const visibleIndicators = useMemo(
    () => indicators.filter((ind) => ind.visible),
    [indicators]
  );

  // Memoize price display info
  const priceDisplayInfo = useMemo(
    () => ({
      open: lastCandle?.open.toFixed(2) ?? "0.00",
      high: lastCandle?.high.toFixed(2) ?? "0.00",
      low: lastCandle?.low.toFixed(2) ?? "0.00",
      close: lastCandle?.close.toFixed(2) ?? "0.00",
      volume: lastCandle ? (lastCandle.volume / 1000000).toFixed(2) : "0.00",
    }),
    [lastCandle]
  );

  // Render drawing overlays as SVG
  const renderDrawingOverlay = useCallback(() => {
    if (!drawings.length) return null;

    return (
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      >
        {drawings.map((drawing) => {
          const isSelected = selectedDrawingId === drawing.id;

          switch (drawing.type) {
            case "horizontalLine":
              return (
                <g key={drawing.id}>
                  <line
                    x1="0%"
                    x2="100%"
                    y1="50%"
                    y2="50%"
                    stroke={drawing.color}
                    strokeWidth={drawing.lineWidth}
                    strokeDasharray={
                      drawing.lineStyle === "dashed"
                        ? "8,4"
                        : drawing.lineStyle === "dotted"
                        ? "2,2"
                        : undefined
                    }
                    opacity={drawing.opacity}
                    className={isSelected ? "animate-pulse" : ""}
                  />
                  {drawing.label && (
                    <text
                      x="10"
                      y="50%"
                      dy="-5"
                      fill={drawing.color}
                      fontSize="12"
                      fontWeight="500"
                    >
                      {drawing.label}
                    </text>
                  )}
                </g>
              );

            case "trendLine": {
              const line = drawing as TrendLineDrawing;
              return (
                <g key={drawing.id}>
                  <line
                    x1="10%"
                    x2="90%"
                    y1="30%"
                    y2="70%"
                    stroke={drawing.color}
                    strokeWidth={drawing.lineWidth}
                    opacity={drawing.opacity}
                    className={isSelected ? "animate-pulse" : ""}
                  />
                  {line.extendLeft && (
                    <line
                      x1="0%"
                      x2="10%"
                      y1="20%"
                      y2="30%"
                      stroke={drawing.color}
                      strokeWidth={drawing.lineWidth}
                      strokeDasharray="4,4"
                      opacity={0.5}
                    />
                  )}
                  {line.extendRight && (
                    <line
                      x1="90%"
                      x2="100%"
                      y1="70%"
                      y2="80%"
                      stroke={drawing.color}
                      strokeWidth={drawing.lineWidth}
                      strokeDasharray="4,4"
                      opacity={0.5}
                    />
                  )}
                </g>
              );
            }

            case "fibonacci": {
              const fib = drawing as FibonacciDrawing;
              return (
                <g key={drawing.id}>
                  {fib.levels.map((level, index) => (
                    <g key={`${drawing.id}-level-${index}`}>
                      <line
                        x1="0%"
                        x2="100%"
                        y1={`${20 + index * 10}%`}
                        y2={`${20 + index * 10}%`}
                        stroke={FIBONACCI_COLORS[index % FIBONACCI_COLORS.length]}
                        strokeWidth={1}
                        strokeDasharray="4,4"
                        opacity={0.7}
                      />
                      {fib.showLabels && (
                        <text
                          x="10"
                          y={`${22 + index * 10}%`}
                          fill={FIBONACCI_COLORS[index % FIBONACCI_COLORS.length]}
                          fontSize="10"
                        >
                          {(level * 100).toFixed(1)}%
                        </text>
                      )}
                    </g>
                  ))}
                </g>
              );
            }

            case "supportResistance": {
              const zone = drawing as SupportResistanceDrawing;
              return (
                <rect
                  key={drawing.id}
                  x="10%"
                  y="40%"
                  width="80%"
                  height="20%"
                  fill={zone.fillColor}
                  stroke={drawing.color}
                  strokeWidth={drawing.lineWidth}
                  strokeDasharray="4,2"
                  opacity={drawing.opacity * 0.5}
                  className={isSelected ? "animate-pulse" : ""}
                />
              );
            }

            case "text": {
              const text = drawing as TextDrawing;
              return (
                <text
                  key={drawing.id}
                  x="50%"
                  y="50%"
                  fill={drawing.color}
                  fontSize={text.fontSize}
                  fontWeight={text.fontWeight}
                  opacity={drawing.opacity}
                  textAnchor="middle"
                  className={isSelected ? "animate-pulse" : ""}
                >
                  {text.text}
                </text>
              );
            }

            default:
              return null;
          }
        })}

        {/* Current drawing preview */}
        {isDrawing && currentDrawing && (
          <g opacity={0.6}>
            {currentDrawing.type === "trendLine" && (
              <line
                x1="10%"
                x2="90%"
                y1="30%"
                y2="70%"
                stroke={currentDrawing.color}
                strokeWidth={currentDrawing.lineWidth}
                strokeDasharray="4,4"
              />
            )}
            {currentDrawing.type === "fibonacci" && (
              <>
                {(currentDrawing as Partial<FibonacciDrawing>).levels?.map(
                  (level, index) => (
                    <line
                      key={`preview-fib-${index}`}
                      x1="0%"
                      x2="100%"
                      y1={`${20 + index * 10}%`}
                      y2={`${20 + index * 10}%`}
                      stroke={FIBONACCI_COLORS[index % FIBONACCI_COLORS.length]}
                      strokeWidth={1}
                      strokeDasharray="4,4"
                    />
                  )
                )}
              </>
            )}
          </g>
        )}
      </svg>
    );
  }, [drawings, selectedDrawingId, isDrawing, currentDrawing]);

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-64 text-gray-500 bg-gray-50 rounded-lg",
          "dark:bg-gray-800 dark:text-gray-400",
          className
        )}
      >
        <div className="text-center">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="font-medium">No chart data available</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Select a stock to view the chart
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold">{symbol}</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {lastCandle?.close.toFixed(2)}
            </span>
            <Badge
              variant={priceChange >= 0 ? "default" : "destructive"}
              className={cn(
                "text-sm font-medium",
                priceChange >= 0
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : ""
              )}
            >
              {priceChange >= 0 ? "+" : ""}
              {priceChange.toFixed(2)}%
            </Badge>
          </div>
          <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>O: {priceDisplayInfo.open}</span>
            <span>H: {priceDisplayInfo.high}</span>
            <span>L: {priceDisplayInfo.low}</span>
            <span>C: {priceDisplayInfo.close}</span>
            <span>Vol: {priceDisplayInfo.volume}M</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Indicator badges */}
          {visibleIndicators.map((indicator) => (
            <Badge
              key={indicator.id}
              variant="outline"
              className="cursor-pointer"
              style={{ borderColor: indicator.color, color: indicator.color }}
              onClick={() => handleIndicatorToggle(indicator.id)}
            >
              {indicator.name}
            </Badge>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-4">
        {/* Drawing toolbar (vertical) */}
        {showDrawingToolbar && (
          <DrawingToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onDeleteSelected={deleteSelectedDrawing}
            onClearAll={clearAllDrawings}
            onExport={exportDrawings}
            onImport={handleImportDrawings}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleReset}
            zoom={zoom}
            hasSelection={!!selectedDrawingId}
            orientation="vertical"
          />
        )}

        {/* Chart area */}
        <div className="flex-1">
          <Card className="overflow-hidden">
            <CardContent className="p-0 relative">
              {/* Loading overlay */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 z-10">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
                </div>
              )}

              {/* Chart container */}
              <div ref={chartContainerRef} className="w-full relative">
                {renderDrawingOverlay()}
              </div>

              {/* Chart controls overlay */}
              <div className="absolute top-2 right-2 flex gap-1 z-10">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleZoomIn}
                  className="h-7 w-7 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleZoomOut}
                  className="h-7 w-7 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleReset}
                  className="h-7 w-7 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800"
                  aria-label="Reset view"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleFullscreen}
                  className="h-7 w-7 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800"
                  aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {/* Drawing tool indicator */}
              {activeTool !== "select" && (
                <div className="absolute bottom-2 left-2 z-10">
                  <Badge
                    variant="outline"
                    className="bg-white/90 dark:bg-gray-800/90 text-xs"
                  >
                    Drawing: {activeTool}
                    <button
                      onClick={cancelDrawing}
                      className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      Cancel
                    </button>
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Indicator panel */}
        {showIndicatorPanel && (
          <div className="w-64 shrink-0">
            <IndicatorOverlay
              indicators={indicators}
              onToggleIndicator={handleIndicatorToggle}
              onUpdateIndicator={handleIndicatorUpdate}
              onRemoveIndicator={handleIndicatorRemove}
            />
          </div>
        )}
      </div>

      {/* Drawing count indicator */}
      {drawings.length > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{drawings.length} drawing(s) on chart</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllDrawings}
            className="h-6 text-xs text-red-500 hover:text-red-600"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}

export default AdvancedPriceChart;
