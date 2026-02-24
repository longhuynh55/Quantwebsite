"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Database, Calendar, TrendingUp, AlertCircle } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface DataSourceNodeProps extends NodeProps {
  data: StrategyNodeData & { label: string };
}

const DataSourceNode = memo(({ data, selected }: DataSourceNodeProps) => {
  const config = data.type === "dataSource" ? data.config : null;
  const hasWarning = !config || config.stocks.length === 0;

  const stocks = config?.stocks || [];
  const stocksDisplay =
    stocks.length > 3
      ? `${stocks.slice(0, 3).join(", ")}… +${stocks.length - 3}`
      : stocks.join(", ");

  return (
    <div
      className={cn(
        "min-w-[240px] bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-700 shadow-sm rounded-lg overflow-hidden",
        "border-l-4 border-l-emerald-500",
        "transition-all duration-200",
        selected && "ring-2 ring-emerald-500/40 shadow-md"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2">
        <div className="flex items-center justify-center w-7 h-7 rounded bg-emerald-500 flex-shrink-0">
          <Database className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-neutral-500 leading-none mb-0.5">
            DATA SOURCE
          </div>
          <div className="text-sm font-semibold text-stone-900 dark:text-white truncate">
            {data.label || "Data Source"}
          </div>
        </div>
        {hasWarning && (
          <div className="flex-shrink-0" title="No stocks selected">
            <AlertCircle className="w-4 h-4 text-amber-500 animate-pulse" />
          </div>
        )}
      </div>

      {/* Parameters — natural language style */}
      <div className="border-t border-stone-100 dark:border-neutral-800 px-3 py-2 space-y-1.5">
        {stocks.length > 0 ? (
          <div className="flex items-start gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-stone-700 dark:text-neutral-300 leading-relaxed">
              Load <strong className="text-stone-900 dark:text-white">{stocksDisplay}</strong> data
            </span>
          </div>
        ) : (
          <div className="text-xs text-stone-400 dark:text-neutral-500 italic">
            No stocks selected
          </div>
        )}

        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-stone-400 dark:text-neutral-500 flex-shrink-0" />
          <span className="text-xs text-stone-600 dark:text-neutral-400">
            {config?.timeframe || "Daily"}
            {config?.startDate && config?.endDate && (
              <> · {config.startDate} → {config.endDate}</>
            )}
          </span>
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white dark:!border-neutral-900"
      />
    </div>
  );
});

DataSourceNode.displayName = "DataSourceNode";

export { DataSourceNode };
