"use client";

import * as React from "react";
// Use legacy import for v1 API compatibility with WidthProvider
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import dynamic from "next/dynamic";
import { useDashboardStore, type DashboardLayouts } from "@/lib/stores/dashboardStore";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetPalette } from "./WidgetPalette";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RotateCcw, LayoutGrid } from "lucide-react";

import "./grid-layout.css";

// WidthProvider wraps Responsive to provide automatic width calculation
const ResponsiveGridLayout = WidthProvider(Responsive);

// Loading skeleton for widgets
function WidgetSkeleton() {
  return (
    <div className="h-full flex flex-col p-4">
      <Skeleton className="h-6 w-32 mb-4" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

// Dynamically import heavy widget components for better initial load performance
const PortfolioValueWidget = dynamic(
  () => import("./widgets/PortfolioValueWidget").then((mod) => mod.PortfolioValueWidget),
  {
    loading: () => <WidgetSkeleton />,
    ssr: false,
  }
);

const WatchlistWidget = dynamic(
  () => import("./widgets/WatchlistWidget").then((mod) => mod.WatchlistWidget),
  {
    loading: () => <WidgetSkeleton />,
    ssr: false,
  }
);

const PerformanceChartWidget = dynamic(
  () => import("./widgets/PerformanceChartWidget").then((mod) => mod.PerformanceChartWidget),
  {
    loading: () => <WidgetSkeleton />,
    ssr: false,
  }
);

const TopMoversWidget = dynamic(
  () => import("./widgets/TopMoversWidget").then((mod) => mod.TopMoversWidget),
  {
    loading: () => <WidgetSkeleton />,
    ssr: false,
  }
);

const MarketOverviewWidget = dynamic(
  () => import("./widgets/MarketOverviewWidget").then((mod) => mod.MarketOverviewWidget),
  {
    loading: () => <WidgetSkeleton />,
    ssr: false,
  }
);

const NewsWidget = dynamic(
  () => import("./widgets/NewsWidget").then((mod) => mod.NewsWidget),
  {
    loading: () => <WidgetSkeleton />,
    ssr: false,
  }
);

// Widget component mapping
const WIDGET_COMPONENTS: Record<string, React.ComponentType<{ config?: Record<string, unknown> }>> = {
  "portfolio-value": PortfolioValueWidget,
  watchlist: WatchlistWidget,
  "performance-chart": PerformanceChartWidget,
  "top-movers": TopMoversWidget,
  "market-overview": MarketOverviewWidget,
  news: NewsWidget,
};

const BREAKPOINTS = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
};

const COLS = {
  lg: 12,
  md: 12,
  sm: 6,
  xs: 4,
  xxs: 2,
};

// Memoized widget renderer to prevent unnecessary re-renders
const MemoizedWidget = React.memo(function MemoizedWidget({
  widget,
  onRemove,
}: {
  widget: { id: string; type: string; title: string; config?: Record<string, unknown> };
  onRemove: (id: string) => void;
}) {
  const WidgetComponent = WIDGET_COMPONENTS[widget.type];

  if (!WidgetComponent) return null;

  return (
    <WidgetWrapper
      id={widget.id}
      title={widget.title}
      onRemove={() => onRemove(widget.id)}
    >
      <WidgetComponent config={widget.config} />
    </WidgetWrapper>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders when unrelated widgets change
  return (
    prevProps.widget.id === nextProps.widget.id &&
    prevProps.widget.type === nextProps.widget.type &&
    prevProps.widget.title === nextProps.widget.title &&
    prevProps.widget.config === nextProps.widget.config
  );
});

export function DashboardLayout() {
  const {
    layouts,
    widgets,
    isPaletteOpen,
    addWidget,
    removeWidget,
    updateLayout,
    togglePalette,
    resetToDefault,
  } = useDashboardStore();

  // Memoize layout change handler
  const handleLayoutChange = React.useCallback(
    (currentLayout: DashboardLayouts["lg"], allLayouts: DashboardLayouts) => {
      updateLayout(allLayouts);
    },
    [updateLayout]
  );

  // Memoize remove handler
  const handleRemoveWidget = React.useCallback(
    (id: string) => {
      removeWidget(id);
    },
    [removeWidget]
  );

  const existingWidgetTypes = React.useMemo(
    () => widgets.map((w) => w.type),
    [widgets]
  );

  return (
    <div className="h-full space-y-5">
      {/* Toolbar */}
      <div className="overflow-hidden border border-stone-200 bg-gradient-to-r from-stone-50 to-stone-100/60 shadow-sm dark:border-neutral-800 dark:from-neutral-950 dark:to-neutral-900">
        <div className="h-1 bg-emerald-700 dark:bg-emerald-600" />
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-px w-8 bg-emerald-700 dark:bg-emerald-500" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-neutral-500">
                Workspace
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700 dark:border-emerald-900 dark:bg-neutral-900 dark:text-emerald-400">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-serif text-2xl font-bold text-stone-900 dark:text-white">
                  Dashboard
                </h1>
                <p className="text-sm text-stone-600 dark:text-neutral-400">
                  Organize your market workspace and pin key signals.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefault}
              className="gap-2 border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Layout
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={togglePalette}
              className="gap-2 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4" />
              Add Widget
            </Button>
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="min-h-[800px] border border-stone-200 bg-stone-100/70 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <ResponsiveGridLayout
          className="layout"
          breakpoints={BREAKPOINTS}
          cols={COLS}
          layouts={layouts as unknown as React.ComponentProps<typeof ResponsiveGridLayout>["layouts"]}
          onLayoutChange={handleLayoutChange as unknown as React.ComponentProps<typeof ResponsiveGridLayout>["onLayoutChange"]}
          rowHeight={60}
          draggableHandle=".react-grid-dragHandleAddon"
          isResizable={true}
          isDraggable={true}
          compactType="vertical"
          preventCollision={false}
          margin={[16, 16]}
        >
          {widgets.map((widget) => (
            <div key={widget.id}>
              <MemoizedWidget widget={widget} onRemove={handleRemoveWidget} />
            </div>
          ))}
        </ResponsiveGridLayout>

        {/* Empty state */}
        {widgets.length === 0 && (
          <div className="flex h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white/80 text-stone-500 dark:border-neutral-700 dark:bg-neutral-900/70 dark:text-neutral-400">
            <LayoutGrid className="mb-4 h-16 w-16 text-emerald-700/60 dark:text-emerald-500/60" />
            <p className="font-serif text-xl font-semibold text-stone-900 dark:text-white">Dashboard is empty</p>
            <p className="mt-2 text-sm">Click &quot;Add Widget&quot; to get started</p>
            <Button
              variant="default"
              className="mt-5 gap-2 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              onClick={togglePalette}
            >
              <Plus className="h-4 w-4" />
              Add Widget
            </Button>
          </div>
        )}
      </div>

      {/* Widget Palette */}
      <WidgetPalette
        isOpen={isPaletteOpen}
        onClose={togglePalette}
        onAddWidget={addWidget}
        existingWidgets={existingWidgetTypes}
      />
    </div>
  );
}
