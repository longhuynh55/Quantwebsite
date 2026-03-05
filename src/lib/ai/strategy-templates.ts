/**
 * Strategy Templates — T0 Tier
 *
 * Pre-built strategy templates for common patterns.
 * Returns instant results (0ms) without LLM calls.
 *
 * Template output matches AiStrategyResponse format from route.ts:
 * { name: string, nodes: [{type, label, config}], edges: [{from, to}] }
 */
import { getCandidateSymbols } from "@/lib/assistant/signals";

// ────────────────────────────────────────────
// Types (mirrors route.ts AiStrategyResponse)
// ────────────────────────────────────────────

interface StrategyNodeConfig {
    type: string;
    label: string;
    config: Record<string, unknown>;
}

interface AiStrategyResponse {
    name: string;
    nodes: StrategyNodeConfig[];
    edges: Array<{ from: number; to: number }>;
}

interface StrategyTemplate {
    id: string;
    keywords: string[];
    build(stocks: string[], params: Record<string, number>): AiStrategyResponse;
}

// ────────────────────────────────────────────
// Stock & Parameter Extraction
// ────────────────────────────────────────────

const HOSE_PATTERN = /\b([A-Z]{3})\b/gi;
const NUMBER_PATTERN = /(?:period|chu[_ ]?k[ỳy]|sl|stoploss|stop[_ ]?loss|tp|takeprofit|take[_ ]?profit)\s*[:=]?\s*(\d+(?:\.\d+)?)/gi;

export function extractStocks(prompt: string): string[] {
    const parserSymbols = getCandidateSymbols(prompt)
        .map((symbol) => String(symbol).trim().toUpperCase())
        .filter((symbol) => symbol.length > 0);

    const matches = prompt.match(HOSE_PATTERN);
    const regexSymbols = (matches ?? []).map((symbol) => symbol.toUpperCase());

    // Filter out common words that look like 3-letter symbols.
    const exclude = new Set([
        "THE", "AND", "FOR", "BUY", "RSI", "EMA", "SMA", "MACD", "ATR", "NOT",
        "CHO", "BAN", "MINH", "VA", "VOI", "NEN", "CAN", "MUA",
        "CHI", "TIN", "TUC",
    ]);
    const merged = [...new Set([...parserSymbols, ...regexSymbols])];
    const filtered = merged.filter((symbol) => !exclude.has(symbol));
    return filtered.length > 0 ? filtered.slice(0, 10) : ["VNM"];
}

export function extractParams(prompt: string): Record<string, number> {
    const params: Record<string, number> = {};
    let match: RegExpExecArray | null;
    const p = new RegExp(NUMBER_PATTERN.source, NUMBER_PATTERN.flags);
    while ((match = p.exec(prompt)) !== null) {
        const key = match[0].split(/[:=\s]/)[0].toLowerCase().trim();
        const val = parseFloat(match[1]);
        if (Number.isFinite(val)) {
            if (key.includes("period") || key.includes("chu")) params.period = val;
            else if (key.includes("sl") || key.includes("stoploss") || key.includes("stop")) params.stopLoss = val;
            else if (key.includes("tp") || key.includes("takeprofit") || key.includes("take")) params.takeProfit = val;
        }
    }
    return params;
}

// ────────────────────────────────────────────
// Template Definitions
// ────────────────────────────────────────────

const TEMPLATES: StrategyTemplate[] = [
    {
        id: "rsi_mean_reversion",
        keywords: ["rsi", "mean reversion", "quá bán", "oversold", "đảo chiều"],
        build(stocks, params) {
            const period = params.period ?? 14;
            return {
                name: "RSI Mean Reversion",
                nodes: [
                    { type: "dataSource", label: `Data: ${stocks.join(", ")}`, config: { stocks, timeframe: "1d", startDate: "", endDate: "" } },
                    { type: "indicator", label: `RSI(${period})`, config: { indicatorType: "rsi", period } },
                    { type: "filter", label: "RSI < 30", config: { filterType: "rsi_oversold", value: 30, comparisonOperator: "<" } },
                    { type: "signal", label: "BUY Signal", config: { signalType: "buy", condition: `RSI(${period}) < 30`, stopLoss: params.stopLoss ?? 5, takeProfit: params.takeProfit ?? 15 } },
                    { type: "output", label: "Output", config: { metrics: ["returns", "sharpe", "drawdown"] } },
                ],
                edges: [
                    { from: 0, to: 1 },
                    { from: 1, to: 2 },
                    { from: 2, to: 3 },
                    { from: 3, to: 4 },
                ],
            };
        },
    },
    {
        id: "macd_crossover",
        keywords: ["macd", "crossover", "giao cắt", "tín hiệu macd"],
        build(stocks, params) {
            return {
                name: "MACD Crossover",
                nodes: [
                    { type: "dataSource", label: `Data: ${stocks.join(", ")}`, config: { stocks, timeframe: "1d", startDate: "", endDate: "" } },
                    { type: "indicator", label: "MACD(12,26,9)", config: { indicatorType: "macd", period: 26, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
                    { type: "signal", label: "BUY Signal", config: { signalType: "buy", condition: "MACD crosses above signal line", stopLoss: params.stopLoss ?? 5, takeProfit: params.takeProfit ?? 10 } },
                    { type: "output", label: "Output", config: { metrics: ["returns", "sharpe", "drawdown"] } },
                ],
                edges: [
                    { from: 0, to: 1 },
                    { from: 1, to: 2 },
                    { from: 2, to: 3 },
                ],
            };
        },
    },
    {
        id: "bollinger_breakout",
        keywords: ["bollinger", "band", "breakout", "phá vỡ", "dải bollinger"],
        build(stocks, params) {
            const period = params.period ?? 20;
            return {
                name: "Bollinger Band Breakout",
                nodes: [
                    { type: "dataSource", label: `Data: ${stocks.join(", ")}`, config: { stocks, timeframe: "1d", startDate: "", endDate: "" } },
                    { type: "indicator", label: `Bollinger(${period})`, config: { indicatorType: "bollinger", period, standardDeviations: 2 } },
                    { type: "filter", label: "Price below lower band", config: { filterType: "price_below", value: 0, comparisonOperator: "<" } },
                    { type: "signal", label: "BUY Signal", config: { signalType: "buy", condition: "Price touches lower Bollinger Band", stopLoss: params.stopLoss ?? 3, takeProfit: params.takeProfit ?? 10 } },
                    { type: "output", label: "Output", config: { metrics: ["returns", "sharpe", "drawdown"] } },
                ],
                edges: [
                    { from: 0, to: 1 },
                    { from: 1, to: 2 },
                    { from: 2, to: 3 },
                    { from: 3, to: 4 },
                ],
            };
        },
    },
    {
        id: "volume_breakout",
        keywords: ["volume", "khối lượng", "đột biến", "volume spike"],
        build(stocks, params) {
            return {
                name: "Volume Breakout",
                nodes: [
                    { type: "dataSource", label: `Data: ${stocks.join(", ")}`, config: { stocks, timeframe: "1d", startDate: "", endDate: "" } },
                    { type: "indicator", label: "Volume", config: { indicatorType: "volume", period: 20 } },
                    { type: "filter", label: "Volume > 2x avg", config: { filterType: "volume_above", value: 200, comparisonOperator: ">" } },
                    { type: "signal", label: "BUY Signal", config: { signalType: "buy", condition: "Volume breakout detected" } },
                    { type: "output", label: "Output", config: { metrics: ["returns", "sharpe", "drawdown"] } },
                ],
                edges: [
                    { from: 0, to: 1 },
                    { from: 1, to: 2 },
                    { from: 2, to: 3 },
                    { from: 3, to: 4 },
                ],
            };
        },
    },
    {
        id: "ma_golden_cross",
        keywords: ["golden cross", "death cross", "ma", "moving average", "trung bình", "ema", "sma"],
        build(stocks, params) {
            return {
                name: "MA Golden Cross",
                nodes: [
                    { type: "dataSource", label: `Data: ${stocks.join(", ")}`, config: { stocks, timeframe: "1d", startDate: "", endDate: "" } },
                    { type: "indicator", label: "EMA(20)", config: { indicatorType: "ema", period: 20 } },
                    { type: "indicator", label: "EMA(50)", config: { indicatorType: "ema", period: 50 } },
                    { type: "signal", label: "BUY Signal", config: { signalType: "buy", condition: "EMA(20) crosses above EMA(50)", stopLoss: params.stopLoss ?? 5, takeProfit: params.takeProfit ?? 15 } },
                    { type: "output", label: "Output", config: { metrics: ["returns", "sharpe", "drawdown"] } },
                ],
                edges: [
                    { from: 0, to: 1 },
                    { from: 0, to: 2 },
                    { from: 1, to: 3 },
                    { from: 2, to: 3 },
                    { from: 3, to: 4 },
                ],
            };
        },
    },
    {
        id: "rsi_risk_management",
        keywords: ["rsi", "risk", "quản lý rủi ro", "risk management", "stoploss", "sl"],
        build(stocks, params) {
            const period = params.period ?? 14;
            return {
                name: "RSI + Risk Management",
                nodes: [
                    { type: "dataSource", label: `Data: ${stocks.join(", ")}`, config: { stocks, timeframe: "1d", startDate: "", endDate: "" } },
                    { type: "indicator", label: `RSI(${period})`, config: { indicatorType: "rsi", period } },
                    { type: "filter", label: "RSI < 30", config: { filterType: "rsi_oversold", value: 30, comparisonOperator: "<" } },
                    { type: "signal", label: "BUY Signal", config: { signalType: "buy", condition: `RSI(${period}) < 30`, stopLoss: params.stopLoss ?? 5, takeProfit: params.takeProfit ?? 15 } },
                    { type: "risk", label: "Risk: fixed", config: { method: "fixed", maxPosition: 10, maxDrawdown: 20 } },
                    { type: "output", label: "Output", config: { metrics: ["returns", "sharpe", "drawdown"] } },
                ],
                edges: [
                    { from: 0, to: 1 },
                    { from: 1, to: 2 },
                    { from: 2, to: 3 },
                    { from: 3, to: 4 },
                    { from: 4, to: 5 },
                ],
            };
        },
    },
    {
        id: "multi_indicator_merge",
        keywords: ["kết hợp", "merge", "combined", "nhiều chỉ báo", "multi indicator", "kết hợp rsi macd"],
        build(stocks, params) {
            const period = params.period ?? 14;
            return {
                name: "Multi-Indicator Merge",
                nodes: [
                    { type: "dataSource", label: `Data: ${stocks.join(", ")}`, config: { stocks, timeframe: "1d", startDate: "", endDate: "" } },
                    { type: "indicator", label: `RSI(${period})`, config: { indicatorType: "rsi", period } },
                    { type: "indicator", label: "MACD(12,26,9)", config: { indicatorType: "macd", period: 26, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
                    { type: "merge", label: "Merge (AND)", config: { logic: "and" } },
                    { type: "signal", label: "BUY Signal", config: { signalType: "buy", condition: "RSI + MACD confluence" } },
                    { type: "output", label: "Output", config: { metrics: ["returns", "sharpe", "drawdown"] } },
                ],
                edges: [
                    { from: 0, to: 1 },
                    { from: 0, to: 2 },
                    { from: 1, to: 3 },
                    { from: 2, to: 3 },
                    { from: 3, to: 4 },
                    { from: 4, to: 5 },
                ],
            };
        },
    },
    {
        id: "backtest_full",
        keywords: ["backtest", "kiểm thử", "testhử", "mô phỏng", "simulation"],
        build(stocks, params) {
            const period = params.period ?? 14;
            return {
                name: "Strategy with Backtest",
                nodes: [
                    { type: "dataSource", label: `Data: ${stocks.join(", ")}`, config: { stocks, timeframe: "1d", startDate: "", endDate: "" } },
                    { type: "indicator", label: `RSI(${period})`, config: { indicatorType: "rsi", period } },
                    { type: "signal", label: "BUY Signal", config: { signalType: "buy", condition: `RSI(${period}) < 30` } },
                    { type: "risk", label: "Risk: fixed", config: { method: "fixed", maxPosition: 10, maxDrawdown: 20 } },
                    { type: "output", label: "Output", config: { metrics: ["returns", "sharpe", "drawdown"] } },
                    { type: "backtest", label: "Backtest 100M", config: { initialCapital: 100_000_000, commission: 0.15, slippage: 0.05 } },
                ],
                edges: [
                    { from: 0, to: 1 },
                    { from: 1, to: 2 },
                    { from: 2, to: 3 },
                    { from: 3, to: 4 },
                    { from: 3, to: 5 },
                ],
            };
        },
    },
];

// ────────────────────────────────────────────
// Matching Logic
// ────────────────────────────────────────────

const MATCH_THRESHOLD = 0.8;

function normalizePrompt(prompt: string): string {
    return prompt
        .toLowerCase()
        .normalize("NFC")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function computeKeywordScore(prompt: string, keywords: string[]): number {
    if (keywords.length === 0) return 0;
    const normalized = normalizePrompt(prompt);
    let matched = 0;
    for (const keyword of keywords) {
        if (normalized.includes(keyword.toLowerCase())) {
            matched += 1;
        }
    }
    return matched / keywords.length;
}

export interface TemplateMatchResult {
    template: StrategyTemplate;
    score: number;
    strategy: AiStrategyResponse;
}

export function matchTemplate(prompt: string): AiStrategyResponse | null {
    const stocks = extractStocks(prompt);
    const params = extractParams(prompt);

    let bestScore = 0;
    let bestTemplate: StrategyTemplate | null = null;

    for (const template of TEMPLATES) {
        const score = computeKeywordScore(prompt, template.keywords);
        if (score > bestScore) {
            bestScore = score;
            bestTemplate = template;
        }
    }

    if (bestScore < MATCH_THRESHOLD || !bestTemplate) {
        return null;
    }

    return bestTemplate.build(stocks, params);
}

/**
 * Returns all templates for testing/inspection.
 * @internal
 */
export function getTemplates(): readonly StrategyTemplate[] {
    return TEMPLATES;
}
