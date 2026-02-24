"use client";

import { forwardRef, useMemo, memo } from "react";
import { cn } from "@/lib/utils";
import { getTrendColor, primaryColors } from "@/lib/design-system/colors";

interface SparklineProps {
  /** Array of numeric values to display */
  data: number[];
  /** Width of the sparkline in pixels (default: 80) */
  width?: number;
  /** Height of the sparkline in pixels (default: 24) */
  height?: number;
  /** Line color (overridden by trend if provided) */
  color?: string;
  /** Whether to show area fill under the line */
  showArea?: boolean;
  /** Auto-color based on trend direction */
  trend?: "up" | "down" | "neutral";
  /** Additional CSS classes */
  className?: string;
  /** Whether to animate on mount (default: true) */
  animate?: boolean;
  /** Stroke width in pixels (default: 1.5) */
  strokeWidth?: number;
  /** Whether to show dots at data points */
  showDots?: boolean;
  /** Accessible label for the sparkline */
  ariaLabel?: string;
}

/**
 * Sparkline - Lightweight SVG-based inline charts for tables and metric cards
 *
 * Features:
 * - Pure SVG implementation (no external libraries)
 * - Smooth bezier curves for natural-looking lines
 * - Optional area fill with low opacity
 * - CSS-based animation on mount
 * - Auto-coloring based on trend direction
 * - Dark mode support
 *
 * @example
 * // Basic usage
 * <Sparkline data={[1, 2, 3, 4, 5]} />
 *
 * @example
 * // With trend coloring and area fill
 * <Sparkline data={[10, 15, 12, 18, 22]} trend="up" showArea />
 *
 * @example
 * // Custom styling
 * <Sparkline
 *   data={[100, 95, 88, 92, 85]}
 *   width={120}
 *   height={32}
 *   color="#8b5cf6"
 *   showDots
 * />
 */
export const Sparkline = memo(
  forwardRef<SVGSVGElement, SparklineProps>(
    (
      {
        data,
        width = 80,
        height = 24,
        color,
        showArea = false,
        trend,
        className,
        animate = true,
        strokeWidth = 1.5,
        showDots = false,
        ariaLabel,
      },
      ref
    ) => {
      // Calculate the line color based on trend or use provided color
      const lineColor = useMemo(() => {
        if (trend) {
          return getTrendColor(trend);
        }
        return color || primaryColors[600];
      }, [trend, color]);

      // Area fill color with transparency
      const areaColor = useMemo(() => {
        return `${lineColor}20`; // 20 = ~12% opacity in hex
      }, [lineColor]);

      // Calculate paths and scaling
      const { linePath, areaPath, dots, isEmpty } = useMemo(() => {
        if (!data || data.length < 2) {
          return { linePath: "", areaPath: "", dots: [], isEmpty: true };
        }

        // Filter out NaN/null values and get valid data points
        const validData = data.filter(
          (v): v is number => typeof v === "number" && !isNaN(v) && isFinite(v)
        );

        if (validData.length < 2) {
          return { linePath: "", areaPath: "", dots: [], isEmpty: true };
        }

        const min = Math.min(...validData);
        const max = Math.max(...validData);
        const range = max - min;

        // Handle edge case where all values are the same
        const safeRange = range === 0 ? 1 : range;

        // Padding to prevent line from touching edges
        const padding = strokeWidth / 2 + 1;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        // Calculate points
        const points = validData.map((value, index) => {
          const x = padding + (index / (validData.length - 1)) * chartWidth;
          // Invert Y because SVG Y increases downward
          const y = padding + chartHeight - ((value - min) / safeRange) * chartHeight;
          return { x, y, value };
        });

        // Generate smooth bezier curve path
        let path = "";
        if (points.length >= 2) {
          // Start at first point
          path = `M ${points[0].x} ${points[0].y}`;

          // Use quadratic bezier curves for smooth lines
          for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];

            if (i === 1) {
              // First segment - simple line to second point with slight curve
              const cpX = prev.x + (curr.x - prev.x) * 0.5;
              path += ` Q ${cpX} ${prev.y} ${curr.x} ${curr.y}`;
            } else if (i === points.length - 1) {
              // Last segment
              const cpX = prev.x + (curr.x - prev.x) * 0.5;
              path += ` Q ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
            } else {
              // Middle segments - smooth curve
              const cp1X = prev.x + (curr.x - prev.x) * 0.4;
              const cp2X = curr.x - (next.x - curr.x) * 0.4;
              path += ` C ${cp1X} ${prev.y} ${cp2X} ${curr.y} ${curr.x} ${curr.y}`;
            }
          }
        }

        // Generate area path (line path + bottom fill)
        let area = "";
        if (showArea && points.length >= 2) {
          area = path;
          area += ` L ${points[points.length - 1].x} ${height - padding}`;
          area += ` L ${points[0].x} ${height - padding}`;
          area += " Z";
        }

        return {
          linePath: path,
          areaPath: area,
          dots: showDots ? points : [],
          isEmpty: false,
        };
      }, [data, width, height, strokeWidth, showDots, showArea]);

      // Generate accessible label
      const computedAriaLabel = useMemo(() => {
        if (ariaLabel) return ariaLabel;
        if (isEmpty || !data) return "Empty sparkline";

        const validData = data.filter(
          (v): v is number => typeof v === "number" && !isNaN(v)
        );
        if (validData.length === 0) return "Empty sparkline";

        const first = validData[0];
        const last = validData[validData.length - 1];
        const change = ((last - first) / Math.abs(first)) * 100;
        const trendText =
          change > 0 ? "increasing" : change < 0 ? "decreasing" : "stable";

        return `Sparkline showing ${trendText} trend from ${first.toFixed(
          2
        )} to ${last.toFixed(2)}`;
      }, [ariaLabel, isEmpty, data]);

      // Handle empty or invalid data
      if (isEmpty) {
        return (
          <svg
            ref={ref}
            width={width}
            height={height}
            className={cn("inline-block", className)}
            aria-label={computedAriaLabel}
            role="img"
          >
            <line
              x1="0"
              y1={height / 2}
              x2={width}
              y2={height / 2}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeDasharray="2 2"
              className="text-stone-300 dark:text-neutral-600"
            />
          </svg>
        );
      }

      return (
        <svg
          ref={ref}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className={cn("inline-block overflow-visible", className)}
          aria-label={computedAriaLabel}
          role="img"
        >
          {/* Area fill */}
          {showArea && areaPath && (
            <path
              d={areaPath}
              fill={areaColor}
              className={cn(animate && "sparkline-area")}
            />
          )}

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(animate && "sparkline-path")}
          />

          {/* Data point dots */}
          {showDots &&
            dots.map((dot, index) => (
              <circle
                key={index}
                cx={dot.x}
                cy={dot.y}
                r={strokeWidth + 0.5}
                fill={lineColor}
                className={cn(
                  animate && "sparkline-dot",
                  index === dots.length - 1 && "sparkline-dot-last"
                )}
                style={
                  animate
                    ? { animationDelay: `${index * 50}ms` }
                    : undefined
                }
              />
            ))}
        </svg>
      );
    }
  ),
  // Custom comparator for data array
  (prevProps, nextProps) => {
    if (prevProps.data.length !== nextProps.data.length) return false;
    return prevProps.data.every((v, i) => v === nextProps.data[i]);
  }
);

Sparkline.displayName = "Sparkline";

export default Sparkline;
