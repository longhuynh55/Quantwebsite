"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  useChartSyncContextOptional,
  type CrosshairPosition,
  type TimeRange,
} from "@/components/charts/sync/ChartSyncProvider";

export interface UseChartSyncOptions {
  chartId: string;
  onCrosshairMove?: (position: CrosshairPosition) => void;
  onTimeRangeChange?: (range: TimeRange) => void;
  onCrosshairLeave?: () => void;
}

export interface UseChartSyncReturn {
  isSyncEnabled: boolean;
  isActiveChart: boolean;
  crosshairPosition: CrosshairPosition;
  timeRange: TimeRange | null;
  handleCrosshairMove: (position: CrosshairPosition) => void;
  handleTimeRangeChange: (range: TimeRange) => void;
  handleCrosshairLeave: () => void;
}

/**
 * Hook to access chart synchronization state and provide handlers
 * for chart crosshair and time range events.
 */
export function useChartSync({
  chartId,
  onCrosshairMove,
  onTimeRangeChange,
  onCrosshairLeave,
}: UseChartSyncOptions): UseChartSyncReturn {
  const context = useChartSyncContextOptional();
  const registerChart = context?.registerChart;
  const unregisterChart = context?.unregisterChart;

  // Track if this hook is mounted
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Register chart on mount, unregister on unmount
  useEffect(() => {
    if (!registerChart || !unregisterChart) return;

    registerChart(chartId);
    return () => {
      unregisterChart(chartId);
    };
  }, [registerChart, unregisterChart, chartId]);

  // Handler for crosshair movement - broadcasts to sync provider
  const handleCrosshairMove = useCallback(
    (position: CrosshairPosition) => {
      if (context) {
        context.updateCrosshair(chartId, position);
      }
      // Also call local handler if provided
      onCrosshairMove?.(position);
    },
    [context, chartId, onCrosshairMove]
  );

  // Handler for time range change - broadcasts to sync provider
  const handleTimeRangeChange = useCallback(
    (range: TimeRange) => {
      if (context) {
        context.updateTimeRange(chartId, range);
      }
      // Also call local handler if provided
      onTimeRangeChange?.(range);
    },
    [context, chartId, onTimeRangeChange]
  );

  // Handler for crosshair leave - clears sync state
  const handleCrosshairLeave = useCallback(() => {
    if (context) {
      context.clearCrosshair(chartId);
    }
    onCrosshairLeave?.();
  }, [context, chartId, onCrosshairLeave]);

  // Effect to respond to synced crosshair position from other charts
  // Note: We intentionally only depend on specific context properties, not the whole context
  useEffect(() => {
    if (!context || !context.isSyncEnabled) return;

    // Only respond to crosshair from other charts
    if (context.activeChartId !== chartId && context.crosshairPosition.time) {
      onCrosshairMove?.(context.crosshairPosition);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context?.crosshairPosition,
    context?.activeChartId,
    context?.isSyncEnabled,
    chartId,
    onCrosshairMove,
  ]);

  // Effect to respond to synced time range from other charts
  // Note: We intentionally only depend on specific context properties, not the whole context
  useEffect(() => {
    if (!context || !context.isSyncEnabled) return;

    // Only respond to time range from other charts
    if (context.activeChartId !== chartId && context.timeRange) {
      onTimeRangeChange?.(context.timeRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context?.timeRange,
    context?.activeChartId,
    context?.isSyncEnabled,
    chartId,
    onTimeRangeChange,
  ]);

  // Return values
  const isSyncEnabled = context?.isSyncEnabled ?? false;
  const isActiveChart = context?.activeChartId === chartId;
  const crosshairPosition = context?.crosshairPosition ?? {
    x: null,
    y: null,
    time: null,
    value: null,
  };
  const timeRange = context?.timeRange ?? null;

  return {
    isSyncEnabled,
    isActiveChart,
    crosshairPosition,
    timeRange,
    handleCrosshairMove,
    handleTimeRangeChange,
    handleCrosshairLeave,
  };
}
