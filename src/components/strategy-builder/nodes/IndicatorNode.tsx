"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Activity, Settings } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface IndicatorNodeProps extends NodeProps {
  data: StrategyNodeData & { label: string };
}

const indicatorColors: Record<string, string> = {
  rsi: "bg-blue-500",
  macd: "bg-teal-500",
  ma: "bg-amber-500",
  ema: "bg-orange-500",
  bollinger: "bg-rose-500",
  atr: "bg-amber-500",
  volume: "bg-cyan-500",
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
  const iconBg = indicatorColors[indicatorType] || "bg-blue-500";

  // Build natural language description
  const buildDescription = () => {
    const parts: string[] = [];
    if (config?.period) parts.push(`${config.period}-period`);
    if (config?.fastPeriod && config?.slowPeriod) {
      parts.push(`Fast ${config.fastPeriod} / Slow ${config.slowPeriod}`);
    }
    if (config?.standardDeviations) parts.push(`${config.standardDeviations}σ`);
    return parts.join(" · ");
  };

  return (
    <div
      className={cn(
        "min-w-[220px] bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-700 shadow-sm rounded-lg overflow-hidden",
        "border-l-4 border-l-blue-500",
        "transition-all duration-200",
        selected && "ring-2 ring-blue-500/40 shadow-md"
      )}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-stone-400 !border-2 !border-white dark:!border-neutral-900"
      />

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2">
        <div className={cn("flex items-center justify-center w-7 h-7 rounded flex-shrink-0", iconBg)}>
          <Activity className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-neutral-500 leading-none mb-0.5">
            INDICATOR
          </div>
          <div className="text-sm font-semibold text-stone-900 dark:text-white truncate">
            {data.label || indicatorLabels[indicatorType]}
          </div>
        </div>
      </div>

      {/* Parameters */}
      <div className="border-t border-stone-100 dark:border-neutral-800 px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            {indicatorLabels[indicatorType]}
          </span>
        </div>

        {buildDescription() && (
          <div className="flex items-center gap-1.5">
            <Settings className="w-3 h-3 text-stone-400 dark:text-neutral-500 flex-shrink-0" />
            <span className="text-xs text-stone-600 dark:text-neutral-400">
              {buildDescription()}
            </span>
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white dark:!border-neutral-900"
      />
    </div>
  );
});

IndicatorNode.displayName = "IndicatorNode";

export { IndicatorNode };
