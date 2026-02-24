"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface CorrelationMatrixProps {
  symbols: string[];
  matrix: number[][]; // 2D array of correlations [-1, 1]
  className?: string;
}

/**
 * Get the background color for a correlation value
 * Color gradient:
 * - -1.0 to -0.5: Deep red
 * - -0.5 to 0: Light red
 * - 0: White/neutral
 * - 0 to 0.5: Light green
 * - 0.5 to 1.0: Deep green
 */
function getCorrelationColor(value: number): string {
  // Handle invalid values
  if (!Number.isFinite(value) || isNaN(value)) {
    return "rgb(200, 200, 200)"; // Gray for invalid values
  }

  // Clamp value between -1 and 1
  const clampedValue = Math.max(-1, Math.min(1, value));

  if (clampedValue === 0) {
    return "rgb(255, 255, 255)";
  }

  if (clampedValue < 0) {
    // Negative correlation - red scale
    const intensity = Math.abs(clampedValue);
    if (intensity >= 0.5) {
      // Deep red: interpolate from rgb(239, 68, 68) to rgb(185, 28, 28)
      const factor = (intensity - 0.5) * 2; // 0 to 1 for 0.5 to 1.0
      const r = Math.round(239 - factor * (239 - 185));
      const g = Math.round(68 - factor * 68);
      const b = Math.round(68 - factor * 68);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Light red: interpolate from rgb(255, 255, 255) to rgb(239, 68, 68)
      const factor = intensity * 2; // 0 to 1 for 0 to 0.5
      const r = Math.round(255 - factor * (255 - 239));
      const g = Math.round(255 - factor * (255 - 68));
      const b = Math.round(255 - factor * (255 - 68));
      return `rgb(${r}, ${g}, ${b})`;
    }
  } else {
    // Positive correlation - green scale
    const intensity = clampedValue;
    if (intensity >= 0.5) {
      // Deep green: interpolate from rgb(34, 197, 94) to rgb(22, 101, 52)
      const factor = (intensity - 0.5) * 2; // 0 to 1 for 0.5 to 1.0
      const r = Math.round(34 - factor * (34 - 22));
      const g = Math.round(197 - factor * (197 - 101));
      const b = Math.round(94 - factor * (94 - 52));
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Light green: interpolate from rgb(255, 255, 255) to rgb(34, 197, 94)
      const factor = intensity * 2; // 0 to 1 for 0 to 0.5
      const r = Math.round(255 - factor * (255 - 34));
      const g = Math.round(255 - factor * (255 - 197));
      const b = Math.round(255 - factor * (255 - 94));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
}

/**
 * Get text color based on background intensity
 */
function getTextColor(value: number): string {
  const absValue = Math.abs(value);
  // Use white text for dark backgrounds, dark text for light backgrounds
  if (absValue >= 0.5) {
    return "text-white";
  }
  return "text-stone-900 dark:text-neutral-100";
}

/**
 * Format correlation value for display
 */
function formatCorrelation(value: number): string {
  return value.toFixed(2);
}

/**
 * Color Legend Component
 */
function ColorLegend() {
  const gradientSteps = 11; // -1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1
  const values = Array.from({ length: gradientSteps }, (_, i) => -1 + (i * 2) / (gradientSteps - 1));

  return (
    <div className="flex items-center justify-center gap-4 mt-6">
      <span className="text-xs text-stone-500 dark:text-neutral-400 font-medium">-1.0</span>
      <div className="flex h-3 rounded overflow-hidden shadow-sm">
        {values.map((value, index) => (
          <div
            key={index}
            className="w-6 h-3"
            style={{ backgroundColor: getCorrelationColor(value) }}
          />
        ))}
      </div>
      <span className="text-xs text-stone-500 dark:text-neutral-400 font-medium">+1.0</span>
      <div className="flex items-center gap-2 ml-4 text-xs text-stone-500 dark:text-neutral-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-red-600"></span>
          Negative
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-white border border-stone-300"></span>
          Neutral
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-green-600"></span>
          Positive
        </span>
      </div>
    </div>
  );
}

export function CorrelationMatrix({
  symbols,
  matrix,
  className,
}: CorrelationMatrixProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  // Memoized color cache - pre-compute colors for all unique values in matrix
  const colorCache = useMemo(() => {
    const cache: Record<string, string> = {};
    // Pre-compute colors for all unique values in matrix
    const uniqueValues = new Set<number>();
    matrix.forEach(row => row.forEach(val => uniqueValues.add(val)));
    uniqueValues.forEach(val => {
      cache[val.toFixed(2)] = getCorrelationColor(val);
    });
    return cache;
  }, [matrix]);

  // Validate matrix dimensions
  const isValidMatrix = useMemo(() => {
    if (!matrix || !symbols || symbols.length === 0) return false;
    if (matrix.length !== symbols.length) return false;
    return matrix.every((row) => row.length === symbols.length);
  }, [matrix, symbols]);

  // Handle cell hover
  const handleMouseEnter = useCallback((row: number, col: number) => {
    setHoveredCell({ row, col });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredCell(null);
  }, []);

  // Check if a cell should be highlighted
  const isHighlighted = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (!hoveredCell) return false;
      return (
        rowIndex === hoveredCell.row ||
        colIndex === hoveredCell.col ||
        (rowIndex === hoveredCell.row && colIndex === hoveredCell.col)
      );
    },
    [hoveredCell]
  );

  // Calculate cell size based on number of symbols (responsive)
  const cellSize = useMemo(() => {
    const symbolCount = symbols.length;
    if (symbolCount <= 5) return "w-16 h-16 min-w-[64px]";
    if (symbolCount <= 10) return "w-14 h-14 min-w-[56px]";
    if (symbolCount <= 15) return "w-12 h-12 min-w-[48px]";
    return "w-10 h-10 min-w-[40px]";
  }, [symbols.length]);

  const textSize = useMemo(() => {
    const symbolCount = symbols.length;
    if (symbolCount <= 5) return "text-sm";
    if (symbolCount <= 10) return "text-xs";
    return "text-[10px]";
  }, [symbols.length]);

  if (!isValidMatrix) {
    return (
      <div className={cn("flex items-center justify-center h-64 bg-stone-50 dark:bg-neutral-800 rounded-lg", className)}>
        <div className="text-center">
          <p className="font-medium text-stone-700 dark:text-neutral-300">Invalid Correlation Data</p>
          <p className="text-sm text-stone-500 dark:text-neutral-400 mt-1">
            Matrix dimensions must match symbol count
          </p>
        </div>
      </div>
    );
  }

  if (symbols.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-64 bg-stone-50 dark:bg-neutral-800 rounded-lg", className)}>
        <div className="text-center">
          <p className="font-medium text-stone-700 dark:text-neutral-300">No Data Available</p>
          <p className="text-sm text-stone-500 dark:text-neutral-400 mt-1">
            Add assets to view correlation matrix
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full overflow-auto", className)} role="region" aria-label="Correlation matrix">
      <div className="inline-block min-w-full" role="grid" aria-rowcount={symbols.length + 1} aria-colcount={symbols.length + 1}>
        {/* Matrix Container */}
        <div className="flex">
          {/* Left margin for row labels */}
          <div className="flex-shrink-0" role="presentation">
            {/* Empty top-left corner */}
            <div className={cn("h-12", cellSize)} role="presentation" />
            {/* Row labels */}
            {symbols.map((symbol, rowIndex) => (
              <div
                key={`row-label-${rowIndex}`}
                role="rowheader"
                className={cn(
                  "flex items-center justify-end pr-2 font-medium text-stone-700 dark:text-neutral-300",
                  cellSize,
                  "text-xs sm:text-sm",
                  hoveredCell?.row === rowIndex && "bg-stone-100 dark:bg-neutral-700 rounded-l"
                )}
              >
                <span className="truncate max-w-[60px] sm:max-w-[80px]">{symbol}</span>
              </div>
            ))}
          </div>

          {/* Matrix Grid */}
          <div role="presentation">
            {/* Column headers */}
            <div className="flex" role="row">
              {symbols.map((symbol, colIndex) => (
                <div
                  key={`col-header-${colIndex}`}
                  role="columnheader"
                  className={cn(
                    "flex items-end justify-center font-medium text-stone-700 dark:text-neutral-300",
                    cellSize,
                    "text-xs sm:text-sm",
                    hoveredCell?.col === colIndex && "bg-stone-100 dark:bg-neutral-700 rounded-t"
                  )}
                >
                  <span
                    className="truncate max-w-[64px] transform -rotate-45 origin-top-left translate-y-4"
                    title={symbol}
                  >
                    {symbol}
                  </span>
                </div>
              ))}
            </div>

            {/* Matrix cells */}
            {matrix.map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className="flex" role="row">
                {row.map((value, colIndex) => {
                  const correlation = value;
                  const isDiagonal = rowIndex === colIndex;
                  const highlighted = isHighlighted(rowIndex, colIndex);
                  // Use cached color for better performance
                  const bgColor = colorCache[correlation.toFixed(2)] || getCorrelationColor(correlation);
                  const textColor = getTextColor(correlation);

                  return (
                    <div
                      key={`cell-${rowIndex}-${colIndex}`}
                      role="gridcell"
                      tabIndex={0}
                      className={cn(
                        "relative flex items-center justify-center transition-all duration-150 cursor-pointer",
                        cellSize,
                        "border border-stone-200 dark:border-neutral-600",
                        "rounded-md m-0.5",
                        highlighted && "ring-2 ring-emerald-400 ring-offset-1 z-10",
                        isDiagonal && "font-bold"
                      )}
                      style={{ backgroundColor: bgColor }}
                      onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
                      onMouseLeave={handleMouseLeave}
                      onFocus={() => handleMouseEnter(rowIndex, colIndex)}
                      onBlur={handleMouseLeave}
                      aria-label={`${symbols[rowIndex]} vs ${symbols[colIndex]}: correlation ${formatCorrelation(correlation)}`}
                    >
                      <span
                        className={cn(
                          "font-mono",
                          textSize,
                          textColor,
                          "select-none"
                        )}
                        aria-hidden="true"
                      >
                        {formatCorrelation(correlation)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <ColorLegend />
      </div>
    </div>
  );
}

export default CorrelationMatrix;

