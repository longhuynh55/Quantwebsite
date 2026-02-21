import { create } from "zustand";
import { persist } from "zustand/middleware";

// Layout item interface compatible with react-grid-layout
export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
}

// Breakpoint keys for responsive layouts
export type DashboardBreakpoint = "lg" | "md" | "sm" | "xs" | "xxs";

// DashboardLayouts type - requires all breakpoints for internal use
// This is compatible with react-grid-layout's ResponsiveLayouts when cast
export interface DashboardLayouts {
  lg: LayoutItem[];
  md: LayoutItem[];
  sm: LayoutItem[];
  xs: LayoutItem[];
  xxs: LayoutItem[];
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  config?: Record<string, unknown>;
}

export type WidgetType =
  | "portfolio-value"
  | "watchlist"
  | "performance-chart"
  | "top-movers"
  | "market-overview"
  | "news";

export interface WidgetDefinition {
  type: WidgetType;
  title: string;
  description: string;
  defaultW: number;
  defaultH: number;
  icon: string;
}

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    type: "portfolio-value",
    title: "Giá trị danh mục",
    description: "Hiển thị tổng giá trị danh mục đầu tư",
    defaultW: 6,
    defaultH: 4,
    icon: "wallet",
  },
  {
    type: "watchlist",
    title: "Danh sách theo dõi",
    description: "Theo dõi giá cổ phiếu yêu thích",
    defaultW: 6,
    defaultH: 4,
    icon: "star",
  },
  {
    type: "performance-chart",
    title: "Biểu đồ hiệu suất",
    description: "Biểu đồ hiệu suất danh mục theo thời gian",
    defaultW: 8,
    defaultH: 6,
    icon: "chart-line",
  },
  {
    type: "top-movers",
    title: "Cổ phiếu biến động",
    description: "Top cổ phiếu tăng/giảm mạnh nhất",
    defaultW: 4,
    defaultH: 6,
    icon: "trending-up",
  },
  {
    type: "market-overview",
    title: "Tổng quan thị trường",
    description: "Các chỉ số thị trường chính",
    defaultW: 6,
    defaultH: 4,
    icon: "globe",
  },
  {
    type: "news",
    title: "Tin tức",
    description: "Tin tức thị trường mới nhất",
    defaultW: 6,
    defaultH: 4,
    icon: "newspaper",
  },
];

interface DashboardState {
  layouts: DashboardLayouts;
  widgets: Widget[];
  isPaletteOpen: boolean;
  addWidget: (type: WidgetType) => void;
  removeWidget: (id: string) => void;
  updateLayout: (layouts: DashboardLayouts) => void;
  updateWidgetConfig: (id: string, config: Record<string, unknown>) => void;
  togglePalette: () => void;
  resetToDefault: () => void;
}

const generateId = (): string => {
  return `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const DEFAULT_LAYOUTS: DashboardLayouts = {
  lg: [
    { i: "widget-portfolio-1", x: 0, y: 0, w: 6, h: 4 },
    { i: "widget-watchlist-1", x: 6, y: 0, w: 6, h: 4 },
    { i: "widget-performance-1", x: 0, y: 4, w: 8, h: 6 },
    { i: "widget-movers-1", x: 8, y: 4, w: 4, h: 6 },
    { i: "widget-market-1", x: 0, y: 10, w: 6, h: 4 },
    { i: "widget-news-1", x: 6, y: 10, w: 6, h: 4 },
  ],
  md: [
    { i: "widget-portfolio-1", x: 0, y: 0, w: 6, h: 4 },
    { i: "widget-watchlist-1", x: 6, y: 0, w: 6, h: 4 },
    { i: "widget-performance-1", x: 0, y: 4, w: 12, h: 6 },
    { i: "widget-movers-1", x: 0, y: 10, w: 6, h: 6 },
    { i: "widget-market-1", x: 6, y: 10, w: 6, h: 4 },
    { i: "widget-news-1", x: 6, y: 14, w: 6, h: 4 },
  ],
  sm: [
    { i: "widget-portfolio-1", x: 0, y: 0, w: 6, h: 4 },
    { i: "widget-watchlist-1", x: 0, y: 4, w: 6, h: 4 },
    { i: "widget-performance-1", x: 0, y: 8, w: 6, h: 6 },
    { i: "widget-movers-1", x: 0, y: 14, w: 6, h: 6 },
    { i: "widget-market-1", x: 0, y: 20, w: 6, h: 4 },
    { i: "widget-news-1", x: 0, y: 24, w: 6, h: 4 },
  ],
  xs: [
    { i: "widget-portfolio-1", x: 0, y: 0, w: 4, h: 4 },
    { i: "widget-watchlist-1", x: 0, y: 4, w: 4, h: 4 },
    { i: "widget-performance-1", x: 0, y: 8, w: 4, h: 6 },
    { i: "widget-movers-1", x: 0, y: 14, w: 4, h: 6 },
    { i: "widget-market-1", x: 0, y: 20, w: 4, h: 4 },
    { i: "widget-news-1", x: 0, y: 24, w: 4, h: 4 },
  ],
  xxs: [
    { i: "widget-portfolio-1", x: 0, y: 0, w: 2, h: 4 },
    { i: "widget-watchlist-1", x: 0, y: 4, w: 2, h: 4 },
    { i: "widget-performance-1", x: 0, y: 8, w: 2, h: 6 },
    { i: "widget-movers-1", x: 0, y: 14, w: 2, h: 6 },
    { i: "widget-market-1", x: 0, y: 20, w: 2, h: 4 },
    { i: "widget-news-1", x: 0, y: 24, w: 2, h: 4 },
  ],
};

const DEFAULT_WIDGETS: Widget[] = [
  { id: "widget-portfolio-1", type: "portfolio-value", title: "Giá trị danh mục" },
  { id: "widget-watchlist-1", type: "watchlist", title: "Danh sách theo dõi" },
  { id: "widget-performance-1", type: "performance-chart", title: "Biểu đồ hiệu suất" },
  { id: "widget-movers-1", type: "top-movers", title: "Cổ phiếu biến động" },
  { id: "widget-market-1", type: "market-overview", title: "Tổng quan thị trường" },
  { id: "widget-news-1", type: "news", title: "Tin tức" },
];

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      layouts: DEFAULT_LAYOUTS,
      widgets: DEFAULT_WIDGETS,
      isPaletteOpen: false,

      addWidget: (type) => {
        const definition = WIDGET_DEFINITIONS.find((d) => d.type === type);
        if (!definition) return;

        const id = generateId();
        const newWidget: Widget = {
          id,
          type,
          title: definition.title,
          config: {},
        };

        const currentLayouts = get().layouts;
        const maxY = Math.max(
          ...currentLayouts.lg.map((l) => l.y + l.h),
          0
        );

        const newLayout: LayoutItem = {
          i: id,
          x: 0,
          y: maxY,
          w: definition.defaultW,
          h: definition.defaultH,
        };

        set({
          widgets: [...get().widgets, newWidget],
          layouts: {
            ...currentLayouts,
            lg: [...currentLayouts.lg, newLayout],
          },
          isPaletteOpen: false,
        });
      },

      removeWidget: (id) => {
        set((state) => ({
          widgets: state.widgets.filter((w) => w.id !== id),
          layouts: {
            ...state.layouts,
            lg: state.layouts.lg.filter((l) => l.i !== id),
            md: state.layouts.md.filter((l) => l.i !== id),
            sm: state.layouts.sm.filter((l) => l.i !== id),
            xs: state.layouts.xs.filter((l) => l.i !== id),
            xxs: state.layouts.xxs.filter((l) => l.i !== id),
          },
        }));
      },

      updateLayout: (layouts) => {
        set({ layouts });
      },

      updateWidgetConfig: (id, config) => {
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === id ? { ...w, config: { ...w.config, ...config } } : w
          ),
        }));
      },

      togglePalette: () => {
        set((state) => ({ isPaletteOpen: !state.isPaletteOpen }));
      },

      resetToDefault: () => {
        set({
          layouts: DEFAULT_LAYOUTS,
          widgets: DEFAULT_WIDGETS,
        });
      },
    }),
    {
      name: "quantvn-dashboard",
      partialize: (state) => ({
        layouts: state.layouts,
        widgets: state.widgets,
      }),
    }
  )
);
