"use client";

import { useCallback, useRef, useMemo, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type NodeChange,
  type EdgeChange,
  ReactFlowProvider,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";
import { nodeTypes } from "./nodes";
import { useStrategyBuilderStore } from "@/lib/stores/strategyBuilderStore";
import type { StrategyNode, StrategyEdge, StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

const generateId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `node-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

interface StrategyCanvasProps {
  className?: string;
}

const StrategyCanvasInner = ({ className }: StrategyCanvasProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const {
    currentStrategy,
    addNode,
    setSelectedNode,
    setNodes,
  } = useStrategyBuilderStore();

  // Convert store nodes to React Flow format
  const initialNodes = useMemo(
    () => currentStrategy?.nodes || [],
    [currentStrategy?.nodes]
  );

  const initialEdges = useMemo(
    () => currentStrategy?.edges || [],
    [currentStrategy?.edges]
  );

  const [nodes, setLocalNodes, onNodesChange] = useNodesState<StrategyNode>(initialNodes);
  const [edges, setLocalEdges, onEdgesChange] = useEdgesState<StrategyEdge>(initialEdges);

  // Keep React Flow local state aligned with persisted store changes.
  useEffect(() => {
    setLocalNodes(initialNodes);
  }, [initialNodes, setLocalNodes]);

  useEffect(() => {
    setLocalEdges(initialEdges);
  }, [initialEdges, setLocalEdges]);

  // Sync local state with store
  const handleNodesChange = useCallback(
    (changes: NodeChange<StrategyNode>[]) => {
      onNodesChange(changes);
      // Sync to store
      const updatedNodes = nodes.map((node) => {
        const positionChange = changes.find(
          (c): c is NodeChange<StrategyNode> & { id: string; type: "position"; position: StrategyNode["position"] } =>
            "id" in c && c.id === node.id && c.type === "position" && "position" in c && Boolean(c.position)
        );
        if (positionChange) {
          return { ...node, position: positionChange.position };
        }
        return node;
      });
      setNodes(updatedNodes);
    },
    [onNodesChange, nodes, setNodes]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<StrategyEdge>[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: StrategyNode) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  // Handle drop from palette
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };

      // Create node data based on type
      let nodeData: StrategyNodeData;
      const nodeType: string = type;
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
              filterType: "price_above",
              value: 0,
              comparisonOperator: ">",
            },
          };
          break;
        default:
          return;
      }

      const newNode: StrategyNode = {
        id: generateId(),
        type: nodeType,
        position,
        data: {
          ...nodeData,
          label,
        },
      };

      addNode(newNode);
    },
    [addNode]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Custom edge styles
  const defaultEdgeOptions = useMemo(
    () => ({
      animated: true,
      style: { stroke: "#94a3b8", strokeWidth: 2 },
    }),
    []
  );

  // Connection line style
  const connectionLineStyle = useMemo(
    () => ({ stroke: "#94a3b8" }),
    []
  );

  // Node color function for minimap
  const getNodeColor = useCallback((node: StrategyNode) => {
    switch (node.type) {
      case "dataSource":
        return "#3b82f6";
      case "indicator":
        return "#a855f7";
      case "filter":
        return "#f97316";
      case "signal":
        if (node.data.type === "signal") {
          return node.data.config.signalType === "buy" ? "#22c55e" : "#ef4444";
        }
        return "#ef4444";
      case "output":
        return "#10b981";
      default:
        return "#6b7280";
    }
  }, []);

  return (
    <div ref={reactFlowWrapper} className={cn("w-full h-full", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes as NodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        nodesConnectable={false}
        connectionLineStyle={connectionLineStyle}
        className="bg-gray-50 dark:bg-gray-950"
      >
        <Background color="#e5e7eb" gap={20} className="dark:!bg-gray-950" />

        <Controls
          className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 !shadow-lg"
          showInteractive={false}
        />

        <MiniMap
          nodeColor={getNodeColor}
          className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700"
          maskColor="rgba(0, 0, 0, 0.1)"
        />

        {/* Empty state */}
        {nodes.length === 0 && (
          <Panel position="top-center" className="mt-20">
            <div className="flex flex-col items-center text-center p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg max-w-sm">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full mb-3">
                <svg
                  className="w-8 h-8 text-blue-600 dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Start Building Your Strategy
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Drag components from the palette on the left to create your trading strategy
              </p>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
};

export const StrategyCanvas = (props: StrategyCanvasProps) => {
  return (
    <ReactFlowProvider>
      <StrategyCanvasInner {...props} />
    </ReactFlowProvider>
  );
};
