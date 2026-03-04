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
import { Brain, Sparkles, X } from "lucide-react";
import { trackUiKpiEvent } from "@/lib/uiKpi";
import type { StrategyBuilderAiAssistEvent } from "@/lib/uiKpiSchema";

interface AiSuggestDialogProps {
  onApplyStrategy: (nodes: StrategyNode[], edges: StrategyEdge[], name: string) => boolean | Promise<boolean>;
  className?: string;
}

export const AiSuggestDialog = memo(function AiSuggestDialog({
  onApplyStrategy,
  className,
}: AiSuggestDialogProps) {
  const [open, setOpen] = useState(false);
  const [lastWarnings, setLastWarnings] = useState<string[]>([]);

  const trackAiAssistEvent = useCallback(
    (event: StrategyBuilderAiAssistEvent, detail?: Record<string, unknown>) => {
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

  const warningSummary = useMemo(() => {
    if (lastWarnings.length === 0) return null;
    const trimmed = lastWarnings.slice(0, 3);
    const extra = lastWarnings.length - trimmed.length;
    return extra > 0 ? [...trimmed, `...and ${extra} more warning(s).`] : trimmed;
  }, [lastWarnings]);

  const handleApplyGenerated = useCallback(
    async (strategy: GeneratedStrategy) => {
      const sanitized = sanitizeGeneratedStrategyForBuilder(strategy);
      const { warnings } = sanitized;
      setLastWarnings(warnings);

      const graph = generatedStrategyToBuilderGraph(sanitized.strategy);
      let applied = false;
      try {
        applied = await Promise.resolve(onApplyStrategy(graph.nodes, graph.edges, graph.name));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to apply generated strategy.");
        trackAiAssistEvent("generate_apply_failed", {
          reason: error instanceof Error ? error.message : "unknown_error",
        });
        return;
      }
      if (!applied) {
        trackAiAssistEvent("generate_apply_cancelled", {
          nodes: graph.nodes.length,
          edges: graph.edges.length,
          warningCount: warnings.length,
        });
        return;
      }

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
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

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300">
              <Sparkles className="h-4 w-4" />
            </span>
            AI Strategy Suggest
          </DialogTitle>
          <DialogDescription>
            Mo ta y tuong chien luoc. AI se tao node-flow va ban co the ap dung truc tiep vao Strategy Builder.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <StrategyGenerator onApplyToBuilder={handleApplyGenerated} />
        </div>

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
          <p className="text-xs text-stone-500 dark:text-neutral-400">Tip: Ctrl+Enter de gui prompt.</p>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
