"use client";

import React, { useEffect, useState, useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChartWrapperProps {
  children: ReactNode;
  className?: string;
  /** Animation variant */
  animation?: "fadeIn" | "slideUp" | "scaleIn" | "drawIn";
  /** Animation duration in ms */
  duration?: number;
  /** Delay before animation starts (ms) */
  delay?: number;
  /** Show loading skeleton before animation */
  showSkeleton?: boolean;
  /** Skeleton height when loading */
  skeletonHeight?: number;
}

/**
 * ChartWrapper - Wraps chart components with entrance animations
 *
 * Animates charts when they become visible in the viewport.
 * Supports different animation styles for various chart types.
 *
 * Usage:
 * ```tsx
 * <ChartWrapper animation="drawIn">
 *   <LineChart data={data} />
 * </ChartWrapper>
 * ```
 */
export function ChartWrapper({
  children,
  className,
  animation = "slideUp",
  duration = 600,
  delay = 0,
  showSkeleton = false,
  skeletonHeight = 300,
}: ChartWrapperProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setTimeout(() => {
              setIsVisible(true);
              setHasAnimated(true);
            }, delay);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "50px" }
    );

    observer.observe(wrapper);

    return () => observer.disconnect();
  }, [delay, hasAnimated]);

  // Animation keyframes as CSS classes
  const animationClasses = {
    fadeIn: {
      initial: "opacity-0",
      animated: "opacity-100",
    },
    slideUp: {
      initial: "opacity-0 translate-y-6",
      animated: "opacity-100 translate-y-0",
    },
    scaleIn: {
      initial: "opacity-0 scale-95",
      animated: "opacity-100 scale-100",
    },
    drawIn: {
      initial: "opacity-0 [clip-path:inset(0_100%_0_0)]",
      animated: "opacity-100 [clip-path:inset(0_0%_0_0)]",
    },
  };

  const { initial, animated } = animationClasses[animation];

  const skeleton = (
    <div
      className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg"
      style={{ height: skeletonHeight }}
    >
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "transition-all ease-out",
        isVisible ? animated : initial,
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        transitionProperty: "opacity, transform, clip-path",
      }}
    >
      {showSkeleton && !hasAnimated ? skeleton : children}
    </div>
  );
}

/**
 * StaggeredChartGrid - Grid of charts with staggered entrance animations
 */
interface StaggeredChartGridProps {
  children: ReactNode;
  className?: string;
  /** Delay between each chart animation (ms) */
  staggerDelay?: number;
  /** Initial delay before first chart (ms) */
  initialDelay?: number;
  /** Number of columns in grid */
  columns?: 1 | 2 | 3 | 4;
}

export function StaggeredChartGrid({
  children,
  className,
  staggerDelay = 150,
  initialDelay = 100,
  columns = 2,
}: StaggeredChartGridProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const childCount = React.Children.count(children);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Stagger the reveal of each child
            for (let i = 0; i < childCount; i++) {
              setTimeout(() => {
                setVisibleCount(i + 1);
              }, initialDelay + i * staggerDelay);
            }
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(grid);

    return () => observer.disconnect();
  }, [children, staggerDelay, initialDelay]);

  const columnClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div ref={gridRef} className={cn("grid gap-6", columnClasses[columns], className)}>
      {React.Children.map(children, (child, index) => (
        <div
          key={index}
          className={cn(
            "transition-all duration-500 ease-out",
            index < visibleCount
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          )}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

export default ChartWrapper;
