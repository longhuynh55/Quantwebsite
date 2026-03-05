/**
 * Strategy Graph Builder — T1 Step 2
 *
 * Deterministic conversion: StrategyIntent → AiStrategyResponse
 * Guarantees all invariants by construction:
 * - Always has dataSource (auto-inserted at index 0)
 * - Always has output (auto-inserted at last index)
 * - All edges reference valid node indices
 * - Path from dataSource → output always exists
 * - No self-loops, no duplicate edges
 */

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

const PIPELINE_NODE_TYPES = [
    "indicator",
    "filter",
    "signal",
    "weighting",
    "conditional",
    "sort",
    "math",
    "merge",
    "risk",
    "backtest",
] as const;

export type PipelineNodeType = (typeof PIPELINE_NODE_TYPES)[number];

const PIPELINE_NODE_TYPE_SET = new Set<string>(PIPELINE_NODE_TYPES);

export interface PipelineStep {
    type: PipelineNodeType;
    label?: string;
    config?: Record<string, unknown>;
}

export interface StrategyIntent {
    name?: string;
    stocks: string[];
    timeframe?: string;
    pipeline: PipelineStep[];
}

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

// ────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────

export function isValidPipelineType(type: string): type is PipelineNodeType {
    return PIPELINE_NODE_TYPE_SET.has(type);
}

// ────────────────────────────────────────────
// Label generation
// ────────────────────────────────────────────

const DEFAULT_LABELS: Record<string, string> = {
    indicator: "Indicator",
    filter: "Filter",
    signal: "Signal",
    weighting: "Weighting",
    conditional: "IF / ELSE",
    sort: "Sort",
    math: "Math",
    merge: "Signal Merge",
    risk: "Risk Management",
    backtest: "Backtest",
};

function generateLabel(step: PipelineStep): string {
    if (step.label?.trim()) return step.label.trim().slice(0, 120);

    const config = step.config ?? {};

    switch (step.type) {
        case "indicator": {
            const indicatorType = String(config.indicatorType ?? "").toUpperCase() || "IND";
            const period = typeof config.period === "number" ? `(${config.period})` : "";
            return `${indicatorType}${period}`;
        }
        case "filter": {
            const filterType = String(config.filterType ?? "").replace(/_/g, " ") || "Filter";
            return filterType.charAt(0).toUpperCase() + filterType.slice(1);
        }
        case "signal": {
            const signalType = String(config.signalType ?? "").toUpperCase() || "SIGNAL";
            return `${signalType} Signal`;
        }
        case "weighting": {
            const method = String(config.method ?? "equal").replace(/_/g, " ");
            return `Weight: ${method}`;
        }
        case "sort": {
            const sortBy = String(config.sortBy ?? "returns");
            const order = String(config.order ?? "desc").toUpperCase();
            return `Sort by ${sortBy} (${order})`;
        }
        case "math": {
            const op = String(config.operation ?? "add");
            return `Math: ${op}`;
        }
        case "merge": {
            const logic = String(config.logic ?? "and").toUpperCase();
            return `Merge (${logic})`;
        }
        case "risk": {
            const method = String(config.method ?? "fixed");
            return `Risk: ${method}`;
        }
        case "conditional": {
            const condition = String(config.condition ?? "value > threshold");
            return `IF ${condition}`.slice(0, 120);
        }
        case "backtest": {
            const capital = typeof config.initialCapital === "number"
                ? `₫${(config.initialCapital / 1_000_000).toFixed(0)}M`
                : "";
            return capital ? `Backtest ${capital}` : "Backtest";
        }
        default:
            return DEFAULT_LABELS[step.type] ?? "Node";
    }
}

// ────────────────────────────────────────────
// Config enrichment (add sensible defaults)
// ────────────────────────────────────────────

function enrichConfig(step: PipelineStep): Record<string, unknown> {
    const base = { ...(step.config ?? {}) };

    switch (step.type) {
        case "indicator":
            if (!base.indicatorType) base.indicatorType = "rsi";
            if (typeof base.period !== "number") base.period = 14;
            break;
        case "filter":
            if (!base.filterType) base.filterType = "rsi_oversold";
            if (typeof base.value !== "number") base.value = 30;
            if (!base.comparisonOperator) base.comparisonOperator = "<";
            break;
        case "signal":
            if (!base.signalType) base.signalType = "buy";
            if (!base.condition) base.condition = "Signal triggered";
            break;
        case "weighting":
            if (!base.method) base.method = "equal";
            break;
        case "sort":
            if (!base.sortBy) base.sortBy = "returns";
            if (!base.order) base.order = "desc";
            if (typeof base.limit !== "number") base.limit = 10;
            break;
        case "math":
            if (!base.operation) base.operation = "add";
            break;
        case "merge":
            if (!base.logic) base.logic = "and";
            break;
        case "risk":
            if (!base.method) base.method = "fixed";
            if (typeof base.maxPosition !== "number") base.maxPosition = 10;
            if (typeof base.maxDrawdown !== "number") base.maxDrawdown = 20;
            break;
        case "conditional":
            if (!base.condition) base.condition = "value > threshold";
            if (typeof base.threshold !== "number") base.threshold = 0;
            break;
        case "backtest":
            if (typeof base.initialCapital !== "number") base.initialCapital = 100_000_000;
            if (typeof base.commission !== "number") base.commission = 0.15;
            if (typeof base.slippage !== "number") base.slippage = 0.05;
            break;
    }

    return base;
}

// ────────────────────────────────────────────
// Main: buildFromIntent
// ────────────────────────────────────────────

export function buildFromIntent(intent: StrategyIntent): AiStrategyResponse {
    const nodes: StrategyNodeConfig[] = [];
    const validTimeframes = new Set(["1d", "1h", "5m", "1w"]);

    // Filter out invalid pipeline steps
    const validPipeline = intent.pipeline.filter((step) => isValidPipelineType(step.type));

    // ─── Auto-add DataSource (index 0) ───
    nodes.push({
        type: "dataSource",
        label: `Data: ${(intent.stocks ?? []).join(", ") || "VNM"}`,
        config: {
            stocks: (intent.stocks ?? []).length > 0 ? intent.stocks : ["VNM"],
            timeframe: validTimeframes.has(intent.timeframe ?? "") ? intent.timeframe! : "1d",
            startDate: "",
            endDate: "",
        },
    });

    // ─── Add pipeline steps (index 1..N) ───
    for (const step of validPipeline) {
        nodes.push({
            type: step.type,
            label: generateLabel(step),
            config: enrichConfig(step),
        });
    }

    // ─── Auto-add Output (index N+1) ───
    nodes.push({
        type: "output",
        label: "Output",
        config: { metrics: ["returns", "sharpe", "drawdown"] },
    });

    // ─── Build edges (sequential by default) ───
    const edges: Array<{ from: number; to: number }> = [];
    const edgeSeen = new Set<string>();

    const addEdge = (from: number, to: number) => {
        // Guard: valid indices, no self-loop, no duplicates
        if (from < 0 || from >= nodes.length) return;
        if (to < 0 || to >= nodes.length) return;
        if (from === to) return;
        const sig = `${from}->${to}`;
        if (edgeSeen.has(sig)) return;
        edgeSeen.add(sig);
        edges.push({ from, to });
    };

    // Connect sequentially: dataSource → step1 → step2 → ... → output
    for (let i = 0; i < nodes.length - 1; i += 1) {
        addEdge(i, i + 1);
    }

    return {
        name: intent.name?.trim()?.slice(0, 120) || "AI Strategy",
        nodes,
        edges,
    };
}
