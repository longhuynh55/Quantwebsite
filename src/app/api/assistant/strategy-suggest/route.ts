import { NextRequest, NextResponse } from 'next/server';
import { generateWithProviderFallback, type LlmMessage } from '@/lib/assistant/providers';

const SYSTEM_PROMPT = `You are a quantitative strategy builder AI. Given a user's strategy description, generate a JSON configuration for a visual node-based strategy builder.

Available node types and their configs:
- "dataSource": { stocks: string[], timeframe: "1d"|"1h"|"5m", startDate: "", endDate: "" }
- "indicator": { indicatorType: "rsi"|"macd"|"ema"|"ma"|"bollinger"|"atr"|"volume", period: number }
- "filter": { filterType: "rsi_oversold"|"rsi_overbought"|"volume_above"|"price_above"|"price_below", value: number, comparisonOperator: "<"|">"|"<="|">=" }
- "signal": { signalType: "buy"|"sell", condition: string, stopLoss?: number, takeProfit?: number }
- "output": { metrics: ["returns","sharpe","drawdown"] }
- "weighting": { method: "equal"|"market_cap"|"inverse_vol"|"risk_parity" }
- "conditional": { condition: string, threshold: number }
- "sort": { sortBy: "returns"|"sharpe"|"volume"|"momentum", order: "asc"|"desc", limit: number }
- "math": { operation: "add"|"subtract"|"multiply"|"divide"|"percent_change", operand?: number }

Respond ONLY with valid JSON, no markdown, no explanation. Format:
{
  "name": "Strategy Name",
  "nodes": [
    { "type": "dataSource", "label": "Label", "config": { ... } },
    { "type": "indicator", "label": "RSI(14)", "config": { "indicatorType": "rsi", "period": 14 } },
    ...
  ],
  "edges": [
    { "from": 0, "to": 1 },
    { "from": 1, "to": 2 },
    ...
  ]
}

edges.from and edges.to are zero-based indices into the nodes array.
Create a logical flow: DataSource → Indicators → Filters/Conditions → Signals → Output.
Use 4-7 nodes for a good strategy.`;

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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt } = body;

        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return NextResponse.json(
                { error: 'Missing or empty prompt' },
                { status: 400 }
            );
        }

        if (prompt.trim().length > 500) {
            return NextResponse.json(
                { error: 'Prompt too long (max 500 characters)' },
                { status: 400 }
            );
        }

        const messages: LlmMessage[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt.trim() },
        ];

        const result = await generateWithProviderFallback(messages, {
            requestId: `strategy-suggest-${Date.now()}`,
        });

        if (!result.success) {
            return NextResponse.json(
                {
                    error: 'AI provider unavailable',
                    details: result.message,
                    fallback: true,
                },
                { status: 502 }
            );
        }

        // Parse the AI response
        let parsed: AiStrategyResponse;
        try {
            // Extract JSON from response (handle markdown code blocks if present)
            let jsonText = result.text.trim();
            const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonText = jsonMatch[1].trim();
            }
            parsed = JSON.parse(jsonText);
        } catch {
            return NextResponse.json(
                {
                    error: 'Failed to parse AI response',
                    raw: result.text.slice(0, 500),
                    fallback: true,
                },
                { status: 422 }
            );
        }

        // Validate structure
        if (!parsed.name || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
            return NextResponse.json(
                {
                    error: 'Invalid AI response structure',
                    fallback: true,
                },
                { status: 422 }
            );
        }

        return NextResponse.json({
            success: true,
            strategy: parsed,
            provider: result.providerUsed,
            fallbackUsed: result.fallbackUsed,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Internal server error', details: message, fallback: true },
            { status: 500 }
        );
    }
}
