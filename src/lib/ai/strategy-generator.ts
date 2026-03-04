/**
 * AI Strategy Generator
 * Generates trading strategies from natural language using GLM API
 */

import {
  generateWithProviderFallback,
  type LlmMessage,
  type LlmResponseFormat,
} from '@/lib/assistant/providers';
import {
  STRATEGY_GENERATION_REPAIR_PROMPT,
  STRATEGY_GENERATION_SYSTEM_PROMPT,
  buildStrategyPrompt,
  buildStrategyRepairPrompt,
} from './prompts/strategy-prompts';
import { createLogger, hashText } from '@/lib/logger';

const strategyLogger = createLogger('ai.strategy-generator');
const STRATEGY_SCHEMA_REQUIRED = String(process.env.ASSISTANT_STRATEGY_SCHEMA_REQUIRED ?? "true")
  .trim()
  .toLowerCase() === "true";

const STRATEGY_JSON_SCHEMA_RESPONSE_FORMAT: LlmResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'strategy_graph',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['nodes', 'edges', 'explanation'],
      properties: {
        name: { type: 'string' },
        strategyType: { type: 'string' },
        riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
        explanation: { type: 'string' },
        nodes: {
          type: 'array',
          maxItems: 25,
          items: {
            type: 'object',
            additionalProperties: true,
            required: ['id', 'type', 'position', 'data'],
            properties: {
              id: { type: 'string' },
              type: { type: 'string', maxLength: 40 },
              position: {
                type: 'object',
                additionalProperties: false,
                required: ['x', 'y'],
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                },
              },
              data: {
                type: 'object',
                additionalProperties: true,
                required: ['type', 'label', 'config'],
                properties: {
                  type: { type: 'string' },
                  label: { type: 'string', maxLength: 120 },
                  config: {
                    type: 'object',
                    additionalProperties: true,
                    maxProperties: 32,
                  },
                },
              },
            },
          },
        },
        edges: {
          type: 'array',
          maxItems: 80,
          items: {
            type: 'object',
            additionalProperties: true,
            required: ['source', 'target'],
            properties: {
              id: { type: 'string' },
              source: { type: 'string' },
              target: { type: 'string' },
              sourceHandle: { type: 'string' },
              targetHandle: { type: 'string' },
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
}

export interface GeneratedStrategyNode {
  id: string;
  type: 'dataSource' | 'indicator' | 'filter' | 'signal' | 'output';
  position: { x: number; y: number };
  data: {
    type: 'dataSource' | 'indicator' | 'filter' | 'signal' | 'output';
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
  schemaApplied?: boolean;
  responseFormatFallbackUsed?: boolean;
  failureKind?: 'parse' | 'timeout' | 'rate_limit' | 'network' | 'upstream' | 'configuration';
  statusCode?: number;
}

const VALID_NODE_TYPES: ReadonlyArray<GeneratedStrategyNode["type"]> = [
  "dataSource",
  "indicator",
  "filter",
  "signal",
  "output",
];

interface StrategyInvariantResult {
  ok: boolean;
  reason?: string;
}

interface StrategyNormalizationResult {
  strategy: GeneratedStrategy;
  warnings: string[];
  hasUnsupportedNodeType: boolean;
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
    abortSignal?: AbortSignal;
  } = {}
): Promise<StrategyGenerationResult> {
  const startedAt = Date.now();
  const timeoutMs = typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs)
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
    let latestSchemaApplied = false;
    let latestResponseFormatFallbackUsed = false;

    let validatedStrategy: GeneratedStrategy | null = null;

    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
      if (deadlineAt !== null && Date.now() >= deadlineAt) {
        logger.warn('strategy.generation.timeout_before_attempt', {
          attempt,
          totalAttempts,
          timeoutMs,
        });
        return {
          success: false,
          error: 'AI service timed out. Please try again.',
          latencyMs: Date.now() - startedAt,
          failureKind: 'timeout',
          statusCode: 504,
        };
      }

      const isRepairAttempt = attempt > 1;
      const userMessage = isRepairAttempt
        ? buildStrategyRepairPrompt(userPrompt)
        : buildStrategyPrompt(userPrompt);
      const systemPrompt = isRepairAttempt
        ? `${STRATEGY_GENERATION_SYSTEM_PROMPT}\n\n${STRATEGY_GENERATION_REPAIR_PROMPT}`
        : STRATEGY_GENERATION_SYSTEM_PROMPT;

      const messages: LlmMessage[] = [{ role: 'system', content: systemPrompt }];
      if (isRepairAttempt && latestRawResponse.trim().length > 0) {
        messages.push({ role: 'assistant', content: latestRawResponse.slice(0, 12_000) });
      }
      messages.push({ role: 'user', content: userMessage });

      const result = await awaitWithDeadline(
        (abortSignal) =>
          generateWithProviderFallback(messages, {
            requestId,
            responseFormat: STRATEGY_JSON_SCHEMA_RESPONSE_FORMAT,
            responseFormatMode: "force",
            requireResponseFormatApplied: STRATEGY_SCHEMA_REQUIRED,
            abortSignal,
          }),
        deadlineAt,
        options.abortSignal
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
      latestSchemaApplied = result.responseFormatApplied ?? false;
      latestResponseFormatFallbackUsed = result.responseFormatFallbackUsed ?? false;
      if (STRATEGY_SCHEMA_REQUIRED && !latestSchemaApplied) {
        return {
          success: false,
          error: "Structured strategy schema enforcement is required but unavailable from provider.",
          latencyMs: Date.now() - startedAt,
          failureKind: "configuration",
          statusCode: 502,
        };
      }
      const parsedStrategy = parseStrategyResponse(latestRawResponse);
      if (parsedStrategy) {
        const normalized = validateAndFixStrategy(parsedStrategy);
        if (normalized.hasUnsupportedNodeType) {
          latestParseFailure = true;
          logger.warn("strategy.generation.unsupported_node_type", {
            warnings: normalized.warnings,
            attempt,
            totalAttempts,
          });
          continue;
        }
        const candidateStrategy = normalized.strategy;
        const invariantResult = validateStrategyInvariants(candidateStrategy);
        if (invariantResult.ok) {
          validatedStrategy = candidateStrategy;
          break;
        }
        latestParseFailure = true;
        logger.warn("strategy.generation.invariant_failed", {
          reason: invariantResult.reason,
          nodeCount: candidateStrategy.nodes.length,
          edgeCount: candidateStrategy.edges.length,
          attempt,
          totalAttempts,
        });
        continue;
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
      schemaApplied: latestSchemaApplied,
      responseFormatFallbackUsed: latestResponseFormatFallbackUsed,
    };
  } catch (error) {
    if (error instanceof StrategyGenerationTimeoutError) {
      logger.warn('strategy.generation.timeout', {
        latencyMs: Date.now() - startedAt,
        timeoutMs,
      });
      return {
        success: false,
        error: 'AI service timed out. Please try again.',
        latencyMs: Date.now() - startedAt,
        failureKind: 'timeout',
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
  let latestValid: GeneratedStrategy | null = null;
  for (const candidate of extractJsonCandidates(response)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (isCoreGeneratedStrategyShape(parsed)) {
        latestValid = parsed;
      }
    } catch {
      // Continue with the next parsing candidate.
    }
  }

  return latestValid;
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

function isCoreGeneratedStrategyShape(value: unknown): value is GeneratedStrategy {
  if (!isRecord(value)) return false;

  if (!Array.isArray(value.nodes)) return false;
  if (!Array.isArray(value.edges)) return false;

  if (!value.nodes.every(isCoreGeneratedNodeShape)) return false;
  if (!value.edges.every(isCoreGeneratedEdgeShape)) return false;

  if (
    value.explanation !== undefined &&
    value.explanation !== null &&
    typeof value.explanation !== "string"
  ) {
    return false;
  }

  return true;
}

function isCoreGeneratedNodeShape(value: unknown): boolean {
  if (!isRecord(value)) return false;

  if (typeof value.type !== "string" || value.type.trim().length === 0) return false;
  if (!isRecord(value.data)) return false;

  if (
    value.position !== undefined &&
    value.position !== null &&
    (!isRecord(value.position) ||
      typeof value.position.x !== "number" ||
      !Number.isFinite(value.position.x) ||
      typeof value.position.y !== "number" ||
      !Number.isFinite(value.position.y))
  ) {
    return false;
  }

  if (typeof value.data.type !== "string" || value.data.type.trim().length === 0) return false;
  if (value.data.label !== undefined && typeof value.data.label !== "string") return false;
  if (value.data.config !== undefined && !isRecord(value.data.config)) return false;

  return true;
}

function isCoreGeneratedEdgeShape(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.source === "string" &&
    value.source.trim().length > 0 &&
    typeof value.target === "string" &&
    value.target.trim().length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate and fix strategy structure
 */
function validateAndFixStrategy(strategy: GeneratedStrategy): StrategyNormalizationResult {
  const nodeIds = new Set<string>();
  const idRemap = new Map<string, string>();
  const warnings: string[] = [];
  let hasUnsupportedNodeType = false;

  // Ensure all nodes have valid structure
  const fixedNodes = strategy.nodes.map((node, index) => {
    const rawNodeId = typeof node.id === "string" && node.id.trim().length > 0 ? node.id.trim() : `node-${index}`;
    let nodeId = rawNodeId;
    if (nodeIds.has(nodeId)) {
      let suffix = 1;
      while (nodeIds.has(`${rawNodeId}-${suffix}`)) {
        suffix += 1;
      }
      nodeId = `${rawNodeId}-${suffix}`;
      warnings.push(`Duplicate node id "${rawNodeId}" was remapped to "${nodeId}".`);
    }
    nodeIds.add(nodeId);
    if (!idRemap.has(rawNodeId)) {
      idRemap.set(rawNodeId, nodeId);
    }

    // Fix node type
    const rawNodeType = typeof node.type === "string" ? node.type : node.data?.type;
    const nodeTypeCandidate = String(rawNodeType ?? "").trim();
    const nodeType = VALID_NODE_TYPES.includes(nodeTypeCandidate as GeneratedStrategyNode["type"])
      ? (nodeTypeCandidate as GeneratedStrategyNode["type"])
      : undefined;
    if (!nodeType) {
      hasUnsupportedNodeType = true;
      warnings.push(`Unsupported node type "${nodeTypeCandidate || "unknown"}" at index ${index}.`);
    }
    const safeNodeType = nodeType
      ? nodeType
      : "indicator";

    // Ensure position exists
    const hasValidPosition = Boolean(
      node.position &&
      typeof node.position.x === "number" &&
      Number.isFinite(node.position.x) &&
      typeof node.position.y === "number" &&
      Number.isFinite(node.position.y)
    );
    const position = hasValidPosition
      ? node.position
      : { x: 50 + index * 250, y: 100 };

    // Ensure data structure
    const data = {
      type: safeNodeType,
      label: node.data?.label || `${safeNodeType} Node`,
      config: node.data?.config || {},
    };

    return {
      ...node,
      id: nodeId,
      type: safeNodeType,
      position,
      data,
    } as GeneratedStrategyNode;
  });

  // Fix edges to reference valid nodes
  const edgeIds = new Set<string>();
  const edgeSignatures = new Set<string>();
  const fixedEdges = strategy.edges
    .map((edge, index) => {
      const sourceId = idRemap.get(edge.source) ?? edge.source;
      const targetId = idRemap.get(edge.target) ?? edge.target;
      const candidateId = typeof edge.id === "string" && edge.id.trim().length > 0 ? edge.id.trim() : `edge-${index}`;
      let edgeId = candidateId;
      if (edgeIds.has(edgeId)) {
        let suffix = 1;
        while (edgeIds.has(`${candidateId}-${suffix}`)) {
          suffix += 1;
        }
        edgeId = `${candidateId}-${suffix}`;
      }
      edgeIds.add(edgeId);
      return {
        ...edge,
        id: edgeId,
        source: sourceId,
        target: targetId,
      };
    })
    .filter((edge) => {
      const sourceId = edge.source;
      const targetId = edge.target;
      const signature = `${sourceId}->${targetId}:${edge.sourceHandle ?? ""}:${edge.targetHandle ?? ""}`;
      if (edgeSignatures.has(signature)) {
        warnings.push(`Duplicate edge "${signature}" was removed.`);
        return false;
      }
      edgeSignatures.add(signature);
      return (
        typeof sourceId === "string" &&
        typeof targetId === "string" &&
        sourceId !== targetId &&
        nodeIds.has(sourceId) &&
        nodeIds.has(targetId)
      );
    }) as GeneratedStrategyEdge[];

  // Ensure explanation exists
  const explanation = strategy.explanation ||
    'Chien luoc duoc tao tu mo ta cua ban. Vui long xem cac node de hieu chi tiet.';

  return {
    strategy: {
      nodes: fixedNodes,
      edges: fixedEdges,
      explanation,
      name: strategy.name,
      strategyType: strategy.strategyType,
      riskLevel: strategy.riskLevel,
    },
    warnings,
    hasUnsupportedNodeType,
  };
}

function validateStrategyInvariants(strategy: GeneratedStrategy): StrategyInvariantResult {
  if (!Array.isArray(strategy.nodes) || strategy.nodes.length < 2) {
    return { ok: false, reason: "strategy_requires_at_least_two_nodes" };
  }
  if (!Array.isArray(strategy.edges) || strategy.edges.length < 1) {
    return { ok: false, reason: "strategy_requires_at_least_one_edge" };
  }

  const dataSourceNodes = strategy.nodes.filter((node) => node.type === "dataSource");
  if (dataSourceNodes.length === 0) {
    return { ok: false, reason: "strategy_requires_data_source_node" };
  }

  const outputNodes = strategy.nodes.filter((node) => node.type === "output");
  if (outputNodes.length === 0) {
    return { ok: false, reason: "strategy_requires_output_node" };
  }

  const adjacency = new Map<string, Set<string>>();
  for (const node of strategy.nodes) {
    adjacency.set(node.id, new Set<string>());
  }
  for (const edge of strategy.edges) {
    const next = adjacency.get(edge.source);
    if (next) {
      next.add(edge.target);
    }
  }

  const visited = new Set<string>();
  const queue = dataSourceNodes.map((node) => node.id);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (visited.has(current)) continue;
    visited.add(current);
    const next = adjacency.get(current);
    if (!next) continue;
    for (const target of next) {
      if (!visited.has(target)) {
        queue.push(target);
      }
    }
  }

  const reachableOutput = outputNodes.some((node) => visited.has(node.id));
  if (!reachableOutput) {
    return { ok: false, reason: "strategy_output_not_reachable_from_data_source" };
  }

  return { ok: true };
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
    super('strategy_generation_deadline_exceeded');
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
  deadlineAt: number | null,
  requestAbortSignal?: AbortSignal
): Promise<T> {
  if (deadlineAt === null && requestAbortSignal) {
    return promiseFactory(requestAbortSignal);
  }
  if (deadlineAt === null) {
    return promiseFactory(new AbortController().signal);
  }

  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) {
    throw new StrategyGenerationTimeoutError();
  }

  const deadlineController = new AbortController();
  const onRequestAbort = () => deadlineController.abort();
  if (requestAbortSignal) {
    if (requestAbortSignal.aborted) {
      deadlineController.abort();
    } else {
      requestAbortSignal.addEventListener("abort", onRequestAbort, { once: true });
    }
  }
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
  } catch (error) {
    if (deadlineController.signal.aborted && isAbortError(error)) {
      throw new StrategyGenerationTimeoutError();
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    requestAbortSignal?.removeEventListener("abort", onRequestAbort);
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
