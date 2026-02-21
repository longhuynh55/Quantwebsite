"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/hooks";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  formatter?: (value: number) => string;
  trigger?: "mount" | "visible";
}

/**
 * AnimatedNumber - Counts up from 0 to target value with smooth easing
 *
 * @param value - Target number to animate to
 * @param duration - Animation duration in milliseconds (default: 1000)
 * @param decimals - Number of decimal places (default: 2)
 * @param prefix - String to prepend (e.g., "$", "+")
 * @param suffix - String to append (e.g., "%")
 * @param formatter - Custom formatter function
 * @param trigger - "mount" to animate on mount, "visible" to animate when scrolled into view
 *
 * @accessibility
 * - Respects prefers-reduced-motion: shows final value immediately if reduced motion is preferred
 * - Provides aria-label with the final value for screen readers
 */
export function AnimatedNumber({
  value,
  duration = 1000,
  decimals = 2,
  prefix = "",
  suffix = "",
  className,
  formatter,
  trigger = "visible",
}: AnimatedNumberProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [displayValue, setDisplayValue] = useState(prefersReducedMotion ? value : 0);
  const [hasAnimated, setHasAnimated] = useState(prefersReducedMotion);
  const elementRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(0);
  const targetValueRef = useRef(value);

  const formatValue = useCallback(
    (val: number) => {
      if (formatter) return formatter(val);
      return `${prefix}${val.toFixed(decimals)}${suffix}`;
    },
    [formatter, prefix, suffix, decimals]
  );

  const cancelRunningAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    startTimeRef.current = null;
  }, []);

  const startAnimation = useCallback(
    (fromValue: number, toValue: number) => {
      // Skip animation if reduced motion is preferred
      if (prefersReducedMotion) {
        setDisplayValue(toValue);
        setHasAnimated(true);
        return;
      }

      cancelRunningAnimation();
      startValueRef.current = fromValue;
      targetValueRef.current = toValue;

      const step = (timestamp: number) => {
        if (!startTimeRef.current) {
          startTimeRef.current = timestamp;
        }

        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = fromValue + (toValue - fromValue) * easeOut;

        setDisplayValue(currentValue);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(step);
        } else {
          setDisplayValue(toValue);
          setHasAnimated(true);
          animationRef.current = null;
        }
      };

      animationRef.current = requestAnimationFrame(step);
    },
    [duration, cancelRunningAnimation, prefersReducedMotion]
  );

  // Handle value changes during animation
  useEffect(() => {
    if (prefersReducedMotion) {
      targetValueRef.current = value;
      return;
    }

    // Skip if value hasn't actually changed
    if (value === targetValueRef.current) return;

    if (hasAnimated) {
      // Already animated once, valueToRender follows `value` directly.
      targetValueRef.current = value;
      return;
    }

    // Cancel any running animation and start from current display value to new target
    const frameId = window.requestAnimationFrame(() => {
      startAnimation(displayValue, value);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [value, hasAnimated, displayValue, startAnimation, prefersReducedMotion]);

  // Initial animation trigger
  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    if (trigger === "mount") {
      const frameId = window.requestAnimationFrame(() => {
        startAnimation(0, value);
      });

      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    // Intersection Observer for visible trigger
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            startAnimation(0, value);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelRunningAnimation();
    };
  }, [trigger, hasAnimated, value, startAnimation, cancelRunningAnimation, prefersReducedMotion]);

  const valueToRender = prefersReducedMotion || hasAnimated ? value : displayValue;

  return (
    <span
      ref={elementRef}
      className={cn("tabular-nums", className)}
      aria-label={formatValue(value)}
    >
      {formatValue(valueToRender)}
    </span>
  );
}

/**
 * AnimatedPercentage - Specialized AnimatedNumber for percentages
 */
export function AnimatedPercentage({
  value,
  showSign = true,
  ...props
}: Omit<AnimatedNumberProps, "suffix" | "formatter"> & { showSign?: boolean }) {
  return (
    <AnimatedNumber
      value={value}
      suffix="%"
      prefix={showSign && value > 0 ? "+" : ""}
      {...props}
    />
  );
}

/**
 * AnimatedCurrency - Specialized AnimatedNumber for currency values
 */
export function AnimatedCurrency({
  value,
  locale = "en-US",
  currency = "USD",
  ...props
}: Omit<AnimatedNumberProps, "formatter"> & {
  locale?: string;
  currency?: string;
}) {
  const formatter = useCallback(
    (val: number) => {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(val);
    },
    [locale, currency]
  );

  return <AnimatedNumber value={value} formatter={formatter} {...props} />;
}

export default AnimatedNumber;
