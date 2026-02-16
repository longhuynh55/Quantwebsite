type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

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

export async function generateWithProviderFallback(messages: LlmMessage[]): Promise<AssistantGenerateResult> {
  const startedAt = Date.now();
  const providers = getProviderChain();
  if (providers.length === 0) {
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
    const result = await callProviderWithRetry(provider, messages);
    if (result.success) {
      return {
        success: true,
        text: result.text,
        providerUsed: provider.name,
        fallbackUsed: index > 0,
        latencyMs: Date.now() - startedAt,
      };
    }

    errors.push({
      provider: provider.name,
      kind: result.kind,
      status: result.status,
      details: result.details,
    });
  }

  const finalKind = pickFinalFailureKind(errors);
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
    providers.push({
      source: 'openrouter',
      name: process.env.OPENROUTER_PROVIDER_NAME?.trim() || 'openrouter',
      baseUrl: process.env.OPENROUTER_BASE_URL?.trim() || 'https://openrouter.ai/api/v1',
      model: process.env.OPENROUTER_MODEL?.trim() || 'openai/gpt-oss-120b:free',
      apiKey: openRouterKey,
      extraHeaders: buildOpenRouterHeaders(),
      timeoutMs: parsePositiveInt(process.env.OPENROUTER_TIMEOUT_MS, timeoutMs),
      maxRetries: parsePositiveInt(process.env.OPENROUTER_MAX_RETRIES, Math.max(1, maxRetries - 1)),
      maxTokens: parsePositiveInt(process.env.OPENROUTER_MAX_TOKENS, maxTokens),
      retryBaseDelayMs: parsePositiveInt(process.env.OPENROUTER_RETRY_BASE_DELAY_MS, retryBaseDelayMs),
    });
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

async function callProviderWithRetry(provider: ProviderConfig, messages: LlmMessage[]): Promise<ProviderCallResult> {
  let lastFailure: ProviderFailure = {
    success: false,
    kind: 'upstream',
    details: 'Unknown provider error',
    attempts: 0,
  };

  for (let attempt = 0; attempt <= provider.maxRetries; attempt += 1) {
    const result = await callProviderOnce(provider, messages, attempt + 1);
    if (result.success) {
      return result;
    }

    lastFailure = result;
    const shouldRetry = attempt < provider.maxRetries && isRetryableFailure(result);
    if (!shouldRetry) {
      return result;
    }

    const delayMs = computeRetryDelayMs(attempt, provider.retryBaseDelayMs, result.retryAfterMs);
    await sleep(delayMs);
  }

  return lastFailure;
}

async function callProviderOnce(
  provider: ProviderConfig,
  messages: LlmMessage[],
  attempts: number
): Promise<ProviderCallResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), provider.timeoutMs);
  try {
    const response = await fetch(`${trimTrailingSlash(provider.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
        ...(provider.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        max_tokens: provider.maxTokens,
        temperature: 0.4,
        top_p: 0.9,
      }),
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
        details: errorText,
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
      details: error instanceof Error ? error.message : String(error),
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
    headers['HTTP-Referer'] = referer;
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
