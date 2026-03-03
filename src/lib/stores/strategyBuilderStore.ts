import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react';
import { sanitizeStrategyGraph } from '@/lib/strategy-builder/graph-guardrails';

// Node data types
export interface DataSourceNodeData {
  label: string;
  stocks: string[];
  timeframe: string;
  startDate: string;
  endDate: string;
}

export interface IndicatorNodeData {
  label: string;
  indicatorType: 'rsi' | 'macd' | 'ma' | 'ema' | 'bollinger' | 'atr' | 'volume';
  period: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
  standardDeviations?: number;
}

export interface FilterNodeData {
  label: string;
  filterType: 'price_above' | 'price_below' | 'volume_above' | 'volume_below' | 'rsi_overbought' | 'rsi_oversold';
  value: number;
  comparisonOperator: '>' | '<' | '>=' | '<=' | '==' | '!=';
}

export interface SignalNodeData {
  label: string;
  signalType: 'buy' | 'sell';
  condition: string;
  quantity?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface OutputNodeData {
  label: string;
  metrics: string[];
}

export type AdvancedNodeType = 'weighting' | 'conditional' | 'sort' | 'math' | 'merge' | 'risk' | 'backtest';

export type AdvancedNodeConfigValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | AdvancedNodeConfig
  | AdvancedNodeConfigValue[];

export interface AdvancedNodeConfig {
  label?: string;
  [key: string]: AdvancedNodeConfigValue;
}

export type StrategyNodeData =
  | { type: 'dataSource'; config: DataSourceNodeData; label: string }
  | { type: 'indicator'; config: IndicatorNodeData; label: string }
  | { type: 'filter'; config: FilterNodeData; label: string }
  | { type: 'signal'; config: SignalNodeData; label: string }
  | { type: 'output'; config: OutputNodeData; label: string }
  | { type: AdvancedNodeType; config: AdvancedNodeConfig; label: string };

export interface StrategyNode extends Node {
  type: string;
  data: StrategyNodeData;
}

export interface StrategyEdge extends Edge {
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  createdAt: Date;
  updatedAt: Date;
}

interface StrategyBuilderState {
  // Current strategy
  currentStrategy: Strategy | null;

  // UI State
  selectedNodeId: string | null;
  isDirty: boolean;
  isSaving: boolean;

  // Actions
  createNewStrategy: (name: string, description?: string) => void;
  loadStrategy: (strategy: Strategy) => void;
  updateStrategyName: (name: string) => void;
  saveStrategy: () => Promise<void>;

  // Node actions
  addNode: (node: StrategyNode) => void;
  updateNodeData: (nodeId: string, data: Partial<StrategyNodeData>) => void;
  deleteNode: (nodeId: string) => void;
  setSelectedNode: (nodeId: string | null) => void;

  // Edge actions
  addEdge: (edge: StrategyEdge) => void;
  deleteEdge: (edgeId: string) => void;

  // Bulk actions
  setNodes: (nodes: StrategyNode[]) => void;
  setEdges: (edges: StrategyEdge[]) => void;
  setGraph: (nodes: StrategyNode[], edges: StrategyEdge[]) => void;
  onNodesChange: (changes: NodeChange<StrategyNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<StrategyEdge>[]) => void;

  // Reset
  reset: () => void;
}

const generateId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `node-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

const createDefaultStrategy = (name: string, description?: string): Strategy => ({
  id: generateId(),
  name,
  description,
  nodes: [],
  edges: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

const edgeSignature = (edge: Pick<StrategyEdge, 'source' | 'target' | 'sourceHandle' | 'targetHandle'>): string =>
  `${edge.source}::${edge.sourceHandle ?? ''}=>${edge.target}::${edge.targetHandle ?? ''}`;

const dedupeEdges = (edges: StrategyEdge[]): StrategyEdge[] => {
  const seen = new Set<string>();
  const uniqueEdges: StrategyEdge[] = [];
  for (const edge of edges) {
    const key = edgeSignature(edge);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueEdges.push(edge);
  }
  return uniqueEdges;
};

export const useStrategyBuilderStore = create<StrategyBuilderState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentStrategy: null,
      selectedNodeId: null,
      isDirty: false,
      isSaving: false,

      // Strategy actions
      createNewStrategy: (name, description) => {
        set({
          currentStrategy: createDefaultStrategy(name, description),
          selectedNodeId: null,
          isDirty: false,
        });
      },

      loadStrategy: (strategy) => {
        const sanitized = sanitizeStrategyGraph(strategy.nodes, strategy.edges);
        set({
          currentStrategy: {
            ...strategy,
            nodes: sanitized.nodes,
            edges: sanitized.edges,
          },
          selectedNodeId: null,
          isDirty: false,
        });
      },

      updateStrategyName: (name) => {
        const { currentStrategy } = get();
        if (!currentStrategy) return;

        const nextName = name;
        if (currentStrategy.name === nextName) {
          return;
        }

        set({
          currentStrategy: {
            ...currentStrategy,
            name: nextName,
          },
          isDirty: true,
        });
      },

      saveStrategy: async () => {
        const { currentStrategy } = get();
        if (!currentStrategy) return;

        set({ isSaving: true });

        // Simulate save operation (replace with actual API call)
        await new Promise((resolve) => setTimeout(resolve, 500));

        set({
          currentStrategy: {
            ...currentStrategy,
            updatedAt: new Date(),
          },
          isDirty: false,
          isSaving: false,
        });
      },

      // Node actions
      addNode: (node) => {
        const { currentStrategy } = get();
        if (!currentStrategy) return;

        const sanitized = sanitizeStrategyGraph(
          [...currentStrategy.nodes, node],
          currentStrategy.edges
        );

        set({
          currentStrategy: {
            ...currentStrategy,
            nodes: sanitized.nodes,
            edges: sanitized.edges,
          },
          isDirty: true,
        });
      },

      updateNodeData: (nodeId, data) => {
        const { currentStrategy } = get();
        if (!currentStrategy) return;

        const nextNodes = currentStrategy.nodes.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, ...data } as StrategyNodeData,
            };
          }
          return node;
        });
        const sanitized = sanitizeStrategyGraph(nextNodes, currentStrategy.edges);

        set({
          currentStrategy: {
            ...currentStrategy,
            nodes: sanitized.nodes,
            edges: sanitized.edges,
          },
          isDirty: true,
        });
      },

      deleteNode: (nodeId) => {
        const { currentStrategy, selectedNodeId } = get();
        if (!currentStrategy) return;

        const nextNodes = currentStrategy.nodes.filter((node) => node.id !== nodeId);
        const nextEdges = currentStrategy.edges.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId
        );
        const sanitized = sanitizeStrategyGraph(nextNodes, nextEdges);

        set({
          currentStrategy: {
            ...currentStrategy,
            nodes: sanitized.nodes,
            edges: sanitized.edges,
          },
          selectedNodeId: selectedNodeId === nodeId ? null : selectedNodeId,
          isDirty: true,
        });
      },

      setSelectedNode: (nodeId) => {
        set({ selectedNodeId: nodeId });
      },

      // Edge actions
      addEdge: (edge) => {
        const { currentStrategy } = get();
        if (!currentStrategy) return;
        const beforeSignatures = new Set(
          currentStrategy.edges.map((currentEdge) => edgeSignature(currentEdge))
        );
        const hasDuplicate = beforeSignatures.has(edgeSignature(edge));
        if (hasDuplicate) return;
        const sanitized = sanitizeStrategyGraph(
          currentStrategy.nodes,
          [...currentStrategy.edges, edge]
        );
        const stillPresent = sanitized.edges.some((item) => item.id === edge.id);
        if (!stillPresent) return;

        set({
          currentStrategy: {
            ...currentStrategy,
            nodes: sanitized.nodes,
            edges: sanitized.edges,
          },
          isDirty: true,
        });
      },

      deleteEdge: (edgeId) => {
        const { currentStrategy } = get();
        if (!currentStrategy) return;
        const nextEdges = currentStrategy.edges.filter((edge) => edge.id !== edgeId);
        const sanitized = sanitizeStrategyGraph(currentStrategy.nodes, nextEdges);

        set({
          currentStrategy: {
            ...currentStrategy,
            nodes: sanitized.nodes,
            edges: sanitized.edges,
          },
          isDirty: true,
        });
      },

      // Bulk actions
      setNodes: (nodes) => {
        const { currentStrategy } = get();
        if (!currentStrategy) return;
        const sanitized = sanitizeStrategyGraph(nodes, currentStrategy.edges);

        set({
          currentStrategy: {
            ...currentStrategy,
            nodes: sanitized.nodes,
            edges: sanitized.edges,
          },
          isDirty: true,
        });
      },

      setEdges: (edges) => {
        const { currentStrategy } = get();
        if (!currentStrategy) return;
        const sanitized = sanitizeStrategyGraph(currentStrategy.nodes, dedupeEdges(edges));

        set({
          currentStrategy: {
            ...currentStrategy,
            nodes: sanitized.nodes,
            edges: sanitized.edges,
          },
          isDirty: true,
        });
      },

      setGraph: (nodes, edges) => {
        const { currentStrategy } = get();
        if (!currentStrategy) return;
        const sanitized = sanitizeStrategyGraph(nodes, dedupeEdges(edges));

        set({
          currentStrategy: {
            ...currentStrategy,
            nodes: sanitized.nodes,
            edges: sanitized.edges,
          },
          isDirty: true,
        });
      },

      onNodesChange: (changes) => {
        // Handle node position changes, etc.
        const { currentStrategy } = get();
        if (!currentStrategy) return;

        // Apply changes to nodes
        const updatedNodes = currentStrategy.nodes.map((node) => {
          const change = changes.find((c) => 'id' in c && c.id === node.id);
          if (change && change.type === 'position' && 'position' in change && change.position) {
            return { ...node, position: change.position };
          }
          if (change && change.type === 'remove') {
            return null;
          }
          return node;
        }).filter(Boolean) as StrategyNode[];
        const sanitized = sanitizeStrategyGraph(updatedNodes, currentStrategy.edges);

        set({
          currentStrategy: {
            ...currentStrategy,
            nodes: sanitized.nodes,
            edges: sanitized.edges,
          },
          isDirty: true,
        });
      },

      onEdgesChange: (changes) => {
        const { currentStrategy } = get();
        if (!currentStrategy) return;

        const removedIds = changes
          .filter((c): c is { type: 'remove'; id: string } => c.type === 'remove' && 'id' in c)
          .map((c) => c.id);

        if (removedIds.length > 0) {
          const nextEdges = currentStrategy.edges.filter(
            (edge) => !removedIds.includes(edge.id)
          );
          const sanitized = sanitizeStrategyGraph(currentStrategy.nodes, nextEdges);
          set({
            currentStrategy: {
              ...currentStrategy,
              nodes: sanitized.nodes,
              edges: sanitized.edges,
            },
            isDirty: true,
          });
        }
      },

      // Reset
      reset: () => {
        set({
          currentStrategy: null,
          selectedNodeId: null,
          isDirty: false,
          isSaving: false,
        });
      },
    }),
    {
      name: 'quantvn-strategy-builder',
      partialize: (state) => ({
        // Serialize Date objects to ISO strings for localStorage persistence
        currentStrategy: state.currentStrategy ? {
          ...state.currentStrategy,
          createdAt: state.currentStrategy.createdAt instanceof Date
            ? state.currentStrategy.createdAt.toISOString()
            : state.currentStrategy.createdAt,
          updatedAt: state.currentStrategy.updatedAt instanceof Date
            ? state.currentStrategy.updatedAt.toISOString()
            : state.currentStrategy.updatedAt,
        } : null,
      }),
      // Rehydrate ISO string dates back to Date objects
      onRehydrateStorage: () => (state) => {
        if (!state?.currentStrategy) return;
        const strategy = state.currentStrategy as unknown as Strategy;
        if (typeof strategy.createdAt === 'string') {
          strategy.createdAt = new Date(strategy.createdAt);
        }
        if (typeof strategy.updatedAt === 'string') {
          strategy.updatedAt = new Date(strategy.updatedAt);
        }
      },
    }
  )
);

// Helper hooks
export const useCurrentStrategy = () =>
  useStrategyBuilderStore((state) => state.currentStrategy);

export const useSelectedNode = () => {
  const selectedNodeId = useStrategyBuilderStore((state) => state.selectedNodeId);
  const currentStrategy = useStrategyBuilderStore((state) => state.currentStrategy);

  if (!selectedNodeId || !currentStrategy) return null;

  return currentStrategy.nodes.find((node) => node.id === selectedNodeId) || null;
};

export const useIsDirty = () =>
  useStrategyBuilderStore((state) => state.isDirty);
