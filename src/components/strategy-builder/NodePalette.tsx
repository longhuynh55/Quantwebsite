"use client";

import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Database,
  Activity,
  Filter,
  GripVertical,
  Wand2,
  ArrowUpCircle,
  BarChart2,
  Scale,
  GitBranch,
  ArrowDownUp,
  Calculator,
  Search,
  Merge,
  ShieldCheck,
  PlayCircle,
} from "lucide-react";

interface NodeTypeItem {
  type: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface NodeSection {
  label: string;
  items: NodeTypeItem[];
}

const nodeSections: NodeSection[] = [
  {
    label: "Data",
    items: [
      {
        type: "dataSource",
        label: "Data Source",
        description: "Stock data input",
        icon: Database,
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/50",
      },
    ],
  },
  {
    label: "Analysis",
    items: [
      {
        type: "indicator",
        label: "Indicator",
        description: "Technical indicators",
        icon: Activity,
        color: "text-teal-600 dark:text-teal-400",
        bgColor: "bg-teal-100 dark:bg-teal-900/40",
      },
      {
        type: "filter",
        label: "Filter",
        description: "Condition filters",
        icon: Filter,
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-100 dark:bg-orange-900/50",
      },
    ],
  },
  {
    label: "Signals",
    items: [
      {
        type: "signal",
        label: "Signal",
        description: "Buy / Sell trigger",
        icon: ArrowUpCircle,
        color: "text-rose-600 dark:text-rose-400",
        bgColor: "bg-rose-100 dark:bg-rose-900/40",
      },
      {
        type: "merge",
        label: "Merge",
        description: "Combine signals (AND/OR)",
        icon: Merge,
        color: "text-teal-600 dark:text-teal-400",
        bgColor: "bg-teal-100 dark:bg-teal-900/40",
      },
    ],
  },
  {
    label: "Risk & Execution",
    items: [
      {
        type: "risk",
        label: "Risk Manager",
        description: "Position sizing & limits",
        icon: ShieldCheck,
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-100 dark:bg-amber-900/40",
      },
      {
        type: "output",
        label: "Output",
        description: "Performance metrics",
        icon: BarChart2,
        color: "text-emerald-700 dark:text-emerald-300",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/50",
      },
      {
        type: "backtest",
        label: "Backtest",
        description: "Run strategy simulation",
        icon: PlayCircle,
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/40",
      },
    ],
  },
  {
    label: "Advanced",
    items: [
      {
        type: "weighting",
        label: "Weighting",
        description: "Asset weight allocation",
        icon: Scale,
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/40",
      },
      {
        type: "conditional",
        label: "Conditional",
        description: "If / else branching",
        icon: GitBranch,
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-100 dark:bg-amber-900/40",
      },
      {
        type: "sort",
        label: "Sort",
        description: "Rank & sort assets",
        icon: ArrowDownUp,
        color: "text-sky-600 dark:text-sky-400",
        bgColor: "bg-sky-100 dark:bg-sky-900/40",
      },
      {
        type: "math",
        label: "Math",
        description: "Custom calculations",
        icon: Calculator,
        color: "text-indigo-600 dark:text-indigo-400",
        bgColor: "bg-indigo-100 dark:bg-indigo-900/40",
      },
    ],
  },
];

interface NodePaletteItemProps {
  item: NodeTypeItem;
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
  onAddNode?: (nodeType: string) => void;
}

const NodePaletteItem = memo(({ item, onDragStart, onAddNode }: NodePaletteItemProps) => {
  const Icon = item.icon;

  const handleDragStart = (e: React.DragEvent) => {
    onDragStart(e, item.type);
    // Create custom drag ghost
    const ghost = document.createElement("div");
    ghost.className = "node-drag-ghost";
    ghost.textContent = item.label;
    ghost.style.position = "absolute";
    ghost.style.top = "-1000px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 40, 20);
    requestAnimationFrame(() => {
      setTimeout(() => ghost.remove(), 100);
    });
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onAddNode?.(item.type)}
      className={cn(
        "flex cursor-pointer items-center gap-3 border border-stone-200 bg-white p-2.5 rounded-lg dark:border-neutral-700 dark:bg-neutral-900",
        "hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20",
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
        <div className="text-sm font-medium text-stone-900 dark:text-white">
          {item.label}
        </div>
        <div className="text-xs text-stone-500 dark:text-neutral-400 truncate">
          {item.description}
        </div>
      </div>
      <GripVertical className="w-4 h-4 text-stone-400 dark:text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
});

NodePaletteItem.displayName = "NodePaletteItem";

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
  onAddNode?: (nodeType: string) => void;
  onApplyQuickTemplate?: () => void;
  className?: string;
}

export const NodePalette = memo(
  ({ onDragStart, onAddNode, onApplyQuickTemplate, className }: NodePaletteProps) => {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredSections = searchQuery.trim()
      ? nodeSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.description.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((section) => section.items.length > 0)
      : nodeSections;

    return (
      <div className={cn("flex flex-col h-full", className)}>
        {/* Header */}
        <div className="border-b border-stone-200 px-4 py-3 dark:border-neutral-700">
          <div className="mb-2 h-px w-8 bg-emerald-700 dark:bg-emerald-500" />
          <h3 className="font-serif text-sm font-semibold text-stone-900 dark:text-white">
            Components
          </h3>
          <p className="mt-0.5 text-[11px] text-stone-500 dark:text-neutral-400">
            Drag or click to add
          </p>
        </div>

        {/* Search */}
        <div className="px-3 pt-3 pb-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 dark:text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search components..."
              className="w-full h-8 pl-8 pr-3 text-xs border border-stone-200 dark:border-neutral-700 bg-stone-50 dark:bg-neutral-800/50 rounded-md text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Node List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredSections.length > 0 ? (
            filteredSections.map((section) => (
              <div key={section.label} className="mb-4">
                <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-400">
                  {section.label}
                </div>
                <div className="space-y-2">
                  {section.items.map((item) => (
                    <NodePaletteItem
                      key={item.type}
                      item={item}
                      onDragStart={onDragStart}
                      onAddNode={onAddNode}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Search className="w-5 h-5 text-stone-300 dark:text-neutral-600 mb-2" />
              <p className="text-xs text-stone-400 dark:text-neutral-500">
                No components match &ldquo;{searchQuery}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-stone-200 bg-stone-100 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/70">
          {onApplyQuickTemplate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onApplyQuickTemplate}
              className="mb-2 w-full gap-2 border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
            >
              <Wand2 className="w-4 h-4" />
              Quick Template
            </Button>
          )}
          <p className="text-xs text-stone-500 dark:text-neutral-400 text-center">
            Tip: Use drag or click, then configure nodes in the right panel
          </p>
        </div>
      </div>
    );
  }
);

NodePalette.displayName = "NodePalette";
