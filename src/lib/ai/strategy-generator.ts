/**
 * AI Strategy Generator
 * Generates trading strategies from natural language using GLM API
 */

import { generateWithProviderFallback, type LlmMessage } from '@/lib/assistant/providers';
import { buildStrategyPrompt, buildStrategyRepairPrompt } from './prompts/strategy-prompts';
import { createLogger, hashText } from '@/lib/logger';

const strategyLogger = createLogger('ai.strategy-generator');

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
      const isRepairAttempt = attempt > 1;
      const systemPrompt = isRepairAttempt
        ? buildStrategyRepairPrompt(userPrompt)
        : buildStrategyPrompt(userPrompt);

      const messages: LlmMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const result = await generateWithProviderFallback(messages, { requestId });
      if (!result.success) {
        logger.warn('strategy.generation.provider_failed', {
          kind: (result as { kind: string }).kind,
          latencyMs: result.latencyMs,
          attempt,
          totalAttempts,
        });
        return {
          success: false,
          error: (result as { message: string }).message || 'Failed to generate strategy',
          latencyMs: Date.now() - startedAt,
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('strategy.generation.exception', {
      error: errorMessage,
      latencyMs: Date.now() - startedAt,
    });
    return {
      success: false,
      error: `An error occurred: ${errorMessage}`,
      latencyMs: Date.now() - startedAt,
    };
  }
}

/**
 * Parse the AI response into a strategy structure
 */
function parseStrategyResponse(response: string): GeneratedStrategy | null {
  try {
    // Try to find JSON in the response
    const jsonMatch = response.match(/\{[\s\S]*"nodes"[\s\S]*"edges"[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeneratedStrategy;

    // Validate required fields
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return null;
    }

    return parsed;
  } catch {
    // Try parsing the entire response as JSON
    try {
      const parsed = JSON.parse(response) as GeneratedStrategy;
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}

/**
 * Validate and fix strategy structure
 */
function validateAndFixStrategy(strategy: GeneratedStrategy): GeneratedStrategy {
  const validNodeTypes = ['dataSource', 'indicator', 'filter', 'signal', 'output'];
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
