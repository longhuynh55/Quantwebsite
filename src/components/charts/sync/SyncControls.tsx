"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Link2, Link2Off, RefreshCw } from "lucide-react";
import { useChartSyncContextOptional } from "./ChartSyncProvider";

export interface SyncControlsProps {
  className?: string;
  showResetButton?: boolean;
  variant?: "default" | "compact" | "icon-only";
  onReset?: () => void;
}

/**
 * Toggle button UI for enabling/disabling chart synchronization.
 */
export function SyncControls({
  className,
  showResetButton = true,
  variant = "default",
  onReset,
}: SyncControlsProps) {
  const context = useChartSyncContextOptional();

  // If not in sync provider, don't render
  if (!context) {
    return null;
  }

  const { isSyncEnabled, toggleSync } = context;

  if (variant === "icon-only") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Tooltip content={isSyncEnabled ? "Disable Sync" : "Enable Sync"}>
          <Button
            variant={isSyncEnabled ? "default" : "outline"}
            size="icon"
            onClick={toggleSync}
            className={cn(
              "h-8 w-8",
              isSyncEnabled && "bg-emerald-700 hover:bg-emerald-800"
            )}
            aria-label={
              isSyncEnabled ? "Disable chart sync" : "Enable chart sync"
            }
          >
            {isSyncEnabled ? (
              <Link2 className="h-4 w-4" />
            ) : (
              <Link2Off className="h-4 w-4" />
            )}
          </Button>
        </Tooltip>

        {showResetButton && onReset && (
          <Tooltip content="Reset Charts">
            <Button
              variant="ghost"
              size="icon"
              onClick={onReset}
              className="h-8 w-8"
              aria-label="Reset all charts"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </Tooltip>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <button
          onClick={toggleSync}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors",
            isSyncEnabled
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-stone-100 text-stone-600 dark:bg-neutral-800 dark:text-neutral-400"
          )}
          aria-pressed={isSyncEnabled}
        >
          {isSyncEnabled ? (
            <Link2 className="h-3 w-3" />
          ) : (
            <Link2Off className="h-3 w-3" />
          )}
          Sync
        </button>

        {showResetButton && onReset && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-stone-100 text-stone-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-stone-200 dark:hover:bg-neutral-700 transition-colors"
            aria-label="Reset all charts"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant={isSyncEnabled ? "default" : "outline"}
        size="sm"
        onClick={toggleSync}
        className={cn("gap-2", isSyncEnabled && "bg-emerald-700 hover:bg-emerald-800")}
        aria-pressed={isSyncEnabled}
      >
        {isSyncEnabled ? (
          <>
            <Link2 className="h-4 w-4" />
            Sync Enabled
          </>
        ) : (
          <>
            <Link2Off className="h-4 w-4" />
            Enable Sync
          </>
        )}
      </Button>

      {showResetButton && onReset && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="gap-2"
          aria-label="Reset all charts"
        >
          <RefreshCw className="h-4 w-4" />
          Reset
        </Button>
      )}
    </div>
  );
}

// Simple indicator component for showing sync status
export interface SyncIndicatorProps {
  className?: string;
  isActive?: boolean;
}

export function SyncIndicator({ className, isActive = false }: SyncIndicatorProps) {
  const context = useChartSyncContextOptional();

  if (!context || !context.isSyncEnabled) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
        isActive
          ? "bg-emerald-700 text-white"
          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isActive ? "bg-white animate-pulse" : "bg-emerald-600"
        )}
      />
      Synced
    </div>
  );
}

export default SyncControls;

