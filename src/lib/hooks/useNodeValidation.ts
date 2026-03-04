"use client";

import { useMemo } from "react";
import type { StrategyNode, StrategyEdge } from "@/lib/stores/strategyBuilderStore";

export interface NodeValidationIssue {
    nodeId: string;
    severity: "error" | "warning";
    message: string;
}

/**
 * Validates all nodes in the strategy and returns a map of nodeId → issues.
 */
export function useNodeValidation(
    nodes: StrategyNode[],
    edges: StrategyEdge[]
): {
    issuesByNode: Map<string, NodeValidationIssue[]>;
    totalErrors: number;
    totalWarnings: number;
    isValid: boolean;
} {
    return useMemo(() => {
        const issuesByNode = new Map<string, NodeValidationIssue[]>();

        const addIssue = (nodeId: string, severity: "error" | "warning", message: string) => {
            if (!issuesByNode.has(nodeId)) {
                issuesByNode.set(nodeId, []);
            }
            issuesByNode.get(nodeId)!.push({ nodeId, severity, message });
        };

        // Build adjacency info
        const incomingEdges = new Map<string, number>();
        const outgoingEdges = new Map<string, number>();
        for (const edge of edges) {
            incomingEdges.set(edge.target, (incomingEdges.get(edge.target) || 0) + 1);
            outgoingEdges.set(edge.source, (outgoingEdges.get(edge.source) || 0) + 1);
        }

        for (const node of nodes) {
            const data = node.data;
            const type = data.type;
            const incoming = incomingEdges.get(node.id) || 0;
            const outgoing = outgoingEdges.get(node.id) || 0;

            // 1. DataSource validation
            if (type === "dataSource") {
                const config = data.config;
                if ("stocks" in config) {
                    const stocks = (config as { stocks?: string[] }).stocks;
                    if (!stocks || stocks.length === 0 || (stocks.length === 1 && !stocks[0])) {
                        addIssue(node.id, "error", "No stocks selected");
                    }
                }
                if (outgoing === 0) {
                    addIssue(node.id, "warning", "Not connected to any downstream node");
                }
            }

            // 2. Indicator validation
            if (type === "indicator") {
                if (incoming === 0) {
                    addIssue(node.id, "error", "Missing input — connect a Data Source");
                }
                const config = data.config;
                if ("period" in config) {
                    const period = (config as { period?: number }).period;
                    if (period !== undefined && (period < 2 || period > 300)) {
                        addIssue(node.id, "warning", `Period ${period} may be out of optimal range`);
                    }
                }
            }

            // 3. Filter validation
            if (type === "filter") {
                if (incoming === 0) {
                    addIssue(node.id, "error", "Missing input — connect data flow");
                }
            }

            // 4. Signal validation
            if (type === "signal") {
                if (incoming === 0) {
                    addIssue(node.id, "error", "Missing input — needs indicator or filter");
                }
                const config = data.config;
                if ("condition" in config) {
                    const condition = (config as { condition?: string }).condition;
                    if (!condition || condition.trim() === "") {
                        addIssue(node.id, "warning", "No condition defined");
                    }
                }
            }

            // 5. Output validation
            if (type === "output") {
                if (incoming === 0) {
                    addIssue(node.id, "error", "No inputs connected");
                }
            }

            // 6. Backtest validation
            if (type === "backtest") {
                if (incoming === 0) {
                    addIssue(node.id, "error", "Needs signal or risk node input");
                }
            }

            // 7. Risk validation
            if (type === "risk") {
                if (incoming === 0) {
                    addIssue(node.id, "error", "Needs signal input");
                }
            }

            // 8. Advanced nodes (weighting, conditional, sort, math, merge)
            if (["weighting", "conditional", "sort", "math", "merge"].includes(type)) {
                if (incoming === 0) {
                    addIssue(node.id, "warning", "No input connected");
                }
            }

            // 9. Disconnected node (no incoming AND no outgoing)
            if (incoming === 0 && outgoing === 0 && type !== "dataSource") {
                addIssue(node.id, "warning", "Isolated node — not connected to any other");
            }
        }

        let totalErrors = 0;
        let totalWarnings = 0;
        for (const issues of issuesByNode.values()) {
            for (const issue of issues) {
                if (issue.severity === "error") totalErrors++;
                else totalWarnings++;
            }
        }

        return {
            issuesByNode,
            totalErrors,
            totalWarnings,
            isValid: totalErrors === 0,
        };
    }, [nodes, edges]);
}
