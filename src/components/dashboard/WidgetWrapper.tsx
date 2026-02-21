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
        "h-full rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900",
        "flex flex-col overflow-hidden shadow-sm",
        "transition-shadow duration-300",
        isHovered && "shadow-md",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-widget-id={id}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-2">
          {/* Drag handle */}
          <span className="react-grid-dragHandleAddon cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <GripVertical className="h-4 w-4" />
          </span>
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {title}
          </h3>
        </div>

        {/* Actions */}
        <div
          className={cn(
            "flex items-center gap-1 transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          {onSettings && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={onSettings}
              aria-label="Cài đặt"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
              onClick={onRemove}
              aria-label="Xóa widget"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </div>
  );
}
