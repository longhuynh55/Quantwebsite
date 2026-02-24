"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { ArrowDownUp } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface SortNodeProps extends NodeProps {
    data: StrategyNodeData & { label: string };
}

const sortByLabels: Record<string, string> = {
    returns: "Returns",
    sharpe: "Sharpe Ratio",
    volume: "Volume",
    market_cap: "Market Cap",
    momentum: "Momentum",
    volatility: "Volatility",
};

const SortNode = memo(({ data, selected }: SortNodeProps) => {
    const config = data.type === "sort" ? data.config : null;
    const sortBy = (config?.sortBy as string) || "returns";
    const order = (config?.order as string) || "desc";
    const limit = config?.limit;

    return (
        <div
            className={cn(
                "min-w-[200px] bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-700 shadow-sm rounded-lg overflow-hidden",
                "border-l-4 border-l-sky-500",
                "transition-all duration-200",
                selected && "ring-2 ring-sky-500/40 shadow-md"
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
                <div className="flex items-center justify-center w-7 h-7 rounded bg-sky-500 flex-shrink-0">
                    <ArrowDownUp className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-neutral-500 leading-none mb-0.5">
                        SORT
                    </div>
                    <div className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                        {data.label || "Sort & Rank"}
                    </div>
                </div>
            </div>

            {/* Natural language sort description */}
            <div className="border-t border-stone-100 dark:border-neutral-800 px-3 py-2 space-y-1.5">
                <div className="text-xs text-stone-700 dark:text-neutral-300">
                    Sort by <strong>{sortByLabels[sortBy] || sortBy}</strong>{" "}
                    <span className={cn(
                        "inline-flex items-center px-1 py-0.5 text-[10px] font-bold uppercase",
                        order === "desc"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                    )}>
                        {order === "desc" ? "▼ DESC" : "▲ ASC"}
                    </span>
                    {limit !== undefined && limit !== null && (
                        <> · Top <strong>{String(limit)}</strong></>
                    )}
                </div>
            </div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-sky-500 !border-2 !border-white dark:!border-neutral-900"
            />
        </div>
    );
});

SortNode.displayName = "SortNode";

export { SortNode };
