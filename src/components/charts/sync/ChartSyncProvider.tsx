"use client";

import * as React from "react";
import { createContext, useContext, useCallback, useRef, useState } from "react";

// Types for chart synchronization
export interface CrosshairPosition {
  x: number | null;
  y: number | null;
  time: string | null;
  value: number | null;
}

export interface TimeRange {
  from: string;
  to: string;
}

export interface ChartSyncState {
  isSyncEnabled: boolean;
  crosshairPosition: CrosshairPosition;
  timeRange: TimeRange | null;
  activeChartId: string | null;
}

export interface ChartSyncActions {
  enableSync: () => void;
  disableSync: () => void;
  toggleSync: () => void;
  updateCrosshair: (chartId: string, position: CrosshairPosition) => void;
  updateTimeRange: (chartId: string, range: TimeRange) => void;
  clearCrosshair: (chartId: string) => void;
  registerChart: (chartId: string) => void;
  unregisterChart: (chartId: string) => void;
}

export type ChartSyncContextValue = ChartSyncState & ChartSyncActions;

const ChartSyncContext = createContext<ChartSyncContextValue | null>(null);

interface ChartSyncProviderProps {
  children: React.ReactNode;
  defaultEnabled?: boolean;
}

export function ChartSyncProvider({
  children,
  defaultEnabled = true,
}: ChartSyncProviderProps) {
  const [isSyncEnabled, setIsSyncEnabled] = useState(defaultEnabled);
  const [crosshairPosition, setCrosshairPosition] = useState<CrosshairPosition>({
    x: null,
    y: null,
    time: null,
    value: null,
  });
  const [timeRange, setTimeRange] = useState<TimeRange | null>(null);
  const [activeChartId, setActiveChartId] = useState<string | null>(null);

  // Track registered charts
  const registeredChartsRef = useRef<Set<string>>(new Set());

  const enableSync = useCallback(() => {
    setIsSyncEnabled(true);
  }, []);

  const disableSync = useCallback(() => {
    setIsSyncEnabled(false);
    // Clear sync state when disabling
    setCrosshairPosition({ x: null, y: null, time: null, value: null });
    setActiveChartId(null);
  }, []);

  const toggleSync = useCallback(() => {
    if (isSyncEnabled) {
      disableSync();
    } else {
      enableSync();
    }
  }, [isSyncEnabled, enableSync, disableSync]);

  const updateCrosshair = useCallback(
    (chartId: string, position: CrosshairPosition) => {
      if (!isSyncEnabled) return;
      setActiveChartId(chartId);
      setCrosshairPosition(position);
    },
    [isSyncEnabled]
  );

  const updateTimeRange = useCallback(
    (chartId: string, range: TimeRange) => {
      if (!isSyncEnabled) return;
      setActiveChartId(chartId);
      setTimeRange(range);
    },
    [isSyncEnabled]
  );

  const clearCrosshair = useCallback((chartId: string) => {
    // Only clear if this chart is currently active.
    setActiveChartId((currentActiveChartId) => {
      if (currentActiveChartId !== chartId) {
        return currentActiveChartId;
      }

      setCrosshairPosition({ x: null, y: null, time: null, value: null });
      return null;
    });
  }, []);

  const registerChart = useCallback((chartId: string) => {
    registeredChartsRef.current.add(chartId);
  }, []);

  const unregisterChart = useCallback((chartId: string) => {
    registeredChartsRef.current.delete(chartId);
    setActiveChartId((currentActiveChartId) => {
      if (currentActiveChartId !== chartId) {
        return currentActiveChartId;
      }

      setCrosshairPosition({ x: null, y: null, time: null, value: null });
      return null;
    });
  }, []);

  const value: ChartSyncContextValue = {
    // State
    isSyncEnabled,
    crosshairPosition,
    timeRange,
    activeChartId,
    // Actions
    enableSync,
    disableSync,
    toggleSync,
    updateCrosshair,
    updateTimeRange,
    clearCrosshair,
    registerChart,
    unregisterChart,
  };

  return (
    <ChartSyncContext.Provider value={value}>
      {children}
    </ChartSyncContext.Provider>
  );
}

export function useChartSyncContext(): ChartSyncContextValue {
  const context = useContext(ChartSyncContext);
  if (!context) {
    throw new Error(
      "useChartSyncContext must be used within a ChartSyncProvider"
    );
  }
  return context;
}

// Optional hook that returns null if not in provider (for standalone chart usage)
export function useChartSyncContextOptional(): ChartSyncContextValue | null {
  return useContext(ChartSyncContext);
}

export { ChartSyncContext };
