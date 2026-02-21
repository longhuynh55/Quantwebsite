"use client";

import * as React from "react";
import {
  ReferenceLine,
  Label,
} from "recharts";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  EyeOff,
  Settings,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

export interface IndicatorConfig {
  id: string;
  name: string;
  type: "sma" | "ema" | "rsi" | "macd" | "bollinger" | "volume" | "custom";
  color: string;
  lineWidth?: number;
  visible: boolean;
  parameters: Record<string, number | string | boolean>;
  data?: Array<{ time: string; value: number }>;
}

export interface IndicatorOverlayProps {
  indicators: IndicatorConfig[];
  onToggleIndicator?: (id: string) => void;
  onUpdateIndicator?: (id: string, updates: Partial<IndicatorConfig>) => void;
  onRemoveIndicator?: (id: string) => void;
  onAddIndicator?: () => void;
  className?: string;
  compact?: boolean;
}

const INDICATOR_LABELS: Record<string, string> = {
  sma: "SMA",
  ema: "EMA",
  rsi: "RSI",
  macd: "MACD",
  bollinger: "BB",
  volume: "Vol",
  custom: "Custom",
};

export function IndicatorOverlay({
  indicators,
  onToggleIndicator,
  onUpdateIndicator,
  onRemoveIndicator,
  onAddIndicator,
  className,
  compact = false,
}: IndicatorOverlayProps) {
  const [expandedIndicator, setExpandedIndicator] = React.useState<string | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);

  const toggleExpand = (id: string) => {
    setExpandedIndicator(expandedIndicator === id ? null : id);
  };

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 flex-wrap",
          className
        )}
      >
        {indicators.map((indicator) => (
          <Badge
            key={indicator.id}
            variant={indicator.visible ? "default" : "outline"}
            className={cn(
              "cursor-pointer transition-colors",
              indicator.visible
                ? "bg-gray-800 dark:bg-gray-200 hover:bg-gray-700 dark:hover:bg-gray-300"
                : "opacity-50"
            )}
            style={{
              borderColor: indicator.color,
              color: indicator.visible ? undefined : indicator.color,
            }}
            onClick={() => onToggleIndicator?.(indicator.id)}
          >
            <span
              className="w-2 h-2 rounded-full mr-1.5"
              style={{ backgroundColor: indicator.color }}
            />
            {INDICATOR_LABELS[indicator.type] || indicator.type}
            {indicator.parameters.period && `(${indicator.parameters.period})`}
          </Badge>
        ))}

        {onAddIndicator && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddIndicator}
            className="h-6 text-xs px-2"
          >
            + Add
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Indicators</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="h-7 w-7 p-0"
            aria-label="Indicator settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 px-4 pb-3">
        <div className="space-y-1">
          {indicators.map((indicator) => (
            <div key={indicator.id} className="rounded-md border border-gray-100 dark:border-gray-700">
              {/* Indicator Header */}
              <div
                className={cn(
                  "flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md",
                  !indicator.visible && "opacity-60"
                )}
                onClick={() => toggleExpand(indicator.id)}
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleIndicator?.(indicator.id);
                    }}
                    className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    aria-label={indicator.visible ? "Hide indicator" : "Show indicator"}
                  >
                    {indicator.visible ? (
                      <Eye className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                    )}
                  </button>

                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: indicator.color }}
                  />

                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {indicator.name}
                  </span>

                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({INDICATOR_LABELS[indicator.type]})
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {onRemoveIndicator && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveIndicator(indicator.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                      aria-label="Remove indicator"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {expandedIndicator === indicator.id ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Settings */}
              {expandedIndicator === indicator.id && showSettings && (
                <div className="px-2 pb-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Color Picker */}
                    <div className="space-y-1">
                      <label className="text-gray-500 dark:text-gray-400">Color</label>
                      <input
                        type="color"
                        value={indicator.color}
                        onChange={(e) =>
                          onUpdateIndicator?.(indicator.id, { color: e.target.value })
                        }
                        className="w-full h-6 rounded cursor-pointer"
                      />
                    </div>

                    {/* Line Width */}
                    <div className="space-y-1">
                      <label className="text-gray-500 dark:text-gray-400">Line Width</label>
                      <select
                        value={indicator.lineWidth || 2}
                        onChange={(e) =>
                          onUpdateIndicator?.(indicator.id, {
                            lineWidth: Number(e.target.value),
                          })
                        }
                        className="w-full h-6 px-1 text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                      >
                        <option value={1}>1px</option>
                        <option value={2}>2px</option>
                        <option value={3}>3px</option>
                        <option value={4}>4px</option>
                      </select>
                    </div>

                    {/* Period Parameter */}
                    {indicator.parameters.period !== undefined && (
                      <div className="space-y-1 col-span-2">
                        <label className="text-gray-500 dark:text-gray-400">Period</label>
                        <input
                          type="number"
                          value={typeof indicator.parameters.period === 'number' ? indicator.parameters.period : 0}
                          onChange={(e) =>
                            onUpdateIndicator?.(indicator.id, {
                              parameters: {
                                ...indicator.parameters,
                                period: Number(e.target.value),
                              },
                            })
                          }
                          min={1}
                          max={200}
                          className="w-full h-6 px-2 text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {indicators.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No indicators added yet
            </p>
          )}
        </div>

        {onAddIndicator && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddIndicator}
            className="w-full mt-2"
          >
            Add Indicator
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Helper component to render indicator reference lines
export interface IndicatorReferenceLinesProps {
  indicators: IndicatorConfig[];
  dataKey?: string;
}

export function IndicatorReferenceLines({
  indicators,
}: IndicatorReferenceLinesProps) {
  const visibleIndicators = indicators.filter((ind) => ind.visible);

  return (
    <>
      {visibleIndicators.map((indicator) => {
        // Get the latest value from indicator data
        const lastValue = indicator.data?.[indicator.data.length - 1]?.value;

        if (lastValue === undefined) return null;

        return (
          <ReferenceLine
            key={indicator.id}
            y={lastValue}
            stroke={indicator.color}
            strokeDasharray="3 3"
            strokeWidth={1}
            opacity={0.7}
            label={
              <Label
                value={INDICATOR_LABELS[indicator.type] || indicator.type}
                position="right"
                fill={indicator.color}
                fontSize={10}
              />
            }
          />
        );
      })}
    </>
  );
}

// Indicator preset configurations
export const INDICATOR_PRESETS: Array<{
  name: string;
  type: IndicatorConfig["type"];
  defaultParameters: Record<string, number | string | boolean>;
  defaultColor: string;
}> = [
  {
    name: "SMA 20",
    type: "sma",
    defaultParameters: { period: 20 },
    defaultColor: "#f59e0b",
  },
  {
    name: "SMA 50",
    type: "sma",
    defaultParameters: { period: 50 },
    defaultColor: "#8b5cf6",
  },
  {
    name: "EMA 12",
    type: "ema",
    defaultParameters: { period: 12 },
    defaultColor: "#3b82f6",
  },
  {
    name: "EMA 26",
    type: "ema",
    defaultParameters: { period: 26 },
    defaultColor: "#ef4444",
  },
  {
    name: "RSI 14",
    type: "rsi",
    defaultParameters: { period: 14 },
    defaultColor: "#10b981",
  },
  {
    name: "Bollinger Bands",
    type: "bollinger",
    defaultParameters: { period: 20, stdDev: 2 },
    defaultColor: "#6366f1",
  },
];

export default IndicatorOverlay;
