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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Palette Panel */}
      <div className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 z-50 shadow-xl animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
            Thêm Widget
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Widget List */}
        <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-64px)]">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Chọn widget để thêm vào dashboard của bạn
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
                  "w-full p-4 rounded-lg border text-left transition-all",
                  "border-gray-200 dark:border-gray-800",
                  isAdded
                    ? "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50"
                    : "hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      "bg-gray-100 dark:bg-gray-800",
                      isAdded &&
                        "bg-blue-100 dark:bg-blue-900/30"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        isAdded
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-600 dark:text-gray-400"
                      )}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {definition.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {definition.description}
                    </p>
                    {isAdded && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 mt-1 inline-block">
                        Đã thêm
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
