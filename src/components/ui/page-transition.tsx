"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Animation variant:
   * - "fade": Simple fade in/out
   * - "slideUp": Fade + slide up from bottom
   * - "slideUp-fast": Faster version of slideUp
   * - "scale": Fade + scale from 95%
   */
  variant?: "fade" | "slideUp" | "slideUp-fast" | "scale";
  /** Delay before animation starts (ms) */
  delay?: number;
}

/**
 * PageTransition - Wraps page content with entrance animations
 *
 * Usage:
 * ```tsx
 * export default function Page() {
 *   return (
 *     <PageTransition variant="slideUp">
 *       <YourContent />
 *     </PageTransition>
 *   );
 * }
 * ```
 */
export function PageTransition({
  children,
  className,
  variant = "slideUp",
  delay = 0,
}: PageTransitionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Small delay to ensure initial render is complete
    const renderTimer = setTimeout(() => setShouldRender(true), 10);
    // Animation delay
    const visibleTimer = setTimeout(() => setIsVisible(true), delay + 50);

    return () => {
      clearTimeout(renderTimer);
      clearTimeout(visibleTimer);
    };
  }, [delay]);

  const variants = {
    fade: "opacity-0 data-[visible=true]:opacity-100 transition-opacity duration-300 ease-out",
    slideUp: "opacity-0 translate-y-4 data-[visible=true]:opacity-100 data-[visible=true]:translate-y-0 transition-all duration-500 ease-out",
    "slideUp-fast": "opacity-0 translate-y-2 data-[visible=true]:opacity-100 data-[visible=true]:translate-y-0 transition-all duration-300 ease-out",
    scale: "opacity-0 scale-95 data-[visible=true]:opacity-100 data-[visible=true]:scale-100 transition-all duration-300 ease-out",
  };

  if (!shouldRender) {
    return <div className={cn("min-h-[50vh]", className)} />;
  }

  return (
    <div
      className={cn(variants[variant], className)}
      data-visible={isVisible}
    >
      {children}
    </div>
  );
}

/**
 * StaggerContainer - Container for staggered child animations
 *
 * Children will animate in sequence with a delay between each.
 * Add `data-stagger` attribute to children that should be animated.
 *
 * Usage:
 * ```tsx
 * <StaggerContainer staggerDelay={100}>
 *   <div data-stagger>First</div>
 *   <div data-stagger>Second</div>
 *   <div data-stagger>Third</div>
 * </StaggerContainer>
 * ```
 */
interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Delay between each child animation (ms) */
  staggerDelay?: number;
  /** Initial delay before first child animates (ms) */
  initialDelay?: number;
  /** Animation to apply to children */
  childAnimation?: "fadeIn" | "slideUp" | "scaleIn";
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 100,
  initialDelay = 100,
  childAnimation = "slideUp",
}: StaggerContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const children = container.querySelectorAll("[data-stagger]");

    children.forEach((child, index) => {
      const element = child as HTMLElement;
      const delay = initialDelay + index * staggerDelay;

      // Set initial state
      element.style.opacity = "0";
      element.style.transform = childAnimation === "slideUp"
        ? "translateY(16px)"
        : childAnimation === "scaleIn"
          ? "scale(0.95)"
          : "none";

      // Trigger animation after delay
      setTimeout(() => {
        element.style.transition = "opacity 0.4s ease-out, transform 0.4s ease-out";
        element.style.opacity = "1";
        element.style.transform = "translateY(0) scale(1)";
      }, delay);
    });
  }, [staggerDelay, initialDelay, childAnimation]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

/**
 * AnimatedSection - Intersection Observer triggered animation
 *
 * Animates when the section scrolls into view.
 */
interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  /** Animation variant */
  animation?: "fadeIn" | "slideUp" | "slideLeft" | "slideRight" | "scaleIn";
  /** Animation duration in ms */
  duration?: number;
  /** Delay before animation starts (ms) */
  delay?: number;
  /** Threshold for intersection observer (0-1) */
  threshold?: number;
}

export function AnimatedSection({
  children,
  className,
  animation = "slideUp",
  duration = 500,
  delay = 0,
  threshold = 0.1,
}: AnimatedSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

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
      { threshold }
    );

    observer.observe(section);

    return () => observer.disconnect();
  }, [delay, threshold, hasAnimated]);

  const animationStyles: Record<string, { from: string; to: string }> = {
    fadeIn: {
      from: "opacity-0",
      to: "opacity-100",
    },
    slideUp: {
      from: "opacity-0 translate-y-8",
      to: "opacity-100 translate-y-0",
    },
    slideLeft: {
      from: "opacity-0 translate-x-8",
      to: "opacity-100 translate-x-0",
    },
    slideRight: {
      from: "opacity-0 -translate-x-8",
      to: "opacity-100 translate-x-0",
    },
    scaleIn: {
      from: "opacity-0 scale-95",
      to: "opacity-100 scale-100",
    },
  };

  const { from, to } = animationStyles[animation];

  return (
    <div
      ref={sectionRef}
      className={cn(
        from,
        isVisible && to,
        `transition-all ease-out`,
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default PageTransition;
