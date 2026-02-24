"use client";

import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Wand2,
    TrendingUp,
    Activity,
    BarChart3,
    Shield,
    Zap,
    X,
} from "lucide-react";
import { createStrategyNodeFromPaletteType } from "./nodeFactory";
import type { StrategyNode, StrategyEdge } from "@/lib/stores/strategyBuilderStore";

export interface StrategyTemplate {
    id: string;
    name: string;
    description: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    tags: string[];
    buildNodes: () => { nodes: StrategyNode[]; edges: StrategyEdge[] };
}

const generateEdgeId = (source: string, target: string) =>
    `e-${source}-${target}`;

const templates: StrategyTemplate[] = [
    {
        id: "rsi-reversal",
        name: "RSI Reversal",
        description:
            "Classic mean-reversion: buy when RSI < 30, sell when RSI > 70. Includes stop-loss and take-profit.",
        icon: Activity,
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/40",
        tags: ["Momentum", "Mean-Reversion"],
        buildNodes: () => {
            const ds = createStrategyNodeFromPaletteType("dataSource", { x: 80, y: 160 })!;
            const ind = createStrategyNodeFromPaletteType("indicator", { x: 340, y: 160 })!;
            const filt = createStrategyNodeFromPaletteType("filter", { x: 600, y: 100 })!;
            const sig = createStrategyNodeFromPaletteType("signal", { x: 600, y: 260 })!;
            const out = createStrategyNodeFromPaletteType("output", { x: 860, y: 160 })!;

            // Customize labels
            ds.data = {
                type: "dataSource",
                label: "VNM Daily",
                config: { label: "VNM Daily", stocks: ["VNM"], timeframe: "1d", startDate: "2020-01-02", endDate: "2025-12-31" },
            };
            ind.data = { ...ind.data, label: "RSI(14)" };
            filt.data = { ...filt.data, label: "RSI < 30" };
            sig.data = { ...sig.data, label: "Buy Signal" };
            out.data = { ...out.data, label: "Performance" };

            const edges: StrategyEdge[] = [
                { id: generateEdgeId(ds.id, ind.id), source: ds.id, target: ind.id, animated: true, style: { stroke: "#059669", strokeWidth: 2 } },
                { id: generateEdgeId(ind.id, filt.id), source: ind.id, target: filt.id, animated: true, style: { stroke: "#0f766e", strokeWidth: 2 } },
                { id: generateEdgeId(ind.id, sig.id), source: ind.id, target: sig.id, animated: true, style: { stroke: "#0f766e", strokeWidth: 2 } },
                { id: generateEdgeId(sig.id, out.id), source: sig.id, target: out.id, animated: true, style: { stroke: "#e11d48", strokeWidth: 2 } },
            ];

            return { nodes: [ds, ind, filt, sig, out], edges };
        },
    },
    {
        id: "macd-crossover",
        name: "EMA Crossover",
        description:
            "Trend-following strategy using EMA crossover logic. Enters on bullish cross, exits on bearish.",
        icon: TrendingUp,
        color: "text-teal-600 dark:text-teal-400",
        bgColor: "bg-teal-100 dark:bg-teal-900/40",
        tags: ["Trend", "Momentum"],
        buildNodes: () => {
            const ds = createStrategyNodeFromPaletteType("dataSource", { x: 80, y: 160 })!;
            const emaFast = createStrategyNodeFromPaletteType("indicator", { x: 340, y: 80 })!;
            const emaSlow = createStrategyNodeFromPaletteType("indicator", { x: 340, y: 260 })!;
            const cond = createStrategyNodeFromPaletteType("conditional", { x: 600, y: 160 })!;
            const sigBuy = createStrategyNodeFromPaletteType("signal", { x: 860, y: 80 })!;
            const sigSell = createStrategyNodeFromPaletteType("signal", { x: 860, y: 260 })!;
            const out = createStrategyNodeFromPaletteType("output", { x: 1100, y: 160 })!;

            ds.data = {
                type: "dataSource",
                label: "FPT Daily",
                config: { label: "FPT Daily", stocks: ["FPT"], timeframe: "1d", startDate: "2020-01-02", endDate: "2025-12-31" },
            };
            emaFast.data = {
                type: "indicator",
                label: "EMA(12)",
                config: { label: "EMA(12)", indicatorType: "ema" as const, period: 12 },
            };
            emaSlow.data = {
                type: "indicator",
                label: "EMA(26)",
                config: { label: "EMA(26)", indicatorType: "ema" as const, period: 26 },
            };
            cond.data = { ...cond.data, label: "EMA Cross?" };
            sigBuy.data = { type: "signal", label: "Buy", config: { label: "Buy", signalType: "buy" as const, condition: "EMA(12) crosses above EMA(26)" } };
            sigSell.data = { type: "signal", label: "Sell", config: { label: "Sell", signalType: "sell" as const, condition: "EMA(12) crosses below EMA(26)" } };
            out.data = { ...out.data, label: "Results" };

            const edges: StrategyEdge[] = [
                { id: generateEdgeId(ds.id, emaFast.id), source: ds.id, target: emaFast.id, animated: true, style: { stroke: "#059669", strokeWidth: 2 } },
                { id: generateEdgeId(ds.id, emaSlow.id), source: ds.id, target: emaSlow.id, animated: true, style: { stroke: "#059669", strokeWidth: 2 } },
                { id: generateEdgeId(emaFast.id, cond.id), source: emaFast.id, target: cond.id, animated: true, style: { stroke: "#0f766e", strokeWidth: 2 } },
                { id: generateEdgeId(emaSlow.id, cond.id), source: emaSlow.id, target: cond.id, animated: true, style: { stroke: "#0f766e", strokeWidth: 2 } },
                { id: generateEdgeId(cond.id, sigBuy.id), source: cond.id, target: sigBuy.id, sourceHandle: "true", animated: true, style: { stroke: "#f59e0b", strokeWidth: 2 } },
                { id: generateEdgeId(cond.id, sigSell.id), source: cond.id, target: sigSell.id, sourceHandle: "false", animated: true, style: { stroke: "#f59e0b", strokeWidth: 2 } },
                { id: generateEdgeId(sigBuy.id, out.id), source: sigBuy.id, target: out.id, animated: true, style: { stroke: "#e11d48", strokeWidth: 2 } },
                { id: generateEdgeId(sigSell.id, out.id), source: sigSell.id, target: out.id, animated: true, style: { stroke: "#e11d48", strokeWidth: 2 } },
            ];

            return { nodes: [ds, emaFast, emaSlow, cond, sigBuy, sigSell, out], edges };
        },
    },
    {
        id: "bollinger-breakout",
        name: "Bollinger Breakout",
        description:
            "Volatility breakout: enters when price breaks above the upper Bollinger Band.",
        icon: BarChart3,
        color: "text-rose-600 dark:text-rose-400",
        bgColor: "bg-rose-100 dark:bg-rose-900/40",
        tags: ["Volatility", "Breakout"],
        buildNodes: () => {
            const ds = createStrategyNodeFromPaletteType("dataSource", { x: 80, y: 160 })!;
            const bb = createStrategyNodeFromPaletteType("indicator", { x: 340, y: 100 })!;
            const sig = createStrategyNodeFromPaletteType("signal", { x: 620, y: 160 })!;
            const out = createStrategyNodeFromPaletteType("output", { x: 880, y: 160 })!;

            ds.data = {
                type: "dataSource",
                label: "HPG Daily",
                config: { label: "HPG Daily", stocks: ["HPG"], timeframe: "1d", startDate: "2020-01-02", endDate: "2025-12-31" },
            };
            bb.data = {
                type: "indicator",
                label: "Bollinger(20,2)",
                config: { label: "Bollinger(20,2)", indicatorType: "bollinger" as const, period: 20, standardDeviations: 2 },
            };
            sig.data = { type: "signal", label: "Breakout Buy", config: { label: "Breakout Buy", signalType: "buy" as const, condition: "Price > Upper BB", stopLoss: 3, takeProfit: 8 } };
            out.data = { ...out.data, label: "Results" };

            const edges: StrategyEdge[] = [
                { id: generateEdgeId(ds.id, bb.id), source: ds.id, target: bb.id, animated: true, style: { stroke: "#059669", strokeWidth: 2 } },
                { id: generateEdgeId(bb.id, sig.id), source: bb.id, target: sig.id, animated: true, style: { stroke: "#0f766e", strokeWidth: 2 } },
                { id: generateEdgeId(sig.id, out.id), source: sig.id, target: out.id, animated: true, style: { stroke: "#e11d48", strokeWidth: 2 } },
            ];

            return { nodes: [ds, bb, sig, out], edges };
        },
    },
    {
        id: "ma-cross",
        name: "SMA Cross",
        description:
            "Dual SMA crossover: short-term SMA crosses above long-term SMA = buy, crosses below = sell.",
        icon: Zap,
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-100 dark:bg-amber-900/40",
        tags: ["Trend", "Classic"],
        buildNodes: () => {
            const ds = createStrategyNodeFromPaletteType("dataSource", { x: 80, y: 160 })!;
            const smaFast = createStrategyNodeFromPaletteType("indicator", { x: 340, y: 80 })!;
            const smaSlow = createStrategyNodeFromPaletteType("indicator", { x: 340, y: 260 })!;
            const math = createStrategyNodeFromPaletteType("math", { x: 600, y: 160 })!;
            const sig = createStrategyNodeFromPaletteType("signal", { x: 860, y: 160 })!;
            const out = createStrategyNodeFromPaletteType("output", { x: 1100, y: 160 })!;

            ds.data = {
                type: "dataSource",
                label: "VCB Daily",
                config: { label: "VCB Daily", stocks: ["VCB"], timeframe: "1d", startDate: "2020-01-02", endDate: "2025-12-31" },
            };
            smaFast.data = {
                type: "indicator",
                label: "SMA(10)",
                config: { label: "SMA(10)", indicatorType: "ma" as const, period: 10 },
            };
            smaSlow.data = {
                type: "indicator",
                label: "SMA(50)",
                config: { label: "SMA(50)", indicatorType: "ma" as const, period: 50 },
            };
            math.data = { type: "math", label: "SMA Fast - SMA Slow", config: { label: "SMA Fast - SMA Slow", operation: "subtract" } };
            sig.data = { type: "signal", label: "Cross Buy", config: { label: "Cross Buy", signalType: "buy" as const, condition: "SMA(10) > SMA(50)" } };
            out.data = { ...out.data, label: "Performance" };

            const edges: StrategyEdge[] = [
                { id: generateEdgeId(ds.id, smaFast.id), source: ds.id, target: smaFast.id, animated: true, style: { stroke: "#059669", strokeWidth: 2 } },
                { id: generateEdgeId(ds.id, smaSlow.id), source: ds.id, target: smaSlow.id, animated: true, style: { stroke: "#059669", strokeWidth: 2 } },
                { id: generateEdgeId(smaFast.id, math.id), source: smaFast.id, target: math.id, animated: true, style: { stroke: "#0f766e", strokeWidth: 2 } },
                { id: generateEdgeId(smaSlow.id, math.id), source: smaSlow.id, target: math.id, animated: true, style: { stroke: "#0f766e", strokeWidth: 2 } },
                { id: generateEdgeId(math.id, sig.id), source: math.id, target: sig.id, animated: true, style: { stroke: "#6366f1", strokeWidth: 2 } },
                { id: generateEdgeId(sig.id, out.id), source: sig.id, target: out.id, animated: true, style: { stroke: "#e11d48", strokeWidth: 2 } },
            ];

            return { nodes: [ds, smaFast, smaSlow, math, sig, out], edges };
        },
    },
    {
        id: "risk-parity",
        name: "Risk Parity Portfolio",
        description:
            "Multi-asset allocation with inverse-volatility weighting, sorted by Sharpe ratio. Top 10 assets.",
        icon: Shield,
        color: "text-violet-600 dark:text-violet-400",
        bgColor: "bg-violet-100 dark:bg-violet-900/40",
        tags: ["Portfolio", "Risk"],
        buildNodes: () => {
            const ds = createStrategyNodeFromPaletteType("dataSource", { x: 80, y: 160 })!;
            const ind = createStrategyNodeFromPaletteType("indicator", { x: 340, y: 100 })!;
            const sort = createStrategyNodeFromPaletteType("sort", { x: 340, y: 260 })!;
            const w = createStrategyNodeFromPaletteType("weighting", { x: 600, y: 160 })!;
            const out = createStrategyNodeFromPaletteType("output", { x: 860, y: 160 })!;

            ds.data = {
                type: "dataSource",
                label: "VN30 Universe",
                config: { label: "VN30 Universe", stocks: ["VNM", "FPT", "VCB", "VHM", "HPG", "MWG"], timeframe: "1d", startDate: "2020-01-02", endDate: "2025-12-31" },
            };
            ind.data = {
                type: "indicator",
                label: "SMA(20)",
                config: { label: "SMA(20)", indicatorType: "ma" as const, period: 20 },
            };
            sort.data = { type: "sort", label: "Sort by Sharpe", config: { label: "Sort by Sharpe", sortBy: "sharpe", order: "desc", limit: 10 } };
            w.data = { type: "weighting", label: "Inv-Vol Weight", config: { label: "Inv-Vol Weight", method: "inverse_vol" } };
            out.data = { ...out.data, label: "Portfolio" };

            const edges: StrategyEdge[] = [
                { id: generateEdgeId(ds.id, ind.id), source: ds.id, target: ind.id, animated: true, style: { stroke: "#059669", strokeWidth: 2 } },
                { id: generateEdgeId(ds.id, sort.id), source: ds.id, target: sort.id, animated: true, style: { stroke: "#059669", strokeWidth: 2 } },
                { id: generateEdgeId(sort.id, w.id), source: sort.id, target: w.id, animated: true, style: { stroke: "#0ea5e9", strokeWidth: 2 } },
                { id: generateEdgeId(ind.id, w.id), source: ind.id, target: w.id, animated: true, style: { stroke: "#0f766e", strokeWidth: 2 } },
                { id: generateEdgeId(w.id, out.id), source: w.id, target: out.id, animated: true, style: { stroke: "#8b5cf6", strokeWidth: 2 } },
            ];

            return { nodes: [ds, ind, sort, w, out], edges };
        },
    },
];

interface TemplateGalleryProps {
    onApplyTemplate: (nodes: StrategyNode[], edges: StrategyEdge[], name: string) => void;
    className?: string;
}

export const TemplateGallery = memo(({ onApplyTemplate, className }: TemplateGalleryProps) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleApply = (template: StrategyTemplate) => {
        const { nodes, edges } = template.buildNodes();
        onApplyTemplate(nodes, edges, template.name);
        setIsOpen(false);
    };

    if (!isOpen) {
        return (
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(true)}
                className={cn(
                    "w-full gap-2 border-stone-300 bg-white text-stone-700 hover:border-emerald-400 hover:bg-emerald-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/30",
                    className
                )}
            >
                <Wand2 className="w-4 h-4" />
                Strategy Templates
            </Button>
        );
    }

    return (
        <div className={cn("flex flex-col", className)}>
            <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400">
                    Templates
                </span>
                <button
                    onClick={() => setIsOpen(false)}
                    className="p-0.5 text-stone-400 hover:text-stone-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {templates.map((template) => {
                    const Icon = template.icon;
                    return (
                        <button
                            key={template.id}
                            onClick={() => handleApply(template)}
                            className={cn(
                                "w-full text-left border border-stone-200 bg-white p-2.5 rounded-lg dark:border-neutral-700 dark:bg-neutral-900",
                                "hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20",
                                "transition-all duration-200 group"
                            )}
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className={cn("p-1.5 rounded-md", template.bgColor)}>
                                    <Icon className={cn("w-3.5 h-3.5", template.color)} />
                                </div>
                                <span className="text-sm font-medium text-stone-900 dark:text-white">
                                    {template.name}
                                </span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-stone-500 dark:text-neutral-400 mb-1.5">
                                {template.description}
                            </p>
                            {/* Mini flow preview */}
                            <div className="flex items-center gap-1 mb-1.5 py-1 px-1.5 bg-stone-50 dark:bg-neutral-800/50 rounded">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title="Data Source" />
                                <span className="w-3 h-px bg-stone-300 dark:bg-neutral-600" />
                                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" title="Indicator" />
                                <span className="w-3 h-px bg-stone-300 dark:bg-neutral-600" />
                                <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" title="Filter/Signal" />
                                <span className="w-3 h-px bg-stone-300 dark:bg-neutral-600" />
                                <span className="w-2 h-2 rounded-full bg-stone-600 dark:bg-stone-400 flex-shrink-0" title="Output" />
                                <span className="ml-1 text-[9px] text-stone-400 dark:text-neutral-500">
                                    {template.tags.length > 1 ? `${template.tags.length + 2} nodes` : "4 nodes"}
                                </span>
                            </div>
                            <div className="flex gap-1">
                                {template.tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-stone-100 text-stone-600 dark:bg-neutral-800 dark:text-neutral-400"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
});

TemplateGallery.displayName = "TemplateGallery";

