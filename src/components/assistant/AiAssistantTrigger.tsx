"use client";

import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAssistantStore } from '@/lib/stores/assistantStore';
import { cn } from '@/lib/utils';

export function AiAssistantTrigger() {
  const { isOpen, togglePanel } = useAssistantStore();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={togglePanel}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg',
        'text-gray-600 dark:text-gray-300',
        'hover:bg-gray-50 dark:hover:bg-gray-800',
        'transition-colors duration-200',
        isOpen && 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
      )}
      aria-label="Open AI Assistant"
      aria-pressed={isOpen}
    >
      <Bot className="w-4 h-4" />
      <span className="hidden xl:inline text-sm">AI Assistant</span>
    </Button>
  );
}
