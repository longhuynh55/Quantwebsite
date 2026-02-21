import * as React from "react";
import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="presentation"
        aria-hidden="true"
        className={cn(
          "animate-pulse rounded-md bg-gray-200 dark:bg-gray-700",
          className
        )}
        {...props}
      />
    );
  }
);
Skeleton.displayName = "Skeleton";

// Skeleton for card components
interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

const SkeletonCard = React.forwardRef<HTMLDivElement, SkeletonCardProps>(
  ({ className, lines = 3, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="presentation"
        aria-hidden="true"
        className={cn(
          "rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow",
          className
        )}
        {...props}
      >
        <Skeleton className="h-6 w-1/3 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")}
            />
          ))}
        </div>
      </div>
    );
  }
);
SkeletonCard.displayName = "SkeletonCard";

// Skeleton for table components
interface SkeletonTableProps extends React.HTMLAttributes<HTMLDivElement> {
  rows?: number;
  columns?: number;
}

const SkeletonTable = React.forwardRef<HTMLDivElement, SkeletonTableProps>(
  ({ className, rows = 5, columns = 5, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="presentation"
        aria-hidden="true"
        className={cn("rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow overflow-hidden", className)}
        {...props}
      >
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-3">
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
        </div>
        {/* Rows */}
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="px-4 py-3">
              <div className="flex gap-4">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <Skeleton
                    key={colIndex}
                    className={cn(
                      "h-4 flex-1",
                      colIndex === 0 ? "w-24" : ""
                    )}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
);
SkeletonTable.displayName = "SkeletonTable";

// Skeleton for chart components - uses deterministic heights
interface SkeletonChartProps extends React.HTMLAttributes<HTMLDivElement> {
  height?: number;
}

// Pre-generated heights for consistent rendering
const CHART_BAR_HEIGHTS = [45, 65, 55, 75, 50, 80, 60, 70, 40, 85, 55, 65];

const SkeletonChart = React.forwardRef<HTMLDivElement, SkeletonChartProps>(
  ({ className, height = 300, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="presentation"
        aria-hidden="true"
        className={cn("rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow", className)}
        style={{ height }}
        {...props}
      >
        {/* Chart header */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
        {/* Chart area */}
        <div className="flex-1 flex items-end justify-between gap-2 h-[calc(100%-60px)]">
          {CHART_BAR_HEIGHTS.map((barHeight, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t"
              style={{ height: `${barHeight}%` }}
            />
          ))}
        </div>
      </div>
    );
  }
);
SkeletonChart.displayName = "SkeletonChart";

// Skeleton for stats/metrics
interface SkeletonStatsProps extends React.HTMLAttributes<HTMLDivElement> {
  count?: number;
}

const SkeletonStats = React.forwardRef<HTMLDivElement, SkeletonStatsProps>(
  ({ className, count = 4, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="presentation"
        aria-hidden="true"
        className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}
        {...props}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow"
          >
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }
);
SkeletonStats.displayName = "SkeletonStats";

// Skeleton for chart loading state - simple variant for lazy loading
interface ChartSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  height?: number;
}

const ChartSkeleton = React.forwardRef<HTMLDivElement, ChartSkeletonProps>(
  ({ className, height = 300, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="presentation"
        aria-hidden="true"
        className={cn(
          "animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800",
          "flex items-center justify-center",
          className
        )}
        style={{ height }}
        {...props}
      >
        {/* Animated chart placeholder lines */}
        <div className="w-4/5 h-3/5 relative">
          <div className="absolute inset-0 flex items-end gap-1">
            {[40, 65, 45, 80, 55, 70, 50, 85, 60, 75, 45, 55].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          {/* Trend line overlay */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            <polyline
              points="0,70 8,60 16,55 24,40 32,45 40,35 48,30 56,25 64,35 72,20 80,25 88,15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-gray-300 dark:text-gray-600"
            />
          </svg>
        </div>
      </div>
    );
  }
);
ChartSkeleton.displayName = "ChartSkeleton";

export { Skeleton, SkeletonCard, SkeletonTable, SkeletonChart, SkeletonStats, ChartSkeleton };
