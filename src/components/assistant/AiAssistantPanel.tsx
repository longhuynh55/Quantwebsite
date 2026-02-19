"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { X, Trash2, Bot, AlertCircle, ShieldCheck, Database, ScrollText, PanelTop, Table2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAssistantStore } from '@/lib/stores/assistantStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { QuickActions } from './QuickActions';
import { TypingIndicator } from './TypingIndicator';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AssistantContextSnapshot, AssistantResponse, AssistantPreferences } from '@/types/assistant';
import { logUiEvent } from '@/lib/frontendTelemetry';

type AssistantUiError = {
  message: string;
  requestId: string;
  traceSummary?: string;
  recoveryHint: string;
};

export function AiAssistantPanel() {
  const router = useRouter();
  const {
    isOpen,
    closePanel,
    messages,
    isLoading,
    addMessage,
    clearMessages,
    setLoading,
    experienceLevel,
    uiMode,
    setUIMode,
  } = useAssistantStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<AssistantUiError | null>(null);
  const pathname = usePathname();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        closePanel();
      }
      // Ctrl+Shift+A to toggle
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        useAssistantStore.getState().togglePanel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closePanel]);

  const buildContextSnapshot = useCallback((): AssistantContextSnapshot => {
    const currentSearchParams =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

    const page =
      pathname === '/'
        ? 'home'
        : pathname === '/screener'
          ? 'screener'
          : pathname === '/charts'
            ? 'charts'
            : pathname === '/backtesting'
              ? 'backtesting'
              : pathname === '/portfolio'
                ? 'portfolio'
                : pathname === '/factors'
                  ? 'factors'
                  : pathname === '/risk'
                    ? 'risk'
                    : pathname === '/ml-lab'
                      ? 'ml-lab'
                      : pathname.startsWith('/learn')
                        ? 'learn'
                        : 'home';

    const filters: Record<string, string> = {};
    currentSearchParams.forEach((value, key) => {
      filters[key] = value;
    });

    const symbol = (currentSearchParams.get('symbol') || '').trim().toUpperCase() || undefined;
    const symbolsParam = currentSearchParams.get('symbols') || '';
    const symbols = symbolsParam
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 20);

    const timeframe =
      currentSearchParams.get('timeframe') ||
      currentSearchParams.get('range') ||
      currentSearchParams.get('period') ||
      undefined;

    const indicators = (currentSearchParams.get('indicators') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20);

    return {
      page,
      uiMode,
      symbol,
      symbols: symbols.length > 0 ? symbols : undefined,
      timeframe,
      selectedIndicators: indicators.length > 0 ? indicators : undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    };
  }, [pathname, uiMode]);

  const buildPreferences = useCallback((): AssistantPreferences => {
    const detailLevel =
      experienceLevel === 'beginner'
        ? 'brief'
        : experienceLevel === 'advanced'
          ? 'deep'
          : 'normal';
    return {
      language: 'vi',
      detailLevel,
    };
  }, [experienceLevel]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    setError(null);
    const requestId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const startedAt = Date.now();
    const contextSnapshot = buildContextSnapshot();
    logUiEvent('info', 'assistant.request.started', {
      requestId,
      page: contextSnapshot.page,
      messageChars: content.length,
      uiMode,
    });

    // Add user message
    addMessage({ role: 'user', content });

    // Set loading state
    setLoading(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-trace-id': requestId,
        },
        body: JSON.stringify({
          message: content,
          conversationHistory: messages.slice(-10),
          contextSnapshot,
          preferences: buildPreferences(),
          uiMode,
          requestId,
          clientTs: new Date().toISOString(),
        }),
      });

      const data: AssistantResponse = await response.json();

      if (!data.success) {
        logUiEvent('warn', 'assistant.request.failed', {
          requestId,
          status: response.status,
          error: data.error ?? 'unknown_error',
          durationMs: Date.now() - startedAt,
        });
        setError({
          message: data.error || 'Failed to get response',
          requestId: data.meta?.requestId ?? requestId,
          traceSummary: data.meta?.toolStatusSummary,
          recoveryHint: buildRecoveryHint(response.status, data.policyStatus),
        });
        return;
      }

      // Add assistant message
      addMessage({
        role: 'assistant',
        content: data.message,
        grounded: data.grounded,
        policyStatus: data.policyStatus,
        policyReason: data.policyReason,
        dataConfidence: data.dataConfidence,
        citations: data.citations,
        usedTools: data.usedTools,
        messageBlocks: data.messageBlocks,
        meta: data.meta,
      });
      logUiEvent('info', 'assistant.request.completed', {
        requestId,
        status: response.status,
        durationMs: Date.now() - startedAt,
        policyStatus: data.policyStatus ?? null,
        dataConfidence: data.dataConfidence ?? null,
        citationCount: Array.isArray(data.citations) ? data.citations.length : 0,
        toolCount: Array.isArray(data.usedTools) ? data.usedTools.length : 0,
      });
    } catch (err) {
      logUiEvent('error', 'assistant.request.exception', {
        requestId,
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      setError({
        message: err instanceof Error ? err.message : 'An error occurred. Please try again.',
        requestId,
        recoveryHint: 'Check your connection, then retry. If the problem persists, share the request ID with engineering.',
      });
    } finally {
      setLoading(false);
    }
  }, [messages, addMessage, setLoading, buildContextSnapshot, buildPreferences, uiMode]);

  const switchToCopilotMode = () => {
    setUIMode('copilot');
  };

  const switchToScreenerMode = () => {
    setUIMode('screener');
    closePanel();
    router.push('/screener');
  };

  const handleClearChat = () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      clearMessages();
      setError(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden"
        onClick={closePanel}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed z-50',
          'bg-white dark:bg-gray-900',
          'shadow-2xl shadow-black/20 dark:shadow-black/40',
          // Mobile: full screen
          'inset-0 lg:inset-auto',
          // Desktop: side panel
          'lg:top-0 lg:right-0 lg:h-full lg:w-[400px]',
          // Animation
          'animate-in slide-in-from-right duration-300',
          'flex flex-col'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-teal-600">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-white">AI Assistant</h2>
              <p className="text-xs text-white/80">Grounded Vietnamese Stock Market Copilot</p>
              <div className="mt-1.5 inline-flex items-center rounded-lg bg-white/15 p-0.5 border border-white/20">
                <button
                  type="button"
                  onClick={switchToCopilotMode}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
                    uiMode === "copilot" ? "bg-white text-blue-700" : "text-white/90 hover:bg-white/15"
                  )}
                >
                  <PanelTop className="w-3.5 h-3.5" />
                  Copilot
                </button>
                <button
                  type="button"
                  onClick={switchToScreenerMode}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
                    uiMode === "screener" ? "bg-white text-blue-700" : "text-white/90 hover:bg-white/15"
                  )}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  Screener
                </button>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white/90">Grounded Data</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white/90">Policy Guardrails</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white/90">Citations</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearChat}
                className="text-white/70 hover:text-white hover:bg-white/10"
                aria-label="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={closePanel}
              className="text-white/70 hover:text-white hover:bg-white/10"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto" role="log" aria-live="polite" aria-label="Assistant conversation">
          {/* Welcome Message */}
          {messages.length === 0 && (
            <div className="p-4 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                Welcome to QuantVN AI Assistant
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Ask about symbols, metrics, valuation, risk, and market structure. Responses prioritize grounded evidence.
              </p>
              <div className="grid grid-cols-1 gap-2 text-left">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-2.5 flex items-start gap-2">
                  <Database className="w-4 h-4 text-blue-500 mt-0.5" />
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Grounded Data:</span> numeric outputs are fetched from internal QuantVN APIs.
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-2.5 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5" />
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Guardrails:</span> missing evidence triggers abstain/fallback behavior.
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-2.5 flex items-start gap-2">
                  <ScrollText className="w-4 h-4 text-purple-500 mt-0.5" />
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Traceability:</span> each response includes sources and execution trace.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {messages.length === 0 && <QuickActions onAction={sendMessage} disabled={isLoading} />}

          {/* Messages */}
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {/* Typing Indicator */}
          {isLoading && <TypingIndicator />}

          {/* Error Display */}
          {error && (
            <div className="mx-4 my-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-700 dark:text-red-300">{error.message}</p>
                <p className="mt-1 text-[11px] text-red-700/90 dark:text-red-300/90 break-all">
                  Request ID: <code className="font-mono">{error.requestId}</code>
                </p>
                {error.traceSummary && (
                  <p className="mt-1 text-[11px] text-red-700/90 dark:text-red-300/90 break-words">
                    Trace: {error.traceSummary}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-red-700/90 dark:text-red-300/90">
                  Recovery: {error.recoveryHint}
                </p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs text-red-600 dark:text-red-400 underline mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
      </div>
    </>
  );
}

function buildRecoveryHint(
  statusCode: number,
  policyStatus: AssistantResponse["policyStatus"] | undefined
): string {
  if (statusCode === 429) {
    return "Rate limit reached. Wait about a minute, then retry with a narrower request.";
  }
  if (policyStatus === "shadow_blocked") {
    return "Request is outside grounded scope. Ask with HOSE-specific scope or a supported metric.";
  }
  if (policyStatus === "fallback") {
    return "Grounding evidence was incomplete. Retry with symbol + metric + timeframe for better coverage.";
  }
  if (statusCode >= 500) {
    return "Temporary backend/provider issue. Retry in a few seconds.";
  }
  return "Retry with a more specific prompt (symbol, metric, timeframe) to improve execution reliability.";
}
