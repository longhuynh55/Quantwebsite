import { createLogger, hashText, type AppLogger } from '@/lib/logger';

type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmJsonSchemaResponseFormat {
  type: 'json_schema';
  json_schema: {
    name: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
}

export interface LlmJsonObjectResponseFormat {
  type: 'json_object';
}

export type LlmResponseFormat = LlmJsonSchemaResponseFormat | LlmJsonObjectResponseFormat;

type ProviderFailureKind = 'timeout' | 'rate_limit' | 'network' | 'upstream' | 'configuration';

interface ProviderConfig {
  source: 'openrouter' | 'glm' | 'fallback';
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  extraHeaders?: Record<string, string>;
  timeoutMs: number;
  maxRetries: number;
  maxTokens: number;
  retryBaseDelayMs: number;
}

interface ProviderSuccess {
  success: true;
  text: string;
  attempts: number;
}

interface ProviderFailure {
  success: false;
  kind: ProviderFailureKind;
  status?: number;
  details?: string;
  retryAfterMs?: number;
  attempts: number;
}

type ProviderCallResult = ProviderSuccess | ProviderFailure;

interface ProviderErrorInfo {
  provider: string;
  kind: ProviderFailureKind;
  status?: number;
  details?: string;
}

export interface AssistantGenerateSuccess {
  success: true;
  text: string;
  providerUsed: string;
  fallbackUsed: boolean;
  latencyMs: number;
}

export interface AssistantGenerateFailure {
  success: false;
  kind: ProviderFailureKind;
  statusCode: number;
  message: string;
  latencyMs: number;
  providerErrors: ProviderErrorInfo[];
}

export type AssistantGenerateResult = AssistantGenerateSuccess | AssistantGenerateFailure;

const providersLogger = createLogger('assistant.providers');

export async function generateWithProviderFallback(
  messages: LlmMessage[],
  options: { requestId?: string; responseFormat?: LlmResponseFormat } = {}
): Promise<AssistantGenerateResult> {
  const startedAt = Date.now();
  const logger = providersLogger.child({ requestId: options.requestId ?? '' });
  const providers = getProviderChain();
  logger.debug('chain.started', {
    providerCount: providers.length,
    providerNames: providers.map((provider) => provider.name),
    providerSources: providers.map((provider) => provider.source),
    messageCount: messages.length,
    promptDigest: hashText(messages.map((msg) => `${msg.role}:${msg.content}`).join('\n')),
  });
  if (providers.length === 0) {
    logger.error('chain.configuration_missing', {
      providerCount: 0,
    });
    return {
      success: false,
      kind: 'configuration',
      statusCode: 500,
      message: 'AI service is not configured. Please contact support.',
      latencyMs: Date.now() - startedAt,
      providerErrors: [{ provider: 'none', kind: 'configuration', details: 'No provider configuration found' }],
    };
  }

  const errors: ProviderErrorInfo[] = [];
  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    const providerStartedAt = Date.now();
    const result = await callProviderWithRetry(provider, messages, logger, options.responseFormat);
    if (result.success) {
      logger.info('provider.success', {
        provider: provider.name,
        source: provider.source,
        model: provider.model,
        attempts: result.attempts,
        fallbackUsed: index > 0,
        latencyMs: Date.now() - providerStartedAt,
        outputChars: result.text.length,
        outputDigest: hashText(result.text),
      });
      return {
        success: true,
        text: result.text,
        providerUsed: provider.name,
        fallbackUsed: index > 0,
        latencyMs: Date.now() - startedAt,
      };
    }

    logger.warn('provider.failed', {
      provider: provider.name,
      source: provider.source,
      model: provider.model,
      kind: result.kind,
      status: result.status,
      attempts: result.attempts,
      latencyMs: Date.now() - providerStartedAt,
    });
    errors.push({
      provider: provider.name,
      kind: result.kind,
      status: result.status,
      details: result.details,
    });
  }

  const finalKind = pickFinalFailureKind(errors);
  logger.error('chain.failed', {
    kind: finalKind,
    providersTried: providers.length,
    latencyMs: Date.now() - startedAt,
  });
  return {
    success: false,
    kind: finalKind,
    statusCode: mapFailureKindToStatusCode(finalKind),
    message: mapFailureKindToMessage(finalKind),
    latencyMs: Date.now() - startedAt,
    providerErrors: errors,
  };
}

function getProviderChain(): ProviderConfig[] {
  const timeoutMs = parsePositiveInt(process.env.GLM_REQUEST_TIMEOUT_MS, 30_000);
  const maxRetries = parsePositiveInt(process.env.GLM_MAX_RETRIES, 2);
  const maxTokens = parsePositiveInt(process.env.GLM_MAX_TOKENS, 1024);
  const retryBaseDelayMs = parsePositiveInt(process.env.GLM_RETRY_BASE_DELAY_MS, 700);

  const providers: ProviderConfig[] = [];

  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    const openRouterBaseUrl = process.env.OPENROUTER_BASE_URL?.trim() || 'https://openrouter.ai/api/v1';
    const openRouterPrimaryName = process.env.OPENROUTER_PROVIDER_NAME?.trim() || 'openrouter';
    const openRouterPrimaryModel = process.env.OPENROUTER_MODEL?.trim() || 'openai/gpt-oss-120b:free';
    const openRouterPrimaryTimeout = parsePositiveInt(process.env.OPENROUTER_TIMEOUT_MS, timeoutMs);
    const openRouterPrimaryRetries = parsePositiveInt(process.env.OPENROUTER_MAX_RETRIES, Math.max(1, maxRetries - 1));
    const openRouterPrimaryMaxTokens = parsePositiveInt(process.env.OPENROUTER_MAX_TOKENS, maxTokens);
    const openRouterPrimaryRetryBaseDelay = parsePositiveInt(
      process.env.OPENROUTER_RETRY_BASE_DELAY_MS,
      retryBaseDelayMs
    );

    providers.push({
      source: 'openrouter',
      name: openRouterPrimaryName,
      baseUrl: openRouterBaseUrl,
      model: openRouterPrimaryModel,
      apiKey: openRouterKey,
      extraHeaders: buildOpenRouterHeaders(),
      timeoutMs: openRouterPrimaryTimeout,
      maxRetries: openRouterPrimaryRetries,
      maxTokens: openRouterPrimaryMaxTokens,
      retryBaseDelayMs: openRouterPrimaryRetryBaseDelay,
    });

    const openRouterSecondaryModel = process.env.OPENROUTER_SECONDARY_MODEL?.trim() || 'openai/gpt-oss-120b';
    if (openRouterSecondaryModel && openRouterSecondaryModel !== openRouterPrimaryModel) {
      providers.push({
        source: 'openrouter',
        name: process.env.OPENROUTER_SECONDARY_PROVIDER_NAME?.trim() || `${openRouterPrimaryName}-secondary`,
        baseUrl: openRouterBaseUrl,
        model: openRouterSecondaryModel,
        apiKey: openRouterKey,
        extraHeaders: buildOpenRouterHeaders(),
        timeoutMs: parsePositiveInt(process.env.OPENROUTER_SECONDARY_TIMEOUT_MS, openRouterPrimaryTimeout),
        maxRetries: parsePositiveInt(process.env.OPENROUTER_SECONDARY_MAX_RETRIES, openRouterPrimaryRetries),
        maxTokens: parsePositiveInt(process.env.OPENROUTER_SECONDARY_MAX_TOKENS, openRouterPrimaryMaxTokens),
        retryBaseDelayMs: parsePositiveInt(
          process.env.OPENROUTER_SECONDARY_RETRY_BASE_DELAY_MS,
          openRouterPrimaryRetryBaseDelay
        ),
      });
    }

    const openRouterTertiaryModel =
      process.env.OPENROUTER_TERTIARY_MODEL?.trim() || 'openai/gpt-oss-20b:free';
    if (
      openRouterTertiaryModel &&
      openRouterTertiaryModel !== openRouterPrimaryModel &&
      openRouterTertiaryModel !== openRouterSecondaryModel
    ) {
      providers.push({
        source: 'openrouter',
        name: process.env.OPENROUTER_TERTIARY_PROVIDER_NAME?.trim() || `${openRouterPrimaryName}-tertiary`,
        baseUrl: openRouterBaseUrl,
        model: openRouterTertiaryModel,
        apiKey: openRouterKey,
        extraHeaders: buildOpenRouterHeaders(),
        timeoutMs: parsePositiveInt(process.env.OPENROUTER_TERTIARY_TIMEOUT_MS, openRouterPrimaryTimeout),
        maxRetries: parsePositiveInt(process.env.OPENROUTER_TERTIARY_MAX_RETRIES, openRouterPrimaryRetries),
        maxTokens: parsePositiveInt(process.env.OPENROUTER_TERTIARY_MAX_TOKENS, openRouterPrimaryMaxTokens),
        retryBaseDelayMs: parsePositiveInt(
          process.env.OPENROUTER_TERTIARY_RETRY_BASE_DELAY_MS,
          openRouterPrimaryRetryBaseDelay
        ),
      });
    }
  }

  const forceOpenRouterOnly = String(process.env.ASSISTANT_OPENROUTER_ONLY ?? '').trim().toLowerCase();
  if (forceOpenRouterOnly === '1' || forceOpenRouterOnly === 'true' || forceOpenRouterOnly === 'yes') {
    return sortProvidersByPriority(providers);
  }

  const primaryKey = process.env.GLM_API_KEY?.trim();
  if (primaryKey) {
    providers.push({
      source: 'glm',
      name: process.env.GLM_PROVIDER_NAME?.trim() || 'glm-primary',
      baseUrl: process.env.GLM_BASE_URL?.trim() || 'https://api.z.ai/api/coding/paas/v4',
      model: process.env.GLM_MODEL?.trim() || 'glm-4.7-flash',
      apiKey: primaryKey,
      timeoutMs,
      maxRetries,
      maxTokens,
      retryBaseDelayMs,
    });
  }

  const fallbackKey = process.env.GLM_FALLBACK_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (fallbackKey) {
    providers.push({
      source: 'fallback',
      name: process.env.GLM_FALLBACK_PROVIDER_NAME?.trim() || process.env.OPENAI_PROVIDER_NAME?.trim() || 'fallback',
      baseUrl:
        process.env.GLM_FALLBACK_BASE_URL?.trim() ||
        process.env.OPENAI_BASE_URL?.trim() ||
        'https://api.openai.com/v1',
      model:
        process.env.GLM_FALLBACK_MODEL?.trim() ||
        process.env.OPENAI_MODEL?.trim() ||
        'gpt-4o-mini',
      apiKey: fallbackKey,
      timeoutMs: parsePositiveInt(process.env.GLM_FALLBACK_TIMEOUT_MS, timeoutMs),
      maxRetries: parsePositiveInt(process.env.GLM_FALLBACK_MAX_RETRIES, Math.max(1, maxRetries - 1)),
      maxTokens: parsePositiveInt(process.env.GLM_FALLBACK_MAX_TOKENS, maxTokens),
      retryBaseDelayMs: parsePositiveInt(process.env.GLM_FALLBACK_RETRY_BASE_DELAY_MS, retryBaseDelayMs),
    });
  }

  return sortProvidersByPriority(providers);
}

async function callProviderWithRetry(
  provider: ProviderConfig,
  messages: LlmMessage[],
  logger: AppLogger,
  responseFormat?: LlmResponseFormat
): Promise<ProviderCallResult> {
  let lastFailure: ProviderFailure = {
    success: false,
    kind: 'upstream',
    details: 'Unknown provider error',
    attempts: 0,
  };

  for (let attempt = 0; attempt <= provider.maxRetries; attempt += 1) {
    const result = await callProviderOnce(provider, messages, attempt + 1, responseFormat);
    if (result.success) {
      return result;
    }

    lastFailure = result;

    if (responseFormat && result.kind === 'upstream' && result.status === 400) {
      logger.warn('provider.response_format_fallback', {
        provider: provider.name,
        source: provider.source,
        model: provider.model,
        attempt: attempt + 1,
      });

      const fallbackResult = await callProviderOnce(provider, messages, attempt + 1, undefined);
      if (fallbackResult.success) {
        return fallbackResult;
      }
      lastFailure = fallbackResult;
    }

    const shouldRetry = attempt < provider.maxRetries && isRetryableFailure(lastFailure);
    if (!shouldRetry) {
      return lastFailure;
    }

    const delayMs = computeRetryDelayMs(attempt, provider.retryBaseDelayMs, lastFailure.retryAfterMs);
    logger.info('provider.retry_scheduled', {
      provider: provider.name,
      source: provider.source,
      model: provider.model,
      attempt: attempt + 1,
      nextAttempt: attempt + 2,
      maxAttempts: provider.maxRetries + 1,
      kind: lastFailure.kind,
      status: lastFailure.status,
      delayMs,
    });
    await sleep(delayMs);
  }

  return lastFailure;
}

async function callProviderOnce(
  provider: ProviderConfig,
  messages: LlmMessage[],
  attempts: number,
  responseFormat?: LlmResponseFormat
): Promise<ProviderCallResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), provider.timeoutMs);
  try {
    const requestPayload: Record<string, unknown> = {
      model: provider.model,
      messages,
      max_tokens: provider.maxTokens,
      temperature: 0.4,
      top_p: 0.9,
    };
    if (shouldAttachResponseFormat(provider, responseFormat)) {
      requestPayload.response_format = responseFormat;
    }

    const response = await fetch(`${trimTrailingSlash(provider.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
        ...(provider.extraHeaders ?? {}),
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const retryAfterMs = parseRetryAfterHeaderMs(response.headers.get('retry-after'));
      const kind: ProviderFailureKind = response.status === 429 ? 'rate_limit' : 'upstream';
      return {
        success: false,
        kind,
        status: response.status,
        details: summarizeProviderHttpError(response.status, errorText),
        retryAfterMs,
        attempts,
      };
    }

    const data = (await response.json()) as ProviderCompletionResponse;
    const text = extractMessageContent(data);
    if (!text) {
      return {
        success: false,
        kind: 'upstream',
        status: 502,
        details: 'Provider returned empty completion content',
        attempts,
      };
    }

    return {
      success: true,
      text,
      attempts,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        kind: 'timeout',
        attempts,
      };
    }
    return {
      success: false,
      kind: 'network',
      details: summarizeProviderNetworkError(error),
      attempts,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

interface ProviderCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

function extractMessageContent(data: ProviderCompletionResponse): string {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }
  if (Array.isArray(content)) {
    const text = content
      .map((item) => (typeof item.text === 'string' ? item.text : ''))
      .join(' ')
      .trim();
    return text;
  }
  return '';
}

function isRetryableFailure(failure: ProviderFailure): boolean {
  if (failure.kind === 'timeout' || failure.kind === 'network' || failure.kind === 'rate_limit') {
    return true;
  }
  return typeof failure.status === 'number' && failure.status >= 500;
}

function computeRetryDelayMs(attempt: number, baseDelayMs: number, retryAfterMs?: number): number {
  if (typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(retryAfterMs, 10_000);
  }
  const jitter = Math.floor(Math.random() * baseDelayMs * 0.5);
  return Math.min(baseDelayMs * 2 ** attempt + jitter, 8_000);
}

function parseRetryAfterHeaderMs(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.floor(seconds * 1000);
  }
  return undefined;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function shouldAttachResponseFormat(
  provider: ProviderConfig,
  responseFormat: LlmResponseFormat | undefined
): boolean {
  if (!responseFormat) return false;
  const raw = String(process.env.ASSISTANT_ENABLE_JSON_SCHEMA_MODE ?? '').trim().toLowerCase();
  const enabled = raw === '' || raw === '1' || raw === 'true' || raw === 'yes';
  if (!enabled) return false;
  return provider.source === 'openrouter' || provider.source === 'fallback';
}

function sortProvidersByPriority(providers: ProviderConfig[]): ProviderConfig[] {
  const rawPriority = process.env.ASSISTANT_PROVIDER_PRIORITY?.trim().toLowerCase();
  const priority = (rawPriority || 'openrouter,glm,fallback')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const orderMap = new Map<string, number>();
  priority.forEach((item, index) => {
    orderMap.set(item, index);
  });

  return [...providers].sort((a, b) => {
    const ai = orderMap.has(a.source) ? Number(orderMap.get(a.source)) : Number.MAX_SAFE_INTEGER;
    const bi = orderMap.has(b.source) ? Number(orderMap.get(b.source)) : Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return 0;
  });
}

function buildOpenRouterHeaders(): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim() || process.env.OPENROUTER_SITE_URL?.trim();
  const title = process.env.OPENROUTER_X_TITLE?.trim() || process.env.OPENROUTER_APP_NAME?.trim();

  if (referer) {
    headers['Referer'] = referer;
  }
  if (title) {
    headers['X-Title'] = title;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

function mapFailureKindToStatusCode(kind: ProviderFailureKind): number {
  if (kind === 'rate_limit') return 429;
  if (kind === 'timeout') return 504;
  if (kind === 'configuration') return 500;
  return 502;
}

function mapFailureKindToMessage(kind: ProviderFailureKind): string {
  if (kind === 'rate_limit') return 'AI service is rate-limited. Please wait a bit and try again.';
  if (kind === 'timeout') return 'AI service timed out. Please try again.';
  if (kind === 'configuration') return 'AI service is not configured. Please contact support.';
  return 'AI service is temporarily unavailable. Please try again.';
}

function pickFinalFailureKind(errors: ProviderErrorInfo[]): ProviderFailureKind {
  const kinds = new Set(errors.map((error) => error.kind));
  if (kinds.has('rate_limit')) return 'rate_limit';
  if (kinds.has('timeout')) return 'timeout';
  if (kinds.has('network')) return 'network';
  if (kinds.has('configuration')) return 'configuration';
  return 'upstream';
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeProviderHttpError(status: number, rawBody: string): string {
  const trimmed = String(rawBody ?? "").trim();
  if (!trimmed) return `http_${status}`;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const rootError = parsed.error;
    if (rootError && typeof rootError === "object" && !Array.isArray(rootError)) {
      const errorRecord = rootError as Record<string, unknown>;
      const code = normalizeProviderCode(errorRecord.code);
      const type = normalizeProviderCode(errorRecord.type);
      const message = normalizeProviderCode(errorRecord.message);
      const suffix = [code, type, message].filter(Boolean).join(":");
      if (suffix) return `http_${status}:${suffix}`;
    }

    const code = normalizeProviderCode(parsed.code);
    const type = normalizeProviderCode(parsed.type);
    const message = normalizeProviderCode(parsed.message);
    const suffix = [code, type, message].filter(Boolean).join(":");
    if (suffix) return `http_${status}:${suffix}`;
  } catch {
    // Ignore parse failures and fall back to digest-style summary.
  }

  return `http_${status}:body_hash=${hashText(trimmed)}`;
}

function summarizeProviderNetworkError(error: unknown): string {
  if (error instanceof Error) {
    const normalizedMessage = normalizeProviderCode(error.message);
    if (normalizedMessage) return `network:${normalizedMessage}`;
    return `network:error_hash=${hashText(error.name)}`;
  }
  const raw = String(error ?? "");
  const normalized = normalizeProviderCode(raw);
  if (normalized) return `network:${normalized}`;
  return `network:error_hash=${hashText(raw)}`;
}

function normalizeProviderCode(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9:_-]+/g, "")
    .slice(0, 80)
    .toLowerCase();
}
