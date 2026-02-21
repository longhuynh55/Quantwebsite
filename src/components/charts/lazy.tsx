"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/skeleton";

// Default height for chart skeletons
const DEFAULT_CHART_HEIGHT = 300;
const CANDLESTICK_HEIGHT = 500;
const HEATMAP_HEIGHT = 400;
const DRAWDOWN_HEIGHT = 250;
const CORRELATION_HEIGHT = 400;

/**
 * Lazy-loaded LineChart component
 * Wraps the LineChart component with dynamic import and loading skeleton
 */
export const LazyLineChart = dynamic(
  () =>
    import("./LineChart").then((mod) => ({
      default: mod.LineChart,
    })),
  {
    loading: () => <ChartSkeleton height={DEFAULT_CHART_HEIGHT} />,
    ssr: false,
  }
);

/**
 * Lazy-loaded BarChart component
 * Wraps the BarChart component with dynamic import and loading skeleton
 */
export const LazyBarChart = dynamic(
  () =>
    import("./LineChart").then((mod) => ({
      default: mod.BarChart,
    })),
  {
    loading: () => <ChartSkeleton height={DEFAULT_CHART_HEIGHT} />,
    ssr: false,
  }
);

/**
 * Lazy-loaded MultiLineChart component
 * Wraps the MultiLineChart component with dynamic import and loading skeleton
 */
export const LazyMultiLineChart = dynamic(
  () =>
    import("./LineChart").then((mod) => ({
      default: mod.MultiLineChart,
    })),
  {
    loading: () => <ChartSkeleton height={DEFAULT_CHART_HEIGHT} />,
    ssr: false,
  }
);

/**
 * Lazy-loaded CandlestickChart component
 * Wraps the CandlestickChart component with dynamic import and loading skeleton
 */
export const LazyCandlestickChart = dynamic(
  () =>
    import("./CandlestickChart").then((mod) => ({
      default: mod.CandlestickChart,
    })),
  {
    loading: () => <ChartSkeleton height={CANDLESTICK_HEIGHT} />,
    ssr: false,
  }
);

/**
 * Lazy-loaded TimeRangeSelector component
 * Wraps the TimeRangeSelector component with dynamic import and loading skeleton
 */
export const LazyTimeRangeSelector = dynamic(
  () =>
    import("./CandlestickChart").then((mod) => ({
      default: mod.TimeRangeSelector,
    })),
  {
    loading: () => (
      <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
    ),
    ssr: false,
  }
);

/**
 * Lazy-loaded MonthlyReturnsHeatmap component
 * Wraps the MonthlyReturnsHeatmap component with dynamic import and loading skeleton
 */
export const LazyMonthlyReturnsHeatmap = dynamic(
  () =>
    import("./MonthlyReturnsHeatmap").then((mod) => ({
      default: mod.MonthlyReturnsHeatmap,
    })),
  {
    loading: () => <ChartSkeleton height={HEATMAP_HEIGHT} />,
    ssr: false,
  }
);

/**
 * Lazy-loaded DrawdownChart component
 * Wraps the DrawdownChart component with dynamic import and loading skeleton
 */
export const LazyDrawdownChart = dynamic(
  () =>
    import("./DrawdownChart").then((mod) => ({
      default: mod.DrawdownChart,
    })),
  {
    loading: () => <ChartSkeleton height={DRAWDOWN_HEIGHT} />,
    ssr: false,
  }
);

/**
 * Lazy-loaded CorrelationMatrix component
 * Wraps the CorrelationMatrix component with dynamic import and loading skeleton
 */
export const LazyCorrelationMatrix = dynamic(
  () =>
    import("./CorrelationMatrix").then((mod) => ({
      default: mod.CorrelationMatrix,
    })),
  {
    loading: () => <ChartSkeleton height={CORRELATION_HEIGHT} />,
    ssr: false,
  }
);

/**
 * Lazy-loaded ChartToolbar component
 * Wraps the ChartToolbar component with dynamic import and loading skeleton
 */
export const LazyChartToolbar = dynamic(
  () =>
    import("./enhanced/ChartToolbar").then((mod) => ({
      default: mod.ChartToolbar,
    })),
  {
    loading: () => (
      <div className="h-10 w-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse ml-auto" />
    ),
    ssr: false,
  }
);

/**
 * Lazy-loaded ChartTooltip component
 * Wraps the ChartTooltip component with dynamic import and loading skeleton
 */
export const LazyChartTooltip = dynamic(
  () =>
    import("./enhanced/ChartTooltip").then((mod) => ({
      default: mod.ChartTooltip,
    })),
  {
    loading: () => null,
    ssr: false,
  }
);
