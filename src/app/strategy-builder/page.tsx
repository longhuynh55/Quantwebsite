"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { StrategyCanvas, NodePalette, PropertyPanel, TemplateGallery, AiSuggestDialog, BacktestResultsPanel } from "@/components/strategy-builder";
import type { StrategyNode, StrategyEdge } from "@/lib/stores/strategyBuilderStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useStrategyBuilderStore,
  useSelectedNode,
} from "@/lib/stores/strategyBuilderStore";
import { createStrategyNodeFromPaletteType } from "@/components/strategy-builder/nodeFactory";
import { cn } from "@/lib/utils";
import { useUndoRedo } from "@/lib/hooks/useUndoRedo";
import { useNodeValidation } from "@/lib/hooks/useNodeValidation";
import {
  Save,
  Play,
  Square,
  Download,
  Plus,
  PanelLeft,
  PanelRight,
  Undo2,
  Redo2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  cancelStrategyLabRunClient,
  createStrategyLabRunClient,
  getStrategyLabRunSummaryClient,
  StrategyLabClientError,
  type StrategyLabSummaryResult,
  waitForStrategyLabRunTerminal,
} from "@/lib/strategy-lab/client";
import { buildStrategyLabRunRequest } from "@/lib/strategy-lab/builder-mapper";
import type { StrategyLabRunStatus } from "@/lib/strategy-lab/contracts";
import { trackUiKpiEvent } from "@/lib/uiKpi";
import type { StrategyBuilderInteractionEvent } from "@/lib/uiKpiSchema";

type StrategyBuilderPersistApi = {
  hasHydrated: () => boolean;
  onHydrate: (listener: () => void) => () => void;
  onFinishHydration: (listener: () => void) => () => void;
};
const STRATEGY_BUILDER_STORAGE_KEY = "quantvn-strategy-builder";

const resolvePersistApi = (): StrategyBuilderPersistApi | null => {
  const storeWithPersist = useStrategyBuilderStore as typeof useStrategyBuilderStore & {
    persist?: StrategyBuilderPersistApi;
  };
  return storeWithPersist.persist ?? null;
};

const hasPersistedStrategySnapshot = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const raw = window.localStorage.getItem(STRATEGY_BUILDER_STORAGE_KEY);
    if (!raw) {
      return false;
    }

    const parsed = JSON.parse(raw) as {
      state?: { currentStrategy?: unknown };
    };
    return Boolean(parsed?.state?.currentStrategy);
  } catch {
    try {
      window.localStorage.removeItem(STRATEGY_BUILDER_STORAGE_KEY);
    } catch {
      // no-op
    }
    return false;
  }
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

export default function StrategyBuilderPage() {
  const persistApi = resolvePersistApi();
  const [strategyName, setStrategyName] = useState("Untitled Strategy");
  const [capitalInput, setCapitalInput] = useState("100000");
  const [hasHydratedStore, setHasHydratedStore] = useState(() =>
    persistApi?.hasHydrated() ?? true
  );
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [isPropertyPanelOpen, setIsPropertyPanelOpen] = useState(true);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<StrategyLabRunStatus | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runSummary, setRunSummary] = useState<StrategyLabSummaryResult | null>(null);
  const [isRunSubmitting, setIsRunSubmitting] = useState(false);
  const runRequestSequenceRef = useRef(0);
  const runPollAbortRef = useRef<AbortController | null>(null);

  const {
    currentStrategy,
    createNewStrategy,
    updateStrategyName,
    saveStrategy,
    updateNodeData,
    addNode,
    addEdge,
    setNodes,
    setEdges,
    deleteNode,
    setSelectedNode,
    isSaving,
    isDirty,
    reset,
  } = useStrategyBuilderStore();

  const selectedNode = useSelectedNode();

  const trackStrategyBuilderEvent = useCallback(
    (event: StrategyBuilderInteractionEvent, detail?: Record<string, unknown>) => {
      trackUiKpiEvent({
        metric: "strategy_builder_interaction",
        event,
        page: "strategy-builder",
        source: "strategy-builder-page",
        detail,
      });
    },
    []
  );

  // Undo/Redo hook
  const { undo, redo, captureSnapshot, clearHistory, canUndo, canRedo } = useUndoRedo();

  // Node validation
  const validation = useNodeValidation(
    currentStrategy?.nodes ?? [],
    currentStrategy?.edges ?? []
  );

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) {
        return;
      }

      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (key === "y" || (key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    if (!persistApi) {
      setHasHydratedStore(true);
      return;
    }

    const handleHydrateStart = () => {
      setHasHydratedStore(false);
    };
    const handleHydrateFinish = () => {
      setHasHydratedStore(true);
    };

    const unsubscribeHydrate = persistApi.onHydrate(handleHydrateStart);
    const unsubscribeFinish = persistApi.onFinishHydration(handleHydrateFinish);

    setHasHydratedStore(persistApi.hasHydrated());

    return () => {
      unsubscribeHydrate();
      unsubscribeFinish();
    };
  }, [persistApi]);

  // Initialize a new strategy on mount if none exists
  useEffect(() => {
    if (!hasHydratedStore) {
      return;
    }
    if (!currentStrategy) {
      if (hasPersistedStrategySnapshot()) {
        return;
      }
      createNewStrategy("Untitled Strategy");
    }
  }, [currentStrategy, createNewStrategy, hasHydratedStore]);

  const currentStrategyName = currentStrategy?.name;

  useEffect(() => {
    if (currentStrategyName) {
      setStrategyName(currentStrategyName);
    }
  }, [currentStrategyName]);

  useEffect(() => {
    if (selectedNode && !isPropertyPanelOpen) {
      setIsPropertyPanelOpen(true);
    }
  }, [isPropertyPanelOpen, selectedNode]);

  const runPreview = useMemo(() => {
    if (!currentStrategy) {
      return { payload: null, error: "Create a strategy before running." };
    }

    const parsedCapital = Number.parseFloat(capitalInput);
    try {
      const payload = buildStrategyLabRunRequest(currentStrategy, {
        name: strategyName,
        capital: Number.isFinite(parsedCapital) ? parsedCapital : undefined,
      });
      return { payload, error: null };
    } catch (error) {
      return {
        payload: null,
        error: error instanceof Error ? error.message : "Invalid run configuration.",
      };
    }
  }, [capitalInput, currentStrategy, strategyName]);

  const previewWarnings = useMemo(() => {
    if (!currentStrategy) {
      return [];
    }

    const warnings: string[] = [];
    const ignoredLegacyNodes = currentStrategy.nodes.filter((node) => {
      const nodeType = node?.data?.type;
      return nodeType === "signal" || nodeType === "output";
    }).length;

    if (ignoredLegacyNodes > 0) {
      warnings.push(
        `${ignoredLegacyNodes} legacy node(s) (Signal/Output) are ignored by Template Tuner execution.`
      );
    }

    const connectionCount = currentStrategy.edges.length;
    if (connectionCount > 0) {
      warnings.push(
        `${connectionCount} connection(s) detected. Connections are visual only and do not change execution logic.`
      );
    }

    return warnings;
  }, [currentStrategy]);

  const isRunActive = runStatus === "queued" || runStatus === "running";

  const resetRunState = useCallback(() => {
    runRequestSequenceRef.current += 1;
    if (runPollAbortRef.current) {
      runPollAbortRef.current.abort();
      runPollAbortRef.current = null;
    }
    setActiveRunId(null);
    setRunStatus(null);
    setRunError(null);
    setRunSummary(null);
    setIsRunSubmitting(false);
  }, []);

  const confirmDiscardUnsavedChanges = useCallback(
    (actionLabel: string) => {
      if (!isDirty) {
        return true;
      }
      return confirm(`You have unsaved changes. Are you sure you want to ${actionLabel}?`);
    },
    [isDirty]
  );

  const getClientErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (error instanceof StrategyLabClientError) {
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return fallback;
  }, []);

  // Handle drag start from palette
  const handleDragStart = useCallback((event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.setData("text/plain", nodeType);
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const handleAddNodeFromPalette = useCallback(
    (nodeType: string) => {
      // ── Pipeline column ordering ──
      const pipelineOrder: Record<string, number> = {
        dataSource: 0, indicator: 1, filter: 1, math: 1,
        sort: 2, weighting: 2, conditional: 2, signal: 3, merge: 3,
        risk: 4, backtest: 5, output: 5,
      };

      // ── Connection rules (which source → which targets) ──
      const connectionRules: Record<string, string[]> = {
        dataSource: ["indicator", "filter", "math", "sort", "weighting", "signal"],
        indicator: ["filter", "signal", "sort", "math", "conditional", "merge", "output"],
        filter: ["signal", "output", "conditional", "merge"],
        signal: ["output", "merge", "risk", "backtest"],
        output: [],
        weighting: ["signal", "output"],
        conditional: ["signal", "output"],
        sort: ["weighting", "signal", "output"],
        math: ["signal", "filter", "output"],
        merge: ["risk", "output", "backtest"],
        risk: ["backtest", "output"],
        backtest: [],
      };

      // ── Edge color by source type ──
      const edgeColorBySource: Record<string, string> = {
        dataSource: "#0d9488", indicator: "#2563eb", filter: "#e11d48",
        signal: "#e11d48", output: "#78716c", weighting: "#059669",
        conditional: "#059669", sort: "#0ea5e9", math: "#6366f1",
        merge: "#14b8a6", risk: "#f59e0b", backtest: "#059669",
      };

      const existingNodes = currentStrategy?.nodes ?? [];
      const col = pipelineOrder[nodeType] ?? 0;

      // ── Auto-layout: count nodes already in this column ──
      const nodesInSameCol = existingNodes.filter(
        (n) => (pipelineOrder[n.type ?? ""] ?? -1) === col
      ).length;

      const COL_WIDTH = 280;
      const ROW_HEIGHT = 160;
      const BASE_X = 80;
      const BASE_Y = 160;

      const position = {
        x: BASE_X + col * COL_WIDTH,
        y: BASE_Y + nodesInSameCol * ROW_HEIGHT,
      };

      const node = createStrategyNodeFromPaletteType(nodeType, position);
      if (!node) {
        toast.error("Unsupported node type.");
        return;
      }
      captureSnapshot();
      addNode(node);

      // ── Auto-connect: find the best upstream node to connect from ──
      // Walk backwards through pipeline columns to find a compatible source
      const candidateSources = existingNodes
        .filter((n) => {
          const srcType = n.type ?? "";
          const allowed = connectionRules[srcType] ?? [];
          return allowed.includes(nodeType);
        })
        .sort((a, b) => {
          // Prefer nodes closer in pipeline order (higher col first)
          const colA = pipelineOrder[a.type ?? ""] ?? 0;
          const colB = pipelineOrder[b.type ?? ""] ?? 0;
          return colB - colA; // descending — closest upstream first
        });

      if (candidateSources.length > 0) {
        const source = candidateSources[0];
        const edgeColor = edgeColorBySource[source.type ?? ""] || "#a8a29e";
        const newEdge: StrategyEdge = {
          id: `e-${source.id}-${node.id}-${Date.now()}`,
          source: source.id,
          target: node.id,
          animated: true,
          style: { stroke: edgeColor, strokeWidth: 2 },
        };
        addEdge(newEdge);
      }

      setSelectedNode(node.id);
      setIsPropertyPanelOpen(true);
    },
    [addNode, addEdge, captureSnapshot, currentStrategy?.nodes, setSelectedNode]
  );

  // Handle node update
  const handleUpdateNode = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      captureSnapshot();
      updateNodeData(nodeId, data);
    },
    [captureSnapshot, updateNodeData]
  );

  // Handle node delete
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      captureSnapshot();
      deleteNode(nodeId);
      setSelectedNode(null);
      toast.success("Node deleted");
    },
    [captureSnapshot, deleteNode, setSelectedNode]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    const normalizedName = strategyName.trim() || "Untitled Strategy";
    if (normalizedName !== strategyName) {
      setStrategyName(normalizedName);
    }
    updateStrategyName(normalizedName);

    try {
      await saveStrategy();
      toast.success("Strategy saved successfully");
    } catch {
      toast.error("Failed to save strategy");
    }
  }, [saveStrategy, strategyName, updateStrategyName]);

  // Handle run backtest
  const handleRunBacktest = useCallback(async () => {
    if (isRunActive || isRunSubmitting) {
      toast.info("A backtest run is already in progress.");
      return;
    }

    const payload = runPreview.payload;
    if (!payload) {
      toast.error(runPreview.error || "Invalid run configuration.");
      return;
    }

    const requestId = runRequestSequenceRef.current + 1;
    runRequestSequenceRef.current = requestId;
    if (runPollAbortRef.current) {
      runPollAbortRef.current.abort();
    }
    const pollAbortController = new AbortController();
    runPollAbortRef.current = pollAbortController;

    setIsRunSubmitting(true);
    setRunSummary(null);
    setRunError(null);

    try {
      const created = await createStrategyLabRunClient(payload);
      if (runRequestSequenceRef.current !== requestId) {
        return;
      }
      setActiveRunId(created.runId);
      setRunStatus(created.status);
      toast.info("Backtest queued. Waiting for completion...");

      const terminalRun = await waitForStrategyLabRunTerminal(created.runId, {
        pollIntervalMs: 1000,
        timeoutMs: 90_000,
        signal: pollAbortController.signal,
        onStatusChange: (nextRun) => {
          if (runRequestSequenceRef.current === requestId) {
            setRunStatus(nextRun.status);
          }
        },
      });
      if (runRequestSequenceRef.current !== requestId) {
        return;
      }

      setRunStatus(terminalRun.status);

      if (terminalRun.status === "succeeded") {
        const summary = await getStrategyLabRunSummaryClient(created.runId);
        if (runRequestSequenceRef.current !== requestId) {
          return;
        }
        setRunSummary(summary);
        toast.success("Backtest completed successfully.");
        return;
      }

      if (terminalRun.status === "cancelled") {
        setRunError("Run was cancelled.");
        toast.info("Backtest cancelled.");
        return;
      }

      const failureMessage = terminalRun.error?.message || "Backtest failed.";
      setRunError(failureMessage);
      toast.error(failureMessage);
    } catch (error) {
      if (error instanceof StrategyLabClientError && error.code === "ABORTED") {
        return;
      }
      if (runRequestSequenceRef.current !== requestId) {
        return;
      }
      const message = getClientErrorMessage(error, "Failed to execute backtest.");
      setRunError(message);
      toast.error(message);
    } finally {
      if (runRequestSequenceRef.current === requestId) {
        setIsRunSubmitting(false);
      }
      if (runPollAbortRef.current === pollAbortController) {
        runPollAbortRef.current = null;
      }
    }
  }, [getClientErrorMessage, isRunActive, isRunSubmitting, runPreview]);

  const handleCancelRun = useCallback(async () => {
    if (!activeRunId || !isRunActive) {
      return;
    }

    try {
      const run = await cancelStrategyLabRunClient(activeRunId);
      setRunStatus(run.status);
      if (run.status === "cancelled") {
        runRequestSequenceRef.current += 1;
        if (runPollAbortRef.current) {
          runPollAbortRef.current.abort();
          runPollAbortRef.current = null;
        }
        setIsRunSubmitting(false);
        setRunError("Run was cancelled.");
      }
      toast.info("Cancel request submitted.");
    } catch (error) {
      toast.error(getClientErrorMessage(error, "Failed to cancel run."));
    }
  }, [activeRunId, getClientErrorMessage, isRunActive]);

  // Handle export
  const handleExport = useCallback(() => {
    if (!currentStrategy) return;

    const data = JSON.stringify(currentStrategy, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${strategyName.toLowerCase().replace(/\s+/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Strategy exported");
  }, [currentStrategy, strategyName]);

  // Handle new strategy
  const handleNewStrategy = useCallback(() => {
    if (!confirmDiscardUnsavedChanges("create a new strategy")) {
      return;
    }

    reset();
    createNewStrategy("Untitled Strategy");
    clearHistory();
    setStrategyName("Untitled Strategy");
    resetRunState();
    toast.success("New strategy created");
  }, [clearHistory, confirmDiscardUnsavedChanges, createNewStrategy, reset, resetRunState]);

  const applyIncomingStrategy = useCallback(
    (
      nextNodes: StrategyNode[],
      nextEdges: StrategyEdge[],
      name: string,
      options: {
        actionLabel: string;
        successToast?: string;
        trackEvent: StrategyBuilderInteractionEvent;
      }
    ): boolean => {
      if (!confirmDiscardUnsavedChanges(options.actionLabel)) {
        return false;
      }

      reset();
      createNewStrategy(name);
      clearHistory();
      setNodes(nextNodes);
      setEdges(nextEdges);

      if (nextNodes.length > 0) {
        setSelectedNode(nextNodes[0].id);
        setIsPropertyPanelOpen(true);
      } else {
        setSelectedNode(null);
      }

      setStrategyName(name);
      updateStrategyName(name);
      resetRunState();
      if (options.successToast) {
        toast.success(options.successToast);
      }
      trackStrategyBuilderEvent(options.trackEvent, {
        name,
        nodeCount: nextNodes.length,
        edgeCount: nextEdges.length,
      });
      return true;
    },
    [
      confirmDiscardUnsavedChanges,
      createNewStrategy,
      clearHistory,
      reset,
      resetRunState,
      setEdges,
      setNodes,
      setSelectedNode,
      trackStrategyBuilderEvent,
      updateStrategyName,
    ]
  );

  const handleApplyTemplate = useCallback(
    (templateNodes: StrategyNode[], templateEdges: StrategyEdge[], name: string): boolean =>
      applyIncomingStrategy(templateNodes, templateEdges, name, {
        actionLabel: "load a template",
        successToast: `Strategy "${name}" loaded`,
        trackEvent: "template_applied",
      }),
    [applyIncomingStrategy]
  );

  const handleApplyAiStrategy = useCallback(
    (nextNodes: StrategyNode[], nextEdges: StrategyEdge[], name: string): boolean =>
      applyIncomingStrategy(nextNodes, nextEdges, name, {
        actionLabel: "apply an AI strategy update",
        trackEvent: "ai_strategy_applied",
      }),
    [applyIncomingStrategy]
  );

  // Handle name change
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextName = e.target.value;
      setStrategyName(nextName);
      updateStrategyName(nextName);
    },
    [updateStrategyName]
  );

  const handleNameBlur = useCallback(() => {
    const normalizedName = strategyName.trim() || "Untitled Strategy";
    if (normalizedName !== strategyName) {
      setStrategyName(normalizedName);
      updateStrategyName(normalizedName);
    }
  }, [strategyName, updateStrategyName]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Emerald accent line */}
      <div className="h-0.5 bg-emerald-700 dark:bg-emerald-600 flex-shrink-0" />

      {/* 3-panel layout */}
      <div className="flex flex-row flex-1 min-h-0">
        {/* Left Panel — Palette */}
        <div
          className={cn(
            "w-64 border-r border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex-shrink-0 flex flex-col",
            isPaletteOpen ? "flex" : "hidden lg:flex"
          )}
        >
          {/* Templates — prominent position */}
          <div className="border-b border-stone-200 dark:border-neutral-700 px-3 py-2">
            <TemplateGallery onApplyTemplate={handleApplyTemplate} />
          </div>
          {/* Components */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <NodePalette
              onDragStart={handleDragStart}
              onAddNode={handleAddNodeFromPalette}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 bg-white px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900 flex-shrink-0">
            {/* Left — Title + Name */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 border-r border-stone-200 dark:border-neutral-700 pr-3">
                <span className="h-px w-5 bg-emerald-700 dark:bg-emerald-500" />
                <span className="font-serif text-sm font-bold text-stone-900 dark:text-white whitespace-nowrap">Strategy Builder</span>
              </div>
              <Input
                value={strategyName}
                onChange={handleNameChange}
                onBlur={handleNameBlur}
                className="h-8 w-48 border-stone-300 bg-stone-50 text-sm font-medium dark:border-neutral-700 dark:bg-neutral-950"
                placeholder="Strategy name..."
              />
              <Input
                type="number"
                min={1}
                value={capitalInput}
                onChange={(event) => setCapitalInput(event.target.value)}
                className="h-8 w-28 border-stone-300 bg-stone-50 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                placeholder="Capital"
                aria-label="Initial capital"
              />
              {isDirty && (
                <span className="text-[11px] font-sans uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Unsaved
                </span>
              )}
            </div>

            {/* Undo/Redo + Validation */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={undo}
                disabled={!canUndo}
                className="h-8 w-8 p-0 border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:bg-stone-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={!canRedo}
                className="h-8 w-8 p-0 border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:bg-stone-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </Button>

              {/* Validation status */}
              {(currentStrategy?.nodes.length ?? 0) > 0 && (
                <div className="flex items-center gap-1.5 ml-2 px-2 py-1 border border-stone-200 dark:border-neutral-700 bg-stone-50 dark:bg-neutral-950 rounded text-[10px]">
                  {validation.totalErrors > 0 ? (
                    <>
                      <AlertCircle className="w-3 h-3 text-rose-700 dark:text-rose-400" />
                      <span className="text-rose-700 dark:text-rose-400 font-bold">{validation.totalErrors} error{validation.totalErrors !== 1 ? "s" : ""}</span>
                    </>
                  ) : validation.totalWarnings > 0 ? (
                    <>
                      <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span className="text-amber-600 dark:text-amber-400 font-bold">{validation.totalWarnings} warning{validation.totalWarnings !== 1 ? "s" : ""}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Valid</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-stone-300 bg-white text-xs font-sans uppercase tracking-wider text-stone-600 hover:border-stone-400 hover:bg-stone-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-900 lg:hidden"
                onClick={() => setIsPaletteOpen((prev) => !prev)}
              >
                <PanelLeft className="w-3.5 h-3.5" />
                Blocks
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-stone-300 bg-white text-xs font-sans uppercase tracking-wider text-stone-600 hover:border-stone-400 hover:bg-stone-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
                onClick={() => setIsPropertyPanelOpen((prev) => !prev)}
              >
                <PanelRight className="w-3.5 h-3.5" />
                Properties
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewStrategy}
                className="h-8 gap-1.5 border-stone-300 bg-white text-xs font-sans uppercase tracking-wider text-stone-600 hover:border-stone-400 hover:bg-stone-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="h-8 gap-1.5 border-stone-300 bg-white text-xs font-sans uppercase tracking-wider text-stone-600 hover:border-stone-400 hover:bg-stone-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !isDirty}
                className="h-8 gap-1.5 border-stone-300 bg-white text-xs font-sans uppercase tracking-wider text-stone-600 hover:border-stone-400 hover:bg-stone-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>

            {/* Right — AI + Run */}
            <div className="flex items-center gap-1.5">
              <AiSuggestDialog onApplyStrategy={handleApplyAiStrategy} />
              <Button
                size="sm"
                onClick={handleRunBacktest}
                disabled={isRunSubmitting || isRunActive}
                className="h-8 gap-1.5 bg-emerald-700 text-xs font-sans uppercase tracking-wider hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <Play className="w-3.5 h-3.5" />
                {isRunSubmitting || isRunActive ? "Running..." : "Run Backtest"}
              </Button>
              {isRunActive && activeRunId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelRun}
                  className="h-8 gap-1.5 text-xs font-sans uppercase tracking-wider"
                >
                  <Square className="w-3.5 h-3.5" />
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Info Bar — strategy preview */}
          <div className="flex items-center gap-3 border-b border-stone-200 bg-stone-50 px-4 py-1.5 text-[11px] dark:border-neutral-800 dark:bg-neutral-950/70 flex-shrink-0">
            {runPreview.payload ? (
              <div className="flex items-center gap-3 flex-wrap text-stone-600 dark:text-neutral-400">
                <span className="inline-flex items-center gap-1.5 border border-stone-200 dark:border-neutral-700 px-2 py-0.5 bg-white dark:bg-neutral-900">
                  <span className="uppercase tracking-wider text-stone-400 dark:text-neutral-500">SYM</span>
                  <strong className="text-stone-900 dark:text-white">{runPreview.payload.symbol}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 border border-stone-200 dark:border-neutral-700 px-2 py-0.5 bg-white dark:bg-neutral-900">
                  <span className="uppercase tracking-wider text-stone-400 dark:text-neutral-500">TYPE</span>
                  <strong className="text-stone-900 dark:text-white">{runPreview.payload.strategyType}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 border border-stone-200 dark:border-neutral-700 px-2 py-0.5 bg-white dark:bg-neutral-900">
                  <span className="uppercase tracking-wider text-stone-400 dark:text-neutral-500">CAPITAL</span>
                  <strong className="text-stone-900 dark:text-white">{formatNumber(runPreview.payload.capital ?? 100000)}</strong>
                </span>
                {runStatus && (
                  <span className="inline-flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {runStatus}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-stone-400 dark:text-neutral-500 italic">{runPreview.error}</p>
            )}
            {runError && (
              <p className="text-rose-600 dark:text-rose-400" role="alert">
                {runError}
              </p>
            )}
            {previewWarnings.length > 0 && (
              <div className="flex items-center gap-2">
                {previewWarnings.map((warning) => (
                  <span key={warning} className="text-amber-600 dark:text-amber-400">
                    ⚠ {warning}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Canvas */}
          <div className="flex-1 relative min-h-0">
            <StrategyCanvas onBeforeMutate={captureSnapshot} />
          </div>

          {runSummary && (
            <BacktestResultsPanel
              result={runSummary}
              onClose={() => setRunSummary(null)}
              onRerun={handleRunBacktest}
              isRunning={isRunSubmitting || isRunActive}
            />
          )}

          {/* Status Bar */}
          <div className="flex items-center justify-between border-t border-stone-200 bg-white px-4 py-1 text-[11px] text-stone-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 flex-shrink-0">
            <div className="flex items-center gap-4">
              <span>
                Nodes: {currentStrategy?.nodes.length || 0}
              </span>
              <span>
                Connections: {currentStrategy?.edges.length || 0}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {currentStrategy?.updatedAt && (
                <span>
                  Last saved: {new Date(currentStrategy.updatedAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Properties */}
        <div
          className={cn(
            "w-80 border-l border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex-shrink-0 overflow-y-auto transition-all duration-300",
            isPropertyPanelOpen ? "block" : "hidden"
          )}
        >
          <PropertyPanel
            selectedNode={selectedNode}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onClose={() => {
              setSelectedNode(null);
              setIsPropertyPanelOpen(false);
            }}
          />
        </div>
      </div>
    </div>
  );
}
