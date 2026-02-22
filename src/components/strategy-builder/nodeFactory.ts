import type { StrategyNode, StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

const generateNodeId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `node-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

export function createStrategyNodeFromPaletteType(
  type: string,
  position: { x: number; y: number }
): StrategyNode | null {
  let nodeData: StrategyNodeData;
  let label: string;

  switch (type) {
    case "dataSource":
      label = "Data Source";
      nodeData = {
        type: "dataSource",
        label,
        config: {
          label,
          stocks: [],
          timeframe: "1d",
          startDate: "",
          endDate: "",
        },
      };
      break;
    case "indicator":
      label = "RSI";
      nodeData = {
        type: "indicator",
        label,
        config: {
          label,
          indicatorType: "rsi",
          period: 14,
        },
      };
      break;
    case "filter":
      label = "Filter";
      nodeData = {
        type: "filter",
        label,
        config: {
          label,
          filterType: "rsi_oversold",
          value: 30,
          comparisonOperator: "<",
        },
      };
      break;
    default:
      return null;
  }

  return {
    id: generateNodeId(),
    type,
    position,
    data: {
      ...nodeData,
      label,
    },
  };
}
