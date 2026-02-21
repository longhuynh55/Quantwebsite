# State Management Design

## Overview
QuantVN uses Zustand for state management with persistence support.

## Store Architecture

### Dashboard Store
```typescript
interface DashboardState {
  // Layout state
  layouts: DashboardLayouts;
  widgets: Widget[];
  isPaletteOpen: boolean;

  // Actions
  addWidget: (type: WidgetType) => void;
  removeWidget: (id: string) => void;
  updateLayout: (layouts: DashboardLayouts) => void;
  updateWidgetConfig: (id: string, config: Record<string, unknown>) => void;
  togglePalette: () => void;
  resetToDefault: () => void;
}
```

### Strategy Builder Store
```typescript
interface StrategyBuilderState {
  // Strategy state
  currentStrategy: Strategy | null;
  nodes: StrategyNode[];
  edges: StrategyEdge[];

  // UI state
  selectedNodeId: string | null;
  isDirty: boolean;

  // Actions
  addNode: (node: StrategyNode) => void;
  updateNode: (id: string, data: Partial<StrategyNodeData>) => void;
  removeNode: (id: string) => void;
  connectNodes: (source: string, target: string) => void;
  validateStrategy: () => ValidationResult;
  runBacktest: () => Promise<BacktestResult>;
}
```

### Real-time Store
```typescript
interface RealtimeState {
  // Price data
  prices: Record<string, PriceData>;

  // Metadata
  lastUpdate: Record<string, number>;

  // Actions
  updatePrice: (symbol: string, data: PriceData) => void;
}
```

### Connection Store
```typescript
interface ConnectionState {
  status: ConnectionStatus;
  reconnectAttempts: number;
  lastConnected: number | null;

  // Actions
  setConnected: () => void;
  setDisconnected: () => void;
  setReconnecting: () => void;
}
```

## Persistence

### LocalStorage Keys
- `quantvn-dashboard` - Dashboard layout and widgets
- `quantvn-strategies` - Saved strategies
- `quantvn-preferences` - User preferences

### Usage
```typescript
export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      // State and actions
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
```

## Best Practices

1. **Single Source of Truth**: Each domain has one store
2. **Immutable Updates**: Use `set` with spread operator
3. **Selective Persistence**: Only persist necessary data
4. **Type Safety**: Define interfaces for all state

## Store Composition
```typescript
// Combine stores in components
const Dashboard = () => {
  const { layouts, widgets } = useDashboardStore();
  const { prices } = useRealtimeStore();
  const { status } = useConnectionStore();

  // Use combined state
};
```
