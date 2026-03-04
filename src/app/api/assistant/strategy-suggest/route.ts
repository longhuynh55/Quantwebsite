import { NextRequest, NextResponse } from 'next/server';
import {
  generateWithProviderFallback,
  type LlmMessage,
  type LlmResponseFormat,
} from '@/lib/assistant/providers';
import { checkRateLimitAsync, createRateLimitKey, getClientIdentifier } from '@/lib/rateLimit';
import { createLogger, hashText, toErrorMeta } from '@/lib/logger';

const strategySuggestLogger = createLogger('api.assistant.strategy-suggest');

const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_PROMPT_LENGTH = 500;
const parsedRepairRetries = Number.parseInt(process.env.STRATEGY_SUGGEST_PARSE_REPAIR_RETRIES ?? '1', 10);
const PARSE_REPAIR_RETRIES = Number.isFinite(parsedRepairRetries) ? Math.max(0, parsedRepairRetries) : 1;
const parsedTimeoutMs = Number.parseInt(process.env.STRATEGY_SUGGEST_TIMEOUT_MS ?? '30000', 10);
const REQUEST_TIMEOUT_MS = Number.isFinite(parsedTimeoutMs) ? Math.max(5_000, parsedTimeoutMs) : 30_000;
const MAX_NODES = 25;
const MAX_EDGES = 80;
const MAX_NAME_LENGTH = 120;
const MAX_LABEL_LENGTH = 120;
const MAX_CONFIG_PROPERTIES = 32;
const STRATEGY_SCHEMA_REQUIRED = parseBooleanFlag(process.env.ASSISTANT_STRATEGY_SCHEMA_REQUIRED, true);

const STRATEGY_NODE_TYPES = [
  "dataSource",
  "indicator",
  "filter",
  "signal",
  "output",
  "weighting",
  "conditional",
  "sort",
  "math",
  "merge",
  "risk",
  "backtest",
] as const;

type StrategyNodeType = (typeof STRATEGY_NODE_TYPES)[number];
const STRATEGY_NODE_TYPE_SET = new Set<string>(STRATEGY_NODE_TYPES);

const STRATEGY_SUGGEST_RESPONSE_FORMAT: LlmResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'strategy_suggest',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'nodes', 'edges'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: MAX_NAME_LENGTH },
        nodes: {
          type: 'array',
          minItems: 1,
          maxItems: MAX_NODES,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'label', 'config'],
            properties: {
              type: { type: 'string', enum: [...STRATEGY_NODE_TYPES] },
              label: { type: 'string', minLength: 1, maxLength: MAX_LABEL_LENGTH },
              config: { type: 'object', additionalProperties: true, maxProperties: MAX_CONFIG_PROPERTIES },
            },
          },
        },
        edges: {
          type: 'array',
          maxItems: MAX_EDGES,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['from', 'to'],
            properties: {
              from: { type: 'integer', minimum: 0 },
              to: { type: 'integer', minimum: 0 },
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
- "merge": { logic: "and"|"or"|"majority" }
- "risk": { method: "fixed"|"kelly"|"volatility"|"equal", maxPosition?: number, maxDrawdown?: number }
- "backtest": { initialCapital?: number, commission?: number, slippage?: number }

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
Create a logical flow: DataSource -> Indicators -> Filters/Conditions -> Signals -> (optional Risk) -> Output.
Backtest is optional terminal node and should only receive incoming edges (no outgoing edges).
Use 4-7 nodes for a good strategy.`;

const REPAIR_PROMPT = `Your previous answer could not be parsed.
Return ONLY a single JSON object with keys: name, nodes, edges.
No markdown. No prose. No trailing commas.`;

interface StrategyNodeConfig {
  type: StrategyNodeType;
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
  schemaApplied?: boolean;
  responseFormatFallbackUsed?: boolean;
  sanitizationWarnings?: string[];
  requestId?: string;
  latencyMs?: number;
  error?: string;
  details?: string;
  raw?: string;
}

function parseBooleanFlag(raw: string | undefined, fallback: boolean): boolean {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return fallback;
}

function isRequestAbortedFailure(
  result: {
    success: false;
    kind: string;
    providerErrors?: Array<{ details?: string }>;
  }
): boolean {
  if (result.kind !== "timeout") return false;
  return (result.providerErrors ?? []).some(
    (providerError) => String(providerError.details ?? "").toLowerCase() === "request_aborted"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidStrategyNodeConfig(value: unknown): value is StrategyNodeConfig {
  if (!isRecord(value)) return false;
  return (
    typeof value.type === 'string' &&
    STRATEGY_NODE_TYPE_SET.has(value.type) &&
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

function sanitizeStrategyResponse(input: AiStrategyResponse): { strategy: AiStrategyResponse; warnings: string[] } {
  const warnings: string[] = [];
  const nodes: StrategyNodeConfig[] = input.nodes.map((node, index) => {
    const type = String(node.type ?? "").trim() as StrategyNodeType;
    const label = (String(node.label ?? "").trim() || `${type}-${index + 1}`).slice(0, MAX_LABEL_LENGTH);
    const config = isRecord(node.config) ? node.config : {};
    if (!isRecord(node.config)) {
      warnings.push(`Node ${index} had invalid config and was reset.`);
    }
    return { type, label, config };
  });

  const edgeSeen = new Set<string>();
  const edges = input.edges.filter((edge) => {
    if (edge.from === edge.to) return false;
    const signature = `${edge.from}->${edge.to}`;
    if (edgeSeen.has(signature)) return false;
    edgeSeen.add(signature);
    return true;
  });
  if (edges.length !== input.edges.length) {
    warnings.push("Self-loop edges were removed.");
  }

  return {
    strategy: {
      name: (String(input.name ?? "").trim() || "AI Strategy").slice(0, MAX_NAME_LENGTH),
      nodes,
      edges,
    },
    warnings,
  };
}

function validateStrategyInvariants(strategy: AiStrategyResponse): string | null {
  if (!Array.isArray(strategy.nodes) || strategy.nodes.length < 2) {
    return "strategy_requires_at_least_two_nodes";
  }
  if (!Array.isArray(strategy.edges) || strategy.edges.length < 1) {
    return "strategy_requires_at_least_one_edge";
  }
  const hasDataSource = strategy.nodes.some((node) => node.type === "dataSource");
  const hasOutput = strategy.nodes.some((node) => node.type === "output");
  if (!hasDataSource) return "strategy_requires_data_source_node";
  if (!hasOutput) return "strategy_requires_output_node";
  const adjacency = new Map<number, number[]>();
  for (let i = 0; i < strategy.nodes.length; i += 1) {
    adjacency.set(i, []);
  }
  for (const edge of strategy.edges) {
    const next = adjacency.get(edge.from);
    if (next) next.push(edge.to);
  }
  const queue: number[] = [];
  const visited = new Set<number>();
  for (let i = 0; i < strategy.nodes.length; i += 1) {
    if (strategy.nodes[i].type === "dataSource") {
      queue.push(i);
    }
  }
  while (queue.length > 0) {
    const current = queue.shift() as number;
    if (visited.has(current)) continue;
    visited.add(current);
    const next = adjacency.get(current) ?? [];
    for (const target of next) {
      if (!visited.has(target)) queue.push(target);
    }
  }
  const reachableOutput = strategy.nodes.some((node, index) => node.type === "output" && visited.has(index));
  if (!reachableOutput) {
    return "strategy_output_not_reachable_from_data_source";
  }
  return null;
}

function extractJsonCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const candidates: string[] = [trimmed];
  const fencedRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fencedMatch: RegExpExecArray | null;
  while ((fencedMatch = fencedRegex.exec(trimmed)) !== null) {
    const block = fencedMatch[1]?.trim();
    if (block) {
      candidates.push(block);
    }
  }

  candidates.push(...extractBalancedObjectCandidates(trimmed));

  return [...new Set(candidates)];
}

function extractBalancedObjectCandidates(text: string): string[] {
  const candidates: string[] = [];
  let startIndex = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        startIndex = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        const candidate = text.slice(startIndex, index + 1).trim();
        if (candidate) {
          candidates.push(candidate);
        }
        startIndex = -1;
      }
    }
  }

  return candidates;
}

function parseStrategyResponse(raw: string): AiStrategyResponse | null {
  let latestValid: AiStrategyResponse | null = null;
  for (const candidate of extractJsonCandidates(raw)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (isValidAiStrategyResponse(parsed)) {
        latestValid = parsed;
      }
    } catch {
      // Continue with the next candidate.
    }
  }
  return latestValid;
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

class StrategySuggestClientAbortError extends Error {
  constructor() {
    super("strategy_suggest_request_aborted");
  }
}

function isAbortError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const name = String((error as { name?: unknown }).name ?? "");
  if (name === "AbortError") return true;
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase();
  return message.includes("abort");
}

async function awaitWithDeadline<T>(
  promiseFactory: (abortSignal: AbortSignal) => Promise<T>,
  deadlineAt: number,
  requestSignal?: AbortSignal
): Promise<T> {
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) {
    throw new StrategySuggestTimeoutError();
  }

  const deadlineController = new AbortController();
  const compositeController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const onDeadlineAbort = () => compositeController.abort();
  const onRequestAbort = () => compositeController.abort();
  deadlineController.signal.addEventListener("abort", onDeadlineAbort, { once: true });
  requestSignal?.addEventListener("abort", onRequestAbort, { once: true });
  try {
    return await Promise.race<T>([
      promiseFactory(compositeController.signal),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          deadlineController.abort();
          reject(new StrategySuggestTimeoutError());
        }, remainingMs);
      }),
    ]);
  } catch (error) {
    if (deadlineController.signal.aborted && isAbortError(error)) {
      throw new StrategySuggestTimeoutError();
    }
    if (requestSignal?.aborted && isAbortError(error)) {
      throw new StrategySuggestClientAbortError();
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    deadlineController.signal.removeEventListener("abort", onDeadlineAbort);
    requestSignal?.removeEventListener("abort", onRequestAbort);
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
    const rateLimit = await checkRateLimitAsync(rateLimitKey, RATE_LIMIT, RATE_LIMIT_WINDOW);
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
    let responseFormatApplied = false;
    let responseFormatFallbackUsed = false;
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
      ];
      if (attempt > 1 && latestRaw.trim().length > 0) {
        messages.push({ role: "assistant", content: latestRaw.slice(0, 12_000) });
      }
      messages.push({ role: "user", content: prompt });

      const result = await awaitWithDeadline(
        (abortSignal) =>
          generateWithProviderFallback(messages, {
            requestId,
            responseFormat: STRATEGY_SUGGEST_RESPONSE_FORMAT,
            responseFormatMode: "force",
            requireResponseFormatApplied: STRATEGY_SCHEMA_REQUIRED,
            abortSignal,
          }),
        deadlineAt,
        request.signal
      );

      if (!result.success) {
        const requestAborted = isRequestAbortedFailure(result) || request.signal.aborted;
        const status =
          (requestAborted
            ? 499
            : result.statusCode ??
              (result.kind === 'timeout'
                ? 504
                : result.kind === 'rate_limit'
                  ? 429
                  : result.kind === 'configuration'
                    ? 502
                    : 502));

        logger.warn('strategy_suggest.provider_failed', {
          status,
          kind: result.kind,
          details: requestAborted ? "request_aborted" : undefined,
          latencyMs: result.latencyMs,
          attempt,
          totalAttempts,
        });

        return NextResponse.json(
          {
            error: requestAborted
              ? "Request was cancelled by client."
              : result.message || 'AI provider unavailable.',
            requestId,
            latencyMs: Date.now() - startedAt,
          },
          { status }
        );
      }

      latestRaw = result.text;
      latestProvider = result.providerUsed;
      fallbackUsed = result.fallbackUsed;
      responseFormatApplied = result.responseFormatApplied ?? false;
      responseFormatFallbackUsed = result.responseFormatFallbackUsed ?? false;

      if (STRATEGY_SCHEMA_REQUIRED && !responseFormatApplied) {
        logger.warn("strategy_suggest.schema_not_applied", {
          attempt,
          totalAttempts,
          providerUsed: result.providerUsed,
          fallbackUsed: result.fallbackUsed,
          responseFormatFallbackUsed,
        });
        return NextResponse.json(
          {
            error: "Structured strategy schema enforcement is required but unavailable from provider.",
            providerUsed: result.providerUsed,
            fallbackUsed: result.fallbackUsed,
            responseFormatFallbackUsed,
            requestId,
            latencyMs: Date.now() - startedAt,
          },
          { status: 502 }
        );
      }

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

    const sanitized = sanitizeStrategyResponse(strategy);
    const invariantFailure = validateStrategyInvariants(sanitized.strategy);
    if (invariantFailure) {
      logger.warn("strategy_suggest.invariant_failed", {
        invariantFailure,
        nodeCount: sanitized.strategy.nodes.length,
        edgeCount: sanitized.strategy.edges.length,
      });
      return NextResponse.json(
        {
          error: "Generated strategy graph is invalid for execution.",
          details: invariantFailure,
          requestId,
          latencyMs: Date.now() - startedAt,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      strategy: sanitized.strategy,
      provider: latestProvider,
      providerUsed: latestProvider,
      fallbackUsed,
      schemaApplied: responseFormatApplied,
      responseFormatFallbackUsed,
      sanitizationWarnings: sanitized.warnings,
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
    if (error instanceof StrategySuggestClientAbortError) {
      return NextResponse.json(
        { error: "Request was cancelled by client.", requestId },
        { status: 499 }
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
