import type {
  GeneratedStrategy,
  GeneratedStrategyEdge,
  GeneratedStrategyNode,
  StrategyNodeConfig,
} from "@/lib/ai/strategy-generator";
import type { StrategyEdge, StrategyNode } from "@/lib/stores/strategyBuilderStore";
import { createStrategyNodeFromPaletteType } from "@/components/strategy-builder/nodeFactory";

type SupportedNodeType = GeneratedStrategyNode["type"];

const DATE_YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;
const TIMEFRAMES = new Set(["1d", "1h", "5m", "1w"]);

const INDICATOR_TYPES = new Set([
  "rsi",
  "macd",
  "ma",
  "ema",
  "bollinger",
  "atr",
  "volume",
]);

const FILTER_TYPES = new Set([
  "price_above",
  "price_below",
  "volume_above",
  "volume_below",
  "rsi_overbought",
  "rsi_oversold",
]);

const COMPARISON_OPERATORS = new Set([">", "<", ">=", "<=", "==", "!="]);

const SIGNAL_TYPES = new Set(["buy", "sell"]);

const METRICS = new Set([
  "returns",
  "sharpe",
  "drawdown",
  "win_rate",
  "profit_factor",
  "max_drawdown",
]);

const generateId = (prefix: string): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const coerceString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const coerceNumber = (value: unknown): number | null => {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value)) return null;
  return value;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeSymbolList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim().toUpperCase() : ""))
      .filter((item) => item.length > 0)
      .slice(0, 50);
  }
  if (typeof value === "string") {
    return value
      .split(/[,\s]+/g)
      .map((item) => item.trim().toUpperCase())
      .filter((item) => item.length > 0)
      .slice(0, 50);
  }
  return [];
};

const normalizeMetrics = (value: unknown): string[] => {
  if (!Array.isArray(value)) return ["returns", "sharpe", "drawdown"];
  const picked = value
    .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
    .filter((item) => METRICS.has(item));
  return picked.length > 0 ? Array.from(new Set(picked)).slice(0, 12) : ["returns", "sharpe", "drawdown"];
};

const defaultPositionForIndex = (type: SupportedNodeType, index: number): { x: number; y: number } => {
  const row = Math.floor(index / 4);
  const col = index % 4;
  const y = 100 + row * 180;
  switch (type) {
    case "dataSource":
      return { x: 80, y };
    case "indicator":
      return { x: 340, y };
    case "filter":
      return { x: 600, y };
    case "signal":
      return { x: 860, y };
    case "output":
      return { x: 1100, y };
    default:
      return { x: 80 + col * 260, y };
  }
};

function sanitizeConfigByType(type: SupportedNodeType, raw: unknown, label: string): { config: StrategyNodeConfig; warnings: string[] } {
  const warnings: string[] = [];
  const input = isRecord(raw) ? raw : {};

  const config: StrategyNodeConfig = {};

  if (type === "dataSource") {
    config.stocks = normalizeSymbolList(input.stocks);
    const timeframe = coerceString(input.timeframe).trim();
    config.timeframe = TIMEFRAMES.has(timeframe) ? timeframe : "1d";
    const startDate = coerceString(input.startDate).trim();
    const endDate = coerceString(input.endDate).trim();
    config.startDate = DATE_YYYY_MM_DD.test(startDate) ? startDate : "";
    config.endDate = DATE_YYYY_MM_DD.test(endDate) ? endDate : "";
  }

  if (type === "indicator") {
    const indicatorType = coerceString(input.indicatorType).trim().toLowerCase();
    config.indicatorType = INDICATOR_TYPES.has(indicatorType) ? (indicatorType as StrategyNodeConfig["indicatorType"]) : "rsi";

    const period = coerceNumber(input.period);
    config.period = period === null ? 14 : clamp(Math.round(period), 2, 500);

    const fastPeriod = coerceNumber(input.fastPeriod);
    if (fastPeriod !== null) config.fastPeriod = clamp(Math.round(fastPeriod), 2, 200);
    const slowPeriod = coerceNumber(input.slowPeriod);
    if (slowPeriod !== null) config.slowPeriod = clamp(Math.round(slowPeriod), 2, 400);
    const signalPeriod = coerceNumber(input.signalPeriod);
    if (signalPeriod !== null) config.signalPeriod = clamp(Math.round(signalPeriod), 2, 200);
    const standardDeviations = coerceNumber(input.standardDeviations);
    if (standardDeviations !== null) config.standardDeviations = clamp(standardDeviations, 0.5, 6);
  }

  if (type === "filter") {
    const filterType = coerceString(input.filterType).trim().toLowerCase();
    config.filterType = FILTER_TYPES.has(filterType) ? (filterType as StrategyNodeConfig["filterType"]) : "rsi_oversold";
    const value = coerceNumber(input.value);
    config.value = value === null ? 30 : clamp(value, -1e9, 1e9);
    const op = coerceString(input.comparisonOperator).trim();
    config.comparisonOperator = COMPARISON_OPERATORS.has(op) ? (op as StrategyNodeConfig["comparisonOperator"]) : "<";
  }

  if (type === "signal") {
    const signalType = coerceString(input.signalType).trim().toLowerCase();
    config.signalType = SIGNAL_TYPES.has(signalType) ? (signalType as StrategyNodeConfig["signalType"]) : "buy";
    config.condition = coerceString(input.condition).trim().slice(0, 500);
    const quantity = coerceNumber(input.quantity);
    if (quantity !== null) config.quantity = clamp(Math.round(quantity), 0, 1_000_000);
    const stopLoss = coerceNumber(input.stopLoss);
    if (stopLoss !== null) config.stopLoss = clamp(stopLoss, 0, 100);
    const takeProfit = coerceNumber(input.takeProfit);
    if (takeProfit !== null) config.takeProfit = clamp(takeProfit, 0, 500);
  }

  if (type === "output") {
    config.metrics = normalizeMetrics(input.metrics);
  }

  if (Object.keys(config).length === 0) {
    warnings.push(`Node "${label}" had an empty/invalid config; defaults were applied.`);
  }

  // Always carry label into config so UI panels remain consistent.
  (config as Record<string, unknown>).label = label;
  return { config, warnings };
}

export function sanitizeGeneratedStrategyForBuilder(strategy: GeneratedStrategy): {
  strategy: GeneratedStrategy;
  warnings: string[];
} {
  const warnings: string[] = [];

  const rawNodes = Array.isArray(strategy.nodes) ? strategy.nodes : [];
  const rawEdges = Array.isArray(strategy.edges) ? strategy.edges : [];

  const usedIds = new Set<string>();
  const idRemap = new Map<string, string>();

  const fixedNodes: GeneratedStrategyNode[] = rawNodes.map((node, index) => {
    const rawId = coerceString(node?.id).trim() || `node-${index}`;
    let id = rawId;
    if (usedIds.has(id)) {
      const next = generateId("node");
      idRemap.set(rawId, next);
      id = next;
      warnings.push(`Duplicate node id "${rawId}" was remapped to "${id}".`);
    }
    usedIds.add(id);

    const type = node.type;
    const label = coerceString(node?.data?.label).trim() || coerceString(node?.data?.type).trim() || `${type} Node`;

    const rawPos = node.position;
    const x = coerceNumber(rawPos?.x);
    const y = coerceNumber(rawPos?.y);
    const position = x === null || y === null ? defaultPositionForIndex(type, index) : { x, y };
    if (x === null || y === null) {
      warnings.push(`Node "${label}" had an invalid position; a default layout was used.`);
    }

    const { config, warnings: configWarnings } = sanitizeConfigByType(type, node?.data?.config, label);
    warnings.push(...configWarnings);

    const data = {
      type,
      label,
      config,
    };

    return {
      ...node,
      id,
      type,
      position,
      data,
    } satisfies GeneratedStrategyNode;
  });

  const nodeIdSet = new Set(fixedNodes.map((node) => node.id));

  const remapNodeId = (value: string): string => idRemap.get(value) ?? value;

  const fixedEdges: GeneratedStrategyEdge[] = [];
  const edgeSeen = new Set<string>();
  for (let index = 0; index < rawEdges.length; index += 1) {
    const edge = rawEdges[index];
    const source = remapNodeId(coerceString(edge?.source).trim());
    const target = remapNodeId(coerceString(edge?.target).trim());
    if (!source || !target) continue;
    if (!nodeIdSet.has(source) || !nodeIdSet.has(target)) {
      warnings.push(`Dropped an edge referencing missing node(s): ${source} -> ${target}.`);
      continue;
    }
    const sig = `${source}::${target}::${coerceString(edge?.sourceHandle)}::${coerceString(edge?.targetHandle)}`;
    if (edgeSeen.has(sig)) {
      continue;
    }
    edgeSeen.add(sig);

    fixedEdges.push({
      id: coerceString(edge?.id).trim() || `edge-${index}`,
      source,
      target,
      sourceHandle: coerceString(edge?.sourceHandle).trim() || undefined,
      targetHandle: coerceString(edge?.targetHandle).trim() || undefined,
    });
  }

  const explanation = coerceString(strategy.explanation).trim() ||
    "Chien luoc duoc tao tu mo ta cua ban. Vui long xem cac node de hieu chi tiet.";

  return {
    strategy: {
      ...strategy,
      nodes: fixedNodes,
      edges: fixedEdges,
      explanation,
    },
    warnings,
  };
}

const edgeColorBySource: Record<string, string> = {
  dataSource: "#059669",
  indicator: "#0f766e",
  filter: "#f97316",
  signal: "#e11d48",
  output: "#10b981",
};

export function generatedStrategyToBuilderGraph(strategy: GeneratedStrategy): {
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  name: string;
} {
  const { strategy: sanitized, warnings } = sanitizeGeneratedStrategyForBuilder(strategy);
  // Warnings are meant for UI surfaces (toasts/inline). The adapter itself never throws.
  void warnings;

  const nodes: StrategyNode[] = sanitized.nodes.map((node) => {
    const base = createStrategyNodeFromPaletteType(node.type, node.position);
    if (!base) {
      // Should never happen because node.type is a supported union.
      const fallback = createStrategyNodeFromPaletteType("indicator", node.position)!;
      fallback.id = node.id;
      fallback.position = node.position;
      fallback.data.label = node.data.label;
      Object.assign(fallback.data.config as Record<string, unknown>, node.data.config, { label: node.data.label });
      return fallback;
    }

    base.id = node.id;
    base.type = node.type;
    base.position = node.position;
    base.data.type = node.type;
    base.data.label = node.data.label;
    Object.assign(base.data.config as Record<string, unknown>, node.data.config, { label: node.data.label });
    return base;
  });

  const nodeIdSet = new Set(nodes.map((node) => node.id));

  const edges: StrategyEdge[] = sanitized.edges
    .filter((edge) => nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target))
    .map((edge) => {
      const sourceType = nodes.find((node) => node.id === edge.source)?.type ?? "dataSource";
      const color = edgeColorBySource[sourceType] || "#a8a29e";
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        animated: true,
        style: { stroke: color, strokeWidth: 2 },
      } satisfies StrategyEdge;
    });

  return {
    nodes,
    edges,
    name: sanitized.name?.trim() || "AI Strategy",
  };
}

