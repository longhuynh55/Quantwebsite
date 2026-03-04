"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
    X,
    GripHorizontal,
    TrendingUp,
    TrendingDown,
    BarChart3,
    ListOrdered,
    Activity,
    RotateCcw,
    Download,
    ChevronUp,
    ChevronDown,
    AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StrategyLabSummaryResult } from "@/lib/strategy-lab/client";

interface BacktestResultsPanelProps {
    result: StrategyLabSummaryResult;
    onClose: () => void;
    onRerun: () => void;
    isRunning?: boolean;
    className?: string;
}

type Tab = "summary" | "metrics" | "diagnostics";

function formatPercent(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value: number): string {
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toFixed(2);
}

function formatRatio(value: number): string {
    return value.toFixed(2);
}

// Metric card component
const MetricCard = memo(function MetricCard({
    label,
    value,
    context,
    valueColor,
}: {
    label: string;
    value: string;
    context?: string;
    valueColor?: string;
}) {
    return (
        <div className="border border-stone-200 dark:border-neutral-700 rounded-md p-3 bg-white dark:bg-neutral-950 hover:border-stone-300 dark:hover:border-neutral-600 transition-colors">
            <div className="text-[10px] uppercase tracking-wider font-bold text-stone-400 dark:text-neutral-500 mb-1.5">
                {label}
            </div>
            <div className={cn("text-xl font-serif font-bold tabular-nums", valueColor || "text-stone-900 dark:text-white")}>
                {value}
            </div>
            {context && (
                <div className="text-[10px] text-stone-500 dark:text-neutral-400 mt-1">
                    {context}
                </div>
            )}
        </div>
    );
});

// Tab button
const TabButton = memo(function TabButton({
    label,
    icon: Icon,
    active,
    onClick,
}: {
    label: string;
    icon: React.ElementType;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all",
                active
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                    : "text-stone-500 dark:text-neutral-400 hover:text-stone-700 dark:hover:text-neutral-200 hover:bg-stone-50 dark:hover:bg-neutral-800"
            )}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
        </button>
    );
});

export const BacktestResultsPanel = memo(function BacktestResultsPanel({
    result,
    onClose,
    onRerun,
    isRunning = false,
    className,
}: BacktestResultsPanelProps) {
    const [activeTab, setActiveTab] = useState<Tab>("summary");
    const [isMinimized, setIsMinimized] = useState(false);
    const [panelHeight, setPanelHeight] = useState(380);
    const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

    const metrics = result.summary.metrics;
    const diagnostics = result.summary.diagnostics;
    const totalTrades = result.summary.totalTrades;

    // Drag to resize
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        dragRef.current = { startY: e.clientY, startHeight: panelHeight };

        const handleDrag = (moveEvent: MouseEvent) => {
            if (!dragRef.current) return;
            const delta = dragRef.current.startY - moveEvent.clientY;
            const newHeight = Math.max(200, Math.min(600, dragRef.current.startHeight + delta));
            setPanelHeight(newHeight);
        };

        const handleDragEnd = () => {
            dragRef.current = null;
            document.removeEventListener("mousemove", handleDrag);
            document.removeEventListener("mouseup", handleDragEnd);
        };

        document.addEventListener("mousemove", handleDrag);
        document.addEventListener("mouseup", handleDragEnd);
    }, [panelHeight]);

    // Return color for metrics
    const returnColor = metrics.totalReturn >= 0
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-rose-700 dark:text-rose-400";

    const winRateColor = metrics.winRate >= 0.5
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-amber-700 dark:text-amber-400";

    const sharpeColor = metrics.sharpeRatio >= 1
        ? "text-emerald-700 dark:text-emerald-400"
        : metrics.sharpeRatio >= 0
            ? "text-stone-700 dark:text-neutral-200"
            : "text-rose-700 dark:text-rose-400";

    return (
        <div
            className={cn(
                "border-t border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex-shrink-0 flex flex-col",
                className
            )}
            style={{ height: isMinimized ? undefined : panelHeight }}
        >
            {/* Drag handle + header */}
            <div
                className="flex items-center gap-3 px-4 py-2 border-b border-stone-100 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-950/60 flex-shrink-0 cursor-row-resize select-none"
                onMouseDown={handleDragStart}
            >
                {/* Drag indicator */}
                <div className="flex-shrink-0 flex flex-col items-center gap-0.5 pr-2 text-stone-300 dark:text-neutral-600">
                    <GripHorizontal className="w-5 h-3" />
                </div>

                {/* Title */}
                <div className="flex items-center gap-2 mr-4">
                    <span className="h-px w-3 bg-emerald-700 dark:bg-emerald-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                        Backtest Results
                    </span>
                </div>

                <span className="font-serif text-sm font-bold text-stone-900 dark:text-white truncate">
                    {result.strategyName}
                </span>

                <span className="text-[10px] text-stone-400 dark:text-neutral-500 ml-1">
                    {result.symbol} · {result.strategyType}
                </span>

                {/* Tabs — inline in header for compactness */}
                <div className="flex items-center gap-1 ml-auto">
                    <TabButton label="Summary" icon={BarChart3} active={activeTab === "summary"} onClick={() => setActiveTab("summary")} />
                    <TabButton label="Metrics" icon={Activity} active={activeTab === "metrics"} onClick={() => setActiveTab("metrics")} />
                    <TabButton label="Diagnostics" icon={AlertTriangle} active={activeTab === "diagnostics"} onClick={() => setActiveTab("diagnostics")} />
                </div>

                {/* Minimize / Close */}
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1 text-stone-400 hover:text-stone-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
                        title={isMinimized ? "Expand" : "Minimize"}
                    >
                        {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 text-stone-400 hover:text-stone-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Panel body */}
            {!isMinimized && (
                <div className="flex-1 overflow-y-auto p-4">
                    {/* SUMMARY TAB */}
                    {activeTab === "summary" && (
                        <div className="space-y-4">
                            {/* Key Metrics Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                <MetricCard
                                    label="Total Return"
                                    value={formatPercent(metrics.totalReturn)}
                                    valueColor={returnColor}
                                    context={`CAGR: ${formatPercent(metrics.cagr)}`}
                                />
                                <MetricCard
                                    label="Sharpe Ratio"
                                    value={formatRatio(metrics.sharpeRatio)}
                                    valueColor={sharpeColor}
                                    context="Risk-adjusted"
                                />
                                <MetricCard
                                    label="Max Drawdown"
                                    value={formatPercent(metrics.maxDrawdown)}
                                    valueColor="text-rose-700 dark:text-rose-400"
                                    context={`${metrics.maxDrawdownDuration} days duration`}
                                />
                                <MetricCard
                                    label="Win Rate"
                                    value={formatPercent(metrics.winRate)}
                                    valueColor={winRateColor}
                                    context={`${totalTrades} total trades`}
                                />
                                <MetricCard
                                    label="Profit Factor"
                                    value={formatRatio(metrics.profitFactor)}
                                    valueColor={metrics.profitFactor >= 1.5 ? "text-emerald-700 dark:text-emerald-400" : undefined}
                                    context="Gross P / Gross L"
                                />
                                <MetricCard
                                    label="Sortino Ratio"
                                    value={formatRatio(metrics.sortinoRatio)}
                                    context="Downside risk-adjusted"
                                />
                            </div>

                            {/* Mini Equity Curve (SVG) */}
                            {result.summary.equityPoints > 0 && (
                                <div className="border border-stone-200 dark:border-neutral-700 rounded-md p-4 bg-stone-50 dark:bg-neutral-950/50">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-neutral-500">
                                            Equity Curve Preview
                                        </span>
                                        <span className="text-[10px] text-stone-500 dark:text-neutral-400">
                                            {result.summary.equityPoints.toLocaleString()} data points
                                        </span>
                                    </div>
                                    <div className="h-16 flex items-end gap-px">
                                        {/* Simple bar representation since we don't have full curve data in summary */}
                                        <div className="flex items-center justify-center w-full text-xs text-stone-400 dark:text-neutral-500 italic">
                                            <TrendingUp className={cn("w-4 h-4 mr-1.5", returnColor)} />
                                            {formatNumber(result.initialCapital)} → {formatNumber(result.initialCapital * (1 + metrics.totalReturn))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Status bar */}
                            <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-neutral-800">
                                <span className="text-[10px] text-stone-400 dark:text-neutral-500">
                                    Generated: {new Date(result.generatedAt).toLocaleString()} · Capital: {formatNumber(result.initialCapital)}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={onRerun}
                                        disabled={isRunning}
                                        className="h-7 gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        {isRunning ? "Running..." : "Re-run"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* METRICS TAB */}
                    {activeTab === "metrics" && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            <MetricCard label="Total Return" value={formatPercent(metrics.totalReturn)} valueColor={returnColor} />
                            <MetricCard label="Net Return" value={formatPercent(metrics.netReturn)} valueColor={metrics.netReturn >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"} />
                            <MetricCard label="Gross Return" value={formatPercent(metrics.grossReturn)} />
                            <MetricCard label="CAGR" value={formatPercent(metrics.cagr)} />
                            <MetricCard label="Sharpe Ratio" value={formatRatio(metrics.sharpeRatio)} valueColor={sharpeColor} />
                            <MetricCard label="Sortino Ratio" value={formatRatio(metrics.sortinoRatio)} />
                            <MetricCard label="Max Drawdown" value={formatPercent(metrics.maxDrawdown)} valueColor="text-rose-700 dark:text-rose-400" />
                            <MetricCard label="DD Duration" value={`${metrics.maxDrawdownDuration} days`} />
                            <MetricCard label="Win Rate" value={formatPercent(metrics.winRate)} valueColor={winRateColor} />
                            <MetricCard label="Profit Factor" value={formatRatio(metrics.profitFactor)} />
                            <MetricCard label="Total Trades" value={totalTrades.toString()} />
                            <MetricCard label="Avg Return" value={formatPercent(metrics.avgReturn)} />
                            <MetricCard label="Avg Win" value={formatPercent(metrics.avgWin)} valueColor="text-emerald-700 dark:text-emerald-400" />
                            <MetricCard label="Avg Loss" value={formatPercent(metrics.avgLoss)} valueColor="text-rose-700 dark:text-rose-400" />
                            <MetricCard label="Best Trade" value={formatPercent(metrics.bestTrade)} valueColor="text-emerald-700 dark:text-emerald-400" />
                            <MetricCard label="Worst Trade" value={formatPercent(metrics.worstTrade)} valueColor="text-rose-700 dark:text-rose-400" />
                            <MetricCard label="Turnover" value={formatRatio(metrics.turnover)} context="Total / Capital" />
                            <MetricCard label="Exposure" value={formatPercent(metrics.exposureRatio)} context="Days in position" />
                        </div>
                    )}

                    {/* DIAGNOSTICS TAB */}
                    {activeTab === "diagnostics" && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <MetricCard label="Coverage Ratio" value={formatPercent(diagnostics.coverageRatio)} />
                                <MetricCard label="Input Rows" value={diagnostics.inputRows?.toLocaleString() ?? "—"} />
                                <MetricCard label="Usable Rows" value={diagnostics.usableRows?.toLocaleString() ?? "—"} />
                                <MetricCard label="Largest Gap" value={`${diagnostics.largestGapDays ?? 0} days`} />
                            </div>

                            {/* Anti-bias signals */}
                            {result.summary.antiBiasSignals && (
                                <div className="border border-stone-200 dark:border-neutral-700 rounded-md p-3 bg-stone-50 dark:bg-neutral-950/50">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-neutral-400 mb-2">
                                        Anti-Bias Signals
                                    </h4>
                                    <div className="grid grid-cols-3 gap-3 text-xs">
                                        <div>
                                            <span className="text-stone-400 dark:text-neutral-500">Trades/Year:</span>{" "}
                                            <strong className="text-stone-900 dark:text-white">{result.summary.antiBiasSignals.tradesPerYear.toFixed(1)}</strong>
                                        </div>
                                        <div>
                                            <span className="text-stone-400 dark:text-neutral-500">Low Coverage:</span>{" "}
                                            <strong className={result.summary.antiBiasSignals.lowCoverage ? "text-rose-600" : "text-emerald-600"}>
                                                {result.summary.antiBiasSignals.lowCoverage ? "Yes ⚠" : "No ✓"}
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="text-stone-400 dark:text-neutral-500">Warnings:</span>{" "}
                                            <strong className="text-stone-900 dark:text-white">{result.summary.antiBiasSignals.warningsCount}</strong>
                                        </div>
                                    </div>
                                    {result.summary.antiBiasSignals.warnings.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {result.summary.antiBiasSignals.warnings.map((w, i) => (
                                                <p key={i} className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                                                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                    {w}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Diagnostics warnings */}
                            {diagnostics.warnings && diagnostics.warnings.length > 0 && (
                                <div className="border border-amber-200 dark:border-amber-900/40 rounded-md p-3 bg-amber-50/50 dark:bg-amber-950/20">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2">
                                        Data Warnings
                                    </h4>
                                    <div className="space-y-1">
                                        {diagnostics.warnings.map((w: string, i: number) => (
                                            <p key={i} className="text-[11px] text-amber-800 dark:text-amber-300">{w}</p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});
