/**
 * useRealtimePrice - Hook for subscribing to real-time price updates
 */

"use client";

import { useEffect, useCallback, useRef } from 'react';
import { useRealtimeStore, useIsSymbolSubscribed, useIsPriceLoading, usePriceError } from '@/lib/stores/realtimeStore';
import { useConnectionStore, useIsConnected } from '@/lib/stores/connectionStore';
import { getWebSocketManager } from '@/lib/websocket/WebSocketManager';
import { createSubscriptionManager } from '@/lib/websocket/SubscriptionManager';
import type { RealtimePrice, SubscriptionTopic, PriceUpdatePayload, ConnectionStatus } from '@/lib/websocket/types';

// Singleton subscription manager
let subscriptionManager: ReturnType<typeof createSubscriptionManager> | null = null;

function getSubscriptionManager() {
  if (!subscriptionManager) {
    const wsManager = getWebSocketManager();
    subscriptionManager = createSubscriptionManager(wsManager);
  }
  return subscriptionManager;
}

interface UseRealtimePriceOptions {
  symbol: string;
  enabled?: boolean;
  onPriceUpdate?: (price: RealtimePrice) => void;
  onError?: (error: string) => void;
}

interface UseRealtimePriceReturn {
  price: RealtimePrice | undefined;
  isLoading: boolean;
  error: string | undefined;
  isConnected: boolean;
  isSubscribed: boolean;
  refresh: () => void;
}

/**
 * Hook for subscribing to real-time price updates for a single symbol
 */
export function useRealtimePrice(options: UseRealtimePriceOptions): UseRealtimePriceReturn;
export function useRealtimePrice(symbol: string): UseRealtimePriceReturn;
export function useRealtimePrice(
  symbolOrOptions: string | UseRealtimePriceOptions
): UseRealtimePriceReturn {
  // Normalize options
  const options: UseRealtimePriceOptions =
    typeof symbolOrOptions === 'string'
      ? { symbol: symbolOrOptions, enabled: true }
      : { enabled: true, ...symbolOrOptions };

  const { symbol, enabled = true, onPriceUpdate, onError } = options;

  // Store state
  const price = useRealtimeStore((state) => state.prices.get(symbol));
  const isSubscribed = useIsSymbolSubscribed(symbol);
  const isLoading = useIsPriceLoading(symbol);
  const error = usePriceError(symbol);
  const isConnected = useIsConnected();

  // Actions
  const addSubscription = useRealtimeStore((state) => state.addSubscription);
  const removeSubscription = useRealtimeStore((state) => state.removeSubscription);
  const updatePrice = useRealtimeStore((state) => state.updatePrice);
  const setLoading = useRealtimeStore((state) => state.setLoading);
  const setError = useRealtimeStore((state) => state.setError);

  // Refs for callbacks
  const onPriceUpdateRef = useRef(onPriceUpdate);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onPriceUpdateRef.current = onPriceUpdate;
    onErrorRef.current = onError;
  }, [onPriceUpdate, onError]);

  // Create topic
  const topic: SubscriptionTopic = `price:${symbol}` as SubscriptionTopic;

  // Subscribe/unsubscribe effect
  useEffect(() => {
    if (!enabled || !symbol) return;

    const subManager = getSubscriptionManager();
    const wsManager = getWebSocketManager();

    // Track subscription in store
    addSubscription(symbol);
    setLoading(symbol, true);

    // Subscribe to the topic
    const unsubscribe = subManager.subscribe(topic, (payload) => {
      const pricePayload = payload as PriceUpdatePayload;
      updatePrice(pricePayload);
      setLoading(symbol, false);
      setError(symbol, null);

      // Call callback if provided
      if (onPriceUpdateRef.current) {
        const realTimePrice: RealtimePrice = {
          symbol: pricePayload.symbol,
          price: pricePayload.price,
          change: pricePayload.change,
          changePercent: pricePayload.changePercent,
          volume: pricePayload.volume,
          turnover: pricePayload.turnover,
          bid: pricePayload.bid,
          ask: pricePayload.ask,
          high: pricePayload.high,
          low: pricePayload.low,
          open: pricePayload.open,
          previousClose: pricePayload.previousClose,
          lastUpdate: pricePayload.timestamp,
        };
        onPriceUpdateRef.current(realTimePrice);
      }
    });

    // Handle connection errors
    const unsubError = wsManager.onError((err) => {
      setError(symbol, err.message);
      setLoading(symbol, false);
      if (onErrorRef.current) {
        onErrorRef.current(err.message);
      }
    });

    // Cleanup
    return () => {
      unsubscribe();
      unsubError();
      removeSubscription(symbol);
    };
  }, [symbol, enabled, topic, addSubscription, removeSubscription, updatePrice, setLoading, setError]);

  // Refresh function to force re-subscribe
  const refresh = useCallback(() => {
    if (!symbol || !enabled) return;

    setLoading(symbol, true);
    setError(symbol, null);

    // Force resubscription by toggling
    const subManager = getSubscriptionManager();
    subManager.unsubscribe(topic);
    subManager.subscribe(topic, (payload) => {
      const pricePayload = payload as PriceUpdatePayload;
      updatePrice(pricePayload);
      setLoading(symbol, false);
    });
  }, [symbol, enabled, topic, setLoading, setError, updatePrice]);

  return {
    price,
    isLoading,
    error,
    isConnected,
    isSubscribed,
    refresh,
  };
}

/**
 * Hook for subscribing to real-time price updates for multiple symbols
 */
interface UseRealtimePricesOptions {
  symbols: string[];
  enabled?: boolean;
  onPriceUpdate?: (symbol: string, price: RealtimePrice) => void;
}

interface UseRealtimePricesReturn {
  prices: Map<string, RealtimePrice>;
  isLoading: boolean;
  errors: Map<string, string>;
  isConnected: boolean;
  subscribedSymbols: string[];
}

export function useRealtimePrices(options: UseRealtimePricesOptions): UseRealtimePricesReturn {
  const { symbols, enabled = true, onPriceUpdate } = options;

  // Store state
  const prices = useRealtimeStore((state) => {
    const result = new Map<string, RealtimePrice>();
    symbols.forEach((symbol) => {
      const price = state.prices.get(symbol);
      if (price) {
        result.set(symbol, price);
      }
    });
    return result;
  });
  const isLoading = useRealtimeStore((state) => {
    return symbols.some((symbol) => state.loadingSymbols.has(symbol));
  });
  const errors = useRealtimeStore((state) => {
    const result = new Map<string, string>();
    symbols.forEach((symbol) => {
      const error = state.errors.get(symbol);
      if (error) {
        result.set(symbol, error);
      }
    });
    return result;
  });
  const isConnected = useIsConnected();
  const subscribedSymbols = useRealtimeStore((state) => {
    return symbols.filter((symbol) => state.subscriptions.has(symbol));
  });

  // Actions
  const addSubscription = useRealtimeStore((state) => state.addSubscription);
  const removeSubscription = useRealtimeStore((state) => state.removeSubscription);
  const updatePrice = useRealtimeStore((state) => state.updatePrice);
  const setLoading = useRealtimeStore((state) => state.setLoading);
  const setError = useRealtimeStore((state) => state.setError);

  // Refs for callbacks
  const onPriceUpdateRef = useRef(onPriceUpdate);

  useEffect(() => {
    onPriceUpdateRef.current = onPriceUpdate;
  }, [onPriceUpdate]);

  // Stringify symbols for dependency comparison
  const symbolsKey = [...symbols].sort().join(',');

  useEffect(() => {
    if (!enabled || symbols.length === 0) return;

    const subManager = getSubscriptionManager();
    const unsubscribers: (() => void)[] = [];

    symbols.forEach((symbol) => {
      const topic: SubscriptionTopic = `price:${symbol}` as SubscriptionTopic;

      addSubscription(symbol);
      setLoading(symbol, true);

      const unsubscribe = subManager.subscribe(topic, (payload) => {
        const pricePayload = payload as PriceUpdatePayload;
        updatePrice(pricePayload);
        setLoading(symbol, false);
        setError(symbol, null);

        if (onPriceUpdateRef.current) {
          const realTimePrice: RealtimePrice = {
            symbol: pricePayload.symbol,
            price: pricePayload.price,
            change: pricePayload.change,
            changePercent: pricePayload.changePercent,
            volume: pricePayload.volume,
            turnover: pricePayload.turnover,
            bid: pricePayload.bid,
            ask: pricePayload.ask,
            high: pricePayload.high,
            low: pricePayload.low,
            open: pricePayload.open,
            previousClose: pricePayload.previousClose,
            lastUpdate: pricePayload.timestamp,
          };
          onPriceUpdateRef.current(symbol, realTimePrice);
        }
      });

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      symbols.forEach((symbol) => removeSubscription(symbol));
    };
  }, [symbols, symbolsKey, enabled, addSubscription, removeSubscription, updatePrice, setLoading, setError]);

  return {
    prices,
    isLoading,
    errors,
    isConnected,
    subscribedSymbols,
  };
}

/**
 * Hook for managing WebSocket connection
 */
interface UseWebSocketConnectionOptions {
  autoConnect?: boolean;
  url?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

interface UseWebSocketConnectionReturn {
  isConnected: boolean;
  isReconnecting: boolean;
  status: ConnectionStatus;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
}

export function useWebSocketConnection(
  options: UseWebSocketConnectionOptions = {}
): UseWebSocketConnectionReturn {
  const { autoConnect = true, url, onConnect, onDisconnect, onError } = options;

  const isConnected = useIsConnected();
  const isReconnecting = useConnectionStore((state) => state.isReconnecting);
  const status = useConnectionStore((state) => state.status);
  const setStatus = useConnectionStore((state) => state.setStatus);
  const setLastError = useConnectionStore((state) => state.setLastError);
  const setStats = useConnectionStore((state) => state.setStats);

  // Refs for callbacks
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    onErrorRef.current = onError;
  }, [onConnect, onDisconnect, onError]);

  // Auto-connect on mount
  useEffect(() => {
    if (!autoConnect) return;

    const wsManager = getWebSocketManager();

    if (url) {
      wsManager.updateConfig({ url });
    }

    // Set up status handler
    const unsubStatus = wsManager.onStatusChange((newStatus) => {
      setStatus(newStatus);
      setStats(wsManager.getStats());

      if (newStatus === 'connected' && onConnectRef.current) {
        onConnectRef.current();
      } else if (newStatus === 'disconnected' && onDisconnectRef.current) {
        onDisconnectRef.current();
      }
    });

    // Set up error handler
    const unsubError = wsManager.onError((error) => {
      setLastError(error.message);
      if (onErrorRef.current) {
        onErrorRef.current(error);
      }
    });

    // Connect
    wsManager.connect();

    return () => {
      unsubStatus();
      unsubError();
    };
  }, [autoConnect, url, setStatus, setStats, setLastError]);

  const connect = useCallback(() => {
    const wsManager = getWebSocketManager();
    wsManager.connect();
  }, []);

  const disconnect = useCallback(() => {
    const wsManager = getWebSocketManager();
    wsManager.disconnect();
  }, []);

  const reconnect = useCallback(() => {
    const wsManager = getWebSocketManager();
    wsManager.disconnect();
    setTimeout(() => wsManager.connect(), 100);
  }, []);

  return {
    isConnected,
    isReconnecting,
    status,
    connect,
    disconnect,
    reconnect,
  };
}

export default useRealtimePrice;
