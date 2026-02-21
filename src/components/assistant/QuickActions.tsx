"use client";

import { useMemo } from "react";
import { QUICK_ACTIONS, type AssistantContextSnapshot, type QuickAction } from "@/types/assistant";
import { uiFeatureFlags } from "@/lib/featureFlags";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  BarChart3,
  PieChart,
  LineChart,
  BookOpen,
  Building2,
} from "lucide-react";

export interface QuickActionInvocationMeta {
  actionId: string;
  source: "contextual" | "default";
  page?: AssistantContextSnapshot["page"];
  symbol?: string;
  symbols?: string[];
  timeframe?: string;
  navGroup?: AssistantContextSnapshot["navGroup"];
  exportReportType?: string;
  fromWatchlistQuery?: boolean;
  watchlistCount?: number;
}

interface QuickActionsProps {
  onAction: (prompt: string, meta?: QuickActionInvocationMeta) => void;
  disabled?: boolean;
  context?: AssistantContextSnapshot;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "trending-up": TrendingUp,
  "bar-chart": BarChart3,
  "pie-chart": PieChart,
  "line-chart": LineChart,
  "book-open": BookOpen,
  building: Building2,
};

interface QuickActionWithMeta extends QuickAction {
  meta?: QuickActionInvocationMeta;
}

function normalizeSymbolToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,10}$/.test(normalized)) return null;
  return normalized;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function extractContextSymbols(context?: AssistantContextSnapshot): string[] {
  if (!context) return [];
  const candidates: string[] = [];
  const push = (value: unknown) => {
    const normalized = normalizeSymbolToken(value);
    if (normalized) {
      candidates.push(normalized);
    }
  };

  if (Array.isArray(context.symbols)) {
    for (const item of context.symbols) {
      push(item);
    }
  }
  push(context.symbol);

  const filters = asRecord(context.filters);
  const groupedCandidates = [
    filters?.symbols,
    filters?.watchlist,
    filters?.tickers,
    filters?.codes,
  ];
  for (const grouped of groupedCandidates) {
    if (Array.isArray(grouped)) {
      for (const item of grouped) {
        push(item);
      }
      continue;
    }
    if (typeof grouped === "string") {
      for (const token of grouped.split(/[,\s;|]+/)) {
        push(token);
      }
    }
  }

  return Array.from(new Set(candidates)).slice(0, 20);
}

function resolveWatchlistQuerySource(context?: AssistantContextSnapshot): boolean {
  const filters = asRecord(context?.filters);
  if (!filters) return false;
  if (filters.watchlistQuerySource === true) return true;
  const contextSource = String(filters.contextSource ?? "").trim().toLowerCase();
  return contextSource === "watchlist_query";
}

function buildActionMeta(
  context: AssistantContextSnapshot | undefined,
  actionId: string,
  source: "contextual" | "default"
): QuickActionInvocationMeta {
  const symbols = extractContextSymbols(context);
  const symbol = normalizeSymbolToken(context?.symbol);
  const timeframe = context?.timeframe?.trim() || undefined;

  return {
    actionId,
    source,
    page: context?.page,
    symbol: symbol ?? undefined,
    symbols: symbols.length > 0 ? symbols : undefined,
    timeframe,
    navGroup: context?.navGroup,
    exportReportType: context?.exportContext?.reportType,
    fromWatchlistQuery: resolveWatchlistQuerySource(context),
    watchlistCount: symbols.length > 0 ? symbols.length : undefined,
  };
}

function buildContextualActions(context?: AssistantContextSnapshot): QuickActionWithMeta[] {
  if (!context) return [];

  const symbol = context.symbol?.trim().toUpperCase();
  const timeframe = context.timeframe?.trim();
  const hasFilters = Boolean(context.filters && Object.keys(context.filters).length > 0);
  const watchlistSymbols = extractContextSymbols(context);
  const fromWatchlistQuery = resolveWatchlistQuerySource(context);

  if (context.page === "screener") {
    return [
      {
        id: "ctx-screener-summary",
        label: "Summarize current screener",
        icon: "bar-chart",
        prompt: hasFilters
          ? "Tom tat bo loc screener hien tai va de xuat 5 ma HOSE phu hop nhat."
          : "De xuat 5 ma HOSE co tinh thanh khoan cao de bat dau sang loc.",
        meta: buildActionMeta(context, "ctx-screener-summary", "contextual"),
      },
    ];
  }

  if (context.page === "charts" && symbol) {
    const actions: QuickActionWithMeta[] = [
      {
        id: "ctx-chart-symbol",
        label: `Analyze ${symbol}`,
        icon: "line-chart",
        prompt: `Phan tich xu huong gia ${symbol}${timeframe ? ` trong khung ${timeframe}` : ""}, neu ro ho tro/khang cu va rui ro ngan han.`,
        meta: buildActionMeta(context, "ctx-chart-symbol", "contextual"),
      },
      {
        id: "ctx-chart-compare",
        label: `Compare ${symbol} vs VNINDEX`,
        icon: "trending-up",
        prompt: `So sanh dong luong cua ${symbol} voi VNINDEX${timeframe ? ` trong ${timeframe}` : ""}, kem nhan xet do manh yeu tuong doi.`,
        meta: buildActionMeta(context, "ctx-chart-compare", "contextual"),
      },
    ];

    if (fromWatchlistQuery && watchlistSymbols.length > 1) {
      actions.push({
        id: "ctx-chart-watchlist",
        label: `Scan watchlist (${watchlistSymbols.length})`,
        icon: "bar-chart",
        prompt: `Tom tat nhanh watchlist ${watchlistSymbols.join(", ")} trong khung ${timeframe || "hien tai"}, neu ma manh/yeu noi bat va rui ro chinh.`,
        meta: buildActionMeta(context, "ctx-chart-watchlist", "contextual"),
      });
    }
    return actions;
  }

  if (context.page === "backtesting" && symbol) {
    return [
      {
        id: "ctx-backtest-review",
        label: `Review ${symbol} backtest`,
        icon: "bar-chart",
        prompt: `Danh gia ket qua backtesting cua ${symbol}, giai thich cac metric quan trong va de xuat cach giam drawdown.`,
        meta: buildActionMeta(context, "ctx-backtest-review", "contextual"),
      },
    ];
  }

  if (context.page === "portfolio") {
    return [
      {
        id: "ctx-portfolio-risk",
        label: "Portfolio risk check",
        icon: "pie-chart",
        prompt: "Phan tich rui ro danh muc hien tai, muc do tap trung va goi y can bang lai.",
        meta: buildActionMeta(context, "ctx-portfolio-risk", "contextual"),
      },
    ];
  }

  if (context.page === "risk" && symbol) {
    return [
      {
        id: "ctx-risk-symbol",
        label: `Risk on ${symbol}`,
        icon: "line-chart",
        prompt: `Tom tat rui ro cua ${symbol} so voi VNINDEX, gom beta, VaR va drawdown.`,
        meta: buildActionMeta(context, "ctx-risk-symbol", "contextual"),
      },
    ];
  }

  return [];
}

export function QuickActions({ onAction, disabled = false, context }: QuickActionsProps) {
  const actions = useMemo(() => {
    const contextual = uiFeatureFlags.assistantContextualActions ? buildContextualActions(context) : [];
    const defaults: QuickActionWithMeta[] = QUICK_ACTIONS.map((item) => ({
      ...item,
      meta: buildActionMeta(context, item.id, "default"),
    }));
    const merged = [...contextual, ...defaults];
    const seen = new Set<string>();
    return merged
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, 8);
  }, [context]);

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-medium">
        Try these prompts
      </p>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = iconMap[action.icon || ""] || TrendingUp;
          return (
            <button
              key={action.id}
              onClick={() => onAction(action.prompt, action.meta)}
              disabled={disabled}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-left",
                "text-sm text-gray-700 dark:text-gray-300",
                "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700",
                "border border-transparent hover:border-gray-300 dark:hover:border-gray-600",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0 text-blue-500" />
              <span className="truncate text-xs">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

