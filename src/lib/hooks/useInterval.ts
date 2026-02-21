import { useEffect, useRef } from 'react';

/**
 * useInterval - setInterval with automatic cleanup
 *
 * This hook provides a declarative way to use setInterval with
 * automatic cleanup when the component unmounts or delay changes.
 * Pass null as delay to pause the interval.
 *
 * @param callback - Function to call on each interval tick
 * @param delay - Interval delay in milliseconds, or null to pause
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const [count, setCount] = useState(0);
 *
 *   useInterval(() => {
 *     setCount(c => c + 1);
 *   }, 1000);
 *
 *   return <div>Count: {count}</div>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Paused interval
 * function PausedCounter({ isRunning }) {
 *   const [count, setCount] = useState(0);
 *
 *   useInterval(() => {
 *     setCount(c => c + 1);
 *   }, isRunning ? 1000 : null);
 *
 *   return <div>Count: {count}</div>;
 * }
 * ```
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    // Don't schedule if delay is null
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
