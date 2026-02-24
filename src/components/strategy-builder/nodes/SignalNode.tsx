"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { ArrowUpCircle, ArrowDownCircle, Shield, Target } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface SignalNodeProps extends NodeProps {
  data: StrategyNodeData & { label: string };
}

const signalConfig = {
  buy: {
    icon: ArrowUpCircle,
    stripe: "border-l-emerald-500",
    iconBg: "bg-emerald-500",
    ring: "ring-emerald-500/40",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    label: "Buy Signal",
    tag: "BUY",
  },
  sell: {
    icon: ArrowDownCircle,
    stripe: "border-l-rose-500",
    iconBg: "bg-rose-500",
    ring: "ring-rose-500/40",
    badge: "bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    label: "Sell Signal",
    tag: "SELL",
  },
};

const SignalNode = memo(({ data, selected }: SignalNodeProps) => {
  const config = data.type === "signal" ? data.config : null;
  const signalType = config?.signalType || "buy";
  const c = signalConfig[signalType];
  const Icon = c.icon;

  return (
    <div
      className={cn(
        "min-w-[200px] bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-700 shadow-sm rounded-lg overflow-hidden",
        "border-l-4", c.stripe,
        "transition-all duration-200",
        selected && cn("ring-2 shadow-md", c.ring)
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
        <div className={cn("flex items-center justify-center w-7 h-7 rounded flex-shrink-0", c.iconBg)}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-neutral-500 leading-none mb-0.5">
            SIGNAL
          </div>
          <div className="text-sm font-semibold text-stone-900 dark:text-white truncate">
            {data.label || c.label}
          </div>
        </div>
        <span className={cn("px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", c.badge)}>
          {c.tag}
        </span>
      </div>

      {/* Parameters */}
      <div className="border-t border-stone-100 dark:border-neutral-800 px-3 py-2 space-y-1.5">
        {config?.condition && (
          <div className="text-xs text-stone-600 dark:text-neutral-300 truncate">
            {config.condition}
          </div>
        )}

        <div className="flex items-center gap-3 text-xs">
          {config?.stopLoss !== undefined && (
            <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
              <Shield className="w-3 h-3" />
              <span>SL {config.stopLoss}%</span>
            </div>
          )}
          {config?.takeProfit !== undefined && (
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Target className="w-3 h-3" />
              <span>TP {config.takeProfit}%</span>
            </div>
          )}
        </div>

        {config?.quantity !== undefined && (
          <div className="text-xs text-stone-500 dark:text-neutral-400">
            Quantity: <strong className="text-stone-700 dark:text-neutral-300">{config.quantity}</strong>
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className={cn(
          "!w-3 !h-3 !border-2 !border-white dark:!border-neutral-900",
          signalType === "buy" ? "!bg-emerald-500" : "!bg-rose-500"
        )}
      />
    </div>
  );
});

SignalNode.displayName = "SignalNode";

export { SignalNode };
