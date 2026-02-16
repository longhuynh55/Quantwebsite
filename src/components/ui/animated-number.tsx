"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

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
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const formatValue = useCallback(
    (val: number) => {
      if (formatter) return formatter(val);
      return `${prefix}${val.toFixed(decimals)}${suffix}`;
    },
    [formatter, prefix, suffix, decimals]
  );

  const startAnimation = useCallback(() => {
    if (hasAnimated) return;
    startTimeRef.current = null;
    const step = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = value * easeOut;

      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
        setHasAnimated(true);
      }
    };

    animationRef.current = requestAnimationFrame(step);
  }, [hasAnimated, duration, value]);

  useEffect(() => {
    if (trigger === "mount") {
      startAnimation();
      return;
    }

    // Intersection Observer for visible trigger
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            startAnimation();
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [trigger, startAnimation, hasAnimated]);

  const valueToRender = hasAnimated ? value : displayValue;

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
