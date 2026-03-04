"use client";

import React from "react";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";

type Direction = "up" | "down" | "left" | "right";

interface ScrollRevealProps {
    children: React.ReactNode;
    /** Animation delay in seconds. Default: 0 */
    delay?: number;
    /** Direction of entrance. Default: "up" */
    direction?: Direction;
    /** Additional className */
    className?: string;
    /** HTML element to render. Default: "div" */
    as?: React.ElementType;
}

const directionMap: Record<Direction, string> = {
    up: "translateY(24px)",
    down: "translateY(-24px)",
    left: "translateX(24px)",
    right: "translateX(-24px)",
};

/**
 * Wrapper component for scroll-triggered reveal animations.
 * Editorial design system: refined fade + subtle slide. No bounce.
 */
export function ScrollReveal({
    children,
    delay = 0,
    direction = "up",
    className = "",
    as: Component = "div",
}: ScrollRevealProps) {
    const { ref, isVisible } = useScrollReveal<HTMLDivElement>();

    return (
        <Component
            ref={ref}
            className={className}
            style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "none" : directionMap[direction],
                transition: `opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)`,
                transitionDelay: `${delay}s`,
            }}
        >
            {children}
        </Component>
    );
}
