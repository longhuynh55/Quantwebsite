import { NextRequest, NextResponse } from 'next/server';
import {
  generateStrategyFromPrompt,
  type GeneratedStrategy,
} from '@/lib/ai/strategy-generator';
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from '@/lib/rateLimit';
import { createLogger, toErrorMeta } from '@/lib/logger';

const strategyApiLogger = createLogger('api.ai.generate-strategy');

// Rate limit: 10 strategy generations per minute per client
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 60 * 1000;

const MAX_PROMPT_LENGTH = 2000;

interface StrategyGenerationRequest {
  prompt: string;
  requestId?: string;
}

interface StrategyGenerationResponse {
  success: boolean;
  strategy?: GeneratedStrategy;
  rawResponse?: string;
  error?: string;
  latencyMs?: number;
  providerUsed?: string;
  requestId?: string;
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
    let body: StrategyGenerationRequest;
    try {
      body = await request.json() as StrategyGenerationRequest;
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

    // Validate prompt
    const prompt = (body.prompt || '').trim();
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
      clientRequestId: body.requestId || null,
    });

    // Generate strategy
    const result = await generateStrategyFromPrompt(prompt, {
      requestId: body.requestId || requestId,
    });

    if (!result.success) {
      logger.warn('generation.failed', {
        error: result.error,
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
        { status: 500 }
      );
    }

    logger.info('generation.completed', {
      nodeCount: result.strategy?.nodes.length || 0,
      edgeCount: result.strategy?.edges.length || 0,
      latencyMs: result.latencyMs,
      providerUsed: result.providerUsed,
    });

    return NextResponse.json<StrategyGenerationResponse>({
      success: true,
      strategy: result.strategy,
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
