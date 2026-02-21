import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * usePrefersReducedMotion - Detects user's motion preference
 *
 * Returns true if the user has enabled "prefers-reduced-motion" in their
 * system settings. Use this to disable or simplify animations for users
 * who prefer reduced motion.
 *
 * @returns boolean indicating if reduced motion is preferred
 *
 * @example
 * ```tsx
 * function AnimatedComponent() {
 *   const prefersReducedMotion = usePrefersReducedMotion();
 *
 *   return (
 *     <div
 *       style={{
 *         transition: prefersReducedMotion ? 'none' : 'transform 0.3s',
 *       }}
 *     >
 *       Content
 *     </div>
 *   );
 * }
 * ```
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    // Check if window is available (SSR safety)
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * useAnimationFrame - requestAnimationFrame with automatic cleanup
 *
 * This hook provides a declarative way to use requestAnimationFrame with
 * automatic cleanup when the component unmounts. The callback receives
 * the delta time since the last frame in milliseconds.
 *
 * @param callback - Function called on each animation frame, receives deltaTime in ms
 * @param active - Whether the animation loop should run (default: true)
 *
 * @example
 * ```tsx
 * function AnimatedBox() {
 *   const [rotation, setRotation] = useState(0);
 *
 *   useAnimationFrame((deltaTime) => {
 *     setRotation(prev => prev + deltaTime * 0.1); // Rotate 0.1 degrees per ms
 *   }, true);
 *
 *   return <div style={{ transform: `rotate(${rotation}deg)` }}>Spinning</div>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Conditional animation
 * function PulsingDot({ isPulsing }) {
 *   const [scale, setScale] = useState(1);
 *
 *   useAnimationFrame((dt) => {
 *     setScale(s => 1 + Math.sin(Date.now() / 200) * 0.2);
 *   }, isPulsing);
 *
 *   return <div style={{ transform: `scale(${scale})` }}>Dot</div>;
 * }
 * ```
 */
export function useAnimationFrame(
  callback: (deltaTime: number) => void,
  active: boolean = true
): void {
  const requestRef = useRef<number | undefined>(undefined);
  const previousTimeRef = useRef<number | undefined>(undefined);
  const savedCallback = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active) {
      // Clean up if becoming inactive
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
        previousTimeRef.current = undefined;
      }
      return;
    }

    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = time - previousTimeRef.current;
        savedCallback.current(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [active]);
}

/**
 * useAnimationLoop - Runs animation loop with start/stop controls
 *
 * Provides imperative control over an animation loop. Useful when you need
 * to manually start/stop animations based on user interactions or other events.
 *
 * @param callback - Function called on each animation frame, receives deltaTime in ms
 * @returns Object with start and stop functions, and isRunning state
 *
 * @example
 * ```tsx
 * function GameCharacter() {
 *   const [position, setPosition] = useState({ x: 0, y: 0 });
 *
 *   const { start, stop, isRunning } = useAnimationLoop((deltaTime) => {
 *     setPosition(prev => ({
 *       x: prev.x + deltaTime * 0.05,
 *       y: prev.y
 *     }));
 *   });
 *
 *   return (
 *     <div>
 *       <div style={{ left: position.x, top: position.y }}>Character</div>
 *       <button onClick={isRunning ? stop : start}>
 *         {isRunning ? 'Stop' : 'Start'}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAnimationLoop(callback: (deltaTime: number) => void): {
  start: () => void;
  stop: () => void;
  isRunning: boolean;
} {
  const [isRunning, setIsRunning] = useState(false);
  const requestRef = useRef<number | undefined>(undefined);
  const previousTimeRef = useRef<number | undefined>(undefined);
  const savedCallback = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  const animate = useCallback(function animateFrame(time: number) {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      savedCallback.current(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animateFrame);
  }, []);

  const start = useCallback(() => {
    if (!isRunning) {
      previousTimeRef.current = undefined;
      requestRef.current = requestAnimationFrame(animate);
      setIsRunning(true);
    }
  }, [isRunning, animate]);

  const stop = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = undefined;
    }
    previousTimeRef.current = undefined;
    setIsRunning(false);
  }, []);

  return { start, stop, isRunning };
}

/**
 * useSpring - Spring physics animation hook
 *
 * Creates a spring-physics based animation value that smoothly transitions
 * to a target value. Useful for natural-feeling animations.
 *
 * @param target - The target value to animate towards
 * @param config - Spring configuration options
 * @param config.tension - Spring tension/stiffness (default: 0.1)
 * @param config.friction - Spring friction/damping (default: 0.8)
 * @param config.precision - Stop animation when within this distance (default: 0.01)
 * @returns Current animated value
 *
 * @example
 * ```tsx
 * function SpringBox() {
 *   const [target, setTarget] = useState(0);
 *   const animatedValue = useSpring(target, { tension: 0.15, friction: 0.7 });
 *
 *   return (
 *     <div>
 *       <div style={{ transform: `translateX(${animatedValue}px)` }}>Spring!</div>
 *       <button onClick={() => setTarget(t => t + 100)}>Move Right</button>
 *       <button onClick={() => setTarget(t => t - 100)}>Move Left</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSpring(
  target: number,
  config?: {
    tension?: number;
    friction?: number;
    precision?: number;
  }
): number {
  const { tension = 0.1, friction = 0.8, precision = 0.01 } = config || {};
  const [current, setCurrent] = useState(target);
  const velocityRef = useRef(0);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Skip animation if very close
    if (Math.abs(current - target) < precision && Math.abs(velocityRef.current) < precision) {
      velocityRef.current = 0;
      return;
    }

    const animate = () => {
      setCurrent((prev) => {
        const diff = target - prev;
        const newVelocity = (velocityRef.current + diff * tension) * friction;
        velocityRef.current = newVelocity;

        const newValue = prev + newVelocity;

        // Stop animation if close enough
        if (Math.abs(diff) < precision && Math.abs(newVelocity) < precision) {
          velocityRef.current = 0;
          return target;
        }

        animationRef.current = requestAnimationFrame(animate);
        return newValue;
      });
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    // `current` is intentionally excluded to keep spring animation continuous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, tension, friction, precision]);

  return current;
}

/**
 * useTween - Tween animation hook for smooth transitions
 *
 * Creates a tweened value that transitions smoothly from one value to another
 * over a specified duration using an easing function.
 *
 * @param target - The target value to tween to
 * @param options - Tween configuration options
 * @param options.duration - Animation duration in ms (default: 300)
 * @param options.easing - Easing function name (default: 'easeOutCubic')
 * @returns Current tweened value
 *
 * @example
 * ```tsx
 * function TweenBox() {
 *   const [target, setTarget] = useState(0);
 *   const value = useTween(target, { duration: 500, easing: 'easeInOutQuad' });
 *
 *   return (
 *     <div>
 *       <div style={{ opacity: value / 100 }}>Fading</div>
 *       <button onClick={() => setTarget(100)}>Fade In</button>
 *       <button onClick={() => setTarget(0)}>Fade Out</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTween(
  target: number,
  options?: {
    duration?: number;
    easing?:
      | 'linear'
      | 'easeInQuad'
      | 'easeOutQuad'
      | 'easeInOutQuad'
      | 'easeInCubic'
      | 'easeOutCubic'
      | 'easeInOutCubic'
      | 'easeInQuart'
      | 'easeOutQuart'
      | 'easeInOutQuart';
  }
): number {
  const { duration = 300, easing = 'easeOutCubic' } = options || {};
  const [current, setCurrent] = useState(target);
  const startTimeRef = useRef<number | undefined>(undefined);
  const startValueRef = useRef(target);
  const animationRef = useRef<number | undefined>(undefined);

  // Easing functions
  const easingFunctions: Record<string, (t: number) => number> = {
    linear: (t) => t,
    easeInQuad: (t) => t * t,
    easeOutQuad: (t) => t * (2 - t),
    easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    easeInCubic: (t) => t * t * t,
    easeOutCubic: (t) => --t * t * t + 1,
    easeInOutCubic: (t) =>
      t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    easeInQuart: (t) => t * t * t * t,
    easeOutQuart: (t) => 1 - --t * t * t * t,
    easeInOutQuart: (t) =>
      t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t,
  };

  useEffect(() => {
    // Skip if already at target
    if (current === target) {
      return;
    }

    startValueRef.current = current;
    startTimeRef.current = undefined;

    const ease = easingFunctions[easing] || easingFunctions.easeOutCubic;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === undefined) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = ease(progress);

      const newValue =
        startValueRef.current + (target - startValueRef.current) * easedProgress;
      setCurrent(newValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    // `current` and `easingFunctions` are intentionally excluded to avoid restarting tween each frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, easing]);

  return current;
}

// Also create useTimeout hook for convenience (re-exported pattern)
/**
 * useTimeout - setTimeout with automatic cleanup
 *
 * This hook provides a declarative way to use setTimeout with
 * automatic cleanup when the component unmounts or delay changes.
 *
 * @param callback - Function to call after the delay
 * @param delay - Delay in milliseconds, or null to pause
 *
 * @example
 * ```tsx
 * function AutoSaveNotification() {
 *   const [show, setShow] = useState(false);
 *
 *   const handleSave = () => {
 *     setShow(true);
 *   };
 *
 *   useTimeout(() => {
 *     setShow(false);
 *   }, show ? 3000 : null);
 *
 *   return show ? <div>Saved!</div> : null;
 * }
 * ```
 */
export function useTimeout(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}
