"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  AdvancedCandlestickChart,
  type OHLCV,
} from "./AdvancedCandlestickChart";
import { IndicatorPanels } from "./IndicatorPanel";
import {
  TrendingUp,
} from "lucide-react";

interface ProfessionalChartProps {
  data: OHLCV[];
  symbol?: string;
  height?: number;
  showVolume?: boolean;
  isLoading?: boolean;
  className?: string;
  defaultOverlayIndicators?: string[];
  defaultOscillatorIndicators?: Array<"rsi" | "macd" | "stochastic">;
}

/**
 * ProfessionalChart - A comprehensive financial chart with multiple indicator support
 *
 * Features:
 * - Main candlestick chart with overlay indicators (SMA, EMA, VWAP, Bollinger Bands)
 * - Separate oscillator panels (RSI, MACD, Stochastic)
 * - Editorial Fintech Design System compliant
 * - Dark mode support
 */
export function ProfessionalChart({
  data,
  symbol = "Stock",
  height = 500,
  showVolume = true,
  isLoading = false,
  className,
  defaultOverlayIndicators = ["sma20", "sma50"],
  defaultOscillatorIndicators = [],
}: ProfessionalChartProps) {
  const [activeOverlays, setActiveOverlays] = useState<Set<string>>(new Set(defaultOverlayIndicators));
  const [activeOscillators, setActiveOscillators] = useState<Set<string>>(new Set(defaultOscillatorIndicators));

  // Toggle overlay indicator
  const toggleOverlay = (key: string) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Toggle oscillator
  const toggleOscillator = (key: "rsi" | "macd" | "stochastic") => {
    setActiveOscillators((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Active oscillator list
  const oscillatorList = useMemo(() => {
    const list: Array<"rsi" | "macd" | "stochastic"> = [];
    if (activeOscillators.has("rsi")) list.push("rsi");
    if (activeOscillators.has("macd")) list.push("macd");
    if (activeOscillators.has("stochastic")) list.push("stochastic");
    return list;
  }, [activeOscillators]);

  if (!data || data.length === 0) {
    return (
      <div className={cn(
        "flex h-64 items-center justify-center",
        "bg-stone-50 dark:bg-neutral-950",
        "border border-stone-200 dark:border-neutral-800",
        className
      )}>
        <div className="text-center">
          <TrendingUp className="mx-auto mb-3 h-12 w-12 text-stone-300 dark:text-neutral-700" />
          <p className="font-serif text-lg text-stone-700 dark:text-neutral-300">No chart data available</p>
          <p className="text-sm text-stone-400 dark:text-neutral-500 mt-1">Select a stock to view the chart</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "border border-stone-200 dark:border-neutral-800",
      "bg-white dark:bg-neutral-950",
      className
    )}>
      {/* Main Chart */}
      <AdvancedCandlestickChart
        data={data}
        symbol={symbol}
        height={height}
        showVolume={showVolume}
        isLoading={isLoading}
        defaultIndicators={Array.from(activeOverlays)}
      />

      {/* Oscillator Panels */}
      {oscillatorList.length > 0 && (
        <IndicatorPanels
          data={data}
          indicators={oscillatorList}
        />
      )}

      {/* Quick Overlay Toggles */}
      <div className="border-t border-stone-200 dark:border-neutral-800 px-4 py-2 bg-stone-50 dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-stone-500 dark:text-neutral-500 uppercase tracking-wider">
              Overlays
            </span>
            <div className="w-px h-3 bg-stone-300 dark:bg-neutral-700" />
          </div>

          <div className="flex items-center gap-1">
            {/* SMA 20 Toggle */}
            <button
              onClick={() => toggleOverlay("sma20")}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                activeOverlays.has("sma20")
                  ? "bg-emerald-600 text-white"
                  : "bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-400 hover:bg-stone-200 dark:hover:bg-neutral-700"
              )}
            >
              SMA20
            </button>

            {/* SMA 50 Toggle */}
            <button
              onClick={() => toggleOverlay("sma50")}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                activeOverlays.has("sma50")
                  ? "bg-emerald-600 text-white"
                  : "bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-400 hover:bg-stone-200 dark:hover:bg-neutral-700"
              )}
            >
              SMA50
            </button>

            {/* EMA 12 Toggle */}
            <button
              onClick={() => toggleOverlay("ema12")}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                activeOverlays.has("ema12")
                  ? "bg-emerald-600 text-white"
                  : "bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-400 hover:bg-stone-200 dark:hover:bg-neutral-700"
              )}
            >
              EMA12
            </button>

            {/* EMA 26 Toggle */}
            <button
              onClick={() => toggleOverlay("ema26")}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                activeOverlays.has("ema26")
                  ? "bg-emerald-600 text-white"
                  : "bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-400 hover:bg-stone-200 dark:hover:bg-neutral-700"
              )}
            >
              EMA26
            </button>

            {/* Bollinger Bands Toggle */}
            <button
              onClick={() => toggleOverlay("bollinger")}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                activeOverlays.has("bollinger")
                  ? "bg-emerald-600 text-white"
                  : "bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-400 hover:bg-stone-200 dark:hover:bg-neutral-700"
              )}
            >
              BB
            </button>

            {/* VWAP Toggle */}
            <button
              onClick={() => toggleOverlay("vwap")}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                activeOverlays.has("vwap")
                  ? "bg-emerald-600 text-white"
                  : "bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-400 hover:bg-stone-200 dark:hover:bg-neutral-700"
              )}
            >
              VWAP
            </button>
          </div>
        </div>
      </div>

      {/* Quick Oscillator Toggles */}
      <div className="border-t border-stone-200 dark:border-neutral-800 px-4 py-2 bg-stone-50 dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-stone-500 dark:text-neutral-500 uppercase tracking-wider">
              Oscillators
            </span>
            <div className="w-px h-3 bg-stone-300 dark:bg-neutral-700" />
          </div>

          <div className="flex items-center gap-1">
            {/* RSI Toggle */}
            <button
              onClick={() => toggleOscillator("rsi")}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                activeOscillators.has("rsi")
                  ? "bg-emerald-600 text-white"
                  : "bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-400 hover:bg-stone-200 dark:hover:bg-neutral-700"
              )}
            >
              RSI
            </button>

            {/* MACD Toggle */}
            <button
              onClick={() => toggleOscillator("macd")}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                activeOscillators.has("macd")
                  ? "bg-emerald-600 text-white"
                  : "bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-400 hover:bg-stone-200 dark:hover:bg-neutral-700"
              )}
            >
              MACD
            </button>

            {/* Stochastic Toggle */}
            <button
              onClick={() => toggleOscillator("stochastic")}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                activeOscillators.has("stochastic")
                  ? "bg-emerald-600 text-white"
                  : "bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-400 hover:bg-stone-200 dark:hover:bg-neutral-700"
              )}
            >
              Stoch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Re-export types
export type { OHLCV } from "./AdvancedCandlestickChart";
export { AdvancedCandlestickChart } from "./AdvancedCandlestickChart";
export { IndicatorPanel, IndicatorPanels } from "./IndicatorPanel";

export default ProfessionalChart;
