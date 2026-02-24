"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Filter } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface FilterNodeProps extends NodeProps {
  data: StrategyNodeData & { label: string };
}

const filterTypeLabels: Record<string, string> = {
  price_above: "Price Above",
  price_below: "Price Below",
  volume_above: "Volume Above",
  volume_below: "Volume Below",
  rsi_overbought: "RSI Overbought",
  rsi_oversold: "RSI Oversold",
};

const comparisonSymbols: Record<string, string> = {
  ">": ">",
  "<": "<",
  ">=": "≥",
  "<=": "≤",
  "==": "=",
  "!=": "≠",
};

const FilterNode = memo(({ data, selected }: FilterNodeProps) => {
  const config = data.type === "filter" ? data.config : null;
  const filterType = config?.filterType || "price_above";
  const op = comparisonSymbols[config?.comparisonOperator || ">"] || ">";
  const value = config?.value || 0;

  return (
    <div
      className={cn(
        "min-w-[200px] bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-700 shadow-sm rounded-lg overflow-hidden",
        "border-l-4 border-l-orange-500",
        "transition-all duration-200",
        selected && "ring-2 ring-orange-500/40 shadow-md"
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
        <div className="flex items-center justify-center w-7 h-7 rounded bg-orange-500 flex-shrink-0">
          <Filter className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-neutral-500 leading-none mb-0.5">
            FILTER
          </div>
          <div className="text-sm font-semibold text-stone-900 dark:text-white truncate">
            {data.label || "Filter"}
          </div>
        </div>
      </div>

      {/* Natural language condition */}
      <div className="border-t border-stone-100 dark:border-neutral-800 px-3 py-2">
        <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/50 px-2.5 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">IF</span>
          <span className="text-xs font-medium text-stone-800 dark:text-neutral-200">
            {filterTypeLabels[filterType]} {op} <strong className="font-mono">{value}</strong>
          </span>
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white dark:!border-neutral-900"
      />
    </div>
  );
});

FilterNode.displayName = "FilterNode";

export { FilterNode };
