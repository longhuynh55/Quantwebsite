import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uiFeatureFlags } from "@/lib/featureFlags";
import { updatePreferences, fetchPreferences } from "@/lib/preferencesClient";
import { MAX_WATCHLIST_SYMBOLS, sanitizeWatchlistSymbols } from "@/lib/preferencesContract";

const WATCHLIST_SYNC_DEBOUNCE_MS = 500;

function normalizeSymbol(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

interface WatchlistState {
  symbols: string[];
  addSymbol: (symbol: string) => void;
  addSymbols: (symbols: string[]) => void;
  removeSymbol: (symbol: string) => void;
  toggleSymbol: (symbol: string) => void;
  clearWatchlist: () => void;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set) => ({
      symbols: [],
      addSymbol: (symbol) =>
        set((state) => {
          const normalized = normalizeSymbol(symbol);
          if (!normalized) return state;
          if (state.symbols.includes(normalized)) return state;
          return {
            symbols: [normalized, ...state.symbols].slice(0, MAX_WATCHLIST_SYMBOLS),
          };
        }),
      addSymbols: (symbols) =>
        set((state) => {
          const queue = symbols.map(normalizeSymbol).filter(Boolean);
          if (queue.length === 0) return state;
          const seen = new Set<string>();
          const merged = [...queue, ...state.symbols].filter((item) => {
            if (seen.has(item)) return false;
            seen.add(item);
            return true;
          });
          return {
            symbols: merged.slice(0, MAX_WATCHLIST_SYMBOLS),
          };
        }),
      removeSymbol: (symbol) =>
        set((state) => {
          const normalized = normalizeSymbol(symbol);
          if (!normalized) return state;
          return {
            symbols: state.symbols.filter((item) => item !== normalized),
          };
        }),
      toggleSymbol: (symbol) =>
        set((state) => {
          const normalized = normalizeSymbol(symbol);
          if (!normalized) return state;
          if (state.symbols.includes(normalized)) {
            return {
              symbols: state.symbols.filter((item) => item !== normalized),
            };
          }
          return {
            symbols: [normalized, ...state.symbols].slice(0, MAX_WATCHLIST_SYMBOLS),
          };
        }),
      clearWatchlist: () => set({ symbols: [] }),
    }),
    {
      name: "quantvn-watchlist",
      partialize: (state) => ({
        symbols: state.symbols.slice(0, MAX_WATCHLIST_SYMBOLS),
      }),
    }
  )
);

let hasBootstrappedPreferences = false;
let hasResolvedPreferences = false;
let isApplyingRemoteState = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function areSameSymbols(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function scheduleWatchlistSync(symbols: string[]): void {
  if (typeof window === "undefined") return;
  if (!uiFeatureFlags.watchlistBridge) return;
  if (!hasResolvedPreferences) return;

  const sanitized = sanitizeWatchlistSymbols(symbols);
  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(() => {
    updatePreferences({ watchlistSymbols: sanitized }).catch((error) => {
      console.warn("Failed to sync watchlist preferences:", error);
    });
  }, WATCHLIST_SYNC_DEBOUNCE_MS);
}

async function bootstrapWatchlistPreferences(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!uiFeatureFlags.watchlistBridge) {
    hasResolvedPreferences = true;
    return;
  }
  if (hasBootstrappedPreferences) return;
  hasBootstrappedPreferences = true;

  try {
    const response = await fetchPreferences();
    const remoteSymbols = sanitizeWatchlistSymbols(response.preferences.watchlistSymbols);
    const localSymbols = useWatchlistStore.getState().symbols;
    hasResolvedPreferences = true;

    if (response.meta.exists) {
      if (!areSameSymbols(localSymbols, remoteSymbols)) {
        isApplyingRemoteState = true;
        useWatchlistStore.setState({ symbols: remoteSymbols });
        isApplyingRemoteState = false;
      }
    } else if (localSymbols.length > 0) {
      scheduleWatchlistSync(localSymbols);
    }
  } catch (error) {
    console.warn("Failed to bootstrap watchlist preferences:", error);
  } finally {
    hasResolvedPreferences = true;
  }
}

if (typeof window !== "undefined") {
  void bootstrapWatchlistPreferences();

  useWatchlistStore.subscribe((state, previousState) => {
    if (state.symbols === previousState.symbols) return;
    if (isApplyingRemoteState) return;
    scheduleWatchlistSync(state.symbols);
  });
}
