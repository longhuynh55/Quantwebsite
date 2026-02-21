import * as React from "react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/ui/professional";
import { TrendBadge } from "@/components/ui/professional";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Enable hover effects for interactive cards */
  interactive?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, ...props }, ref) => {
    const baseStyles = cn(
      "rounded-xl border border-gray-200 bg-white text-gray-950 shadow-sm",
      "dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50",
      "transition-[transform,box-shadow,border-color] duration-300 ease-out"
    );

    const interactiveStyles = interactive && cn(
      "hover:-translate-y-1 hover:shadow-lg",
      "hover:border-gray-300 dark:hover:border-gray-700",
      "cursor-pointer"
    );

    return (
      <div
        ref={ref}
        className={cn(baseStyles, interactiveStyles, className)}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-gray-500 dark:text-gray-400", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

/**
 * MetricCard - Specialized card for displaying metrics with animation support
 */
interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
  animated?: boolean;
  /** Inline trend visualization data */
  sparklineData?: number[];
  /** Progress bar configuration */
  progress?: { value: number; max: number };
  /** Status indicator for live data */
  status?: "live" | "stale" | "error";
  /** Period comparison data */
  comparison?: { value: number; label: string; period: string };
  /** Size variants */
  size?: "sm" | "md" | "lg";
}

// Size variants for padding and text (memoized outside component since it's static)
const sizeStyles = {
  sm: {
    container: "p-3",
    title: "text-xs",
    value: "text-xl",
    description: "text-xs",
  },
  md: {
    container: "p-4",
    title: "text-sm",
    value: "text-2xl",
    description: "text-xs",
  },
  lg: {
    container: "p-6 metric-hero",
    title: "text-sm",
    value: "text-3xl metric-value",
    description: "text-sm",
  },
} as const;

const MetricCard = React.memo(
  React.forwardRef<HTMLDivElement, MetricCardProps>(
    (
      {
        title,
        value,
        description,
        trend,
        trendValue,
        className,
        animated = false,
        sparklineData,
        progress,
        status,
        comparison,
        size = "md",
      },
      ref
    ) => {
      const trendColors = {
        up: "text-green-600 dark:text-green-400",
        down: "text-red-600 dark:text-red-400",
        neutral: "text-gray-600 dark:text-gray-400",
      };

    // Determine trend direction from sparkline data
    const sparklineTrend = React.useMemo(() => {
      if (!sparklineData || sparklineData.length < 2) return undefined;
      const validData = sparklineData.filter(
        (v): v is number => typeof v === "number" && !isNaN(v)
      );
      if (validData.length < 2) return undefined;
      const first = validData[0];
      const last = validData[validData.length - 1];
      if (last > first) return "up";
      if (last < first) return "down";
      return "neutral";
    }, [sparklineData]);

    // Calculate progress percentage
    const progressPercent = React.useMemo(() => {
      if (!progress) return 0;
      const percent = (progress.value / progress.max) * 100;
      return Math.min(100, Math.max(0, percent));
    }, [progress]);

    // Progress bar color based on percentage
    const progressColor = React.useMemo(() => {
      if (progressPercent >= 80) return "bg-green-500 dark:bg-green-400";
      if (progressPercent >= 50) return "bg-blue-500 dark:bg-blue-400";
      if (progressPercent >= 25) return "bg-yellow-500 dark:bg-yellow-400";
      return "bg-red-500 dark:bg-red-400";
    }, [progressPercent]);

    // Comparison trend direction
    const comparisonTrend = React.useMemo(() => {
      if (!comparison) return undefined;
      if (comparison.value > 0) return "up";
      if (comparison.value < 0) return "down";
      return "neutral";
    }, [comparison]);

    const currentSize = sizeStyles[size];

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-sm",
          "transition-[transform,box-shadow,border-color] duration-300 ease-out",
          "hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700",
          animated && "animate-in fade-in zoom-in-95 duration-500",
          currentSize.container,
          className
        )}
      >
        {/* Status indicator in top-right corner */}
        {status && (
          <div className="relative float-right ml-2 mb-1">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
                status === "live" && [
                  "status-live",
                  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                ],
                status === "stale" && [
                  "status-stale",
                  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                ],
                status === "error" && [
                  "status-error",
                  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                ]
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  status === "live" && "bg-green-500",
                  status === "stale" && "bg-yellow-500",
                  status === "error" && "bg-red-500"
                )}
              />
              {status === "live" && "Live"}
              {status === "stale" && "Stale"}
              {status === "error" && "Error"}
            </span>
          </div>
        )}

        {/* Title */}
        <p className={cn("font-medium text-gray-500 dark:text-gray-400", currentSize.title)}>
          {title}
        </p>

        {/* Value row with optional sparkline */}
        <div className="flex items-center gap-3 mt-1">
          <p
            className={cn(
              "font-bold",
              currentSize.value,
              trend === "up" && "text-green-600 dark:text-green-400",
              trend === "down" && "text-red-600 dark:text-red-400",
              (!trend || trend === "neutral") && "text-gray-900 dark:text-white"
            )}
          >
            {value}
          </p>
          {trendValue && (
            <span className={cn("text-sm font-medium", trendColors[trend || "neutral"])}>
              {trend === "up" && "^"}
              {trend === "down" && "v"}
              {trendValue}
            </span>
          )}
          {/* Sparkline */}
          {sparklineData && sparklineData.length >= 2 && (
            <Sparkline
              data={sparklineData}
              trend={sparklineTrend}
              width={size === "lg" ? 100 : 80}
              height={size === "lg" ? 32 : 24}
              showArea
              className="opacity-80"
            />
          )}
        </div>

        {/* Progress bar */}
        {progress && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>{progress.value.toLocaleString()}</span>
              <span>{progress.max.toLocaleString()}</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500 ease-out progress-bar-animated",
                  progressColor
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Comparison with TrendBadge */}
        {comparison && (
          <div className="mt-2 flex items-center gap-2">
            <TrendBadge
              trend={comparisonTrend || "neutral"}
              value={`${comparison.value > 0 ? "+" : ""}${comparison.value}%`}
              size="sm"
              showIcon
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {comparison.period}
            </span>
          </div>
        )}

        {/* Description */}
        {description && (
          <p className={cn("text-gray-500 dark:text-gray-400 mt-1", currentSize.description)}>
            {description}
          </p>
        )}
      </div>
    );
  }
)
);
MetricCard.displayName = "MetricCard";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, MetricCard };
