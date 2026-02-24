"use client";

import { useMemo, useState } from "react";
import { Sparkles, PlayCircle, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AssistantContextSnapshot } from "@/types/assistant";
import {
  defaultArgsForTool,
  draftComposerPlan,
  type ComposerDraftPlan,
  type ComposerExecuteToolName,
} from "@/lib/assistant/composerPlan";

type ComposerWorkflowProps = {
  contextSnapshot: AssistantContextSnapshot;
  disabled?: boolean;
};

type ComposerExecuteResponse = {
  success?: boolean;
  error?: string;
  execution?: Record<string, unknown>;
  result?: unknown;
};

const TOOL_OPTIONS: Array<{ value: ComposerExecuteToolName; label: string }> = [
  { value: "finance_analysis", label: "finance_analysis" },
  { value: "risk_metrics", label: "risk_metrics" },
  { value: "backtest_run", label: "backtest_run" },
  { value: "stock_universe_ranking", label: "stock_universe_ranking" },
  { value: "valuation_rankings", label: "valuation_rankings" },
  { value: "icb_snapshot", label: "icb_snapshot" },
];

export function ComposerWorkflow({ contextSnapshot, disabled = false }: ComposerWorkflowProps) {
  const [objective, setObjective] = useState("");
  const [draft, setDraft] = useState<ComposerDraftPlan | null>(null);
  const [selectedTool, setSelectedTool] = useState<ComposerExecuteToolName>("finance_analysis");
  const [argumentsJson, setArgumentsJson] = useState(
    JSON.stringify(defaultArgsForTool("finance_analysis", contextSnapshot), null, 2)
  );
  const [approvalToken, setApprovalToken] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComposerExecuteResponse | null>(null);

  const canExecute = useMemo(() => {
    return !disabled && !isExecuting && selectedTool.length > 0 && approvalToken.trim().length > 0;
  }, [approvalToken, disabled, isExecuting, selectedTool]);

  const handleDraftPlan = () => {
    const plan = draftComposerPlan(objective, contextSnapshot);
    if (!plan) {
      setError("Objective is required to draft a Composer plan.");
      return;
    }

    setDraft(plan);
    setSelectedTool(plan.toolName);
    setArgumentsJson(JSON.stringify(plan.arguments, null, 2));
    setError(null);
    setResult(null);
  };

  const handleToolChange = (nextTool: ComposerExecuteToolName) => {
    setSelectedTool(nextTool);
    setArgumentsJson(JSON.stringify(defaultArgsForTool(nextTool, contextSnapshot), null, 2));
    setError(null);
    setResult(null);
  };

  const handleExecute = async () => {
    setError(null);
    setResult(null);

    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(argumentsJson);
    } catch {
      setError("Arguments JSON is invalid. Please fix formatting before execute.");
      return;
    }

    if (typeof parsedArgs !== "object" || parsedArgs === null || Array.isArray(parsedArgs)) {
      setError("Arguments must be a JSON object.");
      return;
    }

    setIsExecuting(true);
    try {
      const response = await fetch("/api/assistant/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          toolName: selectedTool,
          arguments: parsedArgs,
          approvalToken: approvalToken.trim(),
        }),
      });

      const payload = (await response.json()) as ComposerExecuteResponse;
      if (!response.ok) {
        setError(payload?.error || `Execution failed with HTTP ${response.status}.`);
        setResult(payload);
        return;
      }

      setResult(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Execute request failed.");
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="mx-4 mt-3 rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Composer Agent</p>
          <h3 className="text-sm font-semibold text-stone-900 dark:text-neutral-100">
            Plan and Execute Tool Calling
          </h3>
          <p className="mt-1 text-xs text-stone-700 dark:text-neutral-300">
            Flow: objective -&gt; plan preview -&gt; approval token -&gt; execute.
          </p>
        </div>
        <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
      </div>

      <div className="mt-3 space-y-2">
        <label className="text-xs font-medium text-stone-700 dark:text-neutral-200" htmlFor="composer-objective">
          Objective
        </label>
        <textarea
          id="composer-objective"
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          placeholder="Example: Top 10 ngan hang HOSE theo PE ngay 2025-12-31"
          rows={2}
          disabled={disabled || isExecuting}
          className={cn(
            "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900",
            "dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          )}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || isExecuting}
          onClick={handleDraftPlan}
          className="w-full"
        >
          Draft Plan
        </Button>
      </div>

      {draft && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-white/80 p-2 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          Suggested: <span className="font-semibold">{draft.toolName}</span> - {draft.summary}
        </div>
      )}

      <div className="mt-3 space-y-2">
        <label className="text-xs font-medium text-stone-700 dark:text-neutral-200" htmlFor="composer-tool">
          Tool
        </label>
        <select
          id="composer-tool"
          value={selectedTool}
          onChange={(event) => handleToolChange(event.target.value as ComposerExecuteToolName)}
          disabled={disabled || isExecuting}
          className={cn(
            "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900",
            "dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          )}
        >
          {TOOL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 space-y-2">
        <label className="text-xs font-medium text-stone-700 dark:text-neutral-200" htmlFor="composer-args-json">
          Arguments JSON
        </label>
        <textarea
          id="composer-args-json"
          value={argumentsJson}
          onChange={(event) => setArgumentsJson(event.target.value)}
          rows={7}
          disabled={disabled || isExecuting}
          className={cn(
            "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 font-mono text-[11px] text-stone-900",
            "dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          )}
        />
      </div>

      <div className="mt-2 space-y-2">
        <label className="text-xs font-medium text-stone-700 dark:text-neutral-200" htmlFor="composer-approval-token">
          Approval Token
        </label>
        <div className="flex items-center gap-2">
          <input
            id="composer-approval-token"
            type="password"
            value={approvalToken}
            onChange={(event) => setApprovalToken(event.target.value)}
            placeholder="Required by /api/assistant/execute"
            disabled={disabled || isExecuting}
            className={cn(
              "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900",
              "dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            )}
          />
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        onClick={handleExecute}
        disabled={!canExecute}
        className="mt-3 w-full"
      >
        <PlayCircle className="mr-1 h-4 w-4" />
        {isExecuting ? "Executing..." : "Execute Tool"}
      </Button>

      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
          <p className="inline-flex items-center gap-1 font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        </div>
      )}

      {result && (
        <div className="mt-2 rounded-lg border border-stone-200 bg-white/85 p-2 dark:border-neutral-700 dark:bg-neutral-900/70">
          <p className="mb-1 text-xs font-medium text-stone-700 dark:text-neutral-200">Execution Result</p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all text-[11px] text-stone-700 dark:text-neutral-200">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}


