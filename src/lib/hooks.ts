"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
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
  const lastUpdated = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    if (lastUpdated.current === 0) {
      lastUpdated.current = now;
      return;
    }
    const timeSinceLastUpdate = now - lastUpdated.current;
    const delay = Math.max(0, interval - timeSinceLastUpdate);
    const timer = setTimeout(() => {
      lastUpdated.current = Date.now();
      setThrottledValue(value);
    }, delay);

    return () => clearTimeout(timer);
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
  }, [options]);

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
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error("Error saving to localStorage:", error);
      }
    },
    [key, storedValue]
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
