import { createStrategyNodeFromPaletteType } from "@/components/strategy-builder/nodeFactory";
import type { StrategyEdge, StrategyNode } from "@/lib/stores/strategyBuilderStore";
import { isConnectionTypeAllowed } from "@/lib/strategy-builder/connectionRules";

export type SupportedPatchNodeType =
  | "dataSource"
  | "indicator"
  | "filter"
  | "signal"
  | "output"
  | "risk"
  | "backtest";

export type StrategyPatchOp =
  | {
      op: "add_node";
      nodeType: SupportedPatchNodeType;
      nodeId?: string;
      label?: string;
      config?: Record<string, unknown>;
      positionHint?: { nearNodeId?: string; x?: number; y?: number };
    }
  | {
      op: "update_node";
      nodeId: string;
      label?: string;
      config?: Record<string, unknown>;
    }
  | {
      op: "remove_node";
      nodeId: string;
    }
  | {
      op: "add_edge";
      source: string;
      target: string;
      sourceHandle?: string;
      targetHandle?: string;
    }
  | {
      op: "remove_edge";
      edgeId?: string;
      source?: string;
      target?: string;
    }
  | {
      op: "relayout";
      mode: "compact" | "pipeline";
    };

export interface GraphValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface GraphValidationResult {
  isValid: boolean;
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  issues: GraphValidationIssue[];
}

export interface StrategyPatchApplyResult extends GraphValidationResult {
  appliedOps: number;
  diffSummary: string[];
}

const DEFAULT_MAX_NODES = 80;
const DEFAULT_MAX_EDGES = 160;
const DEFAULT_POSITION = { x: 80, y: 120 };

const EDGE_COLOR_BY_SOURCE: Record<string, string> = {
  dataSource: "#059669",
  indicator: "#0f766e",
  filter: "#f97316",
  signal: "#e11d48",
  output: "#10b981",
  weighting: "#14b8a6",
  conditional: "#14b8a6",
  sort: "#0ea5e9",
  math: "#6366f1",
  merge: "#14b8a6",
  risk: "#f59e0b",
  backtest: "#059669",
};

const PIPELINE_COLUMN: Record<string, number> = {
  dataSource: 0,
  indicator: 1,
  filter: 2,
  signal: 3,
  risk: 4,
  backtest: 5,
  output: 5,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function edgeSignature(edge: Pick<StrategyEdge, "source" | "target" | "sourceHandle" | "targetHandle">): string {
  return `${edge.source}::${edge.sourceHandle ?? ""}=>${edge.target}::${edge.targetHandle ?? ""}`;
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePosition(
  position: StrategyNode["position"] | undefined,
  fallbackIndex: number
): { x: number; y: number } {
  const x = typeof position?.x === "number" && Number.isFinite(position.x)
    ? position.x
    : DEFAULT_POSITION.x + (fallbackIndex % 4) * 280;
  const y = typeof position?.y === "number" && Number.isFinite(position.y)
    ? position.y
    : DEFAULT_POSITION.y + Math.floor(fallbackIndex / 4) * 160;
  return { x, y };
}

function createEdgeForConnection(
  source: string,
  target: string,
  sourceType: string,
  sourceHandle?: string,
  targetHandle?: string
): StrategyEdge {
  const color = EDGE_COLOR_BY_SOURCE[sourceType] ?? "#a8a29e";
  return {
    id: makeId("e"),
    source,
    target,
    sourceHandle,
    targetHandle,
    animated: true,
    style: { stroke: color, strokeWidth: 2 },
  };
}

export function sanitizeStrategyGraph(
  nodesInput: StrategyNode[],
  edgesInput: StrategyEdge[],
  options?: {
    maxNodes?: number;
    maxEdges?: number;
  }
): GraphValidationResult {
  const maxNodes = options?.maxNodes ?? DEFAULT_MAX_NODES;
  const maxEdges = options?.maxEdges ?? DEFAULT_MAX_EDGES;
  const issues: GraphValidationIssue[] = [];

  const slicedNodes = nodesInput.slice(0, maxNodes);
  if (nodesInput.length > maxNodes) {
    issues.push({
      severity: "warning",
      code: "MAX_NODES_EXCEEDED",
      message: `Graph exceeded max nodes (${maxNodes}); extra nodes were dropped.`,
    });
  }

  const seenNodeIds = new Set<string>();
  const nodes: StrategyNode[] = [];
  for (let index = 0; index < slicedNodes.length; index += 1) {
    const candidate = slicedNodes[index];
    if (!isRecord(candidate)) {
      issues.push({
        severity: "error",
        code: "NODE_INVALID",
        message: `Node at index ${index} is not a valid object.`,
      });
      continue;
    }

    const node = candidate as StrategyNode;
    let nodeId = typeof node.id === "string" ? node.id.trim() : "";
    if (!nodeId) {
      nodeId = `node-${index}`;
      issues.push({
        severity: "warning",
        code: "NODE_ID_MISSING",
        message: `Node at index ${index} had no id; assigned "${nodeId}".`,
      });
    }
    if (seenNodeIds.has(nodeId)) {
      const remapped = makeId("node");
      issues.push({
        severity: "warning",
        code: "NODE_ID_DUPLICATE",
        message: `Duplicate node id "${nodeId}" remapped to "${remapped}".`,
        nodeId,
      });
      nodeId = remapped;
    }
    seenNodeIds.add(nodeId);

    nodes.push({
      ...node,
      id: nodeId,
      position: normalizePosition(node.position, index),
    });
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const slicedEdges = edgesInput.slice(0, maxEdges);
  if (edgesInput.length > maxEdges) {
    issues.push({
      severity: "warning",
      code: "MAX_EDGES_EXCEEDED",
      message: `Graph exceeded max edges (${maxEdges}); extra edges were dropped.`,
    });
  }

  const seenEdgeSignatures = new Set<string>();
  const seenEdgeIds = new Set<string>();
  const edges: StrategyEdge[] = [];
  for (let index = 0; index < slicedEdges.length; index += 1) {
    const candidate = slicedEdges[index];
    if (!isRecord(candidate)) {
      issues.push({
        severity: "error",
        code: "EDGE_INVALID",
        message: `Edge at index ${index} is not a valid object.`,
      });
      continue;
    }

    const edge = candidate as StrategyEdge;
    const source = typeof edge.source === "string" ? edge.source.trim() : "";
    const target = typeof edge.target === "string" ? edge.target.trim() : "";
    if (!source || !target) {
      issues.push({
        severity: "error",
        code: "EDGE_INVALID",
        message: `Edge at index ${index} is missing source/target.`,
      });
      continue;
    }

    let edgeId = typeof edge.id === "string" && edge.id.trim().length > 0 ? edge.id.trim() : makeId("e");
    if (seenEdgeIds.has(edgeId)) {
      const remapped = makeId("e");
      issues.push({
        severity: "warning",
        code: "EDGE_ID_DUPLICATE",
        message: `Duplicate edge id "${edgeId}" remapped to "${remapped}".`,
        edgeId,
      });
      edgeId = remapped;
    }
    seenEdgeIds.add(edgeId);

    if (!nodesById.has(source) || !nodesById.has(target)) {
      issues.push({
        severity: "error",
        code: "EDGE_ORPHAN",
        message: `Edge "${edgeId}" references missing endpoint.`,
        edgeId,
      });
      continue;
    }
    if (source === target) {
      issues.push({
        severity: "error",
        code: "EDGE_SELF_LOOP",
        message: `Edge "${edgeId}" is a self-loop.`,
        edgeId,
      });
      continue;
    }

    const sourceType = nodesById.get(source)?.type ?? "";
    const targetType = nodesById.get(target)?.type ?? "";
    if (!isConnectionTypeAllowed(sourceType, targetType)) {
      issues.push({
        severity: "error",
        code: "EDGE_TYPE_TRANSITION_INVALID",
        message: `Connection ${sourceType} -> ${targetType} is not allowed.`,
        edgeId,
      });
      continue;
    }

    const normalizedSourceHandle = typeof edge.sourceHandle === "string" ? edge.sourceHandle : undefined;
    const normalizedTargetHandle = typeof edge.targetHandle === "string" ? edge.targetHandle : undefined;
    const signature = edgeSignature({
      source,
      target,
      sourceHandle: normalizedSourceHandle,
      targetHandle: normalizedTargetHandle,
    });
    if (seenEdgeSignatures.has(signature)) {
      issues.push({
        severity: "warning",
        code: "EDGE_DUPLICATE",
        message: `Duplicate edge ${source} -> ${target} was dropped.`,
        edgeId,
      });
      continue;
    }

    seenEdgeSignatures.add(signature);
    edges.push({
      ...edge,
      id: edgeId,
      source,
      target,
      sourceHandle: normalizedSourceHandle,
      targetHandle: normalizedTargetHandle,
    });
  }

  const hasBlockingIssue = issues.some((issue) => issue.severity === "error");
  return {
    isValid: !hasBlockingIssue,
    nodes,
    edges,
    issues,
  };
}

export function summarizeGraphDiff(
  beforeNodes: StrategyNode[],
  beforeEdges: StrategyEdge[],
  afterNodes: StrategyNode[],
  afterEdges: StrategyEdge[]
): string[] {
  const summary: string[] = [];

  const beforeNodeIds = new Set(beforeNodes.map((node) => node.id));
  const afterNodeIds = new Set(afterNodes.map((node) => node.id));

  const beforeEdgeIds = new Set(beforeEdges.map((edge) => edge.id));
  const afterEdgeIds = new Set(afterEdges.map((edge) => edge.id));

  const addedNodes = afterNodes.filter((node) => !beforeNodeIds.has(node.id));
  const removedNodes = beforeNodes.filter((node) => !afterNodeIds.has(node.id));
  const addedEdges = afterEdges.filter((edge) => !beforeEdgeIds.has(edge.id));
  const removedEdges = beforeEdges.filter((edge) => !afterEdgeIds.has(edge.id));

  if (addedNodes.length > 0) {
    summary.push(`Added ${addedNodes.length} node(s).`);
  }
  if (removedNodes.length > 0) {
    summary.push(`Removed ${removedNodes.length} node(s).`);
  }
  if (addedEdges.length > 0) {
    summary.push(`Added ${addedEdges.length} edge(s).`);
  }
  if (removedEdges.length > 0) {
    summary.push(`Removed ${removedEdges.length} edge(s).`);
  }

  const updatedNodes = afterNodes.filter((node) => {
    if (!beforeNodeIds.has(node.id)) {
      return false;
    }
    const previous = beforeNodes.find((item) => item.id === node.id);
    if (!previous) {
      return false;
    }
    const beforePayload = JSON.stringify({
      type: previous.type,
      label: previous.data?.label,
      config: previous.data?.config,
      position: previous.position,
    });
    const afterPayload = JSON.stringify({
      type: node.type,
      label: node.data?.label,
      config: node.data?.config,
      position: node.position,
    });
    return beforePayload !== afterPayload;
  });
  if (updatedNodes.length > 0) {
    summary.push(`Updated ${updatedNodes.length} node(s).`);
  }

  if (summary.length === 0) {
    summary.push("No graph changes detected.");
  }
  return summary;
}

function relayoutNodes(nodes: StrategyNode[], mode: "compact" | "pipeline"): StrategyNode[] {
  if (nodes.length === 0) {
    return nodes;
  }

  if (mode === "compact") {
    return nodes.map((node, index) => ({
      ...node,
      position: {
        x: DEFAULT_POSITION.x + (index % 4) * 260,
        y: DEFAULT_POSITION.y + Math.floor(index / 4) * 150,
      },
    }));
  }

  const nodesByColumn = new Map<number, StrategyNode[]>();
  for (const node of nodes) {
    const column = PIPELINE_COLUMN[node.type] ?? 2;
    const list = nodesByColumn.get(column) ?? [];
    list.push(node);
    nodesByColumn.set(column, list);
  }

  const nextNodes: StrategyNode[] = [];
  for (const node of nodes) {
    const column = PIPELINE_COLUMN[node.type] ?? 2;
    const columnNodes = nodesByColumn.get(column) ?? [node];
    const row = Math.max(0, columnNodes.findIndex((item) => item.id === node.id));
    nextNodes.push({
      ...node,
      position: {
        x: 80 + column * 270,
        y: 140 + row * 150,
      },
    });
  }
  return nextNodes;
}

function applyNodeUpdate(
  node: StrategyNode,
  update: { label?: string; config?: Record<string, unknown> }
): StrategyNode {
  const nextLabel = typeof update.label === "string" && update.label.trim().length > 0
    ? update.label.trim()
    : node.data.label;
  const currentConfig = isRecord(node.data.config)
    ? (node.data.config as Record<string, unknown>)
    : {};
  const patchConfig = isRecord(update.config) ? update.config : {};
  const nextConfig = {
    ...currentConfig,
    ...patchConfig,
    label: nextLabel,
  };
  const nextData = {
    ...node.data,
    label: nextLabel,
    config: nextConfig as StrategyNode["data"]["config"],
  } as StrategyNode["data"];

  return {
    ...node,
    data: nextData,
  };
}

function resolvePositionForAddNode(
  nodes: StrategyNode[],
  hint?: { nearNodeId?: string; x?: number; y?: number }
): { x: number; y: number } {
  if (typeof hint?.x === "number" && Number.isFinite(hint.x) && typeof hint?.y === "number" && Number.isFinite(hint.y)) {
    return { x: hint.x, y: hint.y };
  }
  if (hint?.nearNodeId) {
    const nearNode = nodes.find((node) => node.id === hint.nearNodeId);
    if (nearNode) {
      return {
        x: nearNode.position.x + 220,
        y: nearNode.position.y + 40,
      };
    }
  }
  return normalizePosition(undefined, nodes.length);
}

export function applyStrategyPatchOps(
  baseNodes: StrategyNode[],
  baseEdges: StrategyEdge[],
  ops: StrategyPatchOp[],
  options?: {
    maxNodes?: number;
    maxEdges?: number;
  }
): StrategyPatchApplyResult {
  let nodes = [...baseNodes];
  let edges = [...baseEdges];
  const issues: GraphValidationIssue[] = [];
  let appliedOps = 0;

  for (const op of ops) {
    if (!isRecord(op)) {
      issues.push({
        severity: "error",
        code: "PATCH_OP_INVALID",
        message: "Patch op must be an object.",
      });
      continue;
    }

    if (op.op === "add_node") {
      const position = resolvePositionForAddNode(nodes, op.positionHint);
      const node = createStrategyNodeFromPaletteType(op.nodeType, position);
      if (!node) {
        issues.push({
          severity: "error",
          code: "PATCH_ADD_NODE_UNSUPPORTED",
          message: `Unsupported node type "${op.nodeType}".`,
        });
        continue;
      }
      if (typeof op.nodeId === "string" && op.nodeId.trim().length > 0) {
        const requestedId = op.nodeId.trim();
        if (nodes.some((existingNode) => existingNode.id === requestedId)) {
          issues.push({
            severity: "error",
            code: "PATCH_ADD_NODE_DUPLICATE_ID",
            message: `Cannot add node with duplicate id "${requestedId}".`,
            nodeId: requestedId,
          });
          continue;
        }
        node.id = requestedId;
      }
      if (typeof op.label === "string" && op.label.trim().length > 0) {
        node.data.label = op.label.trim();
        if (isRecord(node.data.config)) {
          node.data.config.label = node.data.label;
        }
      }
      if (isRecord(op.config) && isRecord(node.data.config)) {
        node.data.config = {
          ...node.data.config,
          ...op.config,
          label: node.data.label,
        };
      }
      nodes.push(node);
      appliedOps += 1;
      continue;
    }

    if (op.op === "update_node") {
      const index = nodes.findIndex((node) => node.id === op.nodeId);
      if (index < 0) {
        issues.push({
          severity: "error",
          code: "PATCH_UPDATE_NODE_MISSING",
          message: `Cannot update missing node "${op.nodeId}".`,
          nodeId: op.nodeId,
        });
        continue;
      }
      nodes[index] = applyNodeUpdate(nodes[index], {
        label: op.label,
        config: op.config,
      });
      appliedOps += 1;
      continue;
    }

    if (op.op === "remove_node") {
      const beforeCount = nodes.length;
      nodes = nodes.filter((node) => node.id !== op.nodeId);
      if (nodes.length === beforeCount) {
        issues.push({
          severity: "error",
          code: "PATCH_REMOVE_NODE_MISSING",
          message: `Cannot remove missing node "${op.nodeId}".`,
          nodeId: op.nodeId,
        });
        continue;
      }
      edges = edges.filter((edge) => edge.source !== op.nodeId && edge.target !== op.nodeId);
      appliedOps += 1;
      continue;
    }

    if (op.op === "add_edge") {
      const sourceNode = nodes.find((node) => node.id === op.source);
      const targetNode = nodes.find((node) => node.id === op.target);
      if (!sourceNode || !targetNode) {
        issues.push({
          severity: "error",
          code: "PATCH_ADD_EDGE_ORPHAN",
          message: `Cannot add edge "${op.source}" -> "${op.target}" because endpoint is missing.`,
        });
        continue;
      }
      edges.push(
        createEdgeForConnection(
          op.source,
          op.target,
          sourceNode.type,
          op.sourceHandle,
          op.targetHandle
        )
      );
      appliedOps += 1;
      continue;
    }

    if (op.op === "remove_edge") {
      const beforeCount = edges.length;
      if (typeof op.edgeId === "string" && op.edgeId.trim().length > 0) {
        edges = edges.filter((edge) => edge.id !== op.edgeId);
      } else if (typeof op.source === "string" && typeof op.target === "string") {
        edges = edges.filter((edge) => !(edge.source === op.source && edge.target === op.target));
      } else {
        issues.push({
          severity: "error",
          code: "PATCH_REMOVE_EDGE_INVALID",
          message: "remove_edge requires edgeId or source+target.",
        });
        continue;
      }
      if (edges.length === beforeCount) {
        issues.push({
          severity: "warning",
          code: "PATCH_REMOVE_EDGE_NOT_FOUND",
          message: "Requested edge to remove was not found.",
        });
      } else {
        appliedOps += 1;
      }
      continue;
    }

    if (op.op === "relayout") {
      nodes = relayoutNodes(nodes, op.mode);
      appliedOps += 1;
      continue;
    }

    issues.push({
      severity: "error",
      code: "PATCH_OP_UNSUPPORTED",
      message: `Unsupported patch operation "${String((op as { op?: unknown }).op)}".`,
    });
  }

  const sanitized = sanitizeStrategyGraph(nodes, edges, {
    maxNodes: options?.maxNodes,
    maxEdges: options?.maxEdges,
  });
  const mergedIssues = [...issues, ...sanitized.issues];

  return {
    isValid: mergedIssues.every((issue) => issue.severity !== "error"),
    nodes: sanitized.nodes,
    edges: sanitized.edges,
    issues: mergedIssues,
    appliedOps,
    diffSummary: summarizeGraphDiff(baseNodes, baseEdges, sanitized.nodes, sanitized.edges),
  };
}
