"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Activity, Settings } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface IndicatorNodeProps extends NodeProps {
  data: StrategyNodeData & { label: string };
}

const indicatorColors: Record<string, { bg: string; border: string; icon: string }> = {
  rsi: {
    bg: "bg-purple-50 dark:bg-purple-900/30",
    border: "border-purple-300 dark:border-purple-700",
    icon: "bg-purple-500",
  },
  macd: {
    bg: "bg-indigo-50 dark:bg-indigo-900/30",
    border: "border-indigo-300 dark:border-indigo-700",
    icon: "bg-indigo-500",
  },
  ma: {
    bg: "bg-cyan-50 dark:bg-cyan-900/30",
    border: "border-cyan-300 dark:border-cyan-700",
    icon: "bg-cyan-500",
  },
  ema: {
    bg: "bg-teal-50 dark:bg-teal-900/30",
    border: "border-teal-300 dark:border-teal-700",
    icon: "bg-teal-500",
  },
  bollinger: {
    bg: "bg-violet-50 dark:bg-violet-900/30",
    border: "border-violet-300 dark:border-violet-700",
    icon: "bg-violet-500",
  },
  atr: {
    bg: "bg-amber-50 dark:bg-amber-900/30",
    border: "border-amber-300 dark:border-amber-700",
    icon: "bg-amber-500",
  },
  volume: {
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    border: "border-emerald-300 dark:border-emerald-700",
    icon: "bg-emerald-500",
  },
};

const indicatorLabels: Record<string, string> = {
  rsi: "RSI",
  macd: "MACD",
  ma: "Moving Average",
  ema: "Exponential MA",
  bollinger: "Bollinger Bands",
  atr: "ATR",
  volume: "Volume",
};

const IndicatorNode = memo(({ data, selected }: IndicatorNodeProps) => {
  const config = data.type === "indicator" ? data.config : null;
  const indicatorType = config?.indicatorType || "rsi";
  const colors = indicatorColors[indicatorType] || indicatorColors.rsi;

  return (
    <div
      className={cn(
        "min-w-[200px] rounded-lg border-2 bg-white dark:bg-gray-900 shadow-lg",
        "transition-all duration-200",
        selected
          ? `ring-2 ring-offset-1 ring-offset-white dark:ring-offset-gray-900`
          : ""
      )}
      style={{
        borderColor: selected ? "currentColor" : undefined,
      }}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white dark:!border-gray-900"
      />

      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-t-md border-b",
          colors.bg,
          colors.border
        )}
      >
        <div className={cn("p-1.5 rounded-md", colors.icon)}>
          <Activity className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
          {data.label || indicatorLabels[indicatorType]}
        </span>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Type Badge */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">Type:</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {indicatorLabels[indicatorType]}
          </span>
        </div>

        {/* Parameters */}
        <div className="flex items-center gap-1.5">
          <Settings className="w-3 h-3 text-gray-400" />
          <div className="flex flex-wrap gap-1">
            {config?.period && (
              <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
                Period: {config.period}
              </span>
            )}
            {config?.fastPeriod && (
              <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
                Fast: {config.fastPeriod}
              </span>
            )}
            {config?.slowPeriod && (
              <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
                Slow: {config.slowPeriod}
              </span>
            )}
            {config?.standardDeviations && (
              <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
                StdDev: {config.standardDeviations}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white dark:!border-gray-900"
      />
    </div>
  );
});

IndicatorNode.displayName = "IndicatorNode";

export { IndicatorNode };
