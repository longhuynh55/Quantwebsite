"use client";

import * as React from "react";
import { useMemo } from "react";
import {
  useChartSync,
} from "@/hooks/useChartSync";
import { cn } from "@/lib/utils";

export interface SyncedChartProps {
  chartId: string;
  children: (
    syncProps: {
      isSyncEnabled: boolean;
      isActiveChart: boolean;
      crosshairPosition: { x: number | null; y: number | null; time: string | null; value: number | null };
      timeRange: { from: string; to: string } | null;
      onCrosshairMove: (position: { x: number; y: number; time: string; value: number }) => void;
      onTimeRangeChange: (range: { from: string; to: string }) => void;
      onCrosshairLeave: () => void;
    }
  ) => React.ReactNode;
  className?: string;
  showSyncIndicator?: boolean;
}

/**
 * Wrapper component that subscribes a chart to the synchronization system.
 * Provides sync state and handlers to the wrapped chart component.
 */
export function SyncedChart({
  chartId,
  children,
  className,
  showSyncIndicator = true,
}: SyncedChartProps) {
  const {
    isSyncEnabled,
    isActiveChart,
    crosshairPosition,
    timeRange,
    handleCrosshairMove,
    handleTimeRangeChange,
    handleCrosshairLeave,
  } = useChartSync({
    chartId,
  });

  // Memoize sync props to prevent unnecessary re-renders
  const syncProps = useMemo(
    () => ({
      isSyncEnabled,
      isActiveChart,
      crosshairPosition,
      timeRange,
      onCrosshairMove: handleCrosshairMove,
      onTimeRangeChange: handleTimeRangeChange,
      onCrosshairLeave: handleCrosshairLeave,
    }),
    [
      isSyncEnabled,
      isActiveChart,
      crosshairPosition,
      timeRange,
      handleCrosshairMove,
      handleTimeRangeChange,
      handleCrosshairLeave,
    ]
  );

  return (
    <div className={cn("relative", className)}>
      {/* Sync indicator */}
      {showSyncIndicator && isSyncEnabled && (
        <div
          className={cn(
            "absolute top-2 right-2 z-10 px-2 py-1 rounded-full text-xs font-medium transition-colors",
            isActiveChart
              ? "bg-blue-500 text-white"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          )}
        >
          <span className="flex items-center gap-1">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                isActiveChart ? "bg-white animate-pulse" : "bg-blue-500"
              )}
            />
            Synced
          </span>
        </div>
      )}
      {children(syncProps)}
    </div>
  );
}

// Higher-order component version for wrapping existing chart components
export function withChartSync<P extends object>(
  ChartComponent: React.ComponentType<P>,
  chartId: string
) {
  const SyncedChartWrapper = (props: P) => {
    return (
      <SyncedChart chartId={chartId}>
        {(syncProps) => <ChartComponent {...props} {...(syncProps as P)} />}
      </SyncedChart>
    );
  };

  SyncedChartWrapper.displayName = `withChartSync(${ChartComponent.displayName || ChartComponent.name || "Chart"})`;

  return SyncedChartWrapper;
}

export default SyncedChart;
