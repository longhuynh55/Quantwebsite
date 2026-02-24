"use client";

import * as React from "react";
import {
  MousePointer2,
  TrendingUp,
  Minus,
  Grid3X3,
  Square,
  Type,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import type { DrawingTool } from "../hooks/useDrawingManager";

export interface DrawingToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onDeleteSelected?: () => void;
  onClearAll?: () => void;
  onExport?: () => void;
  onImport?: (jsonData: string) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  zoom?: number;
  hasSelection?: boolean;
  className?: string;
  orientation?: "horizontal" | "vertical";
}

const TOOLS: Array<{
  id: DrawingTool;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
}> = [
  { id: "select", label: "Select", icon: MousePointer2, shortcut: "V" },
  { id: "trendLine", label: "Trend Line", icon: TrendingUp, shortcut: "T" },
  { id: "horizontalLine", label: "Horizontal Line", icon: Minus, shortcut: "H" },
  { id: "fibonacci", label: "Fibonacci Retracement", icon: Grid3X3, shortcut: "F" },
  { id: "supportResistance", label: "Support/Resistance Zone", icon: Square, shortcut: "S" },
  { id: "text", label: "Text Annotation", icon: Type, shortcut: "X" },
];

export function DrawingToolbar({
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onDeleteSelected,
  onClearAll,
  onExport,
  onImport,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  zoom = 1,
  hasSelection = false,
  className,
  orientation = "horizontal",
}: DrawingToolbarProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // Tool shortcuts
      const tool = TOOLS.find((t) => t.shortcut?.toLowerCase() === key);
      if (tool) {
        e.preventDefault();
        onToolChange(tool.id);
        return;
      }

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
        return;
      }

      // Delete selected
      if (key === "delete" || key === "backspace") {
        if (hasSelection) {
          e.preventDefault();
          onDeleteSelected?.();
        }
      }

      // Escape to deselect
      if (key === "escape") {
        onToolChange("select");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToolChange, onUndo, onRedo, onDeleteSelected, hasSelection]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (onImport) {
        onImport(content);
      }
    };
    reader.readAsText(file);

    // Reset input
    e.target.value = "";
  };

  const isVertical = orientation === "vertical";

  return (
    <div
      className={cn(
        "flex items-center gap-1 p-1.5 rounded-lg border border-stone-200 bg-white shadow-sm",
        "dark:border-neutral-700 dark:bg-neutral-800",
        isVertical ? "flex-col" : "flex-row flex-wrap",
        className
      )}
      role="toolbar"
      aria-label="Drawing tools"
    >
      {/* Drawing Tools */}
      <div
        className={cn(
          "flex items-center gap-0.5",
          isVertical ? "flex-col" : "flex-row"
        )}
        role="group"
        aria-label="Drawing tools"
      >
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;

          return (
            <Tooltip
              key={tool.id}
              content={
                <span>
                  {tool.label}
                  {tool.shortcut && (
                    <span className="ml-2 text-stone-400 dark:text-neutral-500">
                      ({tool.shortcut})
                    </span>
                  )}
                </span>
              }
              position={isVertical ? "right" : "bottom"}
            >
              <Button
                variant={isActive ? "default" : "ghost"}
                size="icon"
                onClick={() => onToolChange(tool.id)}
                className={cn(
                  "h-8 w-8",
                  isActive &&
                    "bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                )}
                aria-label={tool.label}
                aria-pressed={isActive}
              >
                <Icon className="h-4 w-4" />
              </Button>
            </Tooltip>
          );
        })}
      </div>

      {/* Divider */}
      <div
        className={cn(
          "bg-stone-200 dark:bg-neutral-600",
          isVertical ? "w-6 h-px my-1" : "w-px h-6 mx-1"
        )}
        role="separator"
      />

      {/* History Controls */}
      <div
        className={cn(
          "flex items-center gap-0.5",
          isVertical ? "flex-col" : "flex-row"
        )}
        role="group"
        aria-label="History controls"
      >
        <Tooltip content="Undo (Ctrl+Z)" position={isVertical ? "right" : "bottom"}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onUndo}
            disabled={!canUndo}
            className="h-8 w-8"
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        </Tooltip>

        <Tooltip content="Redo (Ctrl+Shift+Z)" position={isVertical ? "right" : "bottom"}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRedo}
            disabled={!canRedo}
            className="h-8 w-8"
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>

      {/* Divider */}
      <div
        className={cn(
          "bg-stone-200 dark:bg-neutral-600",
          isVertical ? "w-6 h-px my-1" : "w-px h-6 mx-1"
        )}
        role="separator"
      />

      {/* Zoom Controls */}
      {(onZoomIn || onZoomOut || onResetZoom) && (
        <>
          <div
            className={cn(
              "flex items-center gap-0.5",
              isVertical ? "flex-col" : "flex-row"
            )}
            role="group"
            aria-label="Zoom controls"
          >
            <Tooltip content="Zoom In" position={isVertical ? "right" : "bottom"}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onZoomIn}
                className="h-8 w-8"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </Tooltip>

            <span className="text-xs text-stone-500 dark:text-stone-400 min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>

            <Tooltip content="Zoom Out" position={isVertical ? "right" : "bottom"}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onZoomOut}
                className="h-8 w-8"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </Tooltip>

            <Tooltip content="Reset Zoom" position={isVertical ? "right" : "bottom"}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onResetZoom}
                className="h-8 w-8"
                aria-label="Reset zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>

          {/* Divider */}
          <div
            className={cn(
              "bg-stone-200 dark:bg-neutral-600",
              isVertical ? "w-6 h-px my-1" : "w-px h-6 mx-1"
            )}
            role="separator"
          />
        </>
      )}

      {/* Delete Controls */}
      <div
        className={cn(
          "flex items-center gap-0.5",
          isVertical ? "flex-col" : "flex-row"
        )}
        role="group"
        aria-label="Delete controls"
      >
        <Tooltip content="Delete Selected (Del)" position={isVertical ? "right" : "bottom"}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDeleteSelected}
            disabled={!hasSelection}
            className={cn(
              "h-8 w-8",
              hasSelection && "text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            )}
            aria-label="Delete selected drawing"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>

      {/* Divider */}
      <div
        className={cn(
          "bg-stone-200 dark:bg-neutral-600",
          isVertical ? "w-6 h-px my-1" : "w-px h-6 mx-1"
        )}
        role="separator"
      />

      {/* Import/Export */}
      <div
        className={cn(
          "flex items-center gap-0.5",
          isVertical ? "flex-col" : "flex-row"
        )}
        role="group"
        aria-label="Import/Export controls"
      >
        <Tooltip content="Export Drawings" position={isVertical ? "right" : "bottom"}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onExport}
            className="h-8 w-8"
            aria-label="Export drawings"
          >
            <Download className="h-4 w-4" />
          </Button>
        </Tooltip>

        <Tooltip content="Import Drawings" position={isVertical ? "right" : "bottom"}>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleImportClick}
            className="h-8 w-8"
            aria-label="Import drawings"
          >
            <Upload className="h-4 w-4" />
          </Button>
        </Tooltip>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {/* Clear All */}
      <Tooltip content="Clear All Drawings" position={isVertical ? "right" : "bottom"}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearAll}
          className={cn(
            "h-8 w-8",
            "text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          )}
          aria-label="Clear all drawings"
        >
          <X className="h-4 w-4" />
        </Button>
      </Tooltip>
    </div>
  );
}

export default DrawingToolbar;

