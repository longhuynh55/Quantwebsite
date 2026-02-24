"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { StrategyCanvas, NodePalette, PropertyPanel, TemplateGallery, AiSuggestDialog } from "@/components/strategy-builder";
import type { StrategyNode, StrategyEdge } from "@/lib/stores/strategyBuilderStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useStrategyBuilderStore,
  useSelectedNode,
} from "@/lib/stores/strategyBuilderStore";
import { createStrategyNodeFromPaletteType } from "@/components/strategy-builder/nodeFactory";
import { cn } from "@/lib/utils";
import {
  Save,
  Play,
  Square,
  Download,
  Plus,
  PanelLeft,
  PanelRight,
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
    setNodes,
    setEdges,
    deleteNode,
    setSelectedNode,
    isSaving,
    isDirty,
    reset,
  } = useStrategyBuilderStore();

  const selectedNode = useSelectedNode();

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
      const existingNodes = currentStrategy?.nodes.length ?? 0;
      const position = {
        x: 120 + (existingNodes % 4) * 220,
        y: 120 + Math.floor(existingNodes / 4) * 120,
      };
      const node = createStrategyNodeFromPaletteType(nodeType, position);
      if (!node) {
        toast.error("Unsupported node type.");
        return;
      }
      addNode(node);
      setSelectedNode(node.id);
      setIsPropertyPanelOpen(true);
    },
    [addNode, currentStrategy?.nodes.length, setSelectedNode]
  );

  // Handle node update
  const handleUpdateNode = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      updateNodeData(nodeId, data);
    },
    [updateNodeData]
  );

  // Handle node delete
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      deleteNode(nodeId);
      setSelectedNode(null);
      toast.success("Node deleted");
    },
    [deleteNode, setSelectedNode]
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
    setStrategyName("Untitled Strategy");
    resetRunState();
    toast.success("New strategy created");
  }, [confirmDiscardUnsavedChanges, createNewStrategy, reset, resetRunState]);

  const handleApplyTemplate = useCallback(
    (templateNodes: StrategyNode[], templateEdges: StrategyEdge[], name: string) => {
      if (!confirmDiscardUnsavedChanges("load a template")) {
        return;
      }

      reset();
      createNewStrategy(name);
      setNodes(templateNodes);
      setEdges(templateEdges);

      if (templateNodes.length > 0) {
        setSelectedNode(templateNodes[0].id);
        setIsPropertyPanelOpen(true);
      } else {
        setSelectedNode(null);
      }

      setStrategyName(name);
      updateStrategyName(name);
      resetRunState();
      toast.success(`Strategy "${name}" loaded`);
    },
    [
      confirmDiscardUnsavedChanges,
      createNewStrategy,
      reset,
      resetRunState,
      setEdges,
      setNodes,
      setSelectedNode,
      updateStrategyName,
    ]
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
              <AiSuggestDialog onApplyStrategy={handleApplyTemplate} />
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
            <StrategyCanvas />
          </div>

          {runSummary && (
            <div className="border-t border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 px-4 py-2.5 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-sans uppercase tracking-wider font-semibold text-stone-900 dark:text-white">
                  Latest Backtest
                </h3>
                <span className="text-[11px] text-stone-500 dark:text-neutral-400">
                  {new Date(runSummary.generatedAt).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-xs">
                <div className="border border-stone-200 dark:border-neutral-700 px-2 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-neutral-500">Return</div>
                  <div className={cn("font-semibold", runSummary.summary.metrics.totalReturn >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
                    {formatPercent(runSummary.summary.metrics.totalReturn)}
                  </div>
                </div>
                <div className="border border-stone-200 dark:border-neutral-700 px-2 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-neutral-500">Sharpe</div>
                  <div className="font-semibold text-stone-900 dark:text-white">
                    {runSummary.summary.metrics.sharpeRatio.toFixed(2)}
                  </div>
                </div>
                <div className="border border-stone-200 dark:border-neutral-700 px-2 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-neutral-500">Drawdown</div>
                  <div className="font-semibold text-rose-700 dark:text-rose-400">
                    {formatPercent(runSummary.summary.metrics.maxDrawdown)}
                  </div>
                </div>
                <div className="border border-stone-200 dark:border-neutral-700 px-2 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-neutral-500">Trades</div>
                  <div className="font-semibold text-stone-900 dark:text-white">
                    {runSummary.summary.totalTrades}
                  </div>
                </div>
                <div className="border border-stone-200 dark:border-neutral-700 px-2 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-neutral-500">Coverage</div>
                  <div className="font-semibold text-stone-900 dark:text-white">
                    {formatPercent(runSummary.summary.diagnostics.coverageRatio)}
                  </div>
                </div>
              </div>
            </div>
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
