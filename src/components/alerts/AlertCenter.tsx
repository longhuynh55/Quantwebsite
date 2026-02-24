"use client";

import * as React from "react";
import { Bell, RefreshCw, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AlertItem, AlertSeverity, AlertsFeedResponse } from "@/lib/alerts/types";

const POLL_INTERVAL_MS = 20_000;

interface AlertCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlertCenter({ open, onOpenChange }: AlertCenterProps) {
  const [alerts, setAlerts] = React.useState<AlertItem[]>([]);
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const loadAlerts = React.useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    const isInitial = mode === "initial";
    if (isInitial) {
      setIsInitialLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const response = await fetch("/api/alerts", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to fetch alerts (${response.status})`);
      }

      const payload = (await response.json()) as Partial<AlertsFeedResponse>;
      if (!Array.isArray(payload.alerts)) {
        throw new Error("Invalid alerts response shape");
      }

      setAlerts(payload.alerts);
      setLastUpdated(
        typeof payload.polledAt === "string" ? payload.polledAt : new Date().toISOString()
      );
      setErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load alerts";
      setErrorMessage(message);
    } finally {
      if (isInitial) {
        setIsInitialLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    void loadAlerts("initial");

    const intervalId = window.setInterval(() => {
      void loadAlerts("refresh");
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [open, loadAlerts]);

  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  if (!open) return null;

  const unreadCount = alerts.reduce((total, alert) => total + (alert.acknowledged ? 0 : 1), 0);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={() => onOpenChange(false)}
        aria-label="Close alert center overlay"
      />

      <aside
        id="alert-center-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-center-title"
        className="absolute right-0 top-0 h-full w-full max-w-md animate-in slide-in-from-right duration-300 border-l border-stone-200 bg-stone-50 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
      >
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-stone-200 px-4 py-4 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h2 id="alert-center-title" className="text-sm font-semibold text-stone-900 dark:text-neutral-100">
                  Alert Center
                </h2>
                <p className="text-xs text-stone-500 dark:text-neutral-400">
                  {unreadCount} unread alerts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Refresh alerts"
                onClick={() => void loadAlerts("refresh")}
                disabled={isRefreshing || isInitialLoading}
                className="h-8 w-8 rounded-lg text-stone-500 hover:bg-stone-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close alert center"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 rounded-lg text-stone-500 hover:bg-stone-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4">
            {lastUpdated && (
              <p className="mb-3 text-xs text-stone-500 dark:text-neutral-400">
                Last update: {formatTimestamp(lastUpdated)}
              </p>
            )}

            {errorMessage && (
              <p
                role="alert"
                className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-900/30 dark:text-red-200"
              >
                {errorMessage}
              </p>
            )}

            {isInitialLoading ? (
              <p className="text-sm text-stone-500 dark:text-neutral-400">Loading alerts...</p>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-neutral-400">No alerts available.</p>
            ) : (
              <ul className="space-y-3">
                {alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className={cn(
                      "rounded-xl border p-3",
                      alert.acknowledged ? "opacity-80" : "opacity-100",
                      getAlertBorderTone(alert.severity)
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-stone-900 dark:text-neutral-100">{alert.title}</p>
                      <Badge variant={getSeverityBadgeVariant(alert.severity)}>{alert.severity}</Badge>
                    </div>
                    <p className="text-xs text-stone-700 dark:text-neutral-300">{alert.message}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-stone-500 dark:text-neutral-400">
                      <span>{alert.symbol ?? "Portfolio"}</span>
                      <span>{formatTimestamp(alert.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function getSeverityBadgeVariant(severity: AlertSeverity): "default" | "secondary" | "destructive" {
  switch (severity) {
    case "critical":
      return "destructive";
    case "warning":
      return "default";
    default:
      return "secondary";
  }
}

function getAlertBorderTone(severity: AlertSeverity): string {
  switch (severity) {
    case "critical":
      return "border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20";
    case "warning":
      return "border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20";
    default:
      return "border-stone-200 bg-stone-100/70 dark:border-neutral-700 dark:bg-neutral-800/60";
  }
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
