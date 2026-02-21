/**
 * Real-time Store - Real-time data state management with Zustand
 */

import { create } from 'zustand';
import type { RealtimePrice, PriceUpdatePayload, SubscriptionTopic } from '@/lib/websocket/types';

interface SymbolSubscription {
  symbol: string;
  subscribedAt: number;
  lastUpdateAt: number | null;
  updateCount: number;
}

interface RealtimeState {
  // Price data by symbol
  prices: Map<string, RealtimePrice>;

  // Subscription tracking
  subscriptions: Map<string, SymbolSubscription>;

  // Last update timestamp
  lastGlobalUpdate: number | null;

  // Loading states
  loadingSymbols: Set<string>;

  // Error states
  errors: Map<string, string>;

  // Actions
  updatePrice: (payload: PriceUpdatePayload) => void;
  updatePrices: (payloads: PriceUpdatePayload[]) => void;
  getPrice: (symbol: string) => RealtimePrice | undefined;
  hasPrice: (symbol: string) => boolean;
  clearPrice: (symbol: string) => void;
  clearAllPrices: () => void;

  // Subscription actions
  addSubscription: (symbol: string) => void;
  removeSubscription: (symbol: string) => void;
  isSubscribed: (symbol: string) => boolean;
  getSubscriptions: () => string[];

  // Loading state actions
  setLoading: (symbol: string, loading: boolean) => void;
  isLoading: (symbol: string) => boolean;

  // Error state actions
  setError: (symbol: string, error: string | null) => void;
  getError: (symbol: string) => string | undefined;
  clearErrors: () => void;
}

// Helper to create price update from payload
function createRealtimePrice(payload: PriceUpdatePayload): RealtimePrice {
  return {
    symbol: payload.symbol,
    price: payload.price,
    change: payload.change,
    changePercent: payload.changePercent,
    volume: payload.volume,
    turnover: payload.turnover,
    bid: payload.bid,
    ask: payload.ask,
    high: payload.high,
    low: payload.low,
    open: payload.open,
    previousClose: payload.previousClose,
    lastUpdate: payload.timestamp,
  };
}

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  // Initial state
  prices: new Map(),
  subscriptions: new Map(),
  lastGlobalUpdate: null,
  loadingSymbols: new Set(),
  errors: new Map(),

  // Price actions
  updatePrice: (payload) => {
    const price = createRealtimePrice(payload);
    const symbol = payload.symbol;

    set((state) => {
      const newPrices = new Map(state.prices);
      newPrices.set(symbol, price);

      // Update subscription tracking
      const newSubscriptions = new Map(state.subscriptions);
      const sub = newSubscriptions.get(symbol);
      if (sub) {
        newSubscriptions.set(symbol, {
          ...sub,
          lastUpdateAt: Date.now(),
          updateCount: sub.updateCount + 1,
        });
      }

      return {
        prices: newPrices,
        subscriptions: newSubscriptions,
        lastGlobalUpdate: Date.now(),
      };
    });
  },

  updatePrices: (payloads) => {
    if (payloads.length === 0) return;

    set((state) => {
      const newPrices = new Map(state.prices);
      const newSubscriptions = new Map(state.subscriptions);

      payloads.forEach((payload) => {
        const price = createRealtimePrice(payload);
        newPrices.set(payload.symbol, price);

        const sub = newSubscriptions.get(payload.symbol);
        if (sub) {
          newSubscriptions.set(payload.symbol, {
            ...sub,
            lastUpdateAt: Date.now(),
            updateCount: sub.updateCount + 1,
          });
        }
      });

      return {
        prices: newPrices,
        subscriptions: newSubscriptions,
        lastGlobalUpdate: Date.now(),
      };
    });
  },

  getPrice: (symbol) => {
    return get().prices.get(symbol);
  },

  hasPrice: (symbol) => {
    return get().prices.has(symbol);
  },

  clearPrice: (symbol) => {
    set((state) => {
      const newPrices = new Map(state.prices);
      newPrices.delete(symbol);

      const newSubscriptions = new Map(state.subscriptions);
      newSubscriptions.delete(symbol);

      const newLoadingSymbols = new Set(state.loadingSymbols);
      newLoadingSymbols.delete(symbol);

      const newErrors = new Map(state.errors);
      newErrors.delete(symbol);

      return {
        prices: newPrices,
        subscriptions: newSubscriptions,
        loadingSymbols: newLoadingSymbols,
        errors: newErrors,
      };
    });
  },

  clearAllPrices: () => {
    set({
      prices: new Map(),
      subscriptions: new Map(),
      loadingSymbols: new Set(),
      errors: new Map(),
      lastGlobalUpdate: null,
    });
  },

  // Subscription actions
  addSubscription: (symbol) => {
    set((state) => {
      if (state.subscriptions.has(symbol)) {
        return state;
      }

      const newSubscriptions = new Map(state.subscriptions);
      newSubscriptions.set(symbol, {
        symbol,
        subscribedAt: Date.now(),
        lastUpdateAt: null,
        updateCount: 0,
      });

      return { subscriptions: newSubscriptions };
    });
  },

  removeSubscription: (symbol) => {
    set((state) => {
      const newSubscriptions = new Map(state.subscriptions);
      newSubscriptions.delete(symbol);

      return { subscriptions: newSubscriptions };
    });
  },

  isSubscribed: (symbol) => {
    return get().subscriptions.has(symbol);
  },

  getSubscriptions: () => {
    return Array.from(get().subscriptions.keys());
  },

  // Loading state actions
  setLoading: (symbol, loading) => {
    set((state) => {
      const newLoadingSymbols = new Set(state.loadingSymbols);

      if (loading) {
        newLoadingSymbols.add(symbol);
      } else {
        newLoadingSymbols.delete(symbol);
      }

      return { loadingSymbols: newLoadingSymbols };
    });
  },

  isLoading: (symbol) => {
    return get().loadingSymbols.has(symbol);
  },

  // Error state actions
  setError: (symbol, error) => {
    set((state) => {
      const newErrors = new Map(state.errors);

      if (error) {
        newErrors.set(symbol, error);
      } else {
        newErrors.delete(symbol);
      }

      return { errors: newErrors };
    });
  },

  getError: (symbol) => {
    return get().errors.get(symbol);
  },

  clearErrors: () => {
    set({ errors: new Map() });
  },
}));

// Selectors for common state access patterns
export const selectPrice = (symbol: string) => (state: RealtimeState) => state.prices.get(symbol);
export const selectAllPrices = (state: RealtimeState) => state.prices;
export const selectLastUpdate = (state: RealtimeState) => state.lastGlobalUpdate;
export const selectSubscriptions = (state: RealtimeState) => state.subscriptions;

// Helper hooks for specific symbols
export const useRealtimePrice = (symbol: string): RealtimePrice | undefined => {
  return useRealtimeStore((state) => state.prices.get(symbol));
};

export const useIsPriceLoading = (symbol: string): boolean => {
  return useRealtimeStore((state) => state.loadingSymbols.has(symbol));
};

export const usePriceError = (symbol: string): string | undefined => {
  return useRealtimeStore((state) => state.errors.get(symbol));
};

export const useIsSymbolSubscribed = (symbol: string): boolean => {
  return useRealtimeStore((state) => state.subscriptions.has(symbol));
};

// Helper to format price change
export function formatPriceChange(change: number, changePercent: number): {
  text: string;
  isPositive: boolean;
  isNeutral: boolean;
} {
  const isPositive = change > 0;
  const isNeutral = change === 0;
  const sign = isPositive ? '+' : '';
  const text = `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`;

  return { text, isPositive, isNeutral };
}

// Helper to create price topic
export function createPriceTopic(symbol: string): SubscriptionTopic {
  return `price:${symbol}` as SubscriptionTopic;
}
