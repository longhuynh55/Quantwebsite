"use client";

import { useRouter } from 'next/navigation';
import { Bot, ChevronDown, PanelTop, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAssistantStore } from '@/lib/stores/assistantStore';
import { cn } from '@/lib/utils';

export function AiAssistantTrigger() {
  const router = useRouter();
  const { isOpen, openPanel, closePanel, uiMode, setUIMode } = useAssistantStore();

  const handleCopilotMode = () => {
    setUIMode('copilot');
    if (isOpen && uiMode === 'copilot') {
      closePanel();
      return;
    }
    openPanel();
  };

  const handleScreenerMode = () => {
    setUIMode('screener');
    closePanel();
    router.push('/screener');
  };

  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-stone-200 dark:border-neutral-700">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopilotMode}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-none border-r border-stone-200 dark:border-neutral-700',
          'text-stone-600 dark:text-neutral-300',
          'hover:bg-stone-100 dark:hover:bg-neutral-800',
          'transition-colors duration-200',
          isOpen && uiMode === 'copilot' && 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
        )}
        aria-label="Open AI Assistant Copilot"
        aria-pressed={isOpen && uiMode === 'copilot'}
      >
        <Bot className="w-4 h-4" />
        <span className="hidden xl:inline text-sm">AI Assistant</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'h-9 px-2 text-stone-600 dark:text-neutral-300',
            'hover:bg-stone-100 dark:hover:bg-neutral-800 transition-colors'
          )}
          aria-label="Choose assistant mode"
        >
          <ChevronDown className="w-4 h-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Assistant Mode</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCopilotMode} className="gap-2">
            <PanelTop className="w-4 h-4" />
            Copilot Panel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleScreenerMode} className="gap-2">
            <Table2 className="w-4 h-4" />
            Full Screener Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
