"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Filter, ArrowUp, ArrowDown, TrendingUp, BarChart3 } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface FilterNodeProps extends NodeProps {
  data: StrategyNodeData & { label: string };
}

const filterTypeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  price_above: { icon: ArrowUp, color: "text-green-600 dark:text-green-400", label: "Price Above" },
  price_below: { icon: ArrowDown, color: "text-red-600 dark:text-red-400", label: "Price Below" },
  volume_above: { icon: BarChart3, color: "text-blue-600 dark:text-blue-400", label: "Volume Above" },
  volume_below: { icon: BarChart3, color: "text-blue-600 dark:text-blue-400", label: "Volume Below" },
  rsi_overbought: { icon: TrendingUp, color: "text-orange-600 dark:text-orange-400", label: "RSI Overbought" },
  rsi_oversold: { icon: TrendingUp, color: "text-teal-600 dark:text-teal-400", label: "RSI Oversold" },
};

const comparisonSymbols: Record<string, string> = {
  ">": ">",
  "<": "<",
  ">=": ">=",
  "<=": "<=",
  "==": "=",
  "!=": "!=",
};

const FilterNode = memo(({ data, selected }: FilterNodeProps) => {
  const config = data.type === "filter" ? data.config : null;
  const filterType = config?.filterType || "price_above";
  const filterConfig = filterTypeConfig[filterType] || filterTypeConfig.price_above;
  const Icon = filterConfig.icon;

  return (
    <div
      className={cn(
        "min-w-[180px] rounded-lg border-2 bg-white dark:bg-gray-900 shadow-lg",
        "transition-all duration-200",
        selected
          ? "border-orange-500 ring-2 ring-orange-500/30"
          : "border-orange-300 dark:border-orange-700 hover:border-orange-400 dark:hover:border-orange-600"
      )}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white dark:!border-gray-900"
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-900/30 rounded-t-md border-b border-orange-200 dark:border-orange-800">
        <div className="p-1.5 bg-orange-500 rounded-md">
          <Filter className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-orange-900 dark:text-orange-100">
          {data.label || "Filter"}
        </span>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Filter Type */}
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", filterConfig.color)} />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {filterConfig.label}
          </span>
        </div>

        {/* Condition */}
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">Condition:</span>
          <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">
            {comparisonSymbols[config?.comparisonOperator || ">"]} {config?.value || 0}
          </span>
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white dark:!border-gray-900"
      />
    </div>
  );
});

FilterNode.displayName = "FilterNode";

export { FilterNode };
