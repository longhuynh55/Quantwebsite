"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import type { SharedStrategy, StrategyPerformance } from "@/lib/community/strategy-service";
import { STRATEGY_TAGS } from "@/lib/community/strategy-service";
import { Star, Download, TrendingUp, TrendingDown, Copy, ArrowRight, Calendar, User } from "lucide-react";

interface StrategyCardProps {
  strategy: SharedStrategy;
  onViewDetails?: (strategy: SharedStrategy) => void;
  onCopy?: (strategy: SharedStrategy) => void;
  className?: string;
  compact?: boolean;
}

// Star rating component
function StarRating({ rating, ratingCount, size = "sm" }: { rating: number; ratingCount: number; size?: "sm" | "md" }) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const filled = i < Math.floor(rating);
    const partial = i === Math.floor(rating) && rating % 1 > 0;

    return (
      <span key={i} className="relative">
        <Star
          className={cn(
            size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4",
            "text-stone-300 dark:text-stone-600"
          )}
        />
        {(filled || partial) && (
          <Star
            className={cn(
              "absolute top-0 left-0",
              size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4",
              "text-yellow-500 fill-yellow-500"
            )}
            style={partial ? { clipPath: `inset(0 ${(1 - (rating % 1)) * 100}% 0 0)` } : undefined}
          />
        )}
      </span>
    );
  });

  return (
    <div className="flex items-center gap-1">
      <div className="flex">{stars}</div>
      <span className={cn(
        "text-stone-500 dark:text-neutral-400 ml-1",
        size === "sm" ? "text-xs" : "text-sm"
      )}>
        ({ratingCount})
      </span>
    </div>
  );
}

// Performance metrics display
function PerformanceMetrics({ performance }: { performance: StrategyPerformance }) {
  const isPositiveReturn = performance.totalReturn >= 0;

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="flex items-center gap-1">
        {isPositiveReturn ? (
          <TrendingUp className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-red-500" />
        )}
        <span className={cn(
          "font-medium",
          isPositiveReturn ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
        )}>
          <AnimatedNumber
            value={performance.totalReturn}
            decimals={1}
            suffix="%"
          />
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-stone-500 dark:text-neutral-400">Sharpe:</span>
        <span className="font-medium text-stone-700 dark:text-neutral-300">
          <AnimatedNumber value={performance.sharpeRatio} decimals={2} />
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-stone-500 dark:text-neutral-400">DD:</span>
        <span className="font-medium text-red-600 dark:text-red-400">
          -<AnimatedNumber value={performance.maxDrawdown} decimals={1} suffix="%" />
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-stone-500 dark:text-neutral-400">Win:</span>
        <span className="font-medium text-stone-700 dark:text-neutral-300">
          <AnimatedNumber value={performance.winRate} decimals={0} suffix="%" />
        </span>
      </div>
    </div>
  );
}

// Tag badge with Vietnamese label
function StrategyTag({ tag }: { tag: string }) {
  const tagInfo = STRATEGY_TAGS.find(t => t.value === tag) as { value: string; label: string; labelVi: string } | undefined;
  const label = tagInfo?.labelVi || tagInfo?.label || tag;

  const tagColors: Record<string, string> = {
    momentum: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    "mean-reversion": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    "trend-following": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    breakout: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    scalping: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    "swing-trading": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
    "long-term": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    technical: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
    fundamental: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    rsi: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    macd: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
    bollinger: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    volume: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
      tagColors[tag] || "bg-stone-100 text-stone-700 dark:bg-neutral-800 dark:text-neutral-300"
    )}>
      {label}
    </span>
  );
}

export function StrategyCard({
  strategy,
  onViewDetails,
  onCopy,
  className,
  compact = false,
}: StrategyCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <Card
      interactive
      className={cn(
        "flex flex-col h-full",
        className
      )}
    >
      <CardHeader className={compact ? "p-4 pb-2" : undefined}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className={cn(
              "truncate",
              compact ? "text-base" : "text-lg"
            )}>
              {strategy.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <User className="w-3 h-3" />
              <span>{strategy.author}</span>
            </CardDescription>
          </div>
          <StarRating
            rating={strategy.rating}
            ratingCount={strategy.ratingCount}
            size={compact ? "sm" : "md"}
          />
        </div>
      </CardHeader>

      <CardContent className={cn("flex-1", compact ? "p-4 pt-0" : undefined)}>
        {/* Description */}
        <p className={cn(
          "text-stone-600 dark:text-neutral-400 mb-3 line-clamp-2",
          compact ? "text-xs" : "text-sm"
        )}>
          {strategy.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {strategy.tags.slice(0, 3).map((tag) => (
            <StrategyTag key={tag} tag={tag} />
          ))}
          {strategy.tags.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{strategy.tags.length - 3}
            </Badge>
          )}
        </div>

        {/* Performance */}
        <div className={cn(
          "bg-stone-100 dark:bg-neutral-800/50 rounded-lg p-3",
          compact ? "mb-2" : "mb-3"
        )}>
          <PerformanceMetrics performance={strategy.performance} />
        </div>

        {/* Meta info */}
        {!compact && (
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-neutral-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Download className="w-3 h-3" />
                {strategy.downloads}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(strategy.createdAt)}
              </span>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className={cn("gap-2", compact ? "p-4 pt-0" : undefined)}>
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          className="flex-1"
          onClick={() => onViewDetails?.(strategy)}
        >
          Xem chi tiet
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
        <Button
          variant="default"
          size={compact ? "sm" : "default"}
          onClick={() => onCopy?.(strategy)}
          aria-label="Sao chep chien luoc"
        >
          <Copy className="w-4 h-4 mr-1" />
          Sao chep
        </Button>
      </CardFooter>
    </Card>
  );
}

// Skeleton card for loading state
export function StrategyCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className={compact ? "p-4 pb-2" : undefined}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="h-5 bg-stone-200 dark:bg-neutral-700 rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-stone-200 dark:bg-neutral-700 rounded w-1/2 mt-2 animate-pulse" />
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("flex-1", compact ? "p-4 pt-0" : undefined)}>
        <div className="space-y-2 mb-3">
          <div className="h-3 bg-stone-200 dark:bg-neutral-700 rounded animate-pulse" />
          <div className="h-3 bg-stone-200 dark:bg-neutral-700 rounded w-5/6 animate-pulse" />
        </div>
        <div className="flex gap-1 mb-3">
          <div className="h-5 bg-stone-200 dark:bg-neutral-700 rounded w-16 animate-pulse" />
          <div className="h-5 bg-stone-200 dark:bg-neutral-700 rounded w-20 animate-pulse" />
        </div>
        <div className="h-16 bg-stone-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
      </CardContent>
      <CardFooter className={cn("gap-2", compact ? "p-4 pt-0" : undefined)}>
        <div className="h-9 bg-stone-200 dark:bg-neutral-700 rounded flex-1 animate-pulse" />
        <div className="h-9 bg-stone-200 dark:bg-neutral-700 rounded w-24 animate-pulse" />
      </CardFooter>
    </Card>
  );
}
