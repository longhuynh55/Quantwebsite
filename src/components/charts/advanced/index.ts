// Advanced chart components with drawing tools
export { AdvancedPriceChart } from "./AdvancedPriceChart";
export { DrawingToolbar } from "./DrawingToolbar";
export {
  IndicatorOverlay,
  IndicatorReferenceLines,
  INDICATOR_PRESETS,
} from "./IndicatorOverlay";

// Type exports
export type { AdvancedPriceChartProps, OHLCVData } from "./AdvancedPriceChart";
export type { DrawingToolbarProps } from "./DrawingToolbar";
export type {
  IndicatorOverlayProps,
  IndicatorConfig,
  IndicatorReferenceLinesProps,
} from "./IndicatorOverlay";

// Re-export drawing types and hook
export {
  useDrawingManager,
  default as useDrawingManagerDefault,
} from "../hooks/useDrawingManager";

export type {
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
} from "../hooks/useDrawingManager";
