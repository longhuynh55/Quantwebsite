"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { ArrowUpCircle, ArrowDownCircle, Target, Shield } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface SignalNodeProps extends NodeProps {
  data: StrategyNodeData & { label: string };
}

const signalConfig = {
  buy: {
    icon: ArrowUpCircle,
    bg: "bg-green-50 dark:bg-green-900/30",
    border: "border-green-300 dark:border-green-700",
    iconColor: "bg-green-500",
    ringColor: "ring-green-500/30",
    label: "Buy Signal",
  },
  sell: {
    icon: ArrowDownCircle,
    bg: "bg-red-50 dark:bg-red-900/30",
    border: "border-red-300 dark:border-red-700",
    iconColor: "bg-red-500",
    ringColor: "ring-red-500/30",
    label: "Sell Signal",
  },
};

const SignalNode = memo(({ data, selected }: SignalNodeProps) => {
  const config = data.type === "signal" ? data.config : null;
  const signalType = config?.signalType || "buy";
  const currentConfig = signalConfig[signalType];
  const Icon = currentConfig.icon;

  return (
    <div
      className={cn(
        "min-w-[180px] rounded-lg border-2 bg-white dark:bg-gray-900 shadow-lg",
        "transition-all duration-200",
        selected
          ? `ring-2 ${currentConfig.ringColor}`
          : ""
      )}
      style={{
        borderColor: selected ? (signalType === "buy" ? "#22c55e" : "#ef4444") : undefined,
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
          currentConfig.bg,
          currentConfig.border
        )}
      >
        <div className={cn("p-1.5 rounded-md", currentConfig.iconColor)}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span
          className={cn(
            "font-semibold text-sm",
            signalType === "buy"
              ? "text-green-900 dark:text-green-100"
              : "text-red-900 dark:text-red-100"
          )}
        >
          {data.label || currentConfig.label}
        </span>
      </div>

      {/* Content */}
      <div className="px-3 py-2 space-y-2">
        {/* Condition */}
        {config?.condition && (
          <div className="text-xs text-gray-600 dark:text-gray-300 truncate">
            {config.condition}
          </div>
        )}

        {/* Risk Management */}
        <div className="flex items-center gap-3 text-xs">
          {config?.stopLoss !== undefined && (
            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <Shield className="w-3 h-3" />
              <span>SL: {config.stopLoss}%</span>
            </div>
          )}
          {config?.takeProfit !== undefined && (
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <Target className="w-3 h-3" />
              <span>TP: {config.takeProfit}%</span>
            </div>
          )}
        </div>

        {/* Quantity */}
        {config?.quantity !== undefined && (
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">Qty:</span>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {config.quantity}
            </span>
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className={cn(
          "!w-3 !h-3 !border-2 !border-white dark:!border-gray-900",
          signalType === "buy" ? "!bg-green-500" : "!bg-red-500"
        )}
      />
    </div>
  );
});

SignalNode.displayName = "SignalNode";

export { SignalNode };
