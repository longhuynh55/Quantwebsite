/**
 * Connection Store - Connection status state management with Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectionStatus, ConnectionStats } from '@/lib/websocket/types';

interface ConnectionMetrics {
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  totalUptimeMs: number;
  sessionStartTime: number | null;
}

interface ConnectionState {
  // Connection status
  status: ConnectionStatus;
  isConnected: boolean;
  isReconnecting: boolean;

  // Metrics
  metrics: ConnectionMetrics;

  // Stats from WebSocketManager
  stats: ConnectionStats | null;

  // Error information
  lastError: string | null;
  errorCount: number;

  // Actions
  setStatus: (status: ConnectionStatus) => void;
  setStats: (stats: ConnectionStats) => void;
  setLastError: (error: string | null) => void;
  incrementErrorCount: () => void;
  resetMetrics: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
}

const initialMetrics: ConnectionMetrics = {
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  totalUptimeMs: 0,
  sessionStartTime: null,
};

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      // Initial state
      status: 'disconnected',
      isConnected: false,
      isReconnecting: false,
      metrics: initialMetrics,
      stats: null,
      lastError: null,
      errorCount: 0,

      // Actions
      setStatus: (status) => {
        const state = get();
        const isConnected = status === 'connected';
        const isReconnecting = status === 'reconnecting';

        set({
          status,
          isConnected,
          isReconnecting,
        });

        // Handle state transitions
        if (isConnected && state.status !== 'connected') {
          get().onConnect();
        } else if (!isConnected && !isReconnecting && state.status === 'connected') {
          get().onDisconnect();
        } else if (isReconnecting && state.status !== 'reconnecting') {
          get().onReconnect();
        }
      },

      setStats: (stats) => set({ stats }),

      setLastError: (error) => {
        set({ lastError: error });
        if (error) {
          get().incrementErrorCount();
        }
      },

      incrementErrorCount: () => {
        set((state) => ({ errorCount: state.errorCount + 1 }));
      },

      resetMetrics: () => {
        set({
          metrics: initialMetrics,
          errorCount: 0,
          lastError: null,
        });
      },

      onConnect: () => {
        const now = Date.now();
        set((state) => ({
          metrics: {
            ...state.metrics,
            lastConnectedAt: now,
            sessionStartTime: now,
          },
          lastError: null,
        }));
      },

      onDisconnect: () => {
        const now = Date.now();
        set((state) => {
          const sessionUptime = state.metrics.sessionStartTime
            ? now - state.metrics.sessionStartTime
            : 0;

          return {
            metrics: {
              ...state.metrics,
              lastDisconnectedAt: now,
              totalUptimeMs: state.metrics.totalUptimeMs + sessionUptime,
              sessionStartTime: null,
            },
          };
        });
      },

      onReconnect: () => {
        // Reset session start time during reconnection attempts
        set((state) => ({
          metrics: {
            ...state.metrics,
            sessionStartTime: null,
          },
        }));
      },
    }),
    {
      name: 'quantvn-connection',
      partialize: (state) => ({
        metrics: {
          lastConnectedAt: state.metrics.lastConnectedAt,
          lastDisconnectedAt: state.metrics.lastDisconnectedAt,
          totalUptimeMs: state.metrics.totalUptimeMs,
        },
        errorCount: state.errorCount,
      }),
    }
  )
);

// Selectors for common state access patterns
export const selectConnectionStatus = (state: ConnectionState) => state.status;
export const selectIsConnected = (state: ConnectionState) => state.isConnected;
export const selectIsReconnecting = (state: ConnectionState) => state.isReconnecting;
export const selectConnectionMetrics = (state: ConnectionState) => state.metrics;
export const selectLastError = (state: ConnectionState) => state.lastError;

// Helper hooks
export const useConnectionStatus = () => useConnectionStore(selectConnectionStatus);
export const useIsConnected = () => useConnectionStore(selectIsConnected);
export const useIsReconnecting = () => useConnectionStore(selectIsReconnecting);
export const useConnectionMetrics = () => useConnectionStore(selectConnectionMetrics);
export const useLastError = () => useConnectionStore(selectLastError);

// Format uptime for display
export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
