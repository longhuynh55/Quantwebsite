"use client";

import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  trend: "up" | "down" | "neutral";
  value?: string | number;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

const TrendBadge = React.memo(
  React.forwardRef<HTMLSpanElement, TrendBadgeProps>(
    (
      {
        className,
        trend,
        value,
        showIcon = true,
        size = "md",
        ...props
      },
      ref
    ) => {
      // Icon selection based on trend
      const Icon = {
        up: TrendingUp,
        down: TrendingDown,
        neutral: Minus,
      }[trend];

      // Size variants
      const sizeStyles = {
        sm: "px-2 py-0.5 text-xs gap-1",
        md: "px-2.5 py-1 text-sm gap-1.5",
        lg: "px-3 py-1.5 text-base gap-2",
      };

      const iconSizes = {
        sm: "h-3 w-3",
        md: "h-3.5 w-3.5",
        lg: "h-4 w-4",
      };

      return (
        <span
          ref={ref}
          className={cn(
            // Base styles
            "inline-flex items-center rounded-md font-medium",
            "transition-colors duration-200",
            // Trend-specific colors
            trend === "up" && [
              "bg-green-100 text-green-700",
              "dark:bg-green-900/30 dark:text-green-400",
            ],
            trend === "down" && [
              "bg-red-100 text-red-700",
              "dark:bg-red-900/30 dark:text-red-400",
            ],
            trend === "neutral" && [
              "bg-stone-100 text-stone-600",
              "dark:bg-neutral-800/50 dark:text-neutral-400",
            ],
            // Size
            sizeStyles[size],
            className
          )}
          {...props}
        >
          {showIcon && (
            <Icon
              className={cn(
                iconSizes[size],
                // Animate icon with subtle bounce on mount
                "animate-bounce",
                // Trend-specific icon colors
                trend === "up" && "text-green-600 dark:text-green-400",
                trend === "down" && "text-red-600 dark:text-red-400",
                trend === "neutral" && "text-stone-500 dark:text-neutral-400"
              )}
              style={{
                animationIterationCount: 1,
                animationTimingFunction: "ease-out",
                animationDuration: "500ms",
              }}
            />
          )}
          {value !== undefined && (
            <span className="font-semibold">
              {typeof value === "number" ? value.toLocaleString() : value}
            </span>
          )}
        </span>
      );
    }
  )
);

TrendBadge.displayName = "TrendBadge";

export { TrendBadge, type TrendBadgeProps };
