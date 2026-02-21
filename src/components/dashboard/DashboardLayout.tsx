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
    <div className="h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-gray-500" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefault}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Äáº·t láº¡i
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={togglePalette}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            ThÃªm Widget
          </Button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-4 min-h-[800px]">
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
          <div className="flex flex-col items-center justify-center h-[400px] text-gray-500 dark:text-gray-400">
            <LayoutGrid className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">Dashboard is empty</p>
            <p className="text-sm mt-2">Click &quot;Add Widget&quot; to get started</p>
            <Button
              variant="default"
              className="mt-4 gap-2"
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
