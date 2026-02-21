/**
 * Custom React Hooks
 *
 * This module exports custom hooks for real-time data and other utilities.
 */

export {
  useRealtimePrice,
  useRealtimePrices,
  useWebSocketConnection,
} from './useRealtimePrice';

// Chart synchronization hook
export {
  useChartSync,
  type UseChartSyncOptions,
  type UseChartSyncReturn,
} from './useChartSync';
