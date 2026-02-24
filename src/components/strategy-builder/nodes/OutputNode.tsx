"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { BarChart2, Activity } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface OutputNodeProps extends NodeProps {
  data: StrategyNodeData & { label: string };
}

const metricLabels: Record<string, string> = {
  returns: "Total Returns",
  sharpe: "Sharpe Ratio",
  drawdown: "Max Drawdown",
  winrate: "Win Rate",
  profit: "Net Profit",
  trades: "Total Trades",
};

const OutputNode = memo(({ data, selected }: OutputNodeProps) => {
  const config = data.type === "output" ? data.config : null;
  const metrics = config?.metrics || ["returns", "sharpe"];

  return (
    <div
      className={cn(
        "min-w-[200px] bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-700 shadow-sm rounded-lg overflow-hidden",
        "border-l-4 border-l-stone-800 dark:border-l-stone-400",
        "transition-all duration-200",
        selected && "ring-2 ring-stone-500/40 shadow-md"
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
        <div className="flex items-center justify-center w-7 h-7 rounded bg-stone-800 dark:bg-stone-500 flex-shrink-0">
          <BarChart2 className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-neutral-500 leading-none mb-0.5">
            OUTPUT
          </div>
          <div className="text-sm font-semibold text-stone-900 dark:text-white truncate">
            {data.label || "Performance Output"}
          </div>
        </div>
      </div>

      {/* Metrics list */}
      <div className="border-t border-stone-100 dark:border-neutral-800 px-3 py-2">
        {metrics.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {metrics.map((metric) => (
              <span
                key={metric}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-400"
              >
                <Activity className="w-2.5 h-2.5" />
                {metricLabels[metric] || metric}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-xs text-stone-400 dark:text-neutral-500 italic">
            No metrics selected
          </div>
        )}
      </div>

      {/* No output handle — terminal node */}
    </div>
  );
});

OutputNode.displayName = "OutputNode";

export { OutputNode };
