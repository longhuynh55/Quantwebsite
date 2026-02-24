"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Scale } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface WeightingNodeProps extends NodeProps {
    data: StrategyNodeData & { label: string };
}

const methodLabels: Record<string, string> = {
    equal: "Equal Weight",
    market_cap: "Market Cap",
    inverse_vol: "Inverse Volatility",
    risk_parity: "Risk Parity",
    custom: "Custom",
};

const WeightingNode = memo(({ data, selected }: WeightingNodeProps) => {
    const config = data.type === "weighting" ? data.config : null;
    const method = (config?.method as string) || "equal";

    return (
        <div
            className={cn(
                "min-w-[200px] bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-700 shadow-sm rounded-lg overflow-hidden",
                "border-l-4 border-l-violet-500",
                "transition-all duration-200",
                selected && "ring-2 ring-violet-500/40 shadow-md"
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
                <div className="flex items-center justify-center w-7 h-7 rounded bg-violet-500 flex-shrink-0">
                    <Scale className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-neutral-500 leading-none mb-0.5">
                        WEIGHT
                    </div>
                    <div className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                        {data.label || "Weighting"}
                    </div>
                </div>
            </div>

            {/* Method */}
            <div className="border-t border-stone-100 dark:border-neutral-800 px-3 py-2">
                <div className="flex items-center gap-1.5 bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50 px-2.5 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-500 dark:text-violet-400">METHOD</span>
                    <span className="text-xs font-medium text-stone-800 dark:text-neutral-200">
                        {methodLabels[method] || method}
                    </span>
                </div>
            </div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-violet-500 !border-2 !border-white dark:!border-neutral-900"
            />
        </div>
    );
});

WeightingNode.displayName = "WeightingNode";

export { WeightingNode };
