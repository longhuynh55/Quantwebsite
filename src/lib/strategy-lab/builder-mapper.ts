import type { StrategyType } from "@/lib/quant/backtest";
import type {
  Strategy,
  StrategyNode,
  StrategyNodeData,
} from "@/lib/stores/strategyBuilderStore";
import type { StrategyLabCreateRunRequest } from "@/lib/strategy-lab/contracts";

const SYMBOL_REGEX = /^[A-Z0-9]{1,10}$/;
const DEFAULT_CAPITAL = 100000;

type DataSourceNode = StrategyNode & {
  data: Extract<StrategyNodeData, { type: "dataSource" }>;
};
type IndicatorNode = StrategyNode & {
  data: Extract<StrategyNodeData, { type: "indicator" }>;
};
type FilterNode = StrategyNode & {
  data: Extract<StrategyNodeData, { type: "filter" }>;
};
type SupportedIndicatorType = "ma" | "ema" | "rsi" | "bollinger";

const SUPPORTED_INDICATOR_TYPES = new Set<SupportedIndicatorType>([
  "ma",
  "ema",
  "rsi",
  "bollinger",
]);
const RSI_FILTER_TYPES = new Set(["rsi_oversold", "rsi_overbought"]);

function getDistinctIndicatorTypes(indicators: IndicatorNode[]): string[] {
  return Array.from(
    new Set(indicators.map((node) => node.data.config.indicatorType))
  );
}

function getDistinctFilterTypes(filters: FilterNode[]): string[] {
  return Array.from(new Set(filters.map((node) => node.data.config.filterType)));
}

export class StrategyBuilderMappingError extends Error {}

function isNodeType<TType extends StrategyNodeData["type"]>(
  node: StrategyNode,
  type: TType
): node is StrategyNode & { data: Extract<StrategyNodeData, { type: TType }> } {
  return node.data?.type === type;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeCapital(rawCapital?: number): number {
  if (typeof rawCapital !== "number" || !Number.isFinite(rawCapital)) {
    return DEFAULT_CAPITAL;
  }
  if (rawCapital < 1) {
    throw new StrategyBuilderMappingError("Capital must be at least 1.");
  }
  return rawCapital;
}

function getDataSourceNode(strategy: Strategy): DataSourceNode {
  const dataSourceNodes = strategy.nodes.filter((node): node is DataSourceNode =>
    isNodeType(node, "dataSource")
  );
  if (dataSourceNodes.length === 0) {
    throw new StrategyBuilderMappingError("Please add a Data Source node.");
  }
  return dataSourceNodes[0];
}

function getIndicatorNodes(strategy: Strategy): IndicatorNode[] {
  return strategy.nodes.filter((node): node is IndicatorNode =>
    isNodeType(node, "indicator")
  );
}

function getFilterNodes(strategy: Strategy): FilterNode[] {
  return strategy.nodes.filter((node): node is FilterNode =>
    isNodeType(node, "filter")
  );
}

function pickStrategyFromIndicators(
  indicators: IndicatorNode[],
  filters: FilterNode[]
): { strategyType: StrategyType; params: Record<string, number> } {
  if (indicators.length === 0) {
    throw new StrategyBuilderMappingError("Please add at least one Indicator node.");
  }

  const primary = indicators[0];
  const indicatorType = primary.data.config.indicatorType;
  const uniqueIndicatorTypes = getDistinctIndicatorTypes(indicators);
  if (uniqueIndicatorTypes.length > 1) {
    throw new StrategyBuilderMappingError(
      `Mixed indicator families are not supported. Use one of: ${Array.from(
        SUPPORTED_INDICATOR_TYPES
      ).join(", ")}.`
    );
  }
  if (!SUPPORTED_INDICATOR_TYPES.has(indicatorType as SupportedIndicatorType)) {
    throw new StrategyBuilderMappingError(
      `Indicator type "${indicatorType}" is not supported in Template Tuner mode. Supported: ${Array.from(
        SUPPORTED_INDICATOR_TYPES
      ).join(", ")}.`
    );
  }

  if (indicatorType === "ma" || indicatorType === "ema") {
    if (filters.length > 0) {
      throw new StrategyBuilderMappingError(
        `Filters are not supported with ${indicatorType.toUpperCase()} strategies in Template Tuner mode.`
      );
    }

    const sameType = indicators.filter(
      (node) => node.data.config.indicatorType === indicatorType
    );
    const periods = sameType
      .map((node) => node.data.config.period)
      .filter((period): period is number => Number.isFinite(period))
      .map((period) => Math.max(2, Math.floor(period)));

    const shortest = periods.length > 0 ? Math.min(...periods) : 10;
    const longestRaw = periods.length > 1 ? Math.max(...periods) : shortest * 2;
    const longPeriod = Math.max(shortest + 1, longestRaw);

    return {
      strategyType: indicatorType === "ma" ? "sma_crossover" : "ema_crossover",
      params: {
        shortPeriod: clamp(shortest, 2, 299),
        longPeriod: clamp(longPeriod, 3, 300),
      },
    };
  }

  if (indicatorType === "rsi") {
    const unsupportedRsiFilters = getDistinctFilterTypes(filters).filter(
      (filterType) => !RSI_FILTER_TYPES.has(filterType)
    );
    if (unsupportedRsiFilters.length > 0) {
      throw new StrategyBuilderMappingError(
        `RSI only supports filters: ${Array.from(RSI_FILTER_TYPES).join(
          ", "
        )}. Unsupported: ${unsupportedRsiFilters.join(", ")}.`
      );
    }

    const period = clamp(
      Math.floor(primary.data.config.period || 14),
      2,
      100
    );

    const oversoldNode = filters.find(
      (node) => node.data.config.filterType === "rsi_oversold"
    );
    const overboughtNode = filters.find(
      (node) => node.data.config.filterType === "rsi_overbought"
    );

    let oversold = clamp(oversoldNode?.data.config.value ?? 30, 5, 50);
    let overbought = clamp(overboughtNode?.data.config.value ?? 70, 50, 95);
    if (oversold >= overbought) {
      oversold = 30;
      overbought = 70;
    }

    return {
      strategyType: "rsi_mean_reversion",
      params: { period, oversold, overbought },
    };
  }

  if (indicatorType === "bollinger") {
    if (filters.length > 0) {
      throw new StrategyBuilderMappingError(
        "Filters are not supported with Bollinger strategies in Template Tuner mode."
      );
    }

    const period = clamp(
      Math.floor(primary.data.config.period || 20),
      5,
      200
    );
    const stdDev = clamp(primary.data.config.standardDeviations ?? 2, 0.5, 4);

    return {
      strategyType: "bollinger_bands",
      params: { period, stdDev },
    };
  }

  throw new StrategyBuilderMappingError(
    `Indicator type "${indicatorType}" is not supported in Template Tuner mode.`
  );
}

export function buildStrategyLabRunRequest(
  strategy: Strategy,
  options?: {
    name?: string;
    capital?: number;
  }
): StrategyLabCreateRunRequest {
  if (!strategy || strategy.nodes.length === 0) {
    throw new StrategyBuilderMappingError(
      "Please add nodes to your strategy before running a backtest."
    );
  }

  const dataSource = getDataSourceNode(strategy);
  const symbolCandidate = dataSource.data.config.stocks[0]?.trim().toUpperCase();
  if (!symbolCandidate || !SYMBOL_REGEX.test(symbolCandidate)) {
    throw new StrategyBuilderMappingError(
      "Data Source must include a valid HOSE symbol (1-10 uppercase letters/digits)."
    );
  }

  const indicators = getIndicatorNodes(strategy);
  const filters = getFilterNodes(strategy);
  const capital = normalizeCapital(options?.capital);
  const mapping = pickStrategyFromIndicators(indicators, filters);

  const from = dataSource.data.config.startDate?.trim();
  const to = dataSource.data.config.endDate?.trim();
  const dateRange =
    from || to
      ? {
          from: from || undefined,
          to: to || undefined,
        }
      : undefined;

  return {
    name: options?.name?.trim() || strategy.name,
    exchange: "HOSE",
    symbol: symbolCandidate,
    strategyType: mapping.strategyType,
    params: mapping.params,
    capital,
    dateRange,
    priority: "normal",
  };
}
