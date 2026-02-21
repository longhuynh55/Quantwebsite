/**
 * Custom React Hooks
 *
 * This module exports reusable hooks for timers, animations, and other utilities.
 * All hooks include automatic cleanup to prevent memory leaks.
 */

// Timer hooks
export { useTimer, useCountdown, useStopwatch } from './useTimer';

// Animation hooks
export {
  useAnimationFrame,
  useAnimationLoop,
  useSpring,
  useTween,
  useTimeout,
  usePrefersReducedMotion,
} from './useAnimation';

// Interval hook
export { useInterval } from './useInterval';
