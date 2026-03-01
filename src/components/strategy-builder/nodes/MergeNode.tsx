"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Merge } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface MergeNodeProps extends NodeProps {
    data: StrategyNodeData & { label: string };
}

const logicLabels: Record<string, string> = {
    and: "AND — All must pass",
    or: "OR — Any can pass",
    majority: "MAJORITY — >50% pass",
};

const MergeNode = memo(({ data, selected }: MergeNodeProps) => {
    const config = data.type === "merge" ? data.config : null;
    const logic = (config?.logic as string) || "and";

    return (
        <div
            className={cn(
                "min-w-[220px] bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 shadow-sm rounded-sm overflow-hidden",
                "border-l-4 border-l-teal-500",
                "transition-all duration-200",
                selected && "ring-2 ring-teal-500/40 shadow-md"
            )}
        >
            {/* Multiple Input Handles */}
            <Handle
                type="target"
                position={Position.Left}
                id="input-1"
                style={{ top: "30%" }}
                className="!w-3 !h-3 !bg-stone-400 !border-2 !border-white dark:!border-neutral-900"
            />
            <Handle
                type="target"
                position={Position.Left}
                id="input-2"
                style={{ top: "50%" }}
                className="!w-3 !h-3 !bg-stone-400 !border-2 !border-white dark:!border-neutral-900"
            />
            <Handle
                type="target"
                position={Position.Left}
                id="input-3"
                style={{ top: "70%" }}
                className="!w-3 !h-3 !bg-stone-400 !border-2 !border-white dark:!border-neutral-900"
            />

            {/* Header */}
            <div className="flex items-center gap-2.5 px-3 py-2">
                <div className="flex items-center justify-center w-7 h-7 rounded bg-teal-500 flex-shrink-0">
                    <Merge className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500 leading-none mb-0.5">
                        MERGE
                    </div>
                    <div className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                        {data.label || "Signal Merge"}
                    </div>
                </div>
                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                    NEW
                </span>
            </div>

            {/* Logic Mode */}
            <div className="border-t border-stone-100 dark:border-neutral-800 px-3 py-2">
                <div className="flex items-center gap-1.5 bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/50 px-2.5 py-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-teal-600 dark:text-teal-400">
                        {logic.toUpperCase()}
                    </span>
                    <span className="text-xs text-stone-600 dark:text-neutral-400">
                        {logicLabels[logic]?.split(" — ")[1] || ""}
                    </span>
                </div>
            </div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white dark:!border-neutral-900"
            />
        </div>
    );
});

MergeNode.displayName = "MergeNode";

export { MergeNode };
