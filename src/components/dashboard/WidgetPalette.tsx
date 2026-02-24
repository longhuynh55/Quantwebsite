"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Wallet,
  Star,
  LineChart,
  TrendingUp,
  Globe,
  Newspaper,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WIDGET_DEFINITIONS,
  type WidgetType,
} from "@/lib/stores/dashboardStore";

interface WidgetPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (type: WidgetType) => void;
  existingWidgets: WidgetType[];
}

const ICON_MAP: Record<WidgetType, React.ElementType> = {
  "portfolio-value": Wallet,
  watchlist: Star,
  "performance-chart": LineChart,
  "top-movers": TrendingUp,
  "market-overview": Globe,
  news: Newspaper,
};

export function WidgetPalette({
  isOpen,
  onClose,
  onAddWidget,
  existingWidgets,
}: WidgetPaletteProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 transition-opacity" onClick={onClose} />

      <div className="fixed right-0 top-0 z-50 h-full w-80 border-l border-stone-200 bg-white shadow-xl animate-in slide-in-from-right dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center justify-between border-b border-stone-200 p-4 dark:border-neutral-800">
          <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-white">Add Widget</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-[calc(100%-64px)] space-y-3 overflow-y-auto p-4">
          <p className="mb-4 text-sm text-stone-600 dark:text-neutral-400">
            Select widgets to pin into your workspace.
          </p>

          {WIDGET_DEFINITIONS.map((definition) => {
            const Icon = ICON_MAP[definition.type];
            const isAdded = existingWidgets.includes(definition.type);

            return (
              <button
                key={definition.type}
                onClick={() => !isAdded && onAddWidget(definition.type)}
                disabled={isAdded}
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition-all",
                  "border-stone-200 dark:border-neutral-800",
                  isAdded
                    ? "cursor-not-allowed bg-stone-100/70 opacity-60 dark:bg-neutral-900/70"
                    : "cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/70 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/25"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "rounded-lg p-2",
                      "bg-stone-100 dark:bg-neutral-800",
                      isAdded && "bg-emerald-100 dark:bg-emerald-900/30"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        isAdded
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-stone-600 dark:text-neutral-400"
                      )}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-stone-900 dark:text-white">{definition.title}</h3>
                    <p className="mt-1 text-xs text-stone-600 dark:text-neutral-400">{definition.description}</p>
                    {isAdded && (
                      <span className="mt-1 inline-block text-xs text-emerald-700 dark:text-emerald-400">
                        Added
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
