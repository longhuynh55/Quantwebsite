# Advanced Charts Specification

## Overview (Tong quan)

Professional-grade charting system for Vietnamese stock market (HOSE) with TradingView-like features. Supports multiple chart types, technical indicators, drawing tools, and multi-timeframe analysis.

### Key Features (Tinh nang chinh)

- **Multiple Chart Types** - Nen, Thanh, Duong, Vung, Heiken Ashi, Renko
- **Technical Indicators** - Tren 50 chi so ky thuat (SMA, EMA, RSI, MACD, Bollinger Bands, etc.)
- **Drawing Tools** - Cong cu ve trendline, horizontal line, fibonacci
- **Multi-timeframe** - Phan tich nhieu khung thoi gian
- **Comparison Mode** - So sanh nhieu ma chung khoan
- **Dark Mode** - Ho tro che do toi

---

## Component Structure

```
src/components/charts/
├── advanced/
│   ├── AdvancedChart.tsx          # Main chart container
│   ├── ChartToolbar.tsx           # Chart controls toolbar
│   ├── ChartContainer.tsx         # Chart rendering container
│   ├── IndicatorPanel.tsx         # Technical indicators panel
│   ├── DrawingToolbar.tsx         # Drawing tools toolbar
│   ├── TimeframeSelector.tsx      # Timeframe selection
│   ├── ChartSettings.tsx          # Chart configuration
│   ├── ComparisonSelector.tsx     # Multi-symbol comparison
│   ├── DataLabels.tsx             # Price data labels
│   └── index.ts
├── indicators/
│   ├── IndicatorOverlay.tsx       # Overlay indicators (MA, BB)
│   ├── IndicatorPane.tsx          # Separate pane indicators (RSI, MACD)
│   ├── IndicatorSelector.tsx      # Indicator selection UI
│   ├── IndicatorConfig.tsx        # Indicator configuration modal
│   └── index.ts
├── drawings/
│   ├── DrawingManager.tsx         # Drawing state management
│   ├── TrendLine.tsx              # Trend line drawing
│   ├── HorizontalLine.tsx         # Horizontal line drawing
│   ├── FibonacciRetracement.tsx   # Fibonacci retracement
│   ├── Rectangle.tsx              # Rectangle drawing
│   ├── TextAnnotation.tsx         # Text annotations
│   └── index.ts
└── primitives/
    ├── CandlestickSeries.tsx      # Candlestick rendering
    ├── BarSeries.tsx              # Bar chart rendering
    ├── LineSeries.tsx             # Line chart rendering
    ├── AreaSeries.tsx             # Area chart rendering
    ├── VolumeSeries.tsx           # Volume bars
    └── index.ts
```

---

## Technical Specifications

### AdvancedChart

Main chart container that orchestrates all chart components.

```typescript
interface AdvancedChartProps {
  symbol: string;
  interval?: ChartInterval;
  chartType?: ChartType;
  indicators?: IndicatorConfig[];
  drawings?: Drawing[];
  comparisons?: string[];
  theme?: 'light' | 'dark';
  height?: number;
  onCrosshairMove?: (data: CrosshairData) => void;
  onDrawingCreate?: (drawing: Drawing) => void;
  onIndicatorAdd?: (indicator: IndicatorConfig) => void;
}

type ChartInterval =
  | '1m' | '5m' | '15m' | '30m' | '1h'
  | '2h' | '4h' | '1D' | '1W' | '1M';

type ChartType =
  | 'candlestick'
  | 'bar'
  | 'line'
  | 'area'
  | 'heiken-ashi'
  | 'renko'
  | 'kagi'
  | 'point-figure';

interface ChartConfig {
  autoScale: boolean;
  scaleMode: 'linear' | 'logarithmic';
  showVolume: boolean;
  showGrid: boolean;
  showCrosshair: boolean;
  showWatermark: boolean;
  showLogo: boolean;
}
```

### ChartToolbar

Control panel for chart customization.

```typescript
interface ChartToolbarProps {
  chartType: ChartType;
  interval: ChartInterval;
  indicators: IndicatorConfig[];
  onChartTypeChange: (type: ChartType) => void;
  onIntervalChange: (interval: ChartInterval) => void;
  onIndicatorAdd: (indicator: IndicatorConfig) => void;
  onDrawingModeChange: (mode: DrawingMode | null) => void;
  onSettingsOpen: () => void;
  onFullscreen: () => void;
  onSaveImage: () => void;
}

// Toolbar layout
/*
+------------------------------------------------------------------+
| [Logo] [Interval: 1D v] [Type: Candle v] [Indicators] [Drawings] |
| [Settings] [Fullscreen] [Screenshot] [Compare] [Reset]            |
+------------------------------------------------------------------+
*/
```

### TimeframeSelector

Quick timeframe selection buttons.

```typescript
interface TimeframeSelectorProps {
  value: ChartInterval;
  onChange: (interval: ChartInterval) => void;
  availableIntervals?: ChartInterval[];
}

// Layout
/*
+------------------------------------------------+
| 1m | 5m | 15m | 30m | 1H | 4H | 1D | 1W | 1M |
+------------------------------------------------+
*/
```

---

## Chart Types (Cac loai bieu do)

### 1. Candlestick Chart (Bieu do nen)

```typescript
interface CandlestickData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlestickStyle {
  upColor: string;        // Green for price increase
  downColor: string;      // Red for price decrease
  borderUpColor: string;
  borderDownColor: string;
  wickUpColor: string;
  wickDownColor: string;
  borderVisible: boolean;
  wickVisible: boolean;
}

// Default colors for Vietnamese market
const defaultCandlestickStyle: CandlestickStyle = {
  upColor: '#26a69a',      // Green (Mau xanh - Tang)
  downColor: '#ef5350',    // Red (Mau do - Giam)
  borderUpColor: '#26a69a',
  borderDownColor: '#ef5350',
  wickUpColor: '#26a69a',
  wickDownColor: '#ef5350',
  borderVisible: true,
  wickVisible: true
};
```

### 2. Line Chart (Bieu do duong)

```typescript
interface LineChartConfig {
  priceLineVisible: boolean;
  lastValueVisible: boolean;
  lineWidth: number;
  lineType: 'simple' | 'withSteps' | 'curved';
  lineStyle: 'solid' | 'dotted' | 'dashed';
  color: string;
  crosshairMarkerVisible: boolean;
  crosshairMarkerRadius: number;
}
```

### 3. Heiken Ashi

```typescript
interface HeikenAshiData {
  time: string;
  open: number;   // (prevOpen + prevClose) / 2
  high: number;   // max(high, open, close)
  low: number;    // min(low, open, close)
  close: number;  // (open + high + low + close) / 4
}

function calculateHeikenAshi(data: CandlestickData[]): HeikenAshiData[] {
  return data.map((candle, i) => {
    if (i === 0) {
      return {
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: (candle.open + candle.high + candle.low + candle.close) / 4
      };
    }

    const prev = data[i - 1];
    const haClose = (candle.open + candle.high + candle.low + candle.close) / 4;
    const haOpen = (prev.open + prev.close) / 2;

    return {
      time: candle.time,
      open: haOpen,
      high: Math.max(candle.high, haOpen, haClose),
      low: Math.min(candle.low, haOpen, haClose),
      close: haClose
    };
  });
}
```

---

## Technical Indicators (Chi so ky thuat)

### Indicator Categories

```typescript
type IndicatorCategory =
  | 'trend'           // Xu huong: SMA, EMA, WMA, etc.
  | 'momentum'        // Dong luong: RSI, Stochastic, CCI, etc.
  | 'volatility'      // Bien dong: Bollinger Bands, ATR, Keltner
  | 'volume'          // Khoi luong: OBV, VWAP, MFI
  | 'oscillator';     // Dao dong: MACD, ROC, ADX

interface IndicatorConfig {
  id: string;
  name: string;
  nameVi: string;
  category: IndicatorCategory;
  type: 'overlay' | 'pane';  // overlay on price or separate pane
  params: IndicatorParam[];
  styles: IndicatorStyle;
}

interface IndicatorParam {
  name: string;
  displayName: string;
  displayNameVi: string;
  type: 'number' | 'select' | 'color';
  default: number | string;
  min?: number;
  max?: number;
  options?: string[];
}
```

### Trend Indicators (Chi so xu huong)

#### Simple Moving Average (SMA)

```typescript
const SMA_CONFIG: IndicatorDefinition = {
  id: 'sma',
  name: 'Simple Moving Average',
  nameVi: 'Trung binh dong don gian',
  category: 'trend',
  type: 'overlay',
  params: [
    { name: 'period', displayName: 'Period', displayNameVi: 'Chu ky', type: 'number', default: 20, min: 1, max: 500 },
    { name: 'color', displayName: 'Color', displayNameVi: 'Mau sac', type: 'color', default: '#2196F3' },
    { name: 'lineWidth', displayName: 'Line Width', displayNameVi: 'Do day', type: 'number', default: 2, min: 1, max: 5 }
  ],
  calculate: (data: number[], period: number) => {
    const result: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result;
  }
};
```

### Momentum Indicators (Chi so dong luong)

#### Relative Strength Index (RSI)

```typescript
const RSI_CONFIG: IndicatorDefinition = {
  id: 'rsi',
  name: 'Relative Strength Index',
  nameVi: 'Chi so suc manh tuong doi',
  category: 'momentum',
  type: 'pane',
  params: [
    { name: 'period', displayName: 'Period', displayNameVi: 'Chu ky', type: 'number', default: 14, min: 1, max: 100 },
    { name: 'overbought', displayName: 'Overbought Level', displayNameVi: 'Mua qua muc', type: 'number', default: 70 },
    { name: 'oversold', displayName: 'Oversold Level', displayNameVi: 'Ban qua muc', type: 'number', default: 30 }
  ],
  calculate: (closes: number[], period: number) => {
    // RSI calculation implementation
    const result: (number | null)[] = [];
    // ... calculation logic
    return result;
  }
};
```

### Available Indicators List

| Category | Indicators (English) | Indicators (Tieng Viet) |
|----------|---------------------|------------------------|
| Trend | SMA, EMA, WMA, TEMA, VWMA | Trung binh dong don gian, mu so, trong so |
| Momentum | RSI, Stochastic, CCI, Williams %R | Chi so suc manh tuong doi, Stochastic |
| Volatility | Bollinger Bands, ATR, Keltner Channel | Bollinger Bands, ATR, Kenh Keltner |
| Volume | OBV, VWAP, MFI, Chaikin Money Flow | OBV, VWAP, MFI |
| Oscillator | MACD, ROC, ADX, DMI | MACD, ROC, ADX, DMI |

---

## Drawing Tools (Cong cu ve)

### Drawing Types

```typescript
type DrawingType =
  | 'trend-line'
  | 'horizontal-line'
  | 'vertical-line'
  | 'ray'
  | 'parallel-channel'
  | 'fibonacci-retracement'
  | 'fibonacci-extension'
  | 'rectangle'
  | 'circle'
  | 'text'
  | 'arrow'
  | 'brush'
  | 'measure';

interface Drawing {
  id: string;
  type: DrawingType;
  points: ChartPoint[];
  style: DrawingStyle;
  locked: boolean;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ChartPoint {
  time: string;
  price: number;
  x?: number;
  y?: number;
}

interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  backgroundColor?: string;
  backgroundOpacity?: number;
  fontSize?: number;
  fontFamily?: string;
}
```

### Fibonacci Retracement

```typescript
const FIBONACCI_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

interface FibonacciDrawing extends Drawing {
  type: 'fibonacci-retracement';
  startPoint: ChartPoint;
  endPoint: ChartPoint;
  levels: number[];
  showLabels: boolean;
  extendLines: boolean;
}

function calculateFibonacciLevels(
  highPrice: number,
  lowPrice: number,
  levels: number[]
): Record<number, number> {
  const diff = highPrice - lowPrice;
  return levels.reduce((acc, level) => {
    acc[level] = highPrice - diff * level;
    return acc;
  }, {} as Record<number, number>);
}
```

---

## Data Flow

```
PriceData (OHLCV)
    |
    v
+-------------------+
|  ChartRenderer    |  <-- ChartType (candlestick, line, etc.)
+-------------------+
    |
    v
+-------------------+
|  DrawingLayer     |  <-- User drawings (trendlines, fibonacci)
+-------------------+
    |
    v
+-------------------+
|  IndicatorLayer   |  <-- Technical indicators (SMA, RSI, MACD)
+-------------------+
    |
    v
    Output (Chart UI)
```

---

## State Management

### Chart Store

```typescript
// src/lib/stores/chartStore.ts
import { create } from 'zustand';

interface ChartState {
  // Chart configuration
  symbol: string;
  interval: ChartInterval;
  chartType: ChartType;

  // Indicators
  indicators: IndicatorConfig[];

  // Drawings
  drawings: Drawing[];
  activeDrawingTool: DrawingType | null;

  // Comparison
  comparisonSymbols: string[];

  // Theme
  theme: 'light' | 'dark';

  // Actions
  setSymbol: (symbol: string) => void;
  setInterval: (interval: ChartInterval) => void;
  setChartType: (type: ChartType) => void;
  addIndicator: (indicator: IndicatorConfig) => void;
  removeIndicator: (id: string) => void;
  addDrawing: (drawing: Drawing) => void;
  removeDrawing: (id: string) => void;
  setActiveDrawingTool: (tool: DrawingType | null) => void;
  addComparisonSymbol: (symbol: string) => void;
  removeComparisonSymbol: (symbol: string) => void;
  toggleTheme: () => void;
  resetChart: () => void;
}
```

---

## Usage Examples (Vi du su dung)

### Basic Chart Setup

```typescript
import { AdvancedChart } from '@/components/charts/advanced';

export default function StockChartPage({ params }: { params: { symbol: string } }) {
  return (
    <div className="h-[600px]">
      <AdvancedChart
        symbol={params.symbol}
        interval="1D"
        chartType="candlestick"
        theme="dark"
        height={600}
      />
    </div>
  );
}
```

### Chart with Indicators

```typescript
import { AdvancedChart } from '@/components/charts/advanced';

const defaultIndicators: IndicatorConfig[] = [
  { id: 'sma-20', name: 'SMA', params: { period: 20 }, styles: { color: '#2196F3' } },
  { id: 'sma-50', name: 'SMA', params: { period: 50 }, styles: { color: '#FF9800' } },
  { id: 'rsi-14', name: 'RSI', params: { period: 14 } }
];

<AdvancedChart
  symbol="VIC"
  indicators={defaultIndicators}
  onCrosshairMove={(data) => console.log('Crosshair:', data)}
/>
```

---

## API Integration

### Fetch OHLCV Data

```typescript
// GET /api/charts/ohlcv
interface OHLCVRequest {
  symbol: string;
  interval: ChartInterval;
  from?: string;
  to?: string;
  limit?: number;
}

interface OHLCVResponse {
  symbol: string;
  interval: ChartInterval;
  data: CandlestickData[];
  metadata: {
    firstDate: string;
    lastDate: string;
    dataPoints: number;
  };
}
```

---

## Persistence (Luu tru)

Drawings are saved to localStorage and can be exported/imported as JSON.

```typescript
// Save drawings
localStorage.setItem(`drawings-${symbol}`, JSON.stringify(drawings));

// Load drawings
const saved = localStorage.getItem(`drawings-${symbol}`);
const drawings = saved ? JSON.parse(saved) : [];

// Export/Import
function exportDrawings(drawings: Drawing[]): string {
  return JSON.stringify({ version: 1, drawings });
}

function importDrawings(json: string): Drawing[] | null {
  try {
    const data = JSON.parse(json);
    return data.version === 1 ? data.drawings : null;
  } catch {
    return null;
  }
}
```

---

## Dependencies

```json
{
  "dependencies": {
    "lightweight-charts": "^4.2.0",
    "technicalindicators": "^3.1.0",
    "recharts": "^2.15.4",
    "zustand": "^4.5.7",
    "date-fns": "^3.3.1"
  }
}
```

---

## Performance Considerations

1. **Data Virtualization** - Only render visible data points
2. **Indicator Caching** - Cache calculated indicator values
3. **Debounced Redraw** - Debounce chart redraws on rapid updates
4. **Web Workers** - Offload heavy calculations to web workers
5. **Canvas Rendering** - Use canvas for high-frequency updates

---

*Document Version: 1.0*
*Last Updated: February 2026*
*Author: QuantVN Team*
