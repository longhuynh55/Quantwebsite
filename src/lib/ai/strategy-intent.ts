/**
 * Strategy Intent Schema — T1 Step 1
 *
 * Small JSON schema for fast LLM intent extraction.
 * The LLM only outputs a lightweight intent object (~200 tokens)
 * instead of the full strategy graph (~800+ tokens).
 *
 * The graph builder (strategy-graph-builder.ts) then deterministically
 * converts the intent into a full AiStrategyResponse.
 */

import type { LlmResponseFormat } from '@/lib/assistant/providers';

// ────────────────────────────────────────────
// Intent Schema (~200 tokens, strict mode)
// ────────────────────────────────────────────

export const INTENT_RESPONSE_FORMAT: LlmResponseFormat = {
    type: 'json_schema',
    json_schema: {
        name: 'strategy_intent',
        strict: true,
        schema: {
            type: 'object',
            additionalProperties: false,
            required: ['stocks', 'pipeline'],
            properties: {
                name: { type: 'string' },
                stocks: {
                    type: 'array',
                    items: { type: 'string' },
                },
                timeframe: {
                    type: 'string',
                    enum: ['1d', '1h', '5m', '1w'],
                },
                pipeline: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['type'],
                        properties: {
                            type: {
                                type: 'string',
                                enum: [
                                    'indicator', 'filter', 'signal', 'weighting',
                                    'conditional', 'sort', 'math', 'merge', 'risk', 'backtest',
                                ],
                            },
                            label: { type: 'string' },
                            config: { type: 'object' },
                        },
                    },
                },
            },
        },
    },
};

// ────────────────────────────────────────────
// System Prompt (intentionally small ~100 tokens)
// ────────────────────────────────────────────

export const INTENT_SYSTEM_PROMPT = `You are a Vietnamese stock strategy designer.
Given a strategy description, output a JSON object with:
- stocks: array of HOSE stock symbols (e.g. ["VNM", "FPT"])
- pipeline: array of processing steps with type and config
- name: optional strategy name
- timeframe: optional ("1d","1h","5m","1w")

Available pipeline types: indicator, filter, signal, weighting, conditional, sort, math, merge, risk, backtest.
Do NOT include dataSource or output — they are added automatically.
Use realistic defaults for HOSE market. Respond ONLY with valid JSON.`;
