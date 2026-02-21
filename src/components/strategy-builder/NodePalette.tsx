"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import {
  Database,
  Activity,
  Filter,
  GripVertical,
} from "lucide-react";

interface NodeTypeItem {
  type: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const nodeTypes: NodeTypeItem[] = [
  {
    type: "dataSource",
    label: "Data Source",
    description: "Stock data input",
    icon: Database,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/50",
  },
  {
    type: "indicator",
    label: "Indicator",
    description: "Technical indicators",
    icon: Activity,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/50",
  },
  {
    type: "filter",
    label: "Filter",
    description: "Condition filters",
    icon: Filter,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/50",
  },
];

interface NodePaletteItemProps {
  item: NodeTypeItem;
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
}

const NodePaletteItem = memo(({ item, onDragStart }: NodePaletteItemProps) => {
  const Icon = item.icon;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item.type)}
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700",
        "bg-white dark:bg-gray-800 cursor-grab active:cursor-grabbing",
        "hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm",
        "transition-all duration-200",
        "group"
      )}
    >
      <div
        className={cn(
          "p-2 rounded-md",
          item.bgColor,
          "group-hover:scale-105 transition-transform duration-200"
        )}
      >
        <Icon className={cn("w-4 h-4", item.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {item.label}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {item.description}
        </div>
      </div>
      <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
});

NodePaletteItem.displayName = "NodePaletteItem";

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
  className?: string;
}

export const NodePalette = memo(({ onDragStart, className }: NodePaletteProps) => {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Components
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Drag to canvas to add
        </p>
      </div>

      {/* Node List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Data Section */}
        <div className="mb-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
            Data
          </div>
          <NodePaletteItem item={nodeTypes[0]} onDragStart={onDragStart} />
        </div>

        {/* Analysis Section */}
        <div className="mb-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
            Analysis
          </div>
          <div className="space-y-2">
            <NodePaletteItem item={nodeTypes[1]} onDragStart={onDragStart} />
            <NodePaletteItem item={nodeTypes[2]} onDragStart={onDragStart} />
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Tip: Configure nodes in the right panel before running
        </p>
      </div>
    </div>
  );
});

NodePalette.displayName = "NodePalette";
