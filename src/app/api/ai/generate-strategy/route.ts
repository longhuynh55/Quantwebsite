import { NextRequest, NextResponse } from 'next/server';
import {
  generateStrategyFromPrompt,
  type GeneratedStrategy,
} from '@/lib/ai/strategy-generator';
import {
  buildStrategyTemplateFallback,
  type StrategyTemplateFallbackReason,
} from "@/lib/ai/strategy-template-fallback";
import { checkRateLimitAsync, createRateLimitKey, getClientIdentifier } from '@/lib/rateLimit';
import { createLogger, toErrorMeta } from '@/lib/logger';

const strategyApiLogger = createLogger('api.ai.generate-strategy');

// Rate limit: 10 strategy generations per minute per client
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 60 * 1000;

const MAX_PROMPT_LENGTH = 2000;
const parsedParseRepairRetries = Number.parseInt(process.env.STRATEGY_PARSE_REPAIR_RETRIES ?? '1', 10);
const PARSE_REPAIR_RETRIES = Number.isFinite(parsedParseRepairRetries)
  ? Math.max(0, parsedParseRepairRetries)
  : 1;
const parsedProviderTimeoutMs = Number.parseInt(process.env.STRATEGY_PROVIDER_TIMEOUT_MS ?? "", 10);
const PROVIDER_TIMEOUT_MS = Number.isFinite(parsedProviderTimeoutMs)
  ? Math.max(5_000, parsedProviderTimeoutMs)
  : 60_000;
const parsedRequestTimeoutMs = Number.parseInt(process.env.STRATEGY_GENERATION_TIMEOUT_MS ?? "", 10);
const REQUEST_TIMEOUT_MS = Number.isFinite(parsedRequestTimeoutMs)
  ? Math.max(5_000, parsedRequestTimeoutMs, PROVIDER_TIMEOUT_MS + 5_000)
  : Math.max(75_000, PROVIDER_TIMEOUT_MS + 15_000);

interface StrategyGenerationResponse {
  success: boolean;
  strategy?: GeneratedStrategy;
  rawResponse?: string;
  error?: string;
  latencyMs?: number;
  providerUsed?: string;
  schemaApplied?: boolean;
  responseFormatFallbackUsed?: boolean;
  validation?: {
    minimumViable: boolean;
    warnings: string[];
  };
  generationMode?: "llm" | "template_fallback";
  degraded?: boolean;
  degradeReason?: StrategyTemplateFallbackReason;
  userNotice?: string;
  requestId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest): Promise<NextResponse<StrategyGenerationResponse>> {
  const startedAt = Date.now();
  const requestId = generateRequestId();
  const logger = strategyApiLogger.child({ requestId });

  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimitKey = createRateLimitKey('strategy-generation', clientId);
    const rateLimitResult = await checkRateLimitAsync(rateLimitKey, RATE_LIMIT, RATE_LIMIT_WINDOW);

    if (!rateLimitResult.allowed) {
      logger.warn('rate_limit.blocked', {
        remaining: rateLimitResult.remaining,
        resetInMs: Math.max(0, rateLimitResult.resetTime - Date.now()),
      });
      return NextResponse.json<StrategyGenerationResponse>(
        {
          success: false,
          error: 'Too many requests. Please wait a moment before generating another strategy.',
          requestId,
        },
        { status: 429 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json() as unknown;
    } catch {
      logger.warn('request.invalid_json');
      return NextResponse.json<StrategyGenerationResponse>(
        {
          success: false,
          error: 'Invalid JSON payload.',
          requestId,
        },
        { status: 400 }
      );
    }
    if (!isRecord(body)) {
      logger.warn("request.invalid_shape");
      return NextResponse.json<StrategyGenerationResponse>(
        {
          success: false,
          error: "Request body must be a JSON object.",
          requestId,
        },
        { status: 400 }
      );
    }
    const promptValue = body.prompt;
    const clientRequestId =
      typeof body.requestId === "string" && body.requestId.trim().length > 0
        ? body.requestId.trim()
        : undefined;

    // Validate prompt
    const prompt = typeof promptValue === "string" ? promptValue.trim() : "";
    if (!prompt) {
      logger.warn('request.empty_prompt');
      return NextResponse.json<StrategyGenerationResponse>(
        {
          success: false,
          error: 'Prompt is required. Please describe the strategy you want to create.',
          requestId,
        },
        { status: 400 }
      );
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      logger.warn('request.prompt_too_long', {
        promptLength: prompt.length,
        maxLength: MAX_PROMPT_LENGTH,
      });
      return NextResponse.json<StrategyGenerationResponse>(
        {
          success: false,
          error: `Prompt is too long. Maximum ${MAX_PROMPT_LENGTH} characters allowed.`,
          requestId,
        },
        { status: 400 }
      );
    }

    logger.info('request.received', {
      promptLength: prompt.length,
      clientRequestId: clientRequestId ?? null,
    });

    // Generate strategy
    const result = await generateStrategyFromPrompt(prompt, {
      requestId,
      timeoutMs: REQUEST_TIMEOUT_MS,
      providerTimeoutMs: PROVIDER_TIMEOUT_MS,
      parseRepairRetries: Math.max(0, PARSE_REPAIR_RETRIES),
      abortSignal: request.signal,
    });

    if (!result.success) {
      const demoFallbackReason = mapFailureKindToTemplateFallbackReason(result.failureKind);
      if (isDemoAvailabilityModeEnabled() && demoFallbackReason) {
        const fallbackStrategy = buildStrategyTemplateFallback(prompt, demoFallbackReason);
        const fallbackValidation = validateGeneratedStrategy(fallbackStrategy);
        if (fallbackValidation.minimumViable) {
          logger.warn("generation.demo_fallback_used", {
            failureKind: result.failureKind,
            degradeReason: demoFallbackReason,
            latencyMs: result.latencyMs,
          });
          return NextResponse.json<StrategyGenerationResponse>({
            success: true,
            strategy: fallbackStrategy,
            rawResponse: result.rawResponse,
            latencyMs: result.latencyMs,
            providerUsed: "demo-template-fallback",
            schemaApplied: false,
            responseFormatFallbackUsed: true,
            validation: fallbackValidation,
            generationMode: "template_fallback",
            degraded: true,
            degradeReason: demoFallbackReason,
            userNotice:
              "Demo availability mode: AI output was degraded, so a deterministic strategy template was returned.",
            requestId,
          });
        }
        logger.warn("generation.demo_fallback_invalid", {
          failureKind: result.failureKind,
          degradeReason: demoFallbackReason,
          warnings: fallbackValidation.warnings,
        });
      }

      const status =
        result.statusCode ??
        (result.failureKind === "request_aborted"
          ? 499
          : result.failureKind === 'timeout'
            ? 504
            : result.failureKind === 'rate_limit'
              ? 429
              : result.failureKind === 'configuration'
                ? 502
                : result.failureKind === 'parse'
                  ? 422
                  : 502);
      logger.warn('generation.failed', {
        error: result.error,
        failureKind: result.failureKind,
        status,
        latencyMs: result.latencyMs,
      });
      return NextResponse.json<StrategyGenerationResponse>(
        {
          success: false,
          error: result.error || 'Failed to generate strategy. Please try again.',
          rawResponse: result.rawResponse,
          latencyMs: result.latencyMs,
          requestId,
        },
        { status }
      );
    }

    logger.info('generation.completed', {
      nodeCount: result.strategy?.nodes.length || 0,
      edgeCount: result.strategy?.edges.length || 0,
      latencyMs: result.latencyMs,
      providerUsed: result.providerUsed,
    });

    const validation = validateGeneratedStrategy(result.strategy);
    if (!validation.minimumViable) {
      logger.warn("generation.invalid_minimum_viable", {
        warnings: validation.warnings,
      });
      return NextResponse.json<StrategyGenerationResponse>(
        {
          success: false,
          error: "Generated strategy graph is invalid for execution.",
          latencyMs: result.latencyMs,
          validation,
          requestId,
        },
        { status: 422 }
      );
    }

    return NextResponse.json<StrategyGenerationResponse>({
      success: true,
      strategy: result.strategy,
      latencyMs: result.latencyMs,
      providerUsed: result.providerUsed,
      schemaApplied: result.schemaApplied ?? false,
      responseFormatFallbackUsed: result.responseFormatFallbackUsed ?? false,
      validation,
      generationMode: "llm",
      degraded: false,
      requestId,
    });
  } catch (error) {
    logger.error('request.exception', {
      ...toErrorMeta(error),
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json<StrategyGenerationResponse>(
      {
        success: false,
        error: 'An unexpected error occurred. Please try again.',
        requestId,
      },
      { status: 500 }
    );
  }
}

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `strategy-req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isDemoAvailabilityModeEnabled(): boolean {
  return parseBooleanFlag(process.env.ASSISTANT_DEMO_AVAILABILITY_MODE, false);
}

function parseBooleanFlag(raw: string | undefined, fallback: boolean): boolean {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") return false;
  return fallback;
}

function mapFailureKindToTemplateFallbackReason(
  failureKind: "parse" | "timeout" | "request_aborted" | "rate_limit" | "network" | "upstream" | "configuration" | undefined
): StrategyTemplateFallbackReason | null {
  if (!failureKind) return "upstream";
  if (failureKind === "request_aborted") return null;
  if (failureKind === "configuration") return "schema_unavailable";
  if (failureKind === "parse") return "parse";
  if (failureKind === "timeout") return "timeout";
  if (failureKind === "network") return "network";
  if (failureKind === "rate_limit") return "rate_limit";
  return "upstream";
}

function validateGeneratedStrategy(strategy: GeneratedStrategy | undefined): {
  minimumViable: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  if (!strategy) {
    return {
      minimumViable: false,
      warnings: ["strategy_missing"],
    };
  }

  const nodes = Array.isArray(strategy.nodes) ? strategy.nodes : [];
  const edges = Array.isArray(strategy.edges) ? strategy.edges : [];

  if (nodes.length < 2) warnings.push("strategy_requires_at_least_two_nodes");
  if (edges.length < 1) warnings.push("strategy_requires_at_least_one_edge");

  const nodeIds = new Set(nodes.map((node) => node.id));
  const dataSourceIds = nodes.filter((node) => node.type === "dataSource").map((node) => node.id);
  const outputIds = nodes.filter((node) => node.type === "output").map((node) => node.id);

  if (dataSourceIds.length === 0) warnings.push("strategy_requires_data_source_node");
  if (outputIds.length === 0) warnings.push("strategy_requires_output_node");

  const adjacency = new Map<string, Set<string>>();
  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, new Set<string>());
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      warnings.push("strategy_contains_edge_with_missing_nodes");
      continue;
    }
    if (edge.source === edge.target) {
      warnings.push("strategy_contains_self_loop_edge");
      continue;
    }
    const targets = adjacency.get(edge.source);
    if (targets) {
      targets.add(edge.target);
    }
  }

  if (dataSourceIds.length > 0 && outputIds.length > 0) {
    const visited = new Set<string>();
    const queue: string[] = [...dataSourceIds];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (visited.has(current)) continue;
      visited.add(current);
      const next = adjacency.get(current);
      if (!next) continue;
      for (const target of next) {
        if (!visited.has(target)) queue.push(target);
      }
    }
    if (!outputIds.some((outputId) => visited.has(outputId))) {
      warnings.push("strategy_output_not_reachable_from_data_source");
    }
  }

  return {
    minimumViable: warnings.length === 0,
    warnings,
  };
}
