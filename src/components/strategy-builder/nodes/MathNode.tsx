"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Calculator } from "lucide-react";
import type { StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

interface MathNodeProps extends NodeProps {
    data: StrategyNodeData & { label: string };
}

const operationLabels: Record<string, string> = {
    add: "A + B",
    subtract: "A − B",
    multiply: "A × B",
    divide: "A ÷ B",
    percent_change: "% Change",
    log: "Log(A)",
    abs: "|A|",
    power: "A ^ n",
};

const MathNode = memo(({ data, selected }: MathNodeProps) => {
    const config = data.type === "math" ? data.config : null;
    const operation = (config?.operation as string) || "add";
    const operand = config?.operand;

    return (
        <div
            className={cn(
                "min-w-[180px] bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-700 shadow-sm rounded-lg overflow-hidden",
                "border-l-4 border-l-indigo-500",
                "transition-all duration-200",
                selected && "ring-2 ring-indigo-500/40 shadow-md"
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
                <div className="flex items-center justify-center w-7 h-7 rounded bg-indigo-500 flex-shrink-0">
                    <Calculator className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-neutral-500 leading-none mb-0.5">
                        MATH
                    </div>
                    <div className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                        {data.label || "Calculation"}
                    </div>
                </div>
            </div>

            {/* Operation display — prominent */}
            <div className="border-t border-stone-100 dark:border-neutral-800 px-3 py-2 space-y-1.5">
                <div className="flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 px-3 py-2">
                    <span className="text-sm font-mono font-bold text-indigo-700 dark:text-indigo-300">
                        {operationLabels[operation] || operation}
                    </span>
                </div>

                {operand !== undefined && operand !== null && Number(operand) !== 0 && (
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-400 dark:text-neutral-500">Operand</span>
                        <span className="font-mono font-semibold text-indigo-700 dark:text-indigo-300">
                            {String(operand)}
                        </span>
                    </div>
                )}
            </div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-neutral-900"
            />
        </div>
    );
});

MathNode.displayName = "MathNode";

export { MathNode };
