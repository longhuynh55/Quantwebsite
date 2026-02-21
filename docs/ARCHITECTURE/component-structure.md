# Component Structure

## Overview
QuantVN uses a modular component architecture organized by feature domain.

## Directory Structure
```
src/
├── app/                          # Next.js App Router pages
│   ├── dashboard/               # Dashboard page
│   ├── strategy-builder/        # Strategy builder page
│   ├── screener/               # Stock screener
│   ├── backtesting/            # Backtesting results
│   ├── portfolio/              # Portfolio management
│   └── charts/                 # Chart views
│
├── components/
│   ├── ui/                     # Base UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   │
│   ├── dashboard/              # Dashboard components
│   │   ├── DashboardLayout.tsx
│   │   ├── WidgetWrapper.tsx
│   │   ├── WidgetPalette.tsx
│   │   └── widgets/
│   │       ├── PortfolioValueWidget.tsx
│   │       ├── WatchlistWidget.tsx
│   │       └── ...
│   │
│   ├── strategy-builder/       # Strategy builder components
│   │   ├── StrategyCanvas.tsx
│   │   ├── NodePalette.tsx
│   │   ├── PropertyPanel.tsx
│   │   └── nodes/
│   │       ├── DataSourceNode.tsx
│   │       ├── IndicatorNode.tsx
│   │       └── ...
│   │
│   ├── charts/                 # Chart components
│   │   ├── advanced/
│   │   │   ├── AdvancedPriceChart.tsx
│   │   │   ├── DrawingToolbar.tsx
│   │   │   └── IndicatorOverlay.tsx
│   │   └── hooks/
│   │       ├── useDrawingManager.ts
│   │       └── useIndicatorCalculator.ts
│   │
│   └── layout/                 # Layout components
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── Footer.tsx
│
└── lib/
    ├── stores/                 # Zustand stores
    │   ├── dashboardStore.ts
    │   ├── strategyBuilderStore.ts
    │   ├── realtimeStore.ts
    │   └── connectionStore.ts
    │
    ├── websocket/              # WebSocket infrastructure
    │   ├── WebSocketManager.ts
    │   ├── SubscriptionManager.ts
    │   └── types.ts
    │
    └── hooks/                  # Custom hooks
        ├── useDebounce.ts
        ├── useMediaQuery.ts
        └── useLocalStorage.ts
```

## Component Patterns

### Widget Pattern
```typescript
interface WidgetProps {
  config?: Record<string, unknown>;
}

export function MyWidget({ config }: WidgetProps) {
  // Widget implementation
}
```

### Node Pattern (Strategy Builder)
```typescript
import { Handle, Position } from "@xyflow/react";

export function MyNode({ data }: NodeProps) {
  return (
    <div>
      <Handle type="target" position={Position.Left} />
      {/* Node content */}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

## Naming Conventions
- Components: PascalCase (e.g., `DashboardLayout`)
- Files: PascalCase for components (e.g., `DashboardLayout.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useRealtimePrice`)
- Stores: camelCase with `Store` suffix (e.g., `dashboardStore`)
