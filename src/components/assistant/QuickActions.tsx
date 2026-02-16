"use client";

import { QUICK_ACTIONS } from '@/types/assistant';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  BarChart3,
  PieChart,
  LineChart,
  BookOpen,
  Building2,
} from 'lucide-react';

interface QuickActionsProps {
  onAction: (prompt: string) => void;
  disabled?: boolean;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'trending-up': TrendingUp,
  'bar-chart': BarChart3,
  'pie-chart': PieChart,
  'line-chart': LineChart,
  'book-open': BookOpen,
  'building': Building2,
};

export function QuickActions({ onAction, disabled = false }: QuickActionsProps) {
  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-medium">
        Quick Actions
      </p>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map((action) => {
          const Icon = iconMap[action.icon || ''] || TrendingUp;
          return (
            <button
              key={action.id}
              onClick={() => onAction(action.prompt)}
              disabled={disabled}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-left',
                'text-sm text-gray-700 dark:text-gray-300',
                'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700',
                'border border-transparent hover:border-gray-300 dark:hover:border-gray-600',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0 text-blue-500" />
              <span className="truncate text-xs">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
