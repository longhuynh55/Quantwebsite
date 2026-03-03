import { NextRequest, NextResponse } from 'next/server';
import {
  generateWithProviderFallback,
  type LlmMessage,
  type LlmResponseFormat,
} from '@/lib/assistant/providers';
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from '@/lib/rateLimit';
import { createLogger, hashText, toErrorMeta } from '@/lib/logger';

const strategySuggestLogger = createLogger('api.assistant.strategy-suggest');

const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_PROMPT_LENGTH = 500;
const parsedRepairRetries = Number.parseInt(process.env.STRATEGY_SUGGEST_PARSE_REPAIR_RETRIES ?? '1', 10);
const PARSE_REPAIR_RETRIES = Number.isFinite(parsedRepairRetries) ? Math.max(0, parsedRepairRetries) : 1;
const parsedTimeoutMs = Number.parseInt(process.env.STRATEGY_SUGGEST_TIMEOUT_MS ?? '30000', 10);
const REQUEST_TIMEOUT_MS = Number.isFinite(parsedTimeoutMs) ? Math.max(5_000, parsedTimeoutMs) : 30_000;

const STRATEGY_SUGGEST_RESPONSE_FORMAT: LlmResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "strategy_suggest",
    strict: false,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["name", "nodes", "edges"],
      properties: {
        name: { type: "string" },
        nodes: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["type", "label", "config"],
            properties: {
              type: { type: "string" },
              label: { type: "string" },
              config: { type: "object", additionalProperties: true },
            },
          },
        },
        edges: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["from", "to"],
            properties: {
              from: { type: "integer", minimum: 0 },
              to: { type: "integer", minimum: 0 },
            },
          },
        },
      },
    },
  },
};

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
Create a logical flow: DataSource -> Indicators -> Filters/Conditions -> Signals -> Output.
Use 4-7 nodes for a good strategy.`;

const REPAIR_PROMPT = `Your previous answer could not be parsed.
Return ONLY a single JSON object with keys: name, nodes, edges.
No markdown. No prose. No trailing commas.`;

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

interface StrategySuggestResponse {
  success?: boolean;
  strategy?: AiStrategyResponse;
  provider?: string;
  providerUsed?: string;
  fallbackUsed?: boolean;
  requestId?: string;
  latencyMs?: number;
  error?: string;
  details?: string;
  raw?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidStrategyNodeConfig(value: unknown): value is StrategyNodeConfig {
  if (!isRecord(value)) return false;
  return (
    typeof value.type === 'string' &&
    value.type.length > 0 &&
    typeof value.label === 'string' &&
    value.label.length > 0 &&
    isRecord(value.config)
  );
}

function isValidStrategyEdge(value: unknown, nodeCount: number): value is { from: number; to: number } {
  if (!isRecord(value)) return false;
  const { from, to } = value;
  return (
    typeof from === 'number' &&
    typeof to === 'number' &&
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    from >= 0 &&
    to >= 0 &&
    from < nodeCount &&
    to < nodeCount
  );
}

function isValidAiStrategyResponse(value: unknown): value is AiStrategyResponse {
  if (!isRecord(value)) return false;
  const { name, nodes, edges } = value;
  if (typeof name !== 'string' || name.trim().length === 0) return false;
  if (!Array.isArray(nodes) || nodes.length === 0 || !Array.isArray(edges)) return false;
  if (!nodes.every(isValidStrategyNodeConfig)) return false;
  if (!edges.every((edge) => isValidStrategyEdge(edge, nodes.length))) return false;
  return true;
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  return trimmed;
}

function parseStrategyResponse(raw: string): AiStrategyResponse | null {
  try {
    const parsed = JSON.parse(extractJson(raw)) as unknown;
    if (!isValidAiStrategyResponse(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `strategy-suggest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

class StrategySuggestTimeoutError extends Error {
  constructor() {
    super('strategy_suggest_deadline_exceeded');
  }
}

async function awaitWithDeadline<T>(
  promiseFactory: (abortSignal: AbortSignal) => Promise<T>,
  deadlineAt: number
): Promise<T> {
  const deadlineController = new AbortController();
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) {
    throw new StrategySuggestTimeoutError();
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race<T>([
      promiseFactory(deadlineController.signal),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          deadlineController.abort();
          reject(new StrategySuggestTimeoutError());
        }, remainingMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<StrategySuggestResponse>> {
  const startedAt = Date.now();
  const deadlineAt = startedAt + REQUEST_TIMEOUT_MS;
  const requestId = generateRequestId();
  const logger = strategySuggestLogger.child({ requestId });

  try {
    const clientId = getClientIdentifier(request);
    const rateLimitKey = createRateLimitKey('strategy-suggest', clientId);
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMIT, RATE_LIMIT_WINDOW);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests. Please wait and try again.',
          requestId,
        },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload.', requestId },
        { status: 400 }
      );
    }

    if (!isRecord(body)) {
      return NextResponse.json(
        { error: 'Request body must be a JSON object.', requestId },
        { status: 400 }
      );
    }

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing or empty prompt.', requestId },
        { status: 400 }
      );
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt too long (max ${MAX_PROMPT_LENGTH} characters).`, requestId },
        { status: 400 }
      );
    }

    const totalAttempts = Math.max(1, PARSE_REPAIR_RETRIES + 1);
    let latestRaw = '';
    let latestProvider = '';
    let fallbackUsed = false;
    let strategy: AiStrategyResponse | null = null;

    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
      if (Date.now() >= deadlineAt) {
        return NextResponse.json(
          { error: 'AI strategy suggestion timed out. Please try again.', requestId },
          { status: 504 }
        );
      }

      const systemPrompt = attempt > 1 ? `${SYSTEM_PROMPT}\n\n${REPAIR_PROMPT}` : SYSTEM_PROMPT;
      const messages: LlmMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ];

      const result = await awaitWithDeadline(
        (abortSignal) =>
          generateWithProviderFallback(messages, {
            requestId,
            responseFormat: STRATEGY_SUGGEST_RESPONSE_FORMAT,
            abortSignal,
          }),
        deadlineAt
      );

      if (!result.success) {
        const status =
          result.statusCode ??
          (result.kind === 'timeout'
            ? 504
            : result.kind === 'rate_limit'
              ? 429
              : result.kind === 'configuration'
                ? 500
                : 502);

        logger.warn('strategy_suggest.provider_failed', {
          status,
          kind: result.kind,
          latencyMs: result.latencyMs,
          attempt,
          totalAttempts,
        });

        return NextResponse.json(
          {
            error: result.message || 'AI provider unavailable.',
            requestId,
            latencyMs: Date.now() - startedAt,
          },
          { status }
        );
      }

      latestRaw = result.text;
      latestProvider = result.providerUsed;
      fallbackUsed = result.fallbackUsed;

      strategy = parseStrategyResponse(result.text);
      if (strategy) {
        break;
      }

      logger.warn('strategy_suggest.parse_failed', {
        attempt,
        totalAttempts,
        providerUsed: result.providerUsed,
        responseLength: result.text.length,
        responseDigest: hashText(result.text),
      });
    }

    if (!strategy) {
      return NextResponse.json(
        {
          error: 'Failed to parse AI response.',
          raw: latestRaw.slice(0, 500),
          providerUsed: latestProvider || undefined,
          requestId,
          latencyMs: Date.now() - startedAt,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      strategy,
      provider: latestProvider,
      providerUsed: latestProvider,
      fallbackUsed,
      requestId,
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    if (error instanceof StrategySuggestTimeoutError) {
      return NextResponse.json(
        { error: 'AI strategy suggestion timed out. Please try again.', requestId },
        { status: 504 }
      );
    }

    logger.error('strategy_suggest.exception', {
      ...toErrorMeta(error),
      latencyMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      { error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}
