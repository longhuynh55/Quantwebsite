# Customizable Dashboard Widgets Specification

## Overview (Tong quan)

Koyfin-style customizable dashboard with drag-and-drop widgets for Vietnamese stock market (HOSE - Sở giao dịch chứng khoán TP.HCM). Users can personalize their workspace with various financial widgets.

### Key Features (Tinh nang chinh)

- **Drag-and-drop layout** - Kéo thả widget để sắp xếp giao diện
- **Persistent layouts** - Lưu cấu hình dashboard vào localStorage
- **Responsive design** - Tự động điều chỉnh theo kích thước màn hình
- **Real-time updates** - Cập nhật dữ liệu theo thời gian thực
- **Widget customization** - Tùy chỉnh cài đặt từng widget

---

## Component Structure

```
src/components/dashboard/
├── DashboardLayout.tsx       # Main grid layout container
├── WidgetWrapper.tsx         # Standardized widget container
├── WidgetPalette.tsx         # Widget selection panel
├── widgets/
│   ├── PortfolioValueWidget.tsx
│   ├── WatchlistWidget.tsx
│   ├── PerformanceChartWidget.tsx
│   ├── TopMoversWidget.tsx
│   ├── MarketOverviewWidget.tsx
│   ├── NewsWidget.tsx
│   ├── AllocationWidget.tsx
│   └── AlertsWidget.tsx
└── index.ts                  # Barrel export
```

---

## Technical Specifications

### DashboardLayout

Main grid layout using react-grid-layout for responsive drag-and-drop functionality.

```typescript
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardLayoutProps {
  layouts: Layouts;
  onLayoutChange: (layouts: Layouts, allLayouts: Layouts) => void;
  children: React.ReactNode;
  cols: { lg: number; md: number; sm: number; xs: number; xxs: number };
  rowHeight: number;
  breakpoints: { lg: number; md: number; sm: number; xs: number; xxs: number };
}

const defaultBreakpoints = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0
};

const defaultCols = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2
};
```

### WidgetWrapper

Standardized container for all widgets with consistent styling and actions.

```typescript
interface WidgetWrapperProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  onRemove?: () => void;
  onSettings?: () => void;
  onRefresh?: () => void;
  className?: string;
  children: React.ReactNode;
}

// Example usage
<WidgetWrapper
  id="portfolio-value"
  title="Gia tri danh muc"
  icon={<WalletIcon />}
  onRemove={() => removeWidget('portfolio-value')}
  onSettings={() => openSettings('portfolio-value')}
  onRefresh={() => refreshWidget('portfolio-value')}
>
  <PortfolioValueContent />
</WidgetWrapper>
```

### WidgetPalette

Widget selection panel for adding new widgets to the dashboard.

```typescript
interface WidgetDefinition {
  id: string;
  name: string;
  nameVi: string;
  description: string;
  descriptionVi: string;
  icon: React.ReactNode;
  category: 'portfolio' | 'market' | 'analysis' | 'news';
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  maxSize?: { w: number; h: number };
}

interface WidgetPaletteProps {
  availableWidgets: WidgetDefinition[];
  onAddWidget: (widget: WidgetDefinition) => void;
  isOpen: boolean;
  onClose: () => void;
}

// Widget definitions
const widgetDefinitions: WidgetDefinition[] = [
  {
    id: 'portfolio-value',
    name: 'Portfolio Value',
    nameVi: 'Gia tri danh muc',
    description: 'Total portfolio value with change percentage',
    descriptionVi: 'Tong gia tri danh muc voi ty le thay doi',
    icon: <WalletIcon />,
    category: 'portfolio',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 }
  },
  // ... more widgets
];
```

---

## Widget Types (Cac loai Widget)

### 1. PortfolioValueWidget

Displays total portfolio value with daily/weekly/monthly change percentage.

```typescript
interface PortfolioValueWidgetProps {
  portfolioId: string;
  showChange?: 'daily' | 'weekly' | 'monthly';
  currency?: 'VND' | 'USD';
}

interface PortfolioValueData {
  totalValue: number;
  change: number;
  changePercent: number;
  previousValue: number;
  lastUpdated: string;
}
```

### 2. WatchlistWidget

Real-time watchlist with price updates for Vietnamese stocks.

```typescript
interface WatchlistWidgetProps {
  watchlistId: string;
  displayFields?: ('price' | 'change' | 'volume' | 'turnover')[];
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  turnover: number;
  lastUpdated: string;
}
```

### 3. PerformanceChartWidget

Portfolio performance over time with benchmark comparison (VN-Index).

```typescript
interface PerformanceChartWidgetProps {
  portfolioId: string;
  period?: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'ALL';
  benchmark?: 'VNINDEX' | 'VN30' | 'HNX30';
  showDividends?: boolean;
}

interface PerformanceData {
  date: string;
  portfolioValue: number;
  portfolioReturn: number;
  benchmarkReturn: number;
}
```

### 4. TopMoversWidget

Top gainers and losers in HOSE market.

```typescript
interface TopMoversWidgetProps {
  market?: 'HOSE' | 'HNX' | 'UPCOM';
  count?: number;
  sortBy?: 'changePercent' | 'volume' | 'turnover';
  refreshInterval?: number;
}

interface TopMoverItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
}
```

### 5. MarketOverviewWidget

Market indices overview (VN-Index, VN30, HNX-Index).

```typescript
interface MarketOverviewWidgetProps {
  indices?: ('VNINDEX' | 'VN30' | 'HNX' | 'HNX30' | 'UPCOM')[];
  showDetails?: boolean;
}

interface MarketIndexData {
  code: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  volume: number;
  value: number;  // Total trading value in billion VND
  advancers: number;
  decliners: number;
  unchanged: number;
}
```

### 6. NewsWidget

Latest market news from Vietnamese financial sources.

```typescript
interface NewsWidgetProps {
  sources?: string[];
  categories?: ('market' | 'company' | 'economy' | 'sector')[];
  maxItems?: number;
  refreshInterval?: number;
}

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  relatedSymbols?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
}
```

### 7. AllocationWidget

Portfolio allocation by sector/asset class.

```typescript
interface AllocationWidgetProps {
  portfolioId: string;
  groupBy?: 'sector' | 'industry' | 'assetClass' | 'currency';
  chartType?: 'pie' | 'treemap' | 'donut';
}

interface AllocationData {
  name: string;
  value: number;
  percentage: number;
  color: string;
  items?: AllocationData[];
}
```

### 8. AlertsWidget

Price alerts and notifications.

```typescript
interface AlertsWidgetProps {
  maxItems?: number;
  showRead?: boolean;
}

interface AlertItem {
  id: string;
  symbol: string;
  type: 'price_above' | 'price_below' | 'change_above' | 'change_below' | 'volume_above';
  targetValue: number;
  currentValue: number;
  triggered: boolean;
  triggeredAt?: string;
  createdAt: string;
}
```

---

## State Management (Quan ly trang thai)

### Zustand Store

```typescript
// src/lib/stores/dashboardStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DashboardWidget {
  id: string;
  type: string;
  config: Record<string, unknown>;
  layout: { x: number; y: number; w: number; h: number };
}

interface DashboardState {
  // Layout state
  layouts: Record<string, { x: number; y: number; w: number; h: number }[]>;

  // Widget state
  widgets: DashboardWidget[];

  // Actions
  addWidget: (widget: DashboardWidget) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, config: Partial<DashboardWidget>) => void;
  updateLayouts: (layouts: Record<string, DashboardWidget[]>) => void;

  // Persistence
  saveToStorage: () => void;
  loadFromStorage: () => void;
  resetToDefault: () => void;
  exportLayout: () => string;
  importLayout: (json: string) => boolean;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      layouts: {},
      widgets: [],

      addWidget: (widget) => set((state) => ({
        widgets: [...state.widgets, widget]
      })),

      removeWidget: (id) => set((state) => ({
        widgets: state.widgets.filter((w) => w.id !== id)
      })),

      updateWidget: (id, config) => set((state) => ({
        widgets: state.widgets.map((w) =>
          w.id === id ? { ...w, ...config } : w
        )
      })),

      updateLayouts: (layouts) => set({ layouts }),

      saveToStorage: () => {
        const state = get();
        localStorage.setItem('dashboard-layout', JSON.stringify({
          layouts: state.layouts,
          widgets: state.widgets
        }));
      },

      loadFromStorage: () => {
        const saved = localStorage.getItem('dashboard-layout');
        if (saved) {
          const data = JSON.parse(saved);
          set({
            layouts: data.layouts,
            widgets: data.widgets
          });
        }
      },

      resetToDefault: () => set({
        layouts: defaultLayouts,
        widgets: defaultWidgets
      }),

      exportLayout: () => {
        const state = get();
        return JSON.stringify({
          layouts: state.layouts,
          widgets: state.widgets,
          version: 1
        });
      },

      importLayout: (json) => {
        try {
          const data = JSON.parse(json);
          if (data.version === 1) {
            set({
              layouts: data.layouts,
              widgets: data.widgets
            });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      }
    }),
    {
      name: 'quantvn-dashboard',
      version: 1
    }
  )
);
```

---

## Usage Examples (Vi du su dung)

### Basic Dashboard Setup

```typescript
// app/dashboard/page.tsx
'use client';

import { DashboardLayout } from '@/components/dashboard';
import { useDashboardStore } from '@/lib/stores/dashboardStore';

export default function DashboardPage() {
  const { layouts, widgets, updateLayouts, addWidget, removeWidget } = useDashboardStore();

  return (
    <div className="container mx-auto p-4">
      <DashboardLayout
        layouts={layouts}
        onLayoutChange={updateLayouts}
      >
        {widgets.map((widget) => (
          <WidgetWrapper
            key={widget.id}
            id={widget.id}
            title={widget.type}
            onRemove={() => removeWidget(widget.id)}
          >
            <WidgetContent type={widget.type} config={widget.config} />
          </WidgetWrapper>
        ))}
      </DashboardLayout>
    </div>
  );
}
```

### Adding a Widget Programmatically

```typescript
import { useDashboardStore } from '@/lib/stores/dashboardStore';
import { widgetDefinitions } from '@/components/dashboard/definitions';

function AddWidgetButton({ widgetType }: { widgetType: string }) {
  const addWidget = useDashboardStore((state) => state.addWidget);

  const handleAdd = () => {
    const definition = widgetDefinitions.find((w) => w.id === widgetType);
    if (definition) {
      addWidget({
        id: `${widgetType}-${Date.now()}`,
        type: widgetType,
        config: {},
        layout: {
          x: 0,
          y: Infinity,  // Add to bottom
          w: definition.defaultSize.w,
          h: definition.defaultSize.h
        }
      });
    }
  };

  return (
    <Button onClick={handleAdd}>
      Add {widgetType}
    </Button>
  );
}
```

---

## Default Layouts (Bố cục mặc định)

### New User Default

```typescript
const defaultWidgets: DashboardWidget[] = [
  {
    id: 'portfolio-value-default',
    type: 'portfolio-value',
    config: { showChange: 'daily' },
    layout: { x: 0, y: 0, w: 3, h: 2 }
  },
  {
    id: 'market-overview-default',
    type: 'market-overview',
    config: { indices: ['VNINDEX', 'VN30', 'HNX'] },
    layout: { x: 3, y: 0, w: 6, h: 2 }
  },
  {
    id: 'watchlist-default',
    type: 'watchlist',
    config: { watchlistId: 'default' },
    layout: { x: 9, y: 0, w: 3, h: 4 }
  },
  {
    id: 'performance-chart-default',
    type: 'performance-chart',
    config: { period: '1M', benchmark: 'VNINDEX' },
    layout: { x: 0, y: 2, w: 9, h: 3 }
  },
  {
    id: 'top-movers-default',
    type: 'top-movers',
    config: { market: 'HOSE', count: 5 },
    layout: { x: 0, y: 5, w: 6, h: 3 }
  },
  {
    id: 'news-default',
    type: 'news',
    config: { maxItems: 5 },
    layout: { x: 6, y: 5, w: 6, h: 3 }
  }
];
```

---

## Responsive Breakpoints

```typescript
const breakpoints = {
  lg: 1200,  // Desktop - 12 columns
  md: 996,   // Small desktop - 10 columns
  sm: 768,   // Tablet - 6 columns
  xs: 480,   // Large mobile - 4 columns
  xxs: 0     // Mobile - 2 columns
};

const cols = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2
};

// Row height in pixels
const ROW_HEIGHT = 100;

// Grid margin
const MARGIN = [16, 16] as [number, number];
```

---

## Performance Considerations

1. **Lazy Loading** - Widgets are lazy loaded to improve initial render time
2. **Memoization** - Widget content is memoized to prevent unnecessary re-renders
3. **Debounced Updates** - Layout changes are debounced before saving
4. **Virtualization** - Large lists within widgets use virtualization

---

## Dependencies

```json
{
  "dependencies": {
    "react-grid-layout": "^1.4.4",
    "zustand": "^4.5.7",
    "recharts": "^2.15.4",
    "lucide-react": "^0.358.0"
  }
}
```

---

## API Integration

### Fetch Widget Data

```typescript
// GET /api/dashboard/widgets
interface WidgetDataRequest {
  widgets: {
    id: string;
    type: string;
    config: Record<string, unknown>;
  }[];
}

interface WidgetDataResponse {
  data: Record<string, unknown>;
  lastUpdated: string;
}

// POST /api/dashboard/layout
interface SaveLayoutRequest {
  layouts: Layouts;
  widgets: DashboardWidget[];
}
```

---

*Document Version: 1.0*
*Last Updated: February 2026*
*Author: QuantVN Team*
