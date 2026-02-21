"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

/**
 * useUrlState - Synchronizes state with URL search parameters
 * 
 * @param key - The URL parameter key
 * @param defaultValue - The default value if the parameter is missing
 * @returns [value, setValue]
 * 
 * Usage:
 * ```tsx
 * const [symbol, setSymbol] = useUrlState("symbol", "AAA");
 * ```
 */
export function useUrlState<T extends string | number | boolean>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const value = useMemo(() => {
    const param = searchParams.get(key);
    if (param === null) return defaultValue;

    if (typeof defaultValue === "number") {
      const num = Number(param);
      return (Number.isFinite(num) ? num : defaultValue) as T;
    }

    if (typeof defaultValue === "boolean") {
      return (param === "true") as T;
    }

    return param as T;
  }, [searchParams, key, defaultValue]);

  const setValue = useCallback(
    (newValue: T) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newValue === defaultValue || newValue === "" || newValue === undefined || newValue === null) {
        params.delete(key);
      } else {
        params.set(key, String(newValue));
      }
      
      const query = params.toString();
      const url = `${pathname}${query ? `?${query}` : ""}`;
      router.replace(url, { scroll: false });
    },
    [searchParams, key, defaultValue, pathname, router]
  );

  return [value, setValue];
}

/**
 * useUrlStateObject - Synchronizes an object of states with URL search parameters
 */
export function useUrlStateObject<T extends Record<string, string | number | boolean>>(
  defaultValues: T
): [T, (updates: Partial<T>) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const values = useMemo(() => {
    const result = { ...defaultValues } as T;
    const setResultValue = <K extends keyof T>(key: K, value: T[K]) => {
      result[key] = value;
    };

    (Object.keys(defaultValues) as Array<keyof T>).forEach((key) => {
      const param = searchParams.get(String(key));
      if (param !== null) {
        const defaultValue = defaultValues[key];

        if (typeof defaultValue === "number") {
          const num = Number(param);
          if (Number.isFinite(num)) {
            setResultValue(key, num as T[typeof key]);
          }
        } else if (typeof defaultValue === "boolean") {
          setResultValue(key, (param === "true") as T[typeof key]);
        } else {
          setResultValue(key, param as T[typeof key]);
        }
      }
    });
    return result;
  }, [searchParams, defaultValues]);

  const setValues = useCallback(
    (updates: Partial<T>) => {
      const params = new URLSearchParams(searchParams.toString());
      
      Object.entries(updates).forEach(([key, val]) => {
        if (val === defaultValues[key] || val === "" || val === undefined || val === null) {
          params.delete(key);
        } else {
          params.set(key, String(val));
        }
      });

      const query = params.toString();
      const url = `${pathname}${query ? `?${query}` : ""}`;
      router.replace(url, { scroll: false });
    },
    [searchParams, defaultValues, pathname, router]
  );

  return [values, setValues];
}

/**
 * useDebounce - Debounces a value by the specified delay
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 *
 * Usage:
 * ```tsx
 * const [search, setSearch] = useState("");
 * const debouncedSearch = useDebounce(search, 300);
 *
 * useEffect(() => {
 *   if (debouncedSearch) {
 *     fetchResults(debouncedSearch);
 *   }
 * }, [debouncedSearch]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * useDebouncedCallback - Returns a debounced version of the callback
 *
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Debounced callback function
 *
 * Usage:
 * ```tsx
 * const debouncedSearch = useDebouncedCallback((query) => {
 *   fetchResults(query);
 * }, 300);
 *
 * <input onChange={(e) => debouncedSearch(e.target.value)} />
 * ```
 */
export function useDebouncedCallback<TArgs extends readonly unknown[]>(
  callback: (...args: TArgs) => void,
  delay: number = 300
): (...args: TArgs) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: TArgs) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}

/**
 * useThrottle - Throttles a value by the specified interval
 *
 * @param value - The value to throttle
 * @param interval - Interval in milliseconds (default: 100ms)
 * @returns The throttled value
 */
export function useThrottle<T>(value: T, interval: number = 100): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastExecuted = useRef(0);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecuted.current;

    if (lastExecuted.current === 0 || timeSinceLastExecution >= interval) {
      const timeoutId = setTimeout(() => {
        lastExecuted.current = Date.now();
        setThrottledValue(value);
      }, 0);

      return () => clearTimeout(timeoutId);
    } else {
      const timeoutId = setTimeout(() => {
        lastExecuted.current = Date.now();
        setThrottledValue(value);
      }, interval - timeSinceLastExecution);

      return () => clearTimeout(timeoutId);
    }
  }, [value, interval]);

  return throttledValue;
}

/**
 * useIntersectionObserver - Hook for Intersection Observer API
 *
 * @param options - Intersection Observer options
 * @returns [ref, isIntersecting, entry]
 *
 * Usage:
 * ```tsx
 * const [ref, isIntersecting] = useIntersectionObserver({ threshold: 0.5 });
 *
 * <div ref={ref}>
 *   {isIntersecting ? "Visible" : "Hidden"}
 * </div>
 * ```
 */
export function useIntersectionObserver<T extends Element = HTMLDivElement>(
  options: IntersectionObserverInit = {}
): [React.RefCallback<T>, boolean, IntersectionObserverEntry | null] {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const elementRef = useRef<T | null>(null);

  // Memoize options to prevent unnecessary effect re-runs
  // Only recreate observer when these specific values change
  const threshold = options.threshold;
  const rootMargin = options.rootMargin;
  const root = options.root;

  const setRef = useCallback(
    (node: T | null) => {
      elementRef.current = node;
    },
    []
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        setEntry(entry);
      },
      { threshold: 0.1, ...options }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold, rootMargin, root]);

  return [setRef, isIntersecting, entry];
}

/**
 * useMediaQuery - Hook for responsive media queries
 *
 * @param query - CSS media query string
 * @returns Whether the media query matches
 *
 * Usage:
 * ```tsx
 * const isMobile = useMediaQuery("(max-width: 768px)");
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/**
 * useLocalStorage - Persist state to localStorage
 *
 * @param key - localStorage key
 * @param initialValue - Initial value if no stored value exists
 * @returns [value, setValue, removeValue]
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        try {
          const valueToStore = value instanceof Function ? value(prev) : value;
          if (typeof window !== "undefined") {
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
          }
          return valueToStore;
        } catch (error) {
          console.error("Error saving to localStorage:", error);
          return prev;
        }
      });
    },
    [key]
  );

  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.error("Error removing from localStorage:", error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

export default useDebounce;

// Re-export timer and animation hooks
export { useInterval } from "./hooks/useInterval";
export { useAnimationFrame, useTimeout, usePrefersReducedMotion } from "./hooks/useAnimation";
