"use client";

import React, { useEffect, useState, useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/hooks";

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
 * @accessibility
 * - Respects prefers-reduced-motion: shows content immediately without animation
 * if the user has enabled reduced motion in their system preferences
 *
 * Usage:
 * ```tsx
 * <ChartWrapper animation="drawIn">
 * <LineChart data={data} />
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
 const prefersReducedMotion = usePrefersReducedMotion();
 const [isVisible, setIsVisible] = useState(prefersReducedMotion);
 const [hasAnimated, setHasAnimated] = useState(prefersReducedMotion);
 const wrapperRef = useRef<HTMLDivElement>(null);
 const isVisibleResolved = prefersReducedMotion || isVisible;
 const hasAnimatedResolved = prefersReducedMotion || hasAnimated;

 useEffect(() => {
 if (prefersReducedMotion) {
 return;
 }

 const wrapper = wrapperRef.current;
 if (!wrapper) return;

 let timeoutId: NodeJS.Timeout | null = null;

 const observer = new IntersectionObserver(
 (entries) => {
 entries.forEach((entry) => {
 if (entry.isIntersecting && !hasAnimated) {
 timeoutId = setTimeout(() => {
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

 return () => {
 observer.disconnect();
 if (timeoutId) clearTimeout(timeoutId);
 };
 }, [delay, hasAnimated, prefersReducedMotion]);

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
 className="animate-pulse bg-stone-100 dark:bg-neutral-800"
 style={{ height: skeletonHeight }}
 >
 <div className="flex items-center justify-center h-full">
 <div className="h-8 w-8 animate-spin border-2 border-stone-300 border-t-emerald-600 dark:border-neutral-600 dark:border-t-emerald-400" />
 </div>
 </div>
 );

 return (
 <div
 ref={wrapperRef}
 className={cn(
 "transition-all ease-out",
 isVisibleResolved ? animated : initial,
 className
 )}
 style={{
 transitionDuration: `${duration}ms`,
 transitionProperty: "opacity, transform, clip-path",
 }}
 >
 {showSkeleton && !hasAnimatedResolved ? skeleton : children}
 </div>
 );
}

/**
 * StaggeredChartGrid - Grid of charts with staggered entrance animations
 *
 * @accessibility
 * - Respects prefers-reduced-motion: shows all children immediately without animation
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
 const prefersReducedMotion = usePrefersReducedMotion();
 const childCount = React.Children.count(children);
 const [visibleCount, setVisibleCount] = useState(prefersReducedMotion ? childCount : 0);
 const gridRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 // If reduced motion is preferred, show all children immediately
 if (prefersReducedMotion) {
 setVisibleCount(childCount);
 return;
 }

 const grid = gridRef.current;
 if (!grid) return;

 const timers: NodeJS.Timeout[] = [];

 const observer = new IntersectionObserver(
 (entries) => {
 entries.forEach((entry) => {
 if (entry.isIntersecting) {
 // Stagger the reveal of each child
 for (let i = 0; i < childCount; i++) {
 const timer = setTimeout(() => {
 setVisibleCount(i + 1);
 }, initialDelay + i * staggerDelay);
 timers.push(timer);
 }
 observer.unobserve(entry.target);
 }
 });
 },
 { threshold: 0.1 }
 );

 observer.observe(grid);

 return () => {
 observer.disconnect();
 timers.forEach((timer) => clearTimeout(timer));
 };
 }, [children, staggerDelay, initialDelay, childCount, prefersReducedMotion]);

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
 prefersReducedMotion ? "" : "transition-all duration-500 ease-out",
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
