"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { successColors, dangerColors } from "@/lib/design-system/colors";

export interface ChartTooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  dataKey?: string;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<ChartTooltipPayloadItem>;
  label?: string;
  showChange?: boolean;
  previousValue?: number;
  formatter?: (value: number) => string;
  labelFormatter?: (label: string) => string;
  className?: string;
}

/**
 * Professional glass-morphism styled tooltip for charts.
 * Supports percentage change display and custom formatting.
 */
export function ChartTooltip(props: ChartTooltipProps) {
  const {
    active,
    payload,
    label,
    showChange = false,
    previousValue,
    formatter,
    labelFormatter,
    className,
  } = props;

  if (!active || !payload || payload.length === 0) {
    return null;
  }

  // Calculate percentage change if enabled and previous value provided
  const calculateChange = (currentValue: number): { value: number; isPositive: boolean } | null => {
    if (!showChange || previousValue === undefined || previousValue === null || previousValue === 0) {
      return null;
    }

    const change = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
    return {
      value: change,
      isPositive: change >= 0,
    };
  };

  const defaultFormatter = (value: number): string => {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const defaultLabelFormatter = (lbl: string): string => {
    return lbl;
  };

  const formatValue = formatter || defaultFormatter;
  const formatLabel = labelFormatter || defaultLabelFormatter;

  return (
    <div
      className={cn(
        "glass-tooltip min-w-[120px] max-w-[280px]",
        "animate-in fade-in-0 zoom-in-95 duration-150",
        className
      )}
    >
      {/* Label */}
      {label && (
        <div className="mb-2 pb-2 border-b border-gray-200/50 dark:border-gray-700/50">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {formatLabel(label)}
          </p>
        </div>
      )}

      {/* Payload Items */}
      <div className="space-y-1.5">
        {payload.map((item, index) => {
          const change = calculateChange(item.value);

          return (
            <div key={`${item.dataKey || item.name}-${index}`} className="flex items-start gap-2">
              {/* Color Indicator */}
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />

              {/* Name and Value */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {item.name}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatValue(item.value)}
                  </span>
                </div>

                {/* Change Indicator */}
                {change && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className="text-xs font-medium"
                      style={{
                        color: change.isPositive ? successColors[600] : dangerColors[600],
                      }}
                    >
                      {change.isPositive ? "+" : ""}
                      {change.value.toFixed(2)}%
                    </span>
                    <svg
                      className={cn(
                        "w-3 h-3",
                        !change.isPositive && "rotate-180"
                      )}
                      style={{
                        color: change.isPositive ? successColors[600] : dangerColors[600],
                      }}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
