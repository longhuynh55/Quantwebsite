"use client";

import * as React from 'react';
import { useEffect, useRef, useCallback, useState, useMemo, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { X, Trash2, Bot, AlertCircle, ShieldCheck, Database, ScrollText, PanelTop, Table2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAssistantStore } from '@/lib/stores/assistantStore';
import { MemoizedChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { QuickActions, type QuickActionInvocationMeta } from './QuickActions';
import { TypingIndicator } from './TypingIndicator';
import { ComposerWorkflow } from './ComposerWorkflow';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  AssistantContextSnapshot,
  AssistantResponse,
  AssistantResponseMeta,
  AssistantPreferences,
} from '@/types/assistant';
import { uiFeatureFlags } from "@/lib/featureFlags";
import { logUiEvent } from '@/lib/frontendTelemetry';
import { trackUiKpiEvent } from "@/lib/uiKpi";

type AssistantUiError = {
  message: string;
  requestId: string;
  traceSummary?: string;
  recoveryHint: string;
};

const AiAssistantPanel = React.memo(function AiAssistantPanel() {
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
    conversationScope,
    setConversationScope,
    clearConversationScope,
  } = useAssistantStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const inFlightRequestsRef = useRef(0);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<AssistantUiError | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const pathname = usePathname();
  const renderedMessages = useMemo(() => messages.slice(-30), [messages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRafRef.current !== null) {
      window.cancelAnimationFrame(scrollRafRef.current);
    }
    scrollRafRef.current = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      scrollRafRef.current = null;
    });

    return () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    }
  }, [renderedMessages, isLoading]);

  // Focus management for modal dialog.
  useEffect(() => {
    if (!isOpen) {
      setConfirmClear(false);
      setShowQuickActions(false);
      setShowComposer(false);
      if (lastFocusedElementRef.current) {
        lastFocusedElementRef.current.focus();
      }
      return;
    }

    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusTimer = window.setTimeout(() => {
      const input = panelRef.current?.querySelector<HTMLTextAreaElement>('[data-assistant-input="true"]');
      if (input) {
        input.focus();
        return;
      }
      panelRef.current?.focus();
    }, 25);

    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  useEffect(() => {
    clearConversationScope();
  }, [pathname, clearConversationScope]);

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

    const filters: Record<string, unknown> = {};
    currentSearchParams.forEach((value, key) => {
      filters[key] = value;
    });

    const symbol = normalizeContextSymbol(currentSearchParams.get('symbol')) || undefined;
    const querySymbols = parseSymbolList(currentSearchParams.get('symbols'), 20);
    const watchlistSymbols = parseSymbolList(currentSearchParams.get('watchlist'), 20);
    const symbols = mergeUniqueSymbols([querySymbols, watchlistSymbols], 20);

    const timeframe =
      currentSearchParams.get('timeframe') ||
      currentSearchParams.get('timeRange') ||
      currentSearchParams.get('range') ||
      currentSearchParams.get('period') ||
      undefined;

    const indicators = (currentSearchParams.get('indicators') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20);

    const scopeFilters = toContextFilterRecord(conversationScope?.filters);
    const mergedFilters: Record<string, unknown> = {
      ...scopeFilters,
      ...filters,
    };
    if (page === "charts" && watchlistSymbols.length > 0) {
      mergedFilters.watchlist = watchlistSymbols.join(",");
      mergedFilters.symbols = watchlistSymbols;
      mergedFilters.watchlistCount = watchlistSymbols.length;
      mergedFilters.watchlistQuerySource = true;
      mergedFilters.contextSource = "watchlist_query";
    }

    const scopedSymbols = Array.isArray(conversationScope?.symbols)
      ? mergeUniqueSymbols([conversationScope.symbols], 20)
      : [];
    const finalSymbols =
      symbols.length > 0
        ? symbols
        : scopedSymbols.length > 0
          ? scopedSymbols
          : undefined;
    const finalSymbol =
      symbol
      || normalizeContextSymbol(conversationScope?.symbol)
      || (finalSymbols && finalSymbols.length > 0 ? finalSymbols[0] : undefined);
    const finalTimeframe = normalizeContextText(timeframe || conversationScope?.timeframe, 32) || undefined;
    if (finalSymbol) {
      mergedFilters.symbol = finalSymbol;
    }
    if (finalSymbols && finalSymbols.length > 0) {
      mergedFilters.symbols = finalSymbols;
      if (page === "charts") {
        mergedFilters.watchlist = finalSymbols.join(",");
        mergedFilters.watchlistCount = finalSymbols.length;
      }
    }
    if (finalTimeframe) {
      mergedFilters.timeRange = finalTimeframe;
    }

    const hasMergedFilters = Object.keys(mergedFilters).length > 0;
    const finalFilters = hasMergedFilters ? mergedFilters : undefined;
    const navGroup =
      page === "home"
        ? "home"
        : page === "learn"
          ? "learn"
          : page === "screener" || page === "charts"
            ? "analysis"
            : page === "backtesting" || page === "portfolio"
            ? "strategies"
            : "advanced";

    const exportFilters = Object.fromEntries(
      Object.entries(mergedFilters).filter(([, value]) =>
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      )
    ) as Record<string, string | number | boolean>;
    if (page === "charts") {
      if (finalSymbol) {
        exportFilters.symbol = finalSymbol;
      }
      if (finalTimeframe) {
        exportFilters.timeRange = finalTimeframe;
      }
      if (finalSymbols && finalSymbols.length > 0) {
        exportFilters.watchlist = finalSymbols.join(",");
      }
    }

    const exportContext = {
      reportType:
        page === "backtesting"
          ? "backtesting"
          : page === "portfolio"
            ? "portfolio"
            : page === "risk"
              ? "risk"
              : page === "screener"
                ? "screener"
                : page === "charts"
                  ? "charts"
                : undefined,
      filters: Object.keys(exportFilters).length > 0 ? exportFilters : undefined,
      timeframe: finalTimeframe,
    };

    return {
      page,
      uiMode,
      symbol: finalSymbol,
      symbols: finalSymbols,
      timeframe: finalTimeframe,
      selectedIndicators: indicators.length > 0 ? indicators : undefined,
      filters: finalFilters,
      navGroup,
      exportContext,
    };
  }, [conversationScope, pathname, uiMode]);

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

  const updateConversationScopeFromMeta = useCallback(
    (meta?: AssistantResponseMeta) => {
      if (!meta) return;
      const filters = meta.queryPlanFilters ?? undefined;
      const symbols =
        Array.isArray(meta.queryPlanSymbols) && meta.queryPlanSymbols.length > 0
          ? meta.queryPlanSymbols
          : undefined;
      if (!filters && !symbols) return;
      setConversationScope({
        filters,
        symbols,
        symbol: symbols?.[0] ?? undefined,
      });
    },
    [setConversationScope]
  );

  const sendMessage = useCallback(async (content: string, quickActionMeta?: QuickActionInvocationMeta) => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    setError(null);
    const requestId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const startedAt = Date.now();
    const contextSnapshot = mergeQuickActionContextSnapshot(buildContextSnapshot(), quickActionMeta);
    const storeMessages = useAssistantStore.getState().messages;
    const conversationHistory = storeMessages.slice(-10).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    if (quickActionMeta?.source === "contextual" && uiFeatureFlags.assistantContextualActions) {
      trackUiKpiEvent({
        metric: "assistant_contextual_action_ctr",
        event: "assistant_contextual_action_clicked",
        page: contextSnapshot.page,
        source: quickActionMeta.actionId,
        symbol: contextSnapshot.symbol,
        count: 1,
        detail: {
          fromWatchlistQuery: quickActionMeta.fromWatchlistQuery === true,
          timeframe: quickActionMeta.timeframe ?? contextSnapshot.timeframe ?? null,
        },
      });
    }

    logUiEvent('info', 'assistant.request.started', {
      requestId,
      page: contextSnapshot.page,
      messageChars: trimmedContent.length,
      uiMode,
      quickActionId: quickActionMeta?.actionId ?? null,
      quickActionSource: quickActionMeta?.source ?? null,
      quickActionFromWatchlistQuery: quickActionMeta?.fromWatchlistQuery ?? null,
    });

    // Add user message
    addMessage({ role: 'user', content: trimmedContent });

    // Set loading state
    inFlightRequestsRef.current += 1;
    setLoading(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-trace-id': requestId,
        },
        body: JSON.stringify({
          message: trimmedContent,
          conversationHistory,
          contextSnapshot,
          preferences: buildPreferences(),
          uiMode,
          executionMode: "chat",
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
      updateConversationScopeFromMeta(data.meta);
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
      inFlightRequestsRef.current = Math.max(0, inFlightRequestsRef.current - 1);
      setLoading(inFlightRequestsRef.current > 0);
    }
  }, [
    addMessage,
    setLoading,
    buildContextSnapshot,
    buildPreferences,
    uiMode,
    updateConversationScopeFromMeta,
  ]);

  const switchToCopilotMode = () => {
    setUIMode('copilot');
  };

  const switchToScreenerMode = () => {
    setUIMode('screener');
    closePanel();
    router.push('/screener');
  };

  const handleClearChat = () => {
    setConfirmClear(true);
  };

  const confirmClearChat = () => {
    clearMessages();
    setError(null);
    setConfirmClear(false);
  };

  const cancelClearChat = () => {
    setConfirmClear(false);
  };

  const handlePanelKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
      return;
    }
    if (event.key !== 'Tab') return;

    const panel = panelRef.current;
    if (!panel) return;

    const focusableNodes = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const focusableElements = Array.from(focusableNodes).filter((node) => {
      if (node.getAttribute('aria-hidden') === 'true') return false;
      return node.offsetParent !== null || node === document.activeElement;
    });

    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement as HTMLElement | null;

    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, [isOpen, closePanel]);

  if (!isOpen) return null;

  const shouldShowQuickActions = messages.length === 0 || showQuickActions;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden"
        onClick={closePanel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assistant-panel-title"
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
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
              <h2 id="assistant-panel-title" className="font-semibold text-white">AI Assistant</h2>
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

        {confirmClear && (
          <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
            <p className="text-sm">Clear all chat messages?</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={cancelClearChat}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={confirmClearChat}>
                Clear chat
              </Button>
            </div>
          </div>
        )}

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

          {messages.length > 0 && !showQuickActions && (
            <div className="px-4 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQuickActions(true)}
                className="w-full"
              >
                Need ideas? Show quick actions
              </Button>
            </div>
          )}

          {!showComposer && (
            <div className="px-4 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowComposer(true)}
                className="w-full"
              >
                Open Composer (Agent Tool Calling)
              </Button>
            </div>
          )}

          {showComposer && (
            <div className="px-4 pt-3">
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowComposer(false)}>
                  Hide Composer
                </Button>
              </div>
            </div>
          )}

          {showComposer && <ComposerWorkflow contextSnapshot={buildContextSnapshot()} disabled={isLoading} />}

          {/* Quick Actions */}
          {shouldShowQuickActions && (
            <div className="px-4 pt-3 space-y-2">
              {messages.length > 0 && showQuickActions && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowQuickActions(false)}>
                    Hide quick actions
                  </Button>
                </div>
              )}
              <QuickActions onAction={sendMessage} disabled={isLoading} context={buildContextSnapshot()} />
            </div>
          )}

          {/* Messages */}
          {renderedMessages.map((message) => (
            <MemoizedChatMessage key={message.id} message={message} />
          ))}

          {/* Typing Indicator */}
          {isLoading && <TypingIndicator />}

          {/* Error Display */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mx-4 my-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2"
            >
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
});

AiAssistantPanel.displayName = "AiAssistantPanel";

function normalizeContextText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeContextSymbol(value: unknown): string {
  const normalized = normalizeContextText(value, 10).toUpperCase();
  if (!normalized) return "";
  if (!/^[A-Z0-9]{1,10}$/.test(normalized)) return "";
  return normalized;
}

function parseSymbolList(raw: string | null | undefined, limit: number): string[] {
  if (typeof raw !== "string") return [];
  const candidates = raw
    .split(/[,\s;|]+/)
    .map((item) => normalizeContextSymbol(item))
    .filter(Boolean);
  return mergeUniqueSymbols([candidates], limit);
}

function mergeUniqueSymbols(lists: string[][], limit: number): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const list of lists) {
    for (const value of list) {
      const normalized = normalizeContextSymbol(value);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      merged.push(normalized);
      if (merged.length >= limit) return merged;
    }
  }
  return merged;
}

function toContextFilterRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function mergeQuickActionContextSnapshot(
  base: AssistantContextSnapshot,
  quickActionMeta?: QuickActionInvocationMeta
): AssistantContextSnapshot {
  if (!quickActionMeta) return base;

  const actionSymbol = normalizeContextSymbol(quickActionMeta.symbol) || undefined;
  const actionSymbols = Array.isArray(quickActionMeta.symbols)
    ? mergeUniqueSymbols([quickActionMeta.symbols], 20)
    : [];
  const actionTimeframe = normalizeContextText(quickActionMeta.timeframe, 32) || undefined;

  const mergedFilters = toContextFilterRecord(base.filters);
  mergedFilters.quickActionId = quickActionMeta.actionId;
  mergedFilters.quickActionSource = quickActionMeta.source;
  if (quickActionMeta.fromWatchlistQuery === true) {
    mergedFilters.watchlistQuerySource = true;
  }
  if (typeof quickActionMeta.watchlistCount === "number" && Number.isFinite(quickActionMeta.watchlistCount)) {
    mergedFilters.watchlistCount = Math.max(1, Math.trunc(quickActionMeta.watchlistCount));
  }
  if (actionSymbol) {
    mergedFilters.symbol = actionSymbol;
  }
  if (actionSymbols.length > 0) {
    mergedFilters.symbols = actionSymbols;
    mergedFilters.watchlist = actionSymbols.join(",");
    mergedFilters.watchlistCount = actionSymbols.length;
  }
  if (actionTimeframe) {
    mergedFilters.timeRange = actionTimeframe;
  }

  const finalSymbols = actionSymbols.length > 0 ? actionSymbols : base.symbols;
  const finalSymbol = actionSymbol || base.symbol || (finalSymbols && finalSymbols.length > 0 ? finalSymbols[0] : undefined);
  const finalTimeframe = actionTimeframe || base.timeframe;

  const exportFilters: Record<string, string | number | boolean> = {
    ...(base.exportContext?.filters ?? {}),
    quickActionId: quickActionMeta.actionId,
    quickActionSource: quickActionMeta.source,
  };
  if (quickActionMeta.fromWatchlistQuery === true) {
    exportFilters.watchlistQuerySource = true;
  }
  if (actionSymbol) {
    exportFilters.symbol = actionSymbol;
  }
  if (actionSymbols.length > 0) {
    exportFilters.watchlist = actionSymbols.join(",");
    exportFilters.watchlistCount = actionSymbols.length;
  }
  if (actionTimeframe) {
    exportFilters.timeRange = actionTimeframe;
  }

  const exportReportType = quickActionMeta.exportReportType || base.exportContext?.reportType;
  const exportTimeframe = finalTimeframe || base.exportContext?.timeframe;
  const hasExportFilters = Object.keys(exportFilters).length > 0;
  const nextExportContext =
    exportReportType || exportTimeframe || hasExportFilters
      ? {
          reportType: exportReportType,
          timeframe: exportTimeframe,
          filters: hasExportFilters ? exportFilters : undefined,
        }
      : undefined;

  return {
    ...base,
    symbol: finalSymbol,
    symbols: finalSymbols,
    timeframe: finalTimeframe,
    navGroup: quickActionMeta.navGroup || base.navGroup,
    filters: Object.keys(mergedFilters).length > 0 ? mergedFilters : undefined,
    exportContext: nextExportContext,
  };
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

export { AiAssistantPanel };
