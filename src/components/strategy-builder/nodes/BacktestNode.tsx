"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { PlayCircle } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface BacktestNodeProps extends NodeProps {
    data: StrategyNodeData & { label: string };
}

const BacktestNode = memo(({ data, selected }: BacktestNodeProps) => {
    const config = data.type === "backtest" ? data.config : null;
    const capital = config?.initialCapital as number | undefined;
    const commission = config?.commission as number | undefined;
    const slippage = config?.slippage as number | undefined;

    return (
        <div
            className={cn(
                "min-w-[220px] bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 shadow-sm rounded-sm overflow-hidden",
                "border-l-4 border-l-emerald-600",
                "transition-all duration-200",
                selected && "ring-2 ring-emerald-500/40 shadow-md"
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
                <div className="flex items-center justify-center w-7 h-7 rounded bg-emerald-600 flex-shrink-0">
                    <PlayCircle className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500 leading-none mb-0.5">
                        BACKTEST
                    </div>
                    <div className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                        {data.label || "Run Backtest"}
                    </div>
                </div>
                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    NEW
                </span>
            </div>

            {/* Configuration */}
            <div className="border-t border-stone-100 dark:border-neutral-800 px-3 py-2 space-y-1">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-500 dark:text-neutral-500">Capital</span>
                    <span className="font-mono font-semibold text-stone-900 dark:text-white">
                        {capital !== undefined
                            ? `₫${Number(capital).toLocaleString()}`
                            : "₫100,000,000"}
                    </span>
                </div>
                <div className="h-px bg-stone-100 dark:bg-neutral-800" />
                <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-500 dark:text-neutral-500">
                        Commission
                    </span>
                    <span className="font-mono text-stone-600 dark:text-neutral-400">
                        {commission !== undefined ? `${commission}%` : "0.15%"}
                    </span>
                </div>
                <div className="h-px bg-stone-100 dark:bg-neutral-800" />
                <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-500 dark:text-neutral-500">Slippage</span>
                    <span className="font-mono text-stone-600 dark:text-neutral-400">
                        {slippage !== undefined ? `${slippage}%` : "0.05%"}
                    </span>
                </div>
            </div>

            {/* No output handle — terminal node */}
        </div>
    );
});

BacktestNode.displayName = "BacktestNode";

export { BacktestNode };
