"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
  formatNumber?: boolean;
  decimals?: number;
}

// Easing function: ease-out cubic
const easeOutCubic = (progress: number): number => 1 - Math.pow(1 - progress, 3);

export function AnimatedCounter({
  value,
  suffix = "",
  prefix = "",
  duration = 2000,
  className,
  formatNumber = true,
  decimals = 0,
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Memoize the formatter to prevent recreation
  const formatter = useMemo(() => {
    return new Intl.NumberFormat("vi-VN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }, [decimals]);

  // Memoize format function
  const formatValue = useCallback(
    (num: number): string | number => {
      if (!formatNumber) return num;
      return formatter.format(num);
    },
    [formatNumber, formatter]
  );

  // Intersection Observer effect
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observerRef.current?.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Animation effect
  useEffect(() => {
    if (!isVisible) return;

    let startTime: number | null = null;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      // Apply easing
      const easedProgress = easeOutCubic(progress);

      // Calculate current count with decimals support
      const currentCount = decimals > 0
        ? easedProgress * value
        : Math.floor(easedProgress * value);

      setCount(currentCount);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isVisible, value, duration, decimals]);

  // Format display value
  const displayValue = decimals > 0 ? count.toFixed(decimals) : formatValue(count);

  return (
    <span ref={ref} className={cn("tabular-nums", className)} aria-label={`${prefix}${value}${suffix}`}>
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
}
