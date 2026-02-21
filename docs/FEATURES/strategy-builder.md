# Visual Strategy Builder Specification

## Overview
Composer.trade-style visual strategy builder using React Flow.

## Components

### StrategyCanvas
Main canvas using @xyflow/react.

```typescript
interface StrategyCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
}
```

### NodePalette
Draggable node library.

```typescript
interface NodePaletteProps {
  nodeTypes: NodeTypeDefinition[];
  onDragStart: (nodeType: string) => void;
}
```

### PropertyPanel
Node configuration panel.

```typescript
interface PropertyPanelProps {
  selectedNode: Node | null;
  onUpdateNode: (id: string, data: object) => void;
}
```

## Node Types

### DataSourceNode
- Stock/ETF selection
- Timeframe configuration
- Data source selection

### IndicatorNode
- Technical indicators (RSI, MACD, MA, etc.)
- Period configuration
- Output type

### FilterNode
- Condition screening
- Price/volume/fundamental filters
- Logic operators

### SignalNode
- Buy/sell signals
- Entry/exit rules
- Risk management

### OutputNode
- Strategy results
- Performance metrics
- Visualization

## Data Flow
```
DataSource → Indicator → Filter → Signal → Output
```

## Strategy Validation
- Required connections check
- Parameter validation
- Circular dependency detection

## Backtesting Integration
- One-click backtest
- Results visualization
- Performance metrics
