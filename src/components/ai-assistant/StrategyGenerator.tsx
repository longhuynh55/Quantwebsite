"use client";

import * as React from 'react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, RefreshCw, Wand2, Lightbulb } from 'lucide-react';
import type { GeneratedStrategy } from '@/lib/ai/strategy-generator';
import { StrategyPreview } from './StrategyPreview';
import { AIResponsePanel } from './AIResponsePanel';
import { getStrategyExamplesForUI } from '@/lib/ai/prompts/strategy-prompts';

interface StrategyGeneratorProps {
  onStrategyGenerated?: (strategy: GeneratedStrategy) => void;
  onApplyToBuilder?: (strategy: GeneratedStrategy) => void;
  className?: string;
}

interface GenerationState {
  isLoading: boolean;
  error: string | null;
  strategy: GeneratedStrategy | null;
  rawResponse: string | null;
  latencyMs: number | null;
}

export function StrategyGenerator({
  onStrategyGenerated,
  onApplyToBuilder,
  className,
}: StrategyGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [state, setState] = useState<GenerationState>({
    isLoading: false,
    error: null,
    strategy: null,
    rawResponse: null,
    latencyMs: null,
  });

  const examples = React.useMemo(() => getStrategyExamplesForUI(), []);

  const handleGenerate = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || state.isLoading) return;

    setState({
      isLoading: true,
      error: null,
      strategy: null,
      rawResponse: null,
      latencyMs: null,
    });

    try {
      const response = await fetch('/api/ai/generate-strategy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });

      const data = await response.json();

      if (!data.success) {
        setState({
          isLoading: false,
          error: data.error || 'Failed to generate strategy',
          strategy: null,
          rawResponse: data.rawResponse || null,
          latencyMs: data.latencyMs || null,
        });
        return;
      }

      setState({
        isLoading: false,
        error: null,
        strategy: data.strategy,
        rawResponse: data.rawResponse || null,
        latencyMs: data.latencyMs || null,
      });

      onStrategyGenerated?.(data.strategy);
    } catch (error) {
      setState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        strategy: null,
        rawResponse: null,
        latencyMs: null,
      });
    }
  }, [prompt, state.isLoading, onStrategyGenerated]);

  const handleRetry = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  const handleApplyToBuilder = useCallback(() => {
    if (state.strategy && onApplyToBuilder) {
      onApplyToBuilder(state.strategy);
    }
  }, [state.strategy, onApplyToBuilder]);

  const handleExampleClick = useCallback((examplePrompt: string) => {
    setPrompt(examplePrompt);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate]
  );

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Input Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
              <Wand2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Tao Chien Luoc Bang AI</CardTitle>
              <CardDescription className="text-xs">
                Mo ta chien luoc bang tieng Viet de AI tao tu dong
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Text Input */}
          <div className="space-y-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Vi du: Tao chien luoc RSI mean reversion cho VNM - mua khi RSI < 30, ban khi RSI > 70 voi stop loss 5%"
              className={cn(
                'flex min-h-[100px] w-full rounded-md border border-stone-300 bg-transparent px-3 py-2 text-sm shadow-sm',
                'placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'dark:border-stone-600 dark:placeholder:text-stone-500 dark:focus-visible:ring-emerald-400',
                'resize-none'
              )}
              disabled={state.isLoading}
              aria-label="Mo ta chien luoc"
            />
            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
              <span>Nhan Ctrl+Enter de gui</span>
              <span>{prompt.length}/2000</span>
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || state.isLoading}
              className="flex-1"
            >
              {state.isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Dang tao...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Tao Chien Luoc
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Example Prompts */}
      {!state.strategy && !state.isLoading && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm">Vi du mau</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {examples.map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleClick(example.prompt)}
                  aria-label={`Su dung vi du: ${example.name}`}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-lg border border-stone-200 p-3 text-left transition-all',
                    'hover:border-emerald-300 hover:bg-emerald-50/60',
                    'dark:border-stone-700 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/20'
                  )}
                >
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {example.name}
                  </span>
                  <span className="text-xs text-stone-600 dark:text-stone-300">
                    {example.description}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {state.error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                <span className="text-red-600 dark:text-red-400">!</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  Loi tao chien luoc
                </p>
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {state.error}
                </p>
                {state.rawResponse && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-red-500 dark:text-red-400">
                      Xem phan hoi goc
                    </summary>
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-red-100 p-2 text-xs dark:bg-red-900/30">
                      {state.rawResponse}
                    </pre>
                  </details>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRetry}
                  className="mt-3"
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Thu lai
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategy Preview */}
      {state.strategy && (
        <StrategyPreview
          strategy={state.strategy}
          latencyMs={state.latencyMs}
          onApplyToBuilder={handleApplyToBuilder}
          onRegenerate={handleRetry}
        />
      )}

      {/* AI Response Panel */}
      {state.strategy && state.rawResponse && (
        <AIResponsePanel
          explanation={state.strategy.explanation}
          rawResponse={state.rawResponse}
          latencyMs={state.latencyMs}
        />
      )}
    </div>
  );
}
