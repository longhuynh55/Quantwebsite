"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Settings, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WidgetWrapperProps {
  id: string;
  title: string;
  children: React.ReactNode;
  onRemove?: () => void;
  onSettings?: () => void;
  className?: string;
}

export function WidgetWrapper({
  id,
  title,
  children,
  onRemove,
  onSettings,
  className,
}: WidgetWrapperProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      className={cn(
        "h-full overflow-hidden border border-stone-200 bg-white shadow-sm",
        "flex flex-col transition-all duration-300 dark:border-neutral-800 dark:bg-neutral-900",
        isHovered && "border-stone-300 shadow-md dark:border-neutral-700",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-widget-id={id}
    >
      <div className="h-px bg-emerald-700/70 dark:bg-emerald-500/70" />
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50/80 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/80">
        <div className="flex items-center gap-2">
          {/* Drag handle */}
          <span className="react-grid-dragHandleAddon cursor-grab text-stone-400 transition-colors hover:text-emerald-700 active:cursor-grabbing dark:text-neutral-500 dark:hover:text-emerald-400">
            <GripVertical className="h-4 w-4" />
          </span>
          <h3 className="font-serif text-sm font-semibold text-stone-900 dark:text-white">
            {title}
          </h3>
        </div>

        {/* Actions */}
        <div
          className={cn(
            "flex items-center gap-1 transition-opacity duration-200",
            isHovered ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          {onSettings && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-stone-500 hover:bg-stone-200/80 hover:text-stone-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              onClick={onSettings}
              aria-label="Widget settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-stone-500 hover:bg-rose-50 hover:text-rose-700 dark:text-neutral-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
              onClick={onRemove}
              aria-label="Remove widget"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white p-4 dark:bg-neutral-900">{children}</div>
    </div>
  );
}
