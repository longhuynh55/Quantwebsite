import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useTimer - Returns the current time, updates at specified interval
 *
 * This hook provides a Date object that automatically updates at the specified
 * interval, useful for creating clocks, timers, or time-dependent UIs.
 *
 * @param intervalMs - Update interval in milliseconds (default: 1000ms)
 * @returns Current Date object that updates at the specified interval
 *
 * @example
 * ```tsx
 * function Clock() {
 *   const time = useTimer(1000);
 *   return <div>{time.toLocaleTimeString()}</div>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Update every minute
 * const currentTime = useTimer(60000);
 * ```
 */
export function useTimer(intervalMs: number = 1000): Date {
  const [time, setTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date());
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs]);

  return time;
}

/**
 * useCountdown - Countdown timer with controls
 *
 * A hook for countdown functionality with start, pause, and reset controls.
 *
 * @param initialSeconds - Initial countdown time in seconds
 * @param options - Configuration options
 * @param options.onComplete - Callback when countdown reaches zero
 * @returns Object with seconds remaining, and control functions
 *
 * @example
 * ```tsx
 * function CountdownTimer() {
 *   const { seconds, isRunning, start, pause, reset } = useCountdown(60, {
 *     onComplete: () => console.log('Time is up!')
 *   });
 *
 *   return (
 *     <div>
 *       <span>{seconds}s</span>
 *       <button onClick={isRunning ? pause : start}>
 *         {isRunning ? 'Pause' : 'Start'}
 *       </button>
 *       <button onClick={reset}>Reset</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCountdown(
  initialSeconds: number,
  options?: {
    onComplete?: () => void;
  }
): {
  seconds: number;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  setSeconds: (seconds: number) => void;
} {
  const [seconds, setSeconds] = useState<number>(initialSeconds);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const onCompleteRef = useRef(options?.onComplete);

  // Keep callback ref updated
  useEffect(() => {
    onCompleteRef.current = options?.onComplete;
  }, [options?.onComplete]);

  // Handle countdown logic
  useEffect(() => {
    if (!isRunning || seconds <= 0) return;

    const id = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          onCompleteRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [isRunning, seconds]);

  const start = useCallback(() => {
    if (seconds > 0) {
      setIsRunning(true);
    }
  }, [seconds]);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  return {
    seconds,
    isRunning,
    start,
    pause,
    reset,
    setSeconds,
  };
}

/**
 * useStopwatch - Stopwatch with controls
 *
 * A hook for stopwatch functionality with start, pause, reset, and lap controls.
 *
 * @param autoStart - Whether to start automatically (default: false)
 * @returns Object with elapsed time in various formats and control functions
 *
 * @example
 * ```tsx
 * function Stopwatch() {
 *   const { time, isRunning, start, pause, reset, lap, laps } = useStopwatch();
 *
 *   return (
 *     <div>
 *       <span>{time.formatted}</span> {/* "00:01:23" *}
 *       <span>{time.seconds}</span>   {/* 83 *}
 *       <button onClick={isRunning ? pause : start}>
 *         {isRunning ? 'Pause' : 'Start'}
 *       </button>
 *       <button onClick={reset}>Reset</button>
 *       <button onClick={lap}>Lap</button>
 *       {laps.map((lapTime, i) => (
 *         <div key={i}>Lap {i + 1}: {lapTime.formatted}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useStopwatch(autoStart: boolean = false): {
  time: {
    milliseconds: number;
    seconds: number;
    minutes: number;
    hours: number;
    formatted: string;
  };
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  lap: () => void;
  laps: Array<{
    milliseconds: number;
    seconds: number;
    minutes: number;
    hours: number;
    formatted: string;
  }>;
} {
  const [milliseconds, setMilliseconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(autoStart);
  const [laps, setLaps] = useState<
    Array<{
      milliseconds: number;
      seconds: number;
      minutes: number;
      hours: number;
      formatted: string;
    }>
  >([]);

  useEffect(() => {
    if (!isRunning) return;

    const startTime = Date.now() - milliseconds;
    const id = setInterval(() => {
      setMilliseconds(Date.now() - startTime);
    }, 10); // Update every 10ms for smooth display

    return () => clearInterval(id);
    // `milliseconds` is intentionally excluded to avoid interval reset on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      milliseconds: ms,
      seconds: totalSeconds,
      minutes,
      hours,
      formatted: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    };
  };

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setMilliseconds(0);
    setLaps([]);
  }, []);

  const lap = useCallback(() => {
    setLaps((prev) => [...prev, formatTime(milliseconds)]);
  }, [milliseconds]);

  return {
    time: formatTime(milliseconds),
    isRunning,
    start,
    pause,
    reset,
    lap,
    laps,
  };
}
