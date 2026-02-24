"use client";

import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, isLoading, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  const helperId = `${inputId}-helper`;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleSubmit = useCallback(() => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !isLoading && !disabled) {
      onSend(trimmedMessage);
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [message, isLoading, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-stone-200 bg-stone-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <label htmlFor={inputId} className="sr-only">
            Ask QuantVN assistant
          </label>
          <textarea
            id={inputId}
            ref={textareaRef}
            data-assistant-input="true"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask with symbol + metric + timeframe (e.g., VCB net income 2024Q4)..."
            disabled={disabled || isLoading}
            rows={1}
            aria-describedby={helperId}
            className={cn(
              'w-full resize-none rounded-xl border border-stone-300 dark:border-neutral-600',
              'bg-white dark:bg-neutral-800 px-4 py-3 pr-12',
              'text-stone-900 dark:text-neutral-100 placeholder-stone-500 dark:placeholder-neutral-400',
              'focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:focus:ring-emerald-400 focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-200'
            )}
          />
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!message.trim() || isLoading || disabled}
          size="icon"
          className={cn(
            'flex-shrink-0 w-11 h-11 rounded-xl',
            'bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-200'
          )}
          aria-label="Send message"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </div>
      <p id={helperId} className="mt-2 text-center text-xs text-stone-500 dark:text-neutral-400">
        Enter: send | Shift+Enter: new line
      </p>
    </div>
  );
}
