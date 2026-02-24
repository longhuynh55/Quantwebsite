"use client";

import { memo, type FC } from "react";
import {
    BaseEdge,
    getSmoothStepPath,
    type EdgeProps,
} from "@xyflow/react";

/**
 * Custom Gradient Edge — renders a smooth-step path with
 * an SVG linear gradient that transitions from source color
 * to target color, making data flow direction visually clear.
 */

const nodeColorMap: Record<string, string> = {
    dataSource: "#059669",   // emerald
    indicator: "#3b82f6",    // blue
    filter: "#f97316",       // orange
    signal: "#059669",       // emerald (buy default)
    output: "#44403c",       // stone
    weighting: "#8b5cf6",    // violet
    conditional: "#8b5cf6",  // violet
    sort: "#0ea5e9",         // sky
    math: "#6366f1",         // indigo
};

const GradientEdge: FC<EdgeProps> = memo(({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    data,
}) => {
    const gradientId = `gradient-${id}`;

    // Extract colors safely — style.stroke is always set, data may be missing
    const strokeColor = typeof style?.stroke === "string" ? style.stroke : "#a8a29e";
    const sourceColor = (data?.sourceColor as string) || strokeColor;
    const targetColor = (data?.targetColor as string) || sourceColor;

    // Lighten the target color slightly for a subtle gradient feel
    const endColor = targetColor === sourceColor
        ? adjustBrightness(sourceColor, 20)
        : targetColor;

    const [edgePath] = getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        borderRadius: 12,
    });

    return (
        <>
            {/* SVG gradient definition */}
            <defs>
                <linearGradient
                    id={gradientId}
                    gradientUnits="userSpaceOnUse"
                    x1={sourceX}
                    y1={sourceY}
                    x2={targetX}
                    y2={targetY}
                >
                    <stop offset="0%" stopColor={sourceColor} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={endColor} stopOpacity={0.6} />
                </linearGradient>
            </defs>

            {/* Glow layer (behind) */}
            <path
                d={edgePath}
                fill="none"
                stroke={sourceColor}
                strokeWidth={6}
                strokeOpacity={0.08}
                className="react-flow__edge-path"
            />

            {/* Main edge path with gradient */}
            <BaseEdge
                id={id}
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    stroke: `url(#${gradientId})`,
                    strokeWidth: 2.5,
                }}
            />
        </>
    );
});

GradientEdge.displayName = "GradientEdge";

/**
 * Slightly adjust hex color brightness for gradient endpoint.
 */
function adjustBrightness(hex: string, amount: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export { GradientEdge, nodeColorMap };
