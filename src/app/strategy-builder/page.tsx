"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { StrategyCanvas, NodePalette, PropertyPanel } from "@/components/strategy-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useStrategyBuilderStore,
  useSelectedNode,
} from "@/lib/stores/strategyBuilderStore";
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

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

export default function StrategyBuilderPage() {
  const [strategyName, setStrategyName] = useState("Untitled Strategy");
  const [capitalInput, setCapitalInput] = useState("100000");
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [isPropertyPanelOpen, setIsPropertyPanelOpen] = useState(true);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<StrategyLabRunStatus | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runSummary, setRunSummary] = useState<StrategyLabSummaryResult | null>(null);
  const [isRunSubmitting, setIsRunSubmitting] = useState(false);

  const {
    currentStrategy,
    createNewStrategy,
    saveStrategy,
    updateNodeData,
    deleteNode,
    setSelectedNode,
    isSaving,
    isDirty,
    reset,
  } = useStrategyBuilderStore();

  const selectedNode = useSelectedNode();

  // Initialize a new strategy on mount if none exists
  useEffect(() => {
    if (!currentStrategy) {
      createNewStrategy("Untitled Strategy");
    }
  }, [currentStrategy, createNewStrategy]);

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
    event.dataTransfer.effectAllowed = "move";
  }, []);

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
    try {
      await saveStrategy();
      toast.success("Strategy saved successfully");
    } catch {
      toast.error("Failed to save strategy");
    }
  }, [saveStrategy]);

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

    setIsRunSubmitting(true);
    setRunSummary(null);
    setRunError(null);

    try {
      const created = await createStrategyLabRunClient(payload);
      setActiveRunId(created.runId);
      setActiveJobId(created.jobId);
      setRunStatus(created.status);
      toast.info("Backtest queued. Waiting for completion...");

      const terminalRun = await waitForStrategyLabRunTerminal(created.runId, {
        pollIntervalMs: 1000,
        timeoutMs: 90_000,
        onStatusChange: (nextRun) => {
          setRunStatus(nextRun.status);
        },
      });

      setRunStatus(terminalRun.status);

      if (terminalRun.status === "succeeded") {
        const summary = await getStrategyLabRunSummaryClient(created.runId);
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
      const message = getClientErrorMessage(error, "Failed to execute backtest.");
      setRunError(message);
      toast.error(message);
    } finally {
      setIsRunSubmitting(false);
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
    if (isDirty) {
      if (!confirm("You have unsaved changes. Are you sure you want to create a new strategy?")) {
        return;
      }
    }
    reset();
    createNewStrategy("Untitled Strategy");
    setStrategyName("Untitled Strategy");
    toast.success("New strategy created");
  }, [isDirty, reset, createNewStrategy]);

  // Handle name change
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setStrategyName(e.target.value);
    },
    []
  );

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col lg:flex-row bg-gray-50 dark:bg-gray-950">
      {/* Left Panel - Node Palette */}
      <div
        className={cn(
          "w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0",
          isPaletteOpen ? "block" : "hidden lg:block"
        )}
      >
        <NodePalette onDragStart={handleDragStart} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          {/* Left - Strategy Name */}
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              value={strategyName}
              onChange={handleNameChange}
              className="w-64 h-9 text-sm font-medium"
              placeholder="Strategy name..."
            />
            <Input
              type="number"
              min={1}
              value={capitalInput}
              onChange={(event) => setCapitalInput(event.target.value)}
              className="w-40 h-9 text-sm"
              placeholder="Capital"
              aria-label="Initial capital"
            />
            {isDirty && (
              <span className="text-xs text-orange-600 dark:text-orange-400">
                Unsaved changes
              </span>
            )}
          </div>

          {/* Center - Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 lg:hidden"
              onClick={() => setIsPaletteOpen((prev) => !prev)}
            >
              <PanelLeft className="w-4 h-4" />
              Blocks
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 lg:hidden"
              onClick={() => setIsPropertyPanelOpen((prev) => !prev)}
            >
              <PanelRight className="w-4 h-4" />
              Properties
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewStrategy}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>

          {/* Right - Run */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleRunBacktest}
              disabled={isRunSubmitting || isRunActive}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              <Play className="w-4 h-4" />
              {isRunSubmitting || isRunActive ? "Running..." : "Run Backtest"}
            </Button>
            {isRunActive && activeRunId && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancelRun}
                className="gap-2"
              >
                <Square className="w-4 h-4" />
                Cancel Run
              </Button>
            )}
          </div>
        </div>

        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/70 text-xs">
          {runPreview.payload ? (
            <div className="flex items-center gap-4 flex-wrap text-gray-600 dark:text-gray-300">
              <span>
                Symbol: <strong>{runPreview.payload.symbol}</strong>
              </span>
              <span>
                Strategy: <strong>{runPreview.payload.strategyType}</strong>
              </span>
              <span>
                Capital: <strong>{formatNumber(runPreview.payload.capital ?? 100000)}</strong>
              </span>
              {runStatus && (
                <span>
                  Run status: <strong>{runStatus}</strong>
                </span>
              )}
              {activeRunId && (
                <span>
                  Run ID: <strong>{activeRunId}</strong>
                </span>
              )}
              {activeJobId && (
                <span>
                  Job ID: <strong>{activeJobId}</strong>
                </span>
              )}
            </div>
          ) : (
            <p className="text-red-600 dark:text-red-400">{runPreview.error}</p>
          )}
          {runError && (
            <p className="mt-1 text-red-600 dark:text-red-400" role="alert">
              {runError}
            </p>
          )}
          {previewWarnings.length > 0 && (
            <div className="mt-1 space-y-1 text-amber-700 dark:text-amber-300">
              {previewWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 relative min-h-[60vh] lg:min-h-0">
          <StrategyCanvas />
        </div>

        {runSummary && (
          <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Latest Backtest Result
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(runSummary.generatedAt).toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              <div className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-2">
                <div className="text-gray-500 dark:text-gray-400">Total Return</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatPercent(runSummary.summary.metrics.totalReturn)}
                </div>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-2">
                <div className="text-gray-500 dark:text-gray-400">Sharpe</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {runSummary.summary.metrics.sharpeRatio.toFixed(2)}
                </div>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-2">
                <div className="text-gray-500 dark:text-gray-400">Max Drawdown</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatPercent(runSummary.summary.metrics.maxDrawdown)}
                </div>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-2">
                <div className="text-gray-500 dark:text-gray-400">Total Trades</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {runSummary.summary.totalTrades}
                </div>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-2">
                <div className="text-gray-500 dark:text-gray-400">Coverage</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatPercent(runSummary.summary.diagnostics.coverageRatio)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-1.5 text-xs border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">
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
          "w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0 transition-all duration-300",
          isPropertyPanelOpen ? "block" : "hidden lg:block"
        )}
      >
        <PropertyPanel
          selectedNode={selectedNode}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onClose={() => setSelectedNode(null)}
        />
      </div>
    </div>
  );
}
