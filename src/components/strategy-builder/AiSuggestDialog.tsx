"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { StrategyEdge, StrategyNode } from "@/lib/stores/strategyBuilderStore";
import type { GeneratedStrategy } from "@/lib/ai/strategy-generator";
import {
  generatedStrategyToBuilderGraph,
  sanitizeGeneratedStrategyForBuilder,
} from "@/lib/ai/strategy-builder-adapter";
import { StrategyGenerator } from "@/components/ai-assistant";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Brain, Sparkles, Wand2, Loader2, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { trackUiKpiEvent } from "@/lib/uiKpi";

type AiTab = "generate" | "edit";

interface StrategyPatchPreview {
  patchedGraph: {
    name: string;
    nodes: StrategyNode[];
    edges: StrategyEdge[];
  };
  diffSummary: string[];
  warnings: string[];
  summary?: string;
  issues?: Array<{
    severity: "error" | "warning";
    code: string;
    message: string;
  }>;
}

interface AiSuggestDialogProps {
  onApplyStrategy: (nodes: StrategyNode[], edges: StrategyEdge[], name: string) => void;
  currentNodes: StrategyNode[];
  currentEdges: StrategyEdge[];
  strategyName: string;
  className?: string;
}

export const AiSuggestDialog = memo(function AiSuggestDialog({
  onApplyStrategy,
  currentNodes,
  currentEdges,
  strategyName,
  className,
}: AiSuggestDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AiTab>("generate");
  const [lastWarnings, setLastWarnings] = useState<string[]>([]);
  const [patchPrompt, setPatchPrompt] = useState("");
  const [patchLoading, setPatchLoading] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [patchPreview, setPatchPreview] = useState<StrategyPatchPreview | null>(null);

  const warningSummary = useMemo(() => {
    if (lastWarnings.length === 0) return null;
    const trimmed = lastWarnings.slice(0, 3);
    const extra = lastWarnings.length - trimmed.length;
    return extra > 0 ? [...trimmed, `...and ${extra} more warning(s).`] : trimmed;
  }, [lastWarnings]);

  const patchHasBlockingIssues = useMemo(() => {
    return Boolean(patchPreview?.issues?.some((issue) => issue.severity === "error"));
  }, [patchPreview]);

  const trackAiAssistEvent = useCallback(
    (event: string, detail?: Record<string, unknown>) => {
      trackUiKpiEvent({
        metric: "strategy_builder_ai_assist",
        event,
        page: "strategy-builder",
        source: "ai-suggest-dialog",
        detail,
      });
    },
    []
  );

  const handleApplyGenerated = useCallback(
    (strategy: GeneratedStrategy) => {
      const sanitized = sanitizeGeneratedStrategyForBuilder(strategy);
      const graph = generatedStrategyToBuilderGraph(sanitized.strategy);
      const warnings = Array.from(new Set([...sanitized.warnings, ...graph.warnings]));
      setLastWarnings(warnings);

      onApplyStrategy(graph.nodes, graph.edges, graph.name);

      if (warnings.length > 0) {
        const summary = (() => {
          const trimmed = warnings.slice(0, 3);
          const extra = warnings.length - trimmed.length;
          return extra > 0 ? [...trimmed, `...and ${extra} more warning(s).`] : trimmed;
        })();
        toast.warning("Applied with warnings", {
          description: summary.join("\n"),
        });
      } else {
        toast.success("AI strategy applied to builder");
      }

      trackAiAssistEvent("generate_apply_success", {
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        warningCount: warnings.length,
      });

      setOpen(false);
    },
    [onApplyStrategy, trackAiAssistEvent]
  );

  const handlePreviewPatch = useCallback(async () => {
    const prompt = patchPrompt.trim();
    if (!prompt || patchLoading) {
      return;
    }

    setPatchLoading(true);
    setPatchError(null);
    setPatchPreview(null);
    trackAiAssistEvent("edit_preview_requested", {
      promptLength: prompt.length,
      nodeCount: currentNodes.length,
      edgeCount: currentEdges.length,
    });

    try {
      const response = await fetch("/api/ai/strategy-patch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          mode: "preview",
          graph: {
            name: strategyName,
            nodes: currentNodes,
            edges: currentEdges,
          },
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
        patchedGraph?: {
          name: string;
          nodes: StrategyNode[];
          edges: StrategyEdge[];
        };
        diffSummary?: string[];
        warnings?: string[];
        summary?: string;
        issues?: Array<{
          severity: "error" | "warning";
          code: string;
          message: string;
        }>;
      };

      if (!data.success || !data.patchedGraph) {
        setPatchError(data.error || "Failed to build patch preview.");
        trackAiAssistEvent("edit_preview_failed", {
          reason: data.error || "invalid_response",
        });
        return;
      }

      setPatchPreview({
        patchedGraph: data.patchedGraph,
        diffSummary: Array.isArray(data.diffSummary) ? data.diffSummary : [],
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
        summary: data.summary,
        issues: data.issues,
      });
      trackAiAssistEvent("edit_preview_success", {
        diffCount: Array.isArray(data.diffSummary) ? data.diffSummary.length : 0,
        warningCount: Array.isArray(data.warnings) ? data.warnings.length : 0,
      });
    } catch (error) {
      setPatchError(error instanceof Error ? error.message : "Unexpected patch preview error.");
      trackAiAssistEvent("edit_preview_failed", {
        reason: error instanceof Error ? error.message : "exception",
      });
    } finally {
      setPatchLoading(false);
    }
  }, [currentEdges, currentNodes, patchLoading, patchPrompt, strategyName, trackAiAssistEvent]);

  const handleApplyPatch = useCallback(() => {
    if (!patchPreview || patchHasBlockingIssues) {
      return;
    }

    onApplyStrategy(
      patchPreview.patchedGraph.nodes,
      patchPreview.patchedGraph.edges,
      patchPreview.patchedGraph.name
    );
    const warningCount = patchPreview.warnings.length;
    if (warningCount > 0) {
      toast.warning(`Patch applied with ${warningCount} warning(s).`);
    } else {
      toast.success("Patch applied to strategy graph.");
    }
    trackAiAssistEvent("edit_apply_success", {
      nodeCount: patchPreview.patchedGraph.nodes.length,
      edgeCount: patchPreview.patchedGraph.edges.length,
      warningCount,
      hasBlockingIssues: patchHasBlockingIssues,
    });
    setOpen(false);
  }, [onApplyStrategy, patchHasBlockingIssues, patchPreview, trackAiAssistEvent]);

  const clearPatchPreview = useCallback(() => {
    setPatchPreview(null);
    setPatchError(null);
  }, []);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        trackAiAssistEvent("dialog_opened", { tab: activeTab });
      }
    },
    [activeTab, trackAiAssistEvent]
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button
          data-testid="ai-suggest-open-button"
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 border-stone-300 bg-white text-stone-700 hover:border-emerald-400 hover:bg-emerald-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/30",
            className
          )}
        >
          <Brain className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
          AI Suggest
        </Button>
      </DialogTrigger>

      <DialogContent data-testid="ai-suggest-dialog" className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300">
              <Sparkles className="h-4 w-4" />
            </span>
            AI Strategy Assistant
          </DialogTitle>
          <DialogDescription>
            Generate a new strategy, or edit the current graph with natural-language commands.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={activeTab === "generate" ? "default" : "outline"}
            onClick={() => {
              setActiveTab("generate");
              trackAiAssistEvent("tab_switched", { tab: "generate" });
            }}
            className="gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === "edit" ? "default" : "outline"}
            onClick={() => {
              setActiveTab("edit");
              trackAiAssistEvent("tab_switched", { tab: "edit" });
            }}
            className="gap-1.5"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Edit Graph
          </Button>
        </div>

        {activeTab === "generate" ? (
          <div className="mt-4">
            <StrategyGenerator onApplyToBuilder={handleApplyGenerated} />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <textarea
              data-testid="ai-suggest-patch-prompt"
              value={patchPrompt}
              onChange={(event) => setPatchPrompt(event.target.value)}
              placeholder="Example: Add a buy signal after RSI node when RSI < 30 and connect it to output"
              className={cn(
                "min-h-[110px] w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm",
                "placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500",
                "dark:border-neutral-700 dark:bg-neutral-950 dark:placeholder:text-neutral-500 dark:focus-visible:ring-emerald-400"
              )}
              disabled={patchLoading}
            />
            <div className="flex items-center gap-2">
              <Button
                data-testid="ai-suggest-preview-patch"
                type="button"
                size="sm"
                onClick={handlePreviewPatch}
                disabled={!patchPrompt.trim() || patchLoading}
                className="gap-1.5"
              >
                {patchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Preview Patch
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={clearPatchPreview}>
                Clear Preview
              </Button>
              <p className="text-xs text-stone-500 dark:text-neutral-400">
                Apply is disabled when blocking issues are detected.
              </p>
            </div>

            {patchError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
                {patchError}
              </div>
            )}

            {patchPreview && (
              <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs dark:border-neutral-700 dark:bg-neutral-900">
                {patchPreview.summary && <p className="font-medium text-stone-700 dark:text-neutral-200">{patchPreview.summary}</p>}

                <div className="space-y-1">
                  {patchPreview.diffSummary.map((item) => (
                    <p key={item} className="text-stone-600 dark:text-neutral-300">- {item}</p>
                  ))}
                </div>

                {patchPreview.warnings.length > 0 && (
                  <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                    {patchPreview.warnings.map((warning) => (
                      <p key={warning}>- {warning}</p>
                    ))}
                  </div>
                )}

                {patchHasBlockingIssues ? (
                  <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Blocking graph issues detected. Resolve prompt and regenerate preview.
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Patch is valid and ready to apply.
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    data-testid="ai-suggest-apply-patch"
                    type="button"
                    size="sm"
                    onClick={handleApplyPatch}
                    disabled={patchHasBlockingIssues}
                    className="gap-1.5"
                  >
                    Apply Patch
                  </Button>
                  <p className="text-[11px] text-stone-500 dark:text-neutral-400">
                    Runtime note: visual connections may not fully map to current Template Tuner execution logic.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {warningSummary && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold uppercase tracking-[0.14em]">Sanitizer warnings</span>
              <button
                type="button"
                onClick={() => setLastWarnings([])}
                className="p-1 text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                aria-label="Clear warnings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {warningSummary.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="justify-between">
          <p className="text-xs text-stone-500 dark:text-neutral-400">Tip: Use specific commands for more reliable graph edits.</p>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
