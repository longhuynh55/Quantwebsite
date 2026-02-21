"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Database, Calendar, TrendingUp } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface DataSourceNodeProps extends NodeProps {
  data: StrategyNodeData & { label: string };
}

const DataSourceNode = memo(({ data, selected }: DataSourceNodeProps) => {
  const config = data.type === "dataSource" ? data.config : null;

  return (
    <div
      className={cn(
        "min-w-[220px] rounded-lg border-2 bg-white dark:bg-gray-900 shadow-lg",
        "transition-all duration-200",
        selected
          ? "border-blue-500 ring-2 ring-blue-500/30"
          : "border-blue-300 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-600"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-t-md border-b border-blue-200 dark:border-blue-800">
        <div className="p-1.5 bg-blue-500 rounded-md">
          <Database className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-blue-900 dark:text-blue-100">
          {data.label || "Data Source"}
        </span>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Stocks */}
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          <span className="text-xs text-gray-600 dark:text-gray-300">
            {config?.stocks?.length ? (
              config.stocks.length > 3
                ? `${config.stocks.slice(0, 3).join(", ")}... +${config.stocks.length - 3}`
                : config.stocks.join(", ")
            ) : (
              <span className="text-gray-400 dark:text-gray-500 italic">No stocks selected</span>
            )}
          </span>
        </div>

        {/* Timeframe */}
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          <span className="text-xs text-gray-600 dark:text-gray-300">
            {config?.timeframe || "Daily"}
          </span>
        </div>

        {/* Date Range */}
        {config?.startDate && config?.endDate && (
          <div className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
            {config.startDate} to {config.endDate}
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white dark:!border-gray-900"
      />
    </div>
  );
});

DataSourceNode.displayName = "DataSourceNode";

export { DataSourceNode };
