"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { X, Trash2, Bot, AlertCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAssistantStore } from '@/lib/stores/assistantStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { QuickActions } from './QuickActions';
import { TypingIndicator } from './TypingIndicator';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AssistantContextSnapshot, AssistantResponse, AssistantPreferences } from '@/types/assistant';

export function AiAssistantPanel() {
  const {
    isOpen,
    closePanel,
    messages,
    isLoading,
    addMessage,
    clearMessages,
    setLoading,
    experienceLevel,
  } = useAssistantStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
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
      symbol,
      symbols: symbols.length > 0 ? symbols : undefined,
      timeframe,
      selectedIndicators: indicators.length > 0 ? indicators : undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    };
  }, [pathname]);

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

    // Add user message
    addMessage({ role: 'user', content });

    // Set loading state
    setLoading(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          conversationHistory: messages.slice(-10),
          contextSnapshot: buildContextSnapshot(),
          preferences: buildPreferences(),
          requestId:
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          clientTs: new Date().toISOString(),
        }),
      });

      const data: AssistantResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get response');
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
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [messages, addMessage, setLoading, buildContextSnapshot, buildPreferences]);

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
              <p className="text-xs text-white/70">Vietnamese Stock Market Expert</p>
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
        <div className="flex-1 overflow-y-auto">
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
                I can help you understand Vietnamese stock market concepts, technical indicators,
                and quantitative strategies.
              </p>
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
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
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
