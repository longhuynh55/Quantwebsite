/**
 * AI Strategy Generator
 * Generates trading strategies from natural language using GLM API
 */

import {
  generateWithProviderFallback,
  type LlmMessage,
  type LlmResponseFormat,
} from '@/lib/assistant/providers';
import { buildStrategyPrompt, buildStrategyRepairPrompt, buildStrategyUserPrompt } from './prompts/strategy-prompts';
import { createLogger, hashText } from '@/lib/logger';

const strategyLogger = createLogger('ai.strategy-generator');

const STRATEGY_JSON_SCHEMA_RESPONSE_FORMAT: LlmResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "strategy_graph",
    strict: false,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["nodes", "edges", "explanation"],
      properties: {
        name: { type: "string" },
        strategyType: { type: "string" },
        riskLevel: { type: "string", enum: ["low", "medium", "high"] },
        explanation: { type: "string" },
        nodes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true,
            required: ["id", "type", "position", "data"],
            properties: {
              id: { type: "string" },
              type: { type: "string" },
              position: {
                type: "object",
                additionalProperties: false,
                required: ["x", "y"],
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                },
              },
              data: {
                type: "object",
                additionalProperties: true,
                required: ["type", "label", "config"],
                properties: {
                  type: { type: "string" },
                  label: { type: "string" },
                  config: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
              },
            },
          },
        },
        edges: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true,
            required: ["source", "target"],
            properties: {
              id: { type: "string" },
              source: { type: "string" },
              target: { type: "string" },
              sourceHandle: { type: "string" },
              targetHandle: { type: "string" },
            },
          },
        },
      },
    },
  },
};

// Strategy node types matching Strategy Builder
export interface StrategyNodeConfig {
  // DataSource
  stocks?: string[];
  timeframe?: string;
  startDate?: string;
  endDate?: string;
  // Indicator
  indicatorType?: 'rsi' | 'macd' | 'ma' | 'ema' | 'bollinger' | 'atr' | 'volume';
  period?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
  standardDeviations?: number;
  // Filter
  filterType?: 'price_above' | 'price_below' | 'volume_above' | 'volume_below' | 'rsi_overbought' | 'rsi_oversold';
  value?: number;
  comparisonOperator?: '>' | '<' | '>=' | '<=' | '==' | '!=';
  // Signal
  signalType?: 'buy' | 'sell';
  condition?: string;
  quantity?: number;
  stopLoss?: number;
  takeProfit?: number;
  // Output
  metrics?: string[];
  // Risk
  method?: string;
  maxPosition?: number;
  maxDrawdown?: number;
  // Backtest
  initialCapital?: number;
  commission?: number;
  slippage?: number;
}

export interface GeneratedStrategyNode {
  id: string;
  type: 'dataSource' | 'indicator' | 'filter' | 'signal' | 'output' | 'risk' | 'backtest';
  position: { x: number; y: number };
  data: {
    type: 'dataSource' | 'indicator' | 'filter' | 'signal' | 'output' | 'risk' | 'backtest';
    label: string;
    config: StrategyNodeConfig;
  };
}

export interface GeneratedStrategyEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface GeneratedStrategy {
  nodes: GeneratedStrategyNode[];
  edges: GeneratedStrategyEdge[];
  explanation: string;
  name?: string;
  strategyType?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface StrategyGenerationResult {
  success: boolean;
  strategy?: GeneratedStrategy;
  rawResponse?: string;
  error?: string;
  latencyMs: number;
  providerUsed?: string;
  failureKind?: 'parse' | 'timeout' | 'rate_limit' | 'network' | 'upstream' | 'configuration';
  statusCode?: number;
}

/**
 * Generate a trading strategy from natural language description
 */
export async function generateStrategyFromPrompt(
  userPrompt: string,
  options: {
    requestId?: string;
    timeoutMs?: number;
    parseRepairRetries?: number;
  } = {}
): Promise<StrategyGenerationResult> {
  const startedAt = Date.now();
  const timeoutMs = typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs)
    ? Math.max(1, options.timeoutMs)
    : null;
  const deadlineAt = timeoutMs ? startedAt + timeoutMs : null;
  const requestId = options.requestId || generateRequestId();
  const logger = strategyLogger.child({ requestId });

  logger.info('strategy.generation.started', {
    promptLength: userPrompt.length,
    promptDigest: hashText(userPrompt),
  });

  try {
    const totalAttempts = Math.max(1, (options.parseRepairRetries ?? 0) + 1);
    let latestRawResponse = '';
    let latestProviderUsed = '';
    let latestParseFailure = false;

    let validatedStrategy: GeneratedStrategy | null = null;

    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
      if (deadlineAt !== null && Date.now() >= deadlineAt) {
        logger.warn("strategy.generation.timeout_before_attempt", {
          attempt,
          totalAttempts,
          timeoutMs,
        });
        return {
          success: false,
          error: "AI service timed out. Please try again.",
          latencyMs: Date.now() - startedAt,
          failureKind: "timeout",
          statusCode: 504,
        };
      }

      const isRepairAttempt = attempt > 1;
      const systemPrompt = isRepairAttempt
        ? buildStrategyRepairPrompt(userPrompt)
        : buildStrategyPrompt(userPrompt);

      const messages: LlmMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildStrategyUserPrompt(userPrompt) },
      ];

      const result = await awaitWithDeadline(
        (abortSignal) =>
          generateWithProviderFallback(messages, {
            requestId,
            responseFormat: STRATEGY_JSON_SCHEMA_RESPONSE_FORMAT,
            abortSignal,
          }),
        deadlineAt
      );
      if (!result.success) {
        logger.warn('strategy.generation.provider_failed', {
          kind: result.kind,
          statusCode: result.statusCode,
          latencyMs: result.latencyMs,
          attempt,
          totalAttempts,
        });
        return {
          success: false,
          error: result.message || 'Failed to generate strategy',
          latencyMs: Date.now() - startedAt,
          failureKind: result.kind,
          statusCode: result.statusCode,
        };
      }

      latestRawResponse = result.text;
      latestProviderUsed = result.providerUsed;
      const parsedStrategy = parseStrategyResponse(latestRawResponse);
      if (parsedStrategy) {
        validatedStrategy = validateAndFixStrategy(parsedStrategy);
        break;
      }

      latestParseFailure = true;
      logger.warn('strategy.generation.parse_failed', {
        responseLength: latestRawResponse.length,
        responseDigest: hashText(latestRawResponse),
        attempt,
        totalAttempts,
      });
    }

    if (!validatedStrategy) {
      return {
        success: false,
        rawResponse: latestRawResponse,
        error: latestParseFailure
          ? 'Failed to parse strategy from AI response. Please try again with a clearer description.'
          : 'Failed to generate strategy.',
        latencyMs: Date.now() - startedAt,
        failureKind: latestParseFailure ? 'parse' : 'upstream',
        statusCode: latestParseFailure ? 422 : 502,
      };
    }

    const rawResponse = latestRawResponse;

    logger.info('strategy.generation.completed', {
      nodeCount: validatedStrategy.nodes.length,
      edgeCount: validatedStrategy.edges.length,
      explanationLength: validatedStrategy.explanation.length,
      latencyMs: Date.now() - startedAt,
      providerUsed: latestProviderUsed,
    });

    return {
      success: true,
      strategy: validatedStrategy,
      rawResponse,
      latencyMs: Date.now() - startedAt,
      providerUsed: latestProviderUsed,
    };
  } catch (error) {
    if (error instanceof StrategyGenerationTimeoutError) {
      logger.warn("strategy.generation.timeout", {
        latencyMs: Date.now() - startedAt,
        timeoutMs,
      });
      return {
        success: false,
        error: "AI service timed out. Please try again.",
        latencyMs: Date.now() - startedAt,
        failureKind: "timeout",
        statusCode: 504,
      };
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('strategy.generation.exception', {
      error: errorMessage,
      latencyMs: Date.now() - startedAt,
    });
    return {
      success: false,
      error: `An error occurred: ${errorMessage}`,
      latencyMs: Date.now() - startedAt,
      failureKind: 'upstream',
      statusCode: 500,
    };
  }
}

/**
 * Parse the AI response into a strategy structure
 */
function parseStrategyResponse(response: string): GeneratedStrategy | null {
  const candidates = collectJsonCandidates(response);
  for (const candidate of candidates) {
    const variants = [candidate, repairJsonText(candidate)];
    for (const variant of variants) {
      try {
        const parsed = JSON.parse(variant) as unknown;
        const normalized = unwrapGeneratedStrategy(parsed);
        if (normalized) {
          return normalized;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGeneratedStrategy(value: unknown): value is GeneratedStrategy {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) return false;
  if (!value.nodes.every(isRecord)) return false;
  if (!value.edges.every(isRecord)) return false;
  return true;
}

function unwrapGeneratedStrategy(value: unknown): GeneratedStrategy | null {
  if (isGeneratedStrategy(value)) {
    return value;
  }
  if (!isRecord(value)) {
    return null;
  }

  const nestedStrategyInData = isRecord(value.data) ? value.data.strategy : undefined;
  const directCandidates: unknown[] = [value.strategy, nestedStrategyInData, value.data];
  for (const candidate of directCandidates) {
    if (isGeneratedStrategy(candidate)) {
      return candidate;
    }
  }

  return null;
}

function collectJsonCandidates(response: string): string[] {
  const candidates = new Set<string>();
  const trimmed = response.trim();
  if (trimmed) {
    candidates.add(trimmed);
  }

  const fencedRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fencedMatch: RegExpExecArray | null = fencedRegex.exec(response);
  while (fencedMatch) {
    const block = fencedMatch[1]?.trim();
    if (block) {
      candidates.add(block);
    }
    fencedMatch = fencedRegex.exec(response);
  }

  for (const objectText of extractBalancedJsonObjects(response)) {
    candidates.add(objectText);
  }

  return [...candidates];
}

function extractBalancedJsonObjects(source: string): string[] {
  const objects: string[] = [];
  let depth = 0;
  let startIndex = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        startIndex = i;
      }
      depth += 1;
      continue;
    }

    if (char === '}') {
      if (depth > 0) {
        depth -= 1;
      }
      if (depth === 0 && startIndex >= 0) {
        objects.push(source.slice(startIndex, i + 1).trim());
        startIndex = -1;
      }
    }
  }

  return objects;
}

function repairJsonText(source: string): string {
  return source
    .replace(/^\uFEFF/, '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

/**
 * Validate and fix strategy structure
 */
function validateAndFixStrategy(strategy: GeneratedStrategy): GeneratedStrategy {
  const validNodeTypes = ['dataSource', 'indicator', 'filter', 'signal', 'output', 'risk', 'backtest'];
  const nodeIds = new Set<string>();

  // Ensure all nodes have valid structure
  const fixedNodes = strategy.nodes.map((node, index) => {
    const nodeId = node.id || `node-${index}`;
    nodeIds.add(nodeId);

    // Fix node type
    const nodeType = validNodeTypes.includes(node.type) ? node.type : 'indicator';

    // Ensure position exists
    const position = node.position || { x: 50 + index * 250, y: 100 };

    // Ensure data structure
    const data = {
      type: nodeType,
      label: node.data?.label || `${nodeType} Node`,
      config: node.data?.config || {},
    };

    return {
      ...node,
      id: nodeId,
      type: nodeType,
      position,
      data,
    } as GeneratedStrategyNode;
  });

  // Fix edges to reference valid nodes
  const fixedEdges = strategy.edges
    .filter((edge) => {
      const sourceId = edge.source;
      const targetId = edge.target;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    })
    .map((edge, index) => ({
      ...edge,
      id: edge.id || `edge-${index}`,
    })) as GeneratedStrategyEdge[];

  // Ensure explanation exists
  const explanation = strategy.explanation ||
    'Chien luoc duoc tao tu mo ta cua ban. Vui long xem cac node de hieu chi tiet.';

  return {
    nodes: fixedNodes,
    edges: fixedEdges,
    explanation,
    name: strategy.name,
    strategyType: strategy.strategyType,
    riskLevel: strategy.riskLevel,
  };
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `strategy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

class StrategyGenerationTimeoutError extends Error {
  constructor() {
    super("strategy_generation_deadline_exceeded");
  }
}

async function awaitWithDeadline<T>(
  promiseFactory: (abortSignal: AbortSignal) => Promise<T>,
  deadlineAt: number | null
): Promise<T> {
  if (deadlineAt === null) {
    return promiseFactory(new AbortController().signal);
  }
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) {
    throw new StrategyGenerationTimeoutError();
  }

  const deadlineController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race<T>([
      promiseFactory(deadlineController.signal),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          deadlineController.abort();
          reject(new StrategyGenerationTimeoutError());
        }, remainingMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Convert generated strategy to Strategy Builder format
 */
export function convertToStrategyBuilderFormat(
  generatedStrategy: GeneratedStrategy
): {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
} {
  return {
    nodes: generatedStrategy.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        label: node.data.label,
        ...node.data.config,
      },
    })),
    edges: generatedStrategy.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };
}

// Types are already exported above with `export interface`

