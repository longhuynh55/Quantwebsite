/** @jest-environment node */

import type { LlmResponseFormat } from '@/lib/assistant/providers';

const BASE_ENV = { ...process.env };

const RESPONSE_FORMAT: LlmResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'test_schema',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
      },
    },
  },
};

function resetProviderEnv(): void {
  process.env = { ...BASE_ENV };
  process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
  process.env.ASSISTANT_OPENROUTER_ONLY = 'true';
  process.env.OPENROUTER_MODEL = 'openai/gpt-oss-120b:free';
  process.env.OPENROUTER_SECONDARY_MODEL = '';
  process.env.OPENROUTER_TERTIARY_MODEL = '';
  process.env.ASSISTANT_PROVIDER_PRIORITY = 'openrouter';
}

function createSuccessResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }
  );
}

async function importProviders() {
  jest.resetModules();
  return import('@/lib/assistant/providers');
}

describe('assistant providers response_format behavior', () => {
  beforeEach(() => {
    resetProviderEnv();
  });

  afterEach(() => {
    process.env = { ...BASE_ENV };
    jest.restoreAllMocks();
  });

  it('does not attach response_format when schema mode env is unset', async () => {
    delete process.env.ASSISTANT_ENABLE_JSON_SCHEMA_MODE;

    const fetchMock = jest.fn().mockResolvedValue(createSuccessResponse('{"ok":true}'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { generateWithProviderFallback } = await importProviders();
    const result = await generateWithProviderFallback([{ role: 'user', content: 'test' }], {
      requestId: 'req-1',
      responseFormat: RESPONSE_FORMAT,
    });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body.response_format).toBeUndefined();
  });

  it('attaches response_format when schema mode env is enabled', async () => {
    process.env.ASSISTANT_ENABLE_JSON_SCHEMA_MODE = 'true';

    const fetchMock = jest.fn().mockResolvedValue(createSuccessResponse('{"ok":true}'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { generateWithProviderFallback } = await importProviders();
    const result = await generateWithProviderFallback([{ role: 'user', content: 'test' }], {
      requestId: 'req-2',
      responseFormat: RESPONSE_FORMAT,
    });

    expect(result.success).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body.response_format).toBeDefined();
  });

  it('falls back after 422 and caches unsupported schema capability', async () => {
    process.env.ASSISTANT_ENABLE_JSON_SCHEMA_MODE = 'true';

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'unsupported response_format' } }), {
          status: 422,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(createSuccessResponse('{"ok":true}'))
      .mockResolvedValueOnce(createSuccessResponse('{"ok":true}'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { generateWithProviderFallback } = await importProviders();

    const first = await generateWithProviderFallback([{ role: 'user', content: 'first' }], {
      requestId: 'req-3',
      responseFormat: RESPONSE_FORMAT,
    });
    expect(first.success).toBe(true);
    if (first.success) {
      expect(first.responseFormatApplied).toBe(false);
      expect(first.responseFormatFallbackUsed).toBe(true);
    }

    const firstRequestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    const fallbackRequestBody = JSON.parse(fetchMock.mock.calls[1][1].body as string) as Record<string, unknown>;
    expect(firstRequestBody.response_format).toBeDefined();
    expect(fallbackRequestBody.response_format).toBeUndefined();

    const second = await generateWithProviderFallback([{ role: 'user', content: 'second' }], {
      requestId: 'req-4',
      responseFormat: RESPONSE_FORMAT,
    });
    expect(second.success).toBe(true);
    if (second.success) {
      expect(second.responseFormatApplied).toBe(false);
      expect(second.responseFormatFallbackUsed).toBe(false);
    }

    const secondRequestBody = JSON.parse(fetchMock.mock.calls[2][1].body as string) as Record<string, unknown>;
    expect(secondRequestBody.response_format).toBeUndefined();
  });

  it('falls back on 422 without poisoning capability cache when error is unrelated to response_format', async () => {
    process.env.ASSISTANT_ENABLE_JSON_SCHEMA_MODE = 'true';

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'invalid prompt payload' } }), {
          status: 422,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(createSuccessResponse('{"ok":true}'))
      .mockResolvedValueOnce(createSuccessResponse('{"ok":true}'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { generateWithProviderFallback } = await importProviders();

    const first = await generateWithProviderFallback([{ role: 'user', content: 'first' }], {
      requestId: 'req-5',
      responseFormat: RESPONSE_FORMAT,
    });
    expect(first.success).toBe(true);

    const firstRequestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    const fallbackRequestBody = JSON.parse(fetchMock.mock.calls[1][1].body as string) as Record<string, unknown>;
    expect(firstRequestBody.response_format).toBeDefined();
    expect(fallbackRequestBody.response_format).toBeUndefined();

    const second = await generateWithProviderFallback([{ role: 'user', content: 'second' }], {
      requestId: 'req-6',
      responseFormat: RESPONSE_FORMAT,
    });
    expect(second.success).toBe(true);

    const secondRequestBody = JSON.parse(fetchMock.mock.calls[2][1].body as string) as Record<string, unknown>;
    expect(secondRequestBody.response_format).toBeDefined();
  });
});
