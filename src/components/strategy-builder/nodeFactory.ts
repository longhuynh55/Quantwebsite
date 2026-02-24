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
    case "signal":
      label = "Buy Signal";
      nodeData = {
        type: "signal",
        label,
        config: {
          label,
          signalType: "buy",
          condition: "",
          quantity: 100,
          stopLoss: 5,
          takeProfit: 10,
        },
      };
      break;
    case "output":
      label = "Output";
      nodeData = {
        type: "output",
        label,
        config: {
          label,
          metrics: ["returns", "sharpe", "drawdown"],
        },
      };
      break;
    case "weighting":
      label = "Weighting";
      nodeData = {
        type: "weighting",
        label,
        config: {
          label,
          method: "equal",
        },
      };
      break;
    case "conditional":
      label = "Conditional";
      nodeData = {
        type: "conditional",
        label,
        config: {
          label,
          condition: "value > threshold",
          threshold: 0,
        },
      };
      break;
    case "sort":
      label = "Sort";
      nodeData = {
        type: "sort",
        label,
        config: {
          label,
          sortBy: "returns",
          order: "desc",
          limit: 10,
        },
      };
      break;
    case "math":
      label = "Math";
      nodeData = {
        type: "math",
        label,
        config: {
          label,
          operation: "add",
          operand: 0,
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

