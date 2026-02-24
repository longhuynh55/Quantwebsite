"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { GitBranch } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface ConditionalNodeProps extends NodeProps {
    data: StrategyNodeData & { label: string };
}

const ConditionalNode = memo(({ data, selected }: ConditionalNodeProps) => {
    const config = data.type === "conditional" ? data.config : null;
    const condition = (config?.condition as string) || "value > threshold";
    const threshold = config?.threshold;

    return (
        <div
            className={cn(
                "min-w-[220px] bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-700 shadow-sm rounded-lg overflow-hidden",
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
                    <GitBranch className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-neutral-500 leading-none mb-0.5">
                        CONDITIONAL
                    </div>
                    <div className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                        {data.label || "IF / ELSE"}
                    </div>
                </div>
            </div>

            {/* Condition — Composer-style IF badge */}
            <div className="border-t border-stone-100 dark:border-neutral-800 px-3 py-2 space-y-1.5">
                <div className="flex items-center gap-1.5 bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50 px-2.5 py-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">IF</span>
                    <span className="text-xs font-mono font-medium text-stone-800 dark:text-neutral-200 truncate">
                        {condition}
                    </span>
                </div>

                {threshold !== undefined && threshold !== null && (
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-400 dark:text-neutral-500">Threshold</span>
                        <span className="font-mono font-semibold text-violet-700 dark:text-violet-300">
                            {String(threshold)}
                        </span>
                    </div>
                )}
            </div>

            {/* True and False handles with labels */}
            <div className="relative">
                <Handle
                    type="source"
                    position={Position.Right}
                    id="true"
                    style={{ top: -16 }}
                    className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white dark:!border-neutral-900"
                />
                <span className="absolute right-5 -top-[22px] text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    TRUE
                </span>
                <Handle
                    type="source"
                    position={Position.Right}
                    id="false"
                    style={{ top: 8 }}
                    className="!w-3 !h-3 !bg-rose-500 !border-2 !border-white dark:!border-neutral-900"
                />
                <span className="absolute right-5 top-[2px] text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    FALSE
                </span>
            </div>
        </div>
    );
});

ConditionalNode.displayName = "ConditionalNode";

export { ConditionalNode };
