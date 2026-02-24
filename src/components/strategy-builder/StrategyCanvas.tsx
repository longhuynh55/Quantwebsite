"use client";

import { useCallback, useRef, useMemo, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  applyEdgeChanges,
  type NodeTypes,
  type NodeChange,
  type EdgeChange,
  type Connection,
  ReactFlowProvider,
  Panel,
  applyNodeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./strategy-canvas.css";
import { cn } from "@/lib/utils";
import { nodeTypes } from "./nodes";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { createStrategyNodeFromPaletteType } from "./nodeFactory";
import { useStrategyBuilderStore } from "@/lib/stores/strategyBuilderStore";
import type { StrategyNode, StrategyEdge } from "@/lib/stores/strategyBuilderStore";
import { toast } from "sonner";

// Connection rules: which source types can connect to which target types
const connectionRules: Record<string, string[]> = {
  dataSource: ["indicator", "filter", "math", "sort", "weighting", "signal"],
  indicator: ["filter", "signal", "sort", "math", "conditional", "output"],
  filter: ["signal", "sort", "weighting", "conditional", "output"],
  signal: ["output", "weighting"],
  output: [],
  weighting: ["signal", "output"],
  conditional: ["signal", "filter", "indicator", "output"],
  sort: ["filter", "signal", "weighting", "output"],
  math: ["filter", "indicator", "signal", "conditional", "output"],
};

// Edge color by source node type — matches new node stripe colors
const edgeColorBySource: Record<string, string> = {
  dataSource: "#059669", // emerald-500
  indicator: "#3b82f6",  // blue-500
  filter: "#f97316",     // orange-500
  signal: "#059669",     // emerald-500 (buy default)
  output: "#44403c",     // stone-700
  weighting: "#8b5cf6",  // violet-500
  conditional: "#8b5cf6",// violet-500
  sort: "#0ea5e9",       // sky-500
  math: "#6366f1",       // indigo-500
};

interface StrategyCanvasProps {
  className?: string;
}

// Context menu categories for right-click "Add Node"
const contextMenuCategories = [
  { label: "DATA", items: [{ type: "dataSource", name: "Data Source" }] },
  {
    label: "ANALYSIS", items: [
      { type: "indicator", name: "Indicator" },
      { type: "filter", name: "Filter" },
    ]
  },
  { label: "SIGNALS", items: [{ type: "signal", name: "Signal" }] },
  { label: "EXECUTION", items: [{ type: "output", name: "Output" }] },
  {
    label: "ADVANCED", items: [
      { type: "weighting", name: "Weighting" },
      { type: "conditional", name: "Conditional" },
      { type: "sort", name: "Sort" },
      { type: "math", name: "Math" },
    ]
  },
];

const contextMenuStripeColors: Record<string, string> = {
  dataSource: "bg-emerald-500",
  indicator: "bg-blue-500",
  filter: "bg-orange-500",
  signal: "bg-rose-500",
  output: "bg-stone-700",
  weighting: "bg-violet-500",
  conditional: "bg-violet-500",
  sort: "bg-sky-500",
  math: "bg-indigo-500",
};

const StrategyCanvasInner = ({ className }: StrategyCanvasProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView, screenToFlowPosition, getNode } = useReactFlow<StrategyNode, StrategyEdge>();

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(null);

  const {
    currentStrategy,
    addNode,
    addEdge: addEdgeToStore,
    setSelectedNode,
    setNodes,
    setEdges,
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

  const [nodes, setLocalNodes] = useNodesState<StrategyNode>(initialNodes);
  const [edges, setLocalEdges] = useEdgesState<StrategyEdge>(initialEdges);
  const previousNodeCountRef = useRef(nodes.length);

  // Keep React Flow local state aligned with persisted store changes.
  useEffect(() => {
    setLocalNodes(initialNodes);
  }, [initialNodes, setLocalNodes]);

  useEffect(() => {
    setLocalEdges(initialEdges);
  }, [initialEdges, setLocalEdges]);

  // Fix for React Flow v12 + Next.js SSR: force edge re-render after init
  const onInitHandler = useCallback(() => {
    // Give React Flow time to complete internal measurement pass
    setTimeout(() => {
      setLocalEdges([...initialEdges]);
    }, 100);
  }, [initialEdges, setLocalEdges]);

  useEffect(() => {
    const previousCount = previousNodeCountRef.current;
    if (nodes.length > previousCount) {
      requestAnimationFrame(() => {
        fitView({ duration: 250, padding: 0.2 });
      });
    }
    previousNodeCountRef.current = nodes.length;
  }, [fitView, nodes.length]);

  // Sync local state with store
  const handleNodesChange = useCallback(
    (changes: NodeChange<StrategyNode>[]) => {
      setLocalNodes((currentNodes) => {
        const nextNodes = applyNodeChanges(changes, currentNodes) as StrategyNode[];

        const shouldPersist = changes.some(
          (change) =>
            change.type === "position" ||
            change.type === "remove" ||
            change.type === "add" ||
            change.type === "replace"
        );

        if (shouldPersist) {
          setNodes(nextNodes);
        }

        return nextNodes;
      });
    },
    [setLocalNodes, setNodes]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<StrategyEdge>[]) => {
      setLocalEdges((currentEdges) => {
        const nextEdges = applyEdgeChanges(changes, currentEdges);
        setEdges(nextEdges);
        return nextEdges;
      });
    },
    [setEdges, setLocalEdges]
  );

  // Validate connections
  const isValidConnection = useCallback(
    (connection: Connection | { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }) => {
      const sourceNode = getNode(connection.source);
      const targetNode = getNode(connection.target);
      if (!sourceNode || !targetNode) return false;

      // Prevent self-connections
      if (connection.source === connection.target) return false;

      const sourceType = sourceNode.type || "";
      const targetType = targetNode.type || "";

      const allowedTargets = connectionRules[sourceType];
      if (!allowedTargets) return false;

      return allowedTargets.includes(targetType);
    },
    [getNode]
  );

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = getNode(connection.source);
      const targetNode = getNode(connection.target);

      if (!sourceNode || !targetNode) return;

      const sourceType = sourceNode.type || "";
      const targetType = targetNode.type || "";
      const allowedTargets = connectionRules[sourceType] || [];

      if (!allowedTargets.includes(targetType)) {
        toast.error(`Cannot connect ${sourceType} → ${targetType}`);
        return;
      }

      const edgeColor = edgeColorBySource[sourceType] || "#a8a29e";
      const newEdge: StrategyEdge = {
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        animated: true,
        style: { stroke: edgeColor, strokeWidth: 2 },
      };

      addEdgeToStore(newEdge);
    },
    [addEdgeToStore, getNode]
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: StrategyNode) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  // Handle pane click (deselect + close context menu)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setContextMenu(null);
  }, [setSelectedNode]);

  // Handle right-click on canvas
  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        flowX: flowPosition.x,
        flowY: flowPosition.y,
      });
    },
    [screenToFlowPosition]
  );

  // Add node from context menu
  const addNodeFromContextMenu = useCallback(
    (type: string) => {
      if (!contextMenu) return;
      const newNode = createStrategyNodeFromPaletteType(type, { x: contextMenu.flowX, y: contextMenu.flowY });
      if (!newNode) return;
      addNode(newNode);
      setContextMenu(null);
    },
    [addNode, contextMenu]
  );

  // Close context menu on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle drop from palette
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type =
        event.dataTransfer.getData("application/reactflow") ||
        event.dataTransfer.getData("text/plain");
      if (!type) return;

      const position =
        typeof screenToFlowPosition === "function"
          ? screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          })
          : {
            x: event.clientX - (reactFlowWrapper.current?.getBoundingClientRect().left ?? 0),
            y: event.clientY - (reactFlowWrapper.current?.getBoundingClientRect().top ?? 0),
          };
      const newNode = createStrategyNodeFromPaletteType(type, position);
      if (!newNode) return;
      addNode(newNode);
    },
    [addNode, screenToFlowPosition]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Custom edge styles
  const defaultEdgeOptions = useMemo(
    () => ({
      type: "smoothstep" as const,
      animated: true,
      style: { stroke: "#a8a29e", strokeWidth: 2 },
    }),
    []
  );

  // Connection line style
  const connectionLineStyle = useMemo(
    () => ({ stroke: "#059669", strokeWidth: 2, strokeDasharray: "6 3" }),
    []
  );

  // Node color function for minimap
  const getNodeColor = useCallback((node: StrategyNode) => {
    switch (node.type) {
      case "dataSource":
        return "#059669"; // emerald
      case "indicator":
        return "#3b82f6"; // blue
      case "filter":
        return "#f97316"; // orange
      case "signal":
        if (node.data.type === "signal") {
          return node.data.config.signalType === "buy" ? "#059669" : "#e11d48";
        }
        return "#e11d48";
      case "output":
        return "#44403c"; // stone
      case "weighting":
        return "#8b5cf6"; // violet
      case "conditional":
        return "#8b5cf6"; // violet
      case "sort":
        return "#0ea5e9"; // sky
      case "math":
        return "#6366f1"; // indigo
      default:
        return "#737373";
    }
  }, []);

  return (
    <div ref={reactFlowWrapper} className={cn("w-full h-full react-flow-visible-override", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onInit={onInitHandler}
        isValidConnection={isValidConnection}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes as NodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
        snapToGrid
        snapGrid={[15, 15]}
        nodesConnectable
        connectionLineStyle={connectionLineStyle}
        minZoom={0.2}
        maxZoom={2}
        className="strategy-canvas-flow"
      >
        <Background
          color="#a8a29e"
          gap={20}
          size={1.5}
          className="!bg-stone-50 dark:!bg-neutral-950"
        />

        <Controls
          className="strategy-canvas-controls"
          showInteractive={false}
        />

        <MiniMap
          nodeColor={getNodeColor}
          className="strategy-canvas-minimap"
          maskColor="rgba(120, 113, 108, 0.15)"
          pannable
          zoomable
        />

        {/* Empty state — 3-option guide */}
        {nodes.length === 0 && (
          <Panel position="top-center" className="mt-16">
            <div className="w-[380px] bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-700 shadow-lg">
              <div className="px-5 pt-5 pb-3 text-center">
                <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-white mb-1">
                  Build Your Strategy
                </h3>
                <p className="text-xs text-stone-500 dark:text-neutral-400">
                  Choose how to get started
                </p>
              </div>
              <div className="px-4 pb-4 space-y-2">
                <div className="flex items-center gap-3 p-3 border border-stone-200 dark:border-neutral-700 bg-stone-50 dark:bg-neutral-800/50 hover:bg-stone-100 dark:hover:bg-neutral-800 transition-colors cursor-default">
                  <div className="flex items-center justify-center w-8 h-8 rounded bg-emerald-500 flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-stone-900 dark:text-white">Drag from Palette</div>
                    <div className="text-[11px] text-stone-500 dark:text-neutral-400">Drag components from the left panel onto the canvas</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 border border-stone-200 dark:border-neutral-700 bg-stone-50 dark:bg-neutral-800/50 hover:bg-stone-100 dark:hover:bg-neutral-800 transition-colors cursor-default">
                  <div className="flex items-center justify-center w-8 h-8 rounded bg-blue-500 flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-stone-900 dark:text-white">Load a Template</div>
                    <div className="text-[11px] text-stone-500 dark:text-neutral-400">Start with a pre-built strategy from the template gallery</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 border border-stone-200 dark:border-neutral-700 bg-stone-50 dark:bg-neutral-800/50 hover:bg-stone-100 dark:hover:bg-neutral-800 transition-colors cursor-default">
                  <div className="flex items-center justify-center w-8 h-8 rounded bg-violet-500 flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-stone-900 dark:text-white">Ask AI</div>
                    <div className="text-[11px] text-stone-500 dark:text-neutral-400">Describe your strategy and let AI build it for you</div>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[180px] bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl border border-stone-200 dark:border-neutral-700 shadow-xl rounded-lg py-1 overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-stone-400 dark:text-neutral-500 border-b border-stone-100 dark:border-neutral-800">
            Add Node
          </div>
          {contextMenuCategories.map((category) => (
            <div key={category.label}>
              <div className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-stone-400 dark:text-neutral-500">
                {category.label}
              </div>
              {category.items.map((item) => (
                <button
                  key={item.type}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-stone-700 dark:text-neutral-300 hover:bg-stone-50 dark:hover:bg-neutral-800 transition-colors text-left"
                  onClick={() => addNodeFromContextMenu(item.type)}
                >
                  <span className={cn("w-2 h-2 rounded-sm flex-shrink-0", contextMenuStripeColors[item.type])} />
                  {item.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Status Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-8 flex items-center justify-between px-4 border-t border-stone-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm text-xs text-stone-500 dark:text-neutral-400 z-20">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Nodes: <strong className="text-stone-700 dark:text-neutral-200">{nodes.length}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Connections: <strong className="text-stone-700 dark:text-neutral-200">{edges.length}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {nodes.length > 0 ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-600 dark:text-emerald-400">Ready to backtest</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
              <span>Add nodes to begin</span>
            </>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Tooltip */}
      <KeyboardShortcuts />
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
