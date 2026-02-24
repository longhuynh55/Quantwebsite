"use client";

import * as React from "react";
import { ZoomIn, ZoomOut, RotateCcw, Download, Maximize2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

export interface ChartToolbarProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
  onExport?: (format: "png" | "svg") => void;
  onFullscreen?: () => void;
  showZoomControls?: boolean;
  showExport?: boolean;
  showFullscreen?: boolean;
  className?: string;
}

export function ChartToolbar({
  onZoomIn,
  onZoomOut,
  onReset,
  onExport,
  onFullscreen,
  showZoomControls = true,
  showExport = true,
  showFullscreen = true,
  className,
}: ChartToolbarProps) {
  const [isExportDropdownOpen, setIsExportDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleExport = (format: "png" | "svg") => {
    onExport?.(format);
    setIsExportDropdownOpen(false);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-md border border-stone-200 bg-stone-50/80 p-1",
        "dark:border-neutral-700 dark:bg-neutral-800/80",
        className
      )}
      role="toolbar"
      aria-label="Chart controls"
    >
      {/* Zoom Controls */}
      {showZoomControls && (
        <>
          <Tooltip content="Zoom In" position="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={onZoomIn}
              disabled={!onZoomIn}
              className="h-7 w-7 rounded-sm text-stone-600 hover:bg-stone-200 hover:text-stone-900 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </Tooltip>

          <Tooltip content="Zoom Out" position="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={onZoomOut}
              disabled={!onZoomOut}
              className="h-7 w-7 rounded-sm text-stone-600 hover:bg-stone-200 hover:text-stone-900 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </Tooltip>

          <Tooltip content="Reset Zoom" position="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={onReset}
              disabled={!onReset}
              className="h-7 w-7 rounded-sm text-stone-600 hover:bg-stone-200 hover:text-stone-900 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
              aria-label="Reset zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </Tooltip>

          {/* Divider */}
          <div className="mx-1 h-5 w-px bg-stone-300 dark:bg-neutral-600" />
        </>
      )}

      {/* Export Dropdown */}
      {showExport && (
        <div className="relative" ref={dropdownRef}>
          <Tooltip content="Export Chart" position="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              disabled={!onExport}
              className={cn(
                "h-7 w-auto px-1.5 rounded-sm text-stone-600 hover:bg-stone-200 hover:text-stone-900",
                "dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-100",
                isExportDropdownOpen && "bg-stone-200 dark:bg-neutral-700"
              )}
              aria-label="Export chart"
              aria-expanded={isExportDropdownOpen}
              aria-haspopup="menu"
            >
              <Download className="h-4 w-4" />
              <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
            </Button>
          </Tooltip>

          {/* Dropdown Menu */}
          {isExportDropdownOpen && (
            <div
              className={cn(
                "absolute right-0 top-full z-50 mt-1 min-w-[100px] rounded-md border border-stone-200 bg-white py-1 shadow-lg",
                "dark:border-neutral-700 dark:bg-neutral-800",
                "animate-in fade-in-0 zoom-in-95 duration-150"
              )}
              role="menu"
              aria-orientation="vertical"
            >
              <button
                type="button"
                onClick={() => handleExport("png")}
                className={cn(
                  "flex w-full items-center px-3 py-1.5 text-sm text-stone-700",
                  "hover:bg-stone-100 hover:text-stone-900",
                  "dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
                )}
                role="menuitem"
              >
                Export as PNG
              </button>
              <button
                type="button"
                onClick={() => handleExport("svg")}
                className={cn(
                  "flex w-full items-center px-3 py-1.5 text-sm text-stone-700",
                  "hover:bg-stone-100 hover:text-stone-900",
                  "dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
                )}
                role="menuitem"
              >
                Export as SVG
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="mx-1 h-5 w-px bg-stone-300 dark:bg-neutral-600 inline-block" />
        </div>
      )}

      {/* Fullscreen Button */}
      {showFullscreen && (
        <Tooltip content="Fullscreen" position="bottom">
          <Button
            variant="ghost"
            size="icon"
            onClick={onFullscreen}
            disabled={!onFullscreen}
            className="h-7 w-7 rounded-sm text-stone-600 hover:bg-stone-200 hover:text-stone-900 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
            aria-label="Toggle fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </Tooltip>
      )}
    </div>
  );
}

