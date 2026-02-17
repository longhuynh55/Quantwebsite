import { NextRequest, NextResponse } from 'next/server';
import type {
  AssistantCitation,
  AssistantContextSnapshot,
  AssistantPreferences,
  AssistantRequest,
  AssistantResponse,
  AssistantToolUsage,
} from '@/types/assistant';
import { SYSTEM_PROMPT } from '@/types/assistant';
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from '@/lib/rateLimit';
import { generateWithProviderFallback, type LlmMessage } from '@/lib/assistant/providers';
import { runGroundingTools } from '@/lib/assistant/tools';
import { evaluateAssistantPolicy } from '@/lib/assistant/policy';

const MAX_TEXT_LENGTH = 4_000;
const MAX_HISTORY_ITEMS = 10;
const MAX_RESPONSE_CITATIONS = 12;
const DEFAULT_DEV_TOOL_BASE_URL = 'http://127.0.0.1:3000';
const TRUSTED_TOOL_BASE_URL_ENV_KEYS = [
  'ASSISTANT_TOOL_BASE_URL',
  'INTERNAL_API_BASE_URL',
  'APP_BASE_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_APP_URL',
] as const;
const EVAL_MODE_HEADER = 'x-assistant-eval';
const EVAL_TOKEN_HEADER = 'x-assistant-eval-token';

// Rate limit: 30 requests per minute per client
const RATE_LIMIT = 30;
const RATE_LIMIT_WINDOW = 60 * 1000;
const EVAL_RATE_LIMIT = resolveEvalRateLimit();

export async function POST(request: NextRequest) {
  try {
    const isEvalRequest = isAuthorizedEvalRequest(request);
    const rateLimitScope = isEvalRequest ? 'assistant_eval' : 'assistant';
    const rateLimitLimit = isEvalRequest ? EVAL_RATE_LIMIT : RATE_LIMIT;
    const clientId = getClientIdentifier(request);
    const rateLimitKey = createRateLimitKey(rateLimitScope, clientId);
    const rateLimitResult = checkRateLimit(rateLimitKey, rateLimitLimit, RATE_LIMIT_WINDOW);

    if (!rateLimitResult.allowed) {
      return NextResponse.json<AssistantResponse>(
        {
          message: '',
          success: false,
          error: 'Too many requests. Please wait a moment and try again.',
        },
        { status: 429 }
      );
    }

    const toolBaseResolution = resolveTrustedToolBaseUrl();
    const metaBase = {
      requestId: '',
      groundingMode: toolBaseResolution.baseUrl ? ('enabled' as const) : ('disabled' as const),
      toolBaseUrlSource: toolBaseResolution.source,
    };

    const body = (await request.json()) as Partial<AssistantRequest>;
    const message = normalizeText(body.message, MAX_TEXT_LENGTH);
    const conversationHistory = sanitizeConversationHistory(body.conversationHistory);
    const contextSnapshot = sanitizeContextSnapshot(body.contextSnapshot ?? legacyContextToSnapshot(body.context));
    const preferences = sanitizePreferences(body.preferences);
    const requestId = normalizeText(body.requestId, 80) || createRequestId();
    metaBase.requestId = requestId;

    if (!message) {
      return NextResponse.json<AssistantResponse>(
        {
          message: '',
          success: false,
          error: 'Message is required.',
        },
        { status: 400 }
      );
    }

    const trustedToolBaseUrl = toolBaseResolution.baseUrl;
    const grounding = await runGroundingTools({
      baseUrl: trustedToolBaseUrl,
      message,
      contextSnapshot,
    });
    const responseCitations = selectResponseCitations(grounding.citations, MAX_RESPONSE_CITATIONS);

    const policy = evaluateAssistantPolicy({
      message,
      contextSnapshot,
      grounding,
    });

    if (policy.shadowBlocked) {
      console.warn('Assistant policy shadow-blocked response', {
        requestId,
        reasonCode: policy.reasonCode,
        reason: policy.reason,
      });
    }

    if (policy.shouldBypassLlm) {
      return NextResponse.json<AssistantResponse>({
        message: policy.responseMessage || 'INSUFFICIENT_DATA',
        success: true,
        grounded: grounding.citations.length > 0,
        policyStatus: policy.status,
        policyReason: policy.reason,
        dataConfidence: policy.dataConfidence,
        citations: responseCitations,
        usedTools: grounding.usedTools,
        messageBlocks: grounding.messageBlocks,
        meta: {
          providerUsed: 'policy',
          fallbackUsed: false,
          latencyMs: 0,
          ...metaBase,
          policyMode: policy.mode,
        },
      });
    }

    const llmMessages: LlmMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: buildStylePrompt(preferences) },
    ];

    const contextMessage = buildContextMessage(contextSnapshot);
    if (contextMessage) {
      llmMessages.push({ role: 'system', content: contextMessage });
    }

    if (grounding.facts.length > 0) {
      llmMessages.push({ role: 'system', content: buildGroundingPrompt(grounding.facts, grounding.usedTools) });
    }

    for (const historyItem of conversationHistory) {
      llmMessages.push({ role: historyItem.role, content: historyItem.content });
    }

    llmMessages.push({ role: 'user', content: message });

    const generation = await generateWithProviderFallback(llmMessages);
    if (!generation.success) {
      console.error('Assistant provider failure', {
        kind: generation.kind,
        providerErrors: generation.providerErrors,
      });
      if (grounding.facts.length > 0 || responseCitations.length > 0) {
        return NextResponse.json<AssistantResponse>({
          message: buildGroundedFallbackMessage(grounding.facts, grounding.usedTools),
          success: true,
          grounded: grounding.facts.length > 0,
          policyStatus: policy.status,
          policyReason: policy.reason,
          dataConfidence: policy.dataConfidence,
          citations: responseCitations,
          usedTools: grounding.usedTools,
          messageBlocks: grounding.messageBlocks,
          meta: {
            providerUsed: 'grounded-fallback',
            fallbackUsed: true,
            latencyMs: generation.latencyMs,
            ...metaBase,
            policyMode: policy.mode,
          },
        });
      }
      return NextResponse.json<AssistantResponse>(
        {
          message: '',
          success: false,
          error: generation.message,
          grounded: grounding.facts.length > 0,
          policyStatus: policy.status,
          policyReason: policy.reason,
          dataConfidence: policy.dataConfidence,
          citations: responseCitations,
          usedTools: grounding.usedTools,
          messageBlocks: grounding.messageBlocks,
          meta: {
            providerUsed: 'none',
            fallbackUsed: false,
            latencyMs: generation.latencyMs,
            ...metaBase,
            policyMode: policy.mode,
          },
        },
        { status: generation.statusCode }
      );
    }

    return NextResponse.json<AssistantResponse>({
      message: generation.text,
      success: true,
      grounded: grounding.citations.length > 0,
      policyStatus: policy.status,
      policyReason: policy.reason,
      dataConfidence: policy.dataConfidence,
      citations: responseCitations,
      usedTools: grounding.usedTools,
      messageBlocks: grounding.messageBlocks,
      meta: {
        providerUsed: generation.providerUsed,
        fallbackUsed: generation.fallbackUsed,
        latencyMs: generation.latencyMs,
        ...metaBase,
        policyMode: policy.mode,
      },
    });
  } catch (error) {
    console.error('Assistant API error:', error);
    return NextResponse.json<AssistantResponse>(
      {
        message: '',
        success: false,
        error: 'An unexpected error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}

type ConversationHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

function normalizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function sanitizeConversationHistory(raw: unknown): ConversationHistoryItem[] {
  if (!Array.isArray(raw)) return [];

  const items: ConversationHistoryItem[] = [];
  for (const entry of raw.slice(-MAX_HISTORY_ITEMS)) {
    if (!entry || typeof entry !== 'object') continue;

    const role = (entry as { role?: unknown }).role;
    if (role !== 'user' && role !== 'assistant') continue;

    const content = normalizeText((entry as { content?: unknown }).content, MAX_TEXT_LENGTH);
    if (!content) continue;

    items.push({ role, content });
  }
  return items;
}

function sanitizeContextSnapshot(raw: unknown): AssistantContextSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const source = raw as Record<string, unknown>;
  const page = typeof source.page === 'string' ? source.page : '';
  if (!isAllowedPage(page)) return undefined;

  const symbol = normalizeSymbol(source.symbol);
  const symbols = Array.isArray(source.symbols)
    ? source.symbols
        .filter((item): item is string => typeof item === 'string')
        .map(normalizeSymbol)
        .filter(Boolean)
        .slice(0, 30)
    : undefined;

  const timeframe = normalizeText(source.timeframe, 32) || undefined;
  const selectedIndicators = Array.isArray(source.selectedIndicators)
    ? source.selectedIndicators
        .filter((item): item is string => typeof item === 'string')
        .map((item) => normalizeText(item, 32))
        .filter(Boolean)
        .slice(0, 20)
    : undefined;

  const filters = isRecord(source.filters) ? source.filters : undefined;
  const lastApiPayload = isRecord(source.lastApiPayload) ? source.lastApiPayload : undefined;

  return {
    page,
    symbol: symbol || undefined,
    symbols,
    timeframe,
    selectedIndicators,
    filters,
    lastApiPayload,
  };
}

function sanitizePreferences(raw: unknown): AssistantPreferences {
  if (!raw || typeof raw !== 'object') {
    return { language: 'vi', detailLevel: 'normal' };
  }

  const source = raw as Record<string, unknown>;
  const language = source.language === 'en' ? 'en' : 'vi';

  let detailLevel: 'brief' | 'normal' | 'deep' = 'normal';
  if (source.detailLevel === 'brief' || source.detailLevel === 'normal' || source.detailLevel === 'deep') {
    detailLevel = source.detailLevel;
  }

  return { language, detailLevel };
}

function buildStylePrompt(preferences: AssistantPreferences): string {
  const languageInstruction =
    preferences.language === 'en'
      ? 'Respond primarily in English. Keep Vietnamese terms when they are market-specific.'
      : 'Respond primarily in Vietnamese. Keep common finance terms in English when needed.';

  const detailInstruction =
    preferences.detailLevel === 'brief'
      ? 'Keep answers concise (3-6 sentences) and practical.'
      : preferences.detailLevel === 'deep'
        ? 'Provide a deeper explanation with clear sections and short numeric interpretation.'
        : 'Provide balanced detail with concise structure.';

  return [
    languageInstruction,
    detailInstruction,
    'Do not provide buy/sell recommendations. Focus on analysis and education.',
    'If you do not have enough grounded data for a numeric claim, explicitly say so.',
    'Do not output numeric financial claims unless grounded facts and citations are available.',
  ].join(' ');
}

function buildGroundingPrompt(facts: string[], usedTools: AssistantToolUsage[]): string {
  const toolSummary = usedTools
    .map((tool) => {
      const params = tool.requestParams
        ? Object.entries(tool.requestParams)
            .filter(([, value]) => value !== undefined && value !== null && String(value).trim().length > 0)
            .slice(0, 5)
            .map(([key, value]) => `${key}=${String(value)}`)
            .join(",")
        : "";
      const paramSuffix = params ? `{${params}}` : "";
      return `${tool.name}:${tool.status}${paramSuffix}${tool.error ? `(${tool.error})` : ''}`;
    })
    .join(', ');

  return [
    'Grounded data below is fetched from internal QuantVN APIs.',
    'Use these facts for numeric claims. If a metric is missing, explicitly state insufficient data.',
    `Tool status: ${toolSummary || 'none'}`,
    `Facts:\n- ${facts.join('\n- ')}`,
  ].join('\n\n');
}

function buildGroundedFallbackMessage(facts: string[], usedTools: AssistantToolUsage[]): string {
  const successTools = usedTools.filter((tool) => tool.status === 'success').map((tool) => tool.name);
  const factLines = facts.slice(0, 6).map((fact) => `- ${fact}`);
  const header =
    'AI model đang quá tải hoặc timeout. Trả về dữ liệu đã được truy xuất trực tiếp từ hệ thống (grounded data):';
  const toolLine = `Nguồn tool thành công: ${successTools.length > 0 ? successTools.join(', ') : 'none'}.`;
  const guidance =
    'Bạn có thể hỏi lại chi tiết theo chỉ số + timeframe để mình trả lời ngắn gọn hơn (ví dụ: VCB net interest income 2025Q4).';
  return [header, toolLine, ...factLines, guidance].join('\n');
}

function buildContextMessage(contextSnapshot?: AssistantContextSnapshot): string | null {
  if (!contextSnapshot) return null;

  const parts: string[] = [`User is currently on page: ${contextSnapshot.page}.`];
  if (contextSnapshot.symbol) {
    parts.push(`Active symbol: ${contextSnapshot.symbol}.`);
  }
  if (contextSnapshot.symbols && contextSnapshot.symbols.length > 0) {
    parts.push(`Selected symbols: ${contextSnapshot.symbols.join(', ')}.`);
  }
  if (contextSnapshot.timeframe) {
    parts.push(`Active timeframe: ${contextSnapshot.timeframe}.`);
  }
  if (contextSnapshot.selectedIndicators && contextSnapshot.selectedIndicators.length > 0) {
    parts.push(`Selected indicators: ${contextSnapshot.selectedIndicators.join(', ')}.`);
  }

  return parts.join(' ');
}

function legacyContextToSnapshot(context: AssistantRequest['context']): AssistantContextSnapshot | undefined {
  if (!context) return undefined;

  if (context.page === 'charts') {
    return { page: 'charts', symbol: normalizeSymbol(context.symbol) || undefined };
  }
  if (context.page === 'portfolio') {
    return {
      page: 'portfolio',
      symbols: Array.isArray(context.symbols) ? context.symbols.map(normalizeSymbol).filter(Boolean) : undefined,
    };
  }
  if (context.page === 'screener') {
    return { page: 'screener', filters: context.filters };
  }
  if (context.page === 'backtesting') {
    return {
      page: 'backtesting',
      filters: context.strategy ? { strategy: context.strategy } : undefined,
    };
  }
  if (context.page === 'learn') {
    return {
      page: 'learn',
      filters: context.topic ? { topic: context.topic } : undefined,
    };
  }

  return { page: context.page };
}

function normalizeSymbol(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isAllowedPage(value: string): value is AssistantContextSnapshot['page'] {
  return (
    value === 'home' ||
    value === 'screener' ||
    value === 'charts' ||
    value === 'backtesting' ||
    value === 'portfolio' ||
    value === 'factors' ||
    value === 'risk' ||
    value === 'ml-lab' ||
    value === 'learn'
  );
}

function resolveTrustedToolBaseUrl(): { baseUrl?: string; source: string } {
  for (const key of TRUSTED_TOOL_BASE_URL_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (!value) continue;
    const normalized = normalizeBaseUrl(value);
    if (normalized) {
      return {
        baseUrl: normalized,
        source: `env:${key}`,
      };
    }

    console.warn('Ignoring invalid assistant tool base URL from env', { envKey: key });
  }

  if (process.env.NODE_ENV !== 'production') {
    const localhostDevBaseUrl = resolveDevLocalhostBaseUrl();
    return {
      baseUrl: localhostDevBaseUrl,
      source: 'dev-localhost',
    };
  }

  return {
    source: 'none',
  };
}

function normalizeBaseUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    if (parsed.username || parsed.password) return undefined;
    if (parsed.search || parsed.hash) return undefined;
    const normalizedPath = normalizeBasePath(parsed.pathname);
    if (normalizedPath === undefined) return undefined;
    return `${parsed.origin}${normalizedPath}`;
  } catch {
    return undefined;
  }
}

function normalizeBasePath(pathname: string): string | undefined {
  if (!pathname || pathname === '/') return '';
  if (!pathname.startsWith('/')) return undefined;

  const normalizedPath = pathname.replace(/\/{2,}/g, '/').replace(/\/+$/g, '');
  if (!normalizedPath || normalizedPath === '/') return '';

  const segments = normalizedPath.split('/').slice(1);
  for (const segment of segments) {
    if (!segment) continue;
    try {
      const decodedSegment = decodeURIComponent(segment);
      if (decodedSegment === '.' || decodedSegment === '..') return undefined;
      if (decodedSegment.includes('/') || decodedSegment.includes('\\')) return undefined;
    } catch {
      return undefined;
    }
  }

  return normalizedPath;
}

function resolveDevLocalhostBaseUrl(): string {
  const port = normalizePort(process.env.PORT);
  if (!port) return DEFAULT_DEV_TOOL_BASE_URL;
  return `http://127.0.0.1:${port}`;
}

function normalizePort(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65_535) {
    return undefined;
  }
  return String(parsed);
}

function isAuthorizedEvalRequest(request: NextRequest): boolean {
  const evalMarker = String(request.headers.get(EVAL_MODE_HEADER) ?? '').trim().toLowerCase();
  if (evalMarker !== 'true') return false;

  const configuredToken = String(process.env.ASSISTANT_EVAL_AUTH_TOKEN ?? '').trim();
  if (!configuredToken) {
    return process.env.NODE_ENV !== 'production';
  }

  const candidate = String(request.headers.get(EVAL_TOKEN_HEADER) ?? '').trim();
  return candidate.length > 0 && candidate === configuredToken;
}

function resolveEvalRateLimit(): number {
  const raw = String(process.env.ASSISTANT_EVAL_RATE_LIMIT_MAX ?? '').trim();
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 240;
  return Math.max(RATE_LIMIT, Math.min(parsed, 2_000));
}

function selectResponseCitations(citations: AssistantCitation[], limit: number): AssistantCitation[] {
  if (citations.length <= limit) return citations;

  const selected: AssistantCitation[] = [];
  const selectedKeys = new Set<string>();
  const seenEndpoints = new Set<string>();
  for (const citation of citations) {
    const key = citationKey(citation);
    if (selectedKeys.has(key)) continue;
    const endpoint = String(citation.endpoint ?? '').trim();
    if (!endpoint || seenEndpoints.has(endpoint)) continue;
    seenEndpoints.add(endpoint);
    selectedKeys.add(key);
    selected.push(citation);
    if (selected.length >= limit) return selected;
  }

  for (const citation of citations) {
    const key = citationKey(citation);
    if (selectedKeys.has(key)) continue;
    selectedKeys.add(key);
    selected.push(citation);
    if (selected.length >= limit) break;
  }
  return selected;
}

function citationKey(citation: AssistantCitation): string {
  return `${citation.id}|${citation.endpoint ?? ''}|${citation.symbol ?? ''}|${citation.period ?? ''}`;
}
