// Regular chart imports (eager loading)
export { LineChart, BarChart, MultiLineChart } from "./LineChart";
export { CandlestickChart, TimeRangeSelector } from "./CandlestickChart";
export { CorrelationMatrix } from "./CorrelationMatrix";
export { MonthlyReturnsHeatmap } from "./MonthlyReturnsHeatmap";
export { DrawdownChart } from "./DrawdownChart";

// Advanced chart components with drawing tools
export {
  AdvancedPriceChart,
  DrawingToolbar,
  IndicatorOverlay,
  IndicatorReferenceLines,
  INDICATOR_PRESETS,
  useDrawingManager,
} from "./advanced";

// Chart synchronization components
export {
  ChartSyncProvider,
  useChartSyncContext,
  useChartSyncContextOptional,
  ChartSyncContext,
  SyncedChart,
  withChartSync,
  SyncControls,
  SyncIndicator,
} from "./sync";

// Chart sync type exports
export type {
  ChartSyncState,
  ChartSyncActions,
  ChartSyncContextValue,
  CrosshairPosition,
  TimeRange,
  SyncedChartProps,
  SyncControlsProps,
  SyncIndicatorProps,
} from "./sync";

// Type exports
export type { OHLCVData, IndicatorConfig } from "./CandlestickChart";
export type {
  LineChartProps,
  BarChartProps,
  MultiLineChartProps,
} from "./LineChart";
export type { MonthlyReturnsHeatmapProps } from "./MonthlyReturnsHeatmap";
export type { DrawdownChartProps } from "./DrawdownChart";
export type { CorrelationMatrixProps } from "./CorrelationMatrix";

// Advanced chart type exports
export type {
  AdvancedPriceChartProps,
  DrawingToolbarProps,
  IndicatorOverlayProps,
  IndicatorConfig as AdvancedIndicatorConfig,
  IndicatorReferenceLinesProps,
  DrawingTool,
  Point,
  BaseDrawing,
  TrendLineDrawing,
  HorizontalLineDrawing,
  FibonacciDrawing,
  SupportResistanceDrawing,
  TextDrawing,
  Drawing,
  DrawingState,
  DrawingHistory,
} from "./advanced";

// Lazy-loaded chart imports (code splitting)
export {
  LazyLineChart,
  LazyBarChart,
  LazyMultiLineChart,
  LazyCandlestickChart,
  LazyTimeRangeSelector,
  LazyMonthlyReturnsHeatmap,
  LazyDrawdownChart,
  LazyCorrelationMatrix,
  LazyChartToolbar,
  LazyChartTooltip,
} from "./lazy";
