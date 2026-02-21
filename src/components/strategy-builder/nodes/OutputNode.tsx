"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { BarChart2, TrendingUp, Percent, DollarSign, Activity } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface OutputNodeProps extends NodeProps {
  data: StrategyNodeData & { label: string };
}

const metricIcons: Record<string, React.ElementType> = {
  returns: TrendingUp,
  sharpe: Activity,
  drawdown: BarChart2,
  winrate: Percent,
  profit: DollarSign,
};

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
        "min-w-[200px] rounded-lg border-2 bg-white dark:bg-gray-900 shadow-lg",
        "transition-all duration-200",
        selected
          ? "border-emerald-500 ring-2 ring-emerald-500/30"
          : "border-emerald-300 dark:border-emerald-700 hover:border-emerald-400 dark:hover:border-emerald-600"
      )}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white dark:!border-gray-900"
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-t-md border-b border-emerald-200 dark:border-emerald-800">
        <div className="p-1.5 bg-emerald-500 rounded-md">
          <BarChart2 className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-emerald-900 dark:text-emerald-100">
          {data.label || "Output"}
        </span>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Metrics to display:</div>
        <div className="space-y-1">
          {metrics.map((metric) => {
            const Icon = metricIcons[metric] || Activity;
            return (
              <div
                key={metric}
                className="flex items-center gap-2 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded"
              >
                <Icon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  {metricLabels[metric] || metric}
                </span>
              </div>
            );
          })}
        </div>

        {metrics.length === 0 && (
          <div className="text-xs text-gray-400 dark:text-gray-500 italic">
            No metrics selected
          </div>
        )}
      </div>

      {/* No output handle - this is a terminal node */}
    </div>
  );
});

OutputNode.displayName = "OutputNode";

export { OutputNode };
