"use client";

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Database,
  TrendingUp,
  Filter,
  ArrowRightLeft,
  BarChart3,
  Play,
  RefreshCw,
  ArrowRight,
  Clock,
  GitBranch
} from 'lucide-react';
import type { GeneratedStrategy } from '@/lib/ai/strategy-generator';

interface StrategyPreviewProps {
  strategy: GeneratedStrategy;
  latencyMs?: number | null;
  onApplyToBuilder?: () => void;
  onRegenerate?: () => void;
  className?: string;
}

// Node type configurations
const nodeTypeConfig = {
  dataSource: {
    icon: Database,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Nguon Du Lieu',
  },
  indicator: {
    icon: TrendingUp,
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-900/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    label: 'Chi Bao',
  },
  filter: {
    icon: Filter,
    color: 'bg-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-900/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    label: 'Bo Loc',
  },
  signal: {
    icon: ArrowRightLeft,
    color: 'bg-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/30',
    borderColor: 'border-green-200 dark:border-green-800',
    label: 'Tin Hieu',
  },
  output: {
    icon: BarChart3,
    color: 'bg-teal-500',
    bgColor: 'bg-teal-50 dark:bg-teal-900/30',
    borderColor: 'border-teal-200 dark:border-teal-800',
    label: 'Ket Qua',
  },
};

export function StrategyPreview({
  strategy,
  latencyMs,
  onApplyToBuilder,
  onRegenerate,
  className,
}: StrategyPreviewProps) {
  // Count nodes by type
  const nodeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const node of strategy.nodes) {
      counts[node.type] = (counts[node.type] || 0) + 1;
    }
    return counts;
  }, [strategy.nodes]);

  // Format latency
  const latencyDisplay = React.useMemo(() => {
    if (latencyMs === null || latencyMs === undefined) return null;
    if (latencyMs < 1000) return `${latencyMs}ms`;
    return `${(latencyMs / 1000).toFixed(1)}s`;
  }, [latencyMs]);

  return (
    <Card className={cn('border-green-200 dark:border-green-800', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500">
              <Play className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm">Chien Luoc Da Tao</CardTitle>
              {strategy.name && (
                <CardDescription className="text-xs">{strategy.name}</CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {latencyDisplay && (
              <Badge variant="secondary" className="text-xs">
                <Clock className="mr-1 h-3 w-3" />
                {latencyDisplay}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              <GitBranch className="mr-1 h-3 w-3" />
              {strategy.nodes.length} nodes
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Strategy Type Badge */}
        {strategy.strategyType && (
          <div className="flex items-center gap-2">
            <Badge
              variant={
                strategy.riskLevel === 'high'
                  ? 'destructive'
                  : strategy.riskLevel === 'low'
                    ? 'secondary'
                    : 'default'
              }
              className="text-xs"
            >
              {strategy.strategyType}
              {strategy.riskLevel && ` - ${strategy.riskLevel.toUpperCase()} RISK`}
            </Badge>
          </div>
        )}

        {/* Node Type Summary */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(nodeCounts).map(([type, count]) => {
            const config = nodeTypeConfig[type as keyof typeof nodeTypeConfig];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <Badge
                key={type}
                variant="outline"
                className={cn('text-xs', config.bgColor, config.borderColor)}
              >
                <Icon className={cn('mr-1 h-3 w-3', config.color.replace('bg-', 'text-'))} />
                {config.label}: {count}
              </Badge>
            );
          })}
        </div>

        {/* Node Flow Preview */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Luong Chien Luoc
          </h4>
          <div className="flex flex-wrap items-center gap-1 overflow-x-auto pb-2">
            {strategy.nodes.map((node, index) => {
              const config = nodeTypeConfig[node.type as keyof typeof nodeTypeConfig];
              if (!config) return null;
              const Icon = config.icon;
              const isLast = index === strategy.nodes.length - 1;

              return (
                <React.Fragment key={node.id}>
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-2 py-1.5',
                      config.bgColor,
                      config.borderColor
                    )}
                    title={node.data.label}
                  >
                    <Icon className={cn('h-3.5 w-3.5', config.color.replace('bg-', 'text-'))} />
                    <span className="text-xs font-medium truncate max-w-[100px]">
                      {node.data.label}
                    </span>
                  </div>
                  {!isLast && (
                    <ArrowRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Detailed Node List */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Chi Tiet Cac Node
          </h4>
          <div className="grid gap-2 max-h-60 overflow-y-auto pr-1">
            {strategy.nodes.map((node) => {
              const config = nodeTypeConfig[node.type as keyof typeof nodeTypeConfig];
              if (!config) return null;
              const Icon = config.icon;

              return (
                <div
                  key={node.id}
                  className={cn(
                    'flex items-start gap-2 rounded-lg border p-2',
                    config.bgColor,
                    config.borderColor
                  )}
                >
                  <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', config.color.replace('bg-', 'text-'))} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">
                      {node.data.label}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(node.data.config).slice(0, 4).map(([key, value]) => (
                        value !== undefined && value !== null && value !== '' && (
                          <span
                            key={key}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-white/50 dark:bg-black/20 text-gray-600 dark:text-gray-300"
                          >
                            {key}: {String(value).slice(0, 20)}
                          </span>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Edge Count */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <GitBranch className="h-3.5 w-3.5" />
          <span>{strategy.edges.length} ket noi giua cac node</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {onApplyToBuilder && (
            <Button onClick={onApplyToBuilder} className="flex-1" size="sm">
              <Play className="mr-2 h-3.5 w-3.5" />
              Ap Dung Vao Strategy Builder
            </Button>
          )}
          {onRegenerate && (
            <Button variant="outline" onClick={onRegenerate} size="sm">
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Tao Lai
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
