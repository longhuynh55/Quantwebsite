"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import type { SharedStrategy } from "@/lib/community/strategy-service";
import { STRATEGY_TAGS } from "@/lib/community/strategy-service";
import {
  Star,
  Download,
  TrendingUp,
  TrendingDown,
  Copy,
  Calendar,
  User,
  BarChart3,
  AlertTriangle,
  Target,
  Share2,
} from "lucide-react";

interface StrategyDetailProps {
  strategy: SharedStrategy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy?: (strategy: SharedStrategy) => void;
  onRate?: (strategy: SharedStrategy, rating: number) => void;
}

// Interactive star rating for rating input
function InteractiveStarRating({
  currentRating,
  userRating,
  onRate,
}: {
  currentRating: number;
  userRating: number | null;
  onRate: (rating: number) => void;
}) {
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isActive = hoverRating !== null
            ? star <= hoverRating
            : star <= (userRating ?? currentRating);

          return (
            <button
              key={star}
              type="button"
              className="p-0.5 hover:scale-110 transition-transform"
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(null)}
              onClick={() => onRate(star)}
              aria-label={`Danh gia ${star} sao`}
            >
              <Star
                className={cn(
                  "w-6 h-6 transition-colors",
                  isActive
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-stone-300 dark:text-stone-600"
                )}
              />
            </button>
          );
        })}
      </div>
      <div className="text-sm text-stone-500 dark:text-neutral-400">
        <span className="font-medium text-stone-700 dark:text-neutral-300">
          {(hoverRating ?? userRating ?? currentRating).toFixed(1)}
        </span>
        {" / 5 "}
        <span className="text-xs">({userRating ? "Danh gia cua ban" : "Trung binh"})</span>
      </div>
    </div>
  );
}

// Tag badge component
function StrategyTag({ tag }: { tag: string }) {
  const tagInfo = STRATEGY_TAGS.find(t => t.value === tag) as { value: string; label: string; labelVi: string } | undefined;
  const label = tagInfo?.labelVi || tagInfo?.label || tag;

  const tagColors: Record<string, string> = {
    momentum: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    "mean-reversion": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    "trend-following": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
    breakout: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
    scalping: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 border-pink-200 dark:border-pink-800",
    "swing-trading": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
    "long-term": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    technical: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800",
    fundamental: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    rsi: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800",
    macd: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200 dark:border-sky-800",
    bollinger: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800",
    volume: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800",
  };

  return (
    <span className={cn(
      "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border",
      tagColors[tag] || "bg-stone-100 text-stone-700 dark:bg-neutral-800 dark:text-neutral-300 border-stone-200 dark:border-neutral-700"
    )}>
      {label}
    </span>
  );
}

// Metric card component
function MetricCard({
  icon: Icon,
  label,
  value,
  suffix = "",
  prefix = "",
  valueClassName,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-stone-100 dark:bg-neutral-800/50 rounded-xl">
      <div className="p-2 bg-white dark:bg-neutral-700 rounded-lg shadow-sm">
        <Icon className="w-5 h-5 text-stone-600 dark:text-neutral-300" />
      </div>
      <div>
        <p className="text-xs text-stone-500 dark:text-neutral-400">{label}</p>
        <p className={cn("text-lg font-bold", valueClassName)}>
          {prefix}<AnimatedNumber value={value} decimals={2} suffix={suffix} />
        </p>
      </div>
    </div>
  );
}

// Mini node visualization
function MiniNodeVisualization({ nodes, edges }: { nodes: SharedStrategy["nodes"]; edges: SharedStrategy["edges"] }) {
  // Create a simple visualization of the strategy structure
  const nodeCount = nodes.length || 4;
  const edgeCount = edges.length || 3;

  return (
    <div className="bg-stone-100 dark:bg-neutral-800 rounded-xl p-4 h-40 relative overflow-hidden">
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-20">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Simulated nodes */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 100">
        {/* Edges */}
        {Array.from({ length: Math.min(edgeCount, 3) }).map((_, i) => (
          <line
            key={`edge-${i}`}
            x1={40 + i * 50}
            y1={50}
            x2={80 + i * 50}
            y2={50}
            stroke="#a8a29e"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        ))}

        {/* Nodes */}
        {Array.from({ length: Math.min(nodeCount, 4) }).map((_, i) => {
          const colors = ["#047857", "#0f766e", "#b45309", "#57534e"];
          const x = 25 + i * 50;
          return (
            <g key={`node-${i}`}>
              <rect
                x={x - 15}
                y={40}
                width="30"
                height="20"
                rx="4"
                fill={colors[i % colors.length]}
              />
              <text
                x={x}
                y={52}
                textAnchor="middle"
                fill="white"
                fontSize="6"
                fontWeight="bold"
              >
                {["DATA", "IND", "FLT", "OUT"][i]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Node count indicator */}
      <div className="absolute bottom-2 right-2 text-xs text-stone-500 dark:text-neutral-400">
        {nodeCount} nodes, {edgeCount} connections
      </div>
    </div>
  );
}

export function StrategyDetail({
  strategy,
  open,
  onOpenChange,
  onCopy,
  onRate,
}: StrategyDetailProps) {
  const [userRating, setUserRating] = React.useState<number | null>(null);

  // Reset user rating when strategy changes
  React.useEffect(() => {
    setUserRating(null);
  }, [strategy?.id]);

  if (!strategy) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const handleRate = (rating: number) => {
    setUserRating(rating);
    onRate?.(strategy, rating);
  };

  const isPositiveReturn = strategy.performance.totalReturn >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{strategy.name}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <User className="w-4 h-4" />
                <span>{strategy.author}</span>
                <span className="text-stone-400">|</span>
                <Calendar className="w-4 h-4" />
                <span>{formatDate(strategy.createdAt)}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Rating section */}
          <div className="flex items-center justify-between p-4 bg-stone-100 dark:bg-neutral-800/50 rounded-xl">
            <InteractiveStarRating
              currentRating={strategy.rating}
              userRating={userRating}
              onRate={handleRate}
            />
            <div className="flex items-center gap-4 text-sm text-stone-500 dark:text-neutral-400">
              <span className="flex items-center gap-1">
                <Download className="w-4 h-4" />
                {strategy.downloads} luot tai
              </span>
            </div>
          </div>

          {/* Tags */}
          <div>
            <h4 className="text-sm font-medium text-stone-700 dark:text-neutral-300 mb-2">The loai</h4>
            <div className="flex flex-wrap gap-2">
              {strategy.tags.map((tag) => (
                <StrategyTag key={tag} tag={tag} />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-sm font-medium text-stone-700 dark:text-neutral-300 mb-2">Mo ta</h4>
            <p className="text-stone-600 dark:text-neutral-400 leading-relaxed">
              {strategy.description}
            </p>
          </div>

          {/* Performance metrics */}
          <div>
            <h4 className="text-sm font-medium text-stone-700 dark:text-neutral-300 mb-3">Hieu suat</h4>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                icon={isPositiveReturn ? TrendingUp : TrendingDown}
                label="Tong loi nhuan"
                value={strategy.performance.totalReturn}
                suffix="%"
                valueClassName={isPositiveReturn ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
              />
              <MetricCard
                icon={BarChart3}
                label="Sharpe Ratio"
                value={strategy.performance.sharpeRatio}
              />
              <MetricCard
                icon={AlertTriangle}
                label="Max Drawdown"
                value={strategy.performance.maxDrawdown}
                prefix="-"
                suffix="%"
                valueClassName="text-red-600 dark:text-red-400"
              />
              <MetricCard
                icon={Target}
                label="Ty le thang"
                value={strategy.performance.winRate}
                suffix="%"
              />
            </div>
          </div>

          {/* Strategy visualization */}
          <div>
            <h4 className="text-sm font-medium text-stone-700 dark:text-neutral-300 mb-2">Truc quan chien luoc</h4>
            <MiniNodeVisualization nodes={strategy.nodes} edges={strategy.edges} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Dong
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              // Share functionality
              navigator.clipboard.writeText(window.location.href);
            }}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Chia se
          </Button>
          <Button
            onClick={() => {
              onCopy?.(strategy);
              onOpenChange(false);
            }}
          >
            <Copy className="w-4 h-4 mr-2" />
            Sao chep vao chien luoc cua toi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
