import { NextRequest, NextResponse } from 'next/server';
import {
  generateStrategyFromPrompt,
  type GeneratedStrategy,
} from '@/lib/ai/strategy-generator';
import { sanitizeGeneratedStrategyForBuilder } from '@/lib/ai/strategy-builder-adapter';
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from '@/lib/rateLimit';
import { createLogger, toErrorMeta } from '@/lib/logger';

const strategyApiLogger = createLogger('api.ai.generate-strategy');

// Rate limit: 10 strategy generations per minute per client
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 60 * 1000;

const MAX_PROMPT_LENGTH = 2000;
const parsedParseRepairRetries = Number.parseInt(process.env.STRATEGY_PARSE_REPAIR_RETRIES ?? '2', 10);
const PARSE_REPAIR_RETRIES = Number.isFinite(parsedParseRepairRetries)
  ? Math.max(0, parsedParseRepairRetries)
  : 2;
const parsedRequestTimeoutMs = Number.parseInt(process.env.STRATEGY_GENERATE_TIMEOUT_MS ?? "45000", 10);
const REQUEST_TIMEOUT_MS = Number.isFinite(parsedRequestTimeoutMs)
  ? Math.max(5_000, parsedRequestTimeoutMs)
  : 45_000;

interface StrategyGenerationResponse {
  success: boolean;
  strategy?: GeneratedStrategy;
  rawResponse?: string;
  error?: string;
  latencyMs?: number;
  providerUsed?: string;
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
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMIT, RATE_LIMIT_WINDOW);

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
      parseRepairRetries: Math.max(0, PARSE_REPAIR_RETRIES),
    });

    if (!result.success) {
      const errorMessage = result.error || 'Failed to generate strategy. Please try again.';
      const status =
        result.statusCode ??
        (result.failureKind === "parse"
          ? 422
          : result.failureKind === "timeout"
            ? 504
            : result.failureKind === "rate_limit"
              ? 429
              : result.failureKind === "configuration"
                ? 500
                : 502);
      logger.warn('generation.failed', {
        error: errorMessage,
        latencyMs: result.latencyMs,
        status,
        failureKind: result.failureKind,
      });
      return NextResponse.json<StrategyGenerationResponse>(
        {
          success: false,
          error: errorMessage,
          rawResponse: result.rawResponse,
          latencyMs: result.latencyMs,
          requestId,
        },
        { status }
      );
    }

    if (!result.strategy) {
      logger.warn('generation.empty_strategy', {
        latencyMs: result.latencyMs,
      });
      return NextResponse.json<StrategyGenerationResponse>(
        {
          success: false,
          error: 'Strategy generation returned empty payload.',
          requestId,
        },
        { status: 500 }
      );
    }

    const sanitized = sanitizeGeneratedStrategyForBuilder(result.strategy);

    logger.info('generation.completed', {
      nodeCount: result.strategy?.nodes.length || 0,
      edgeCount: result.strategy?.edges.length || 0,
      latencyMs: result.latencyMs,
      providerUsed: result.providerUsed,
      warningCount: sanitized.warnings.length,
    });

    return NextResponse.json<StrategyGenerationResponse>({
      success: true,
      strategy: sanitized.strategy,
      latencyMs: result.latencyMs,
      providerUsed: result.providerUsed,
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
