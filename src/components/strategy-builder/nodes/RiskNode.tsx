"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface RiskNodeProps extends NodeProps {
    data: StrategyNodeData & { label: string };
}

const methodLabels: Record<string, string> = {
    fixed: "Fixed %",
    kelly: "Kelly Criterion",
    volatility: "Volatility-Adjusted",
    equal: "Equal Risk",
};

const RiskNode = memo(({ data, selected }: RiskNodeProps) => {
    const config = data.type === "risk" ? data.config : null;
    const method = (config?.method as string) || "fixed";
    const maxPosition = config?.maxPosition as number | undefined;
    const maxDrawdown = config?.maxDrawdown as number | undefined;

    return (
        <div
            className={cn(
                "min-w-[220px] bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 shadow-sm rounded-sm overflow-hidden",
                "border-l-4 border-l-amber-500",
                "transition-all duration-200",
                selected && "ring-2 ring-amber-500/40 shadow-md"
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
                <div className="flex items-center justify-center w-7 h-7 rounded bg-amber-500 flex-shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500 leading-none mb-0.5">
                        RISK
                    </div>
                    <div className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                        {data.label || "Risk Manager"}
                    </div>
                </div>
                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    NEW
                </span>
            </div>

            {/* Parameters */}
            <div className="border-t border-stone-100 dark:border-neutral-800 px-3 py-2 space-y-1.5">
                <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 px-2.5 py-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-600 dark:text-amber-400">
                        SIZING
                    </span>
                    <span className="text-xs font-medium text-stone-800 dark:text-neutral-200">
                        {methodLabels[method] || method}
                    </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                    {maxPosition !== undefined && (
                        <div className="flex items-center gap-1 text-stone-600 dark:text-neutral-400">
                            <span>Max Position</span>
                            <span className="font-mono font-semibold text-amber-700 dark:text-amber-300">
                                {maxPosition}%
                            </span>
                        </div>
                    )}
                    {maxDrawdown !== undefined && (
                        <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                            <span>Max DD</span>
                            <span className="font-mono font-semibold">
                                {maxDrawdown}%
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white dark:!border-neutral-900"
            />
        </div>
    );
});

RiskNode.displayName = "RiskNode";

export { RiskNode };
