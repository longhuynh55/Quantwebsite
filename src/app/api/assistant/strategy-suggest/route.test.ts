/** @jest-environment node */

const mockCheckRateLimit = jest.fn();
const mockCreateRateLimitKey = jest.fn();
const mockGetClientIdentifier = jest.fn();
const mockGenerateWithProviderFallback = jest.fn();

jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  createRateLimitKey: (...args: unknown[]) => mockCreateRateLimitKey(...args),
  getClientIdentifier: (...args: unknown[]) => mockGetClientIdentifier(...args),
}));

jest.mock("@/lib/assistant/providers", () => ({
  generateWithProviderFallback: (...args: unknown[]) => mockGenerateWithProviderFallback(...args),
}));

import { POST } from "./route";

describe("POST /api/assistant/strategy-suggest", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockCreateRateLimitKey.mockReturnValue("strategy-suggest:test");
    mockGetClientIdentifier.mockReturnValue("client-test");
    mockCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 10,
      resetTime: Date.now() + 30_000,
    });
  });

  it("returns 400 when prompt is empty", async () => {
    const response = await POST(
      new Request("http://localhost/api/assistant/strategy-suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(400);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 30_000,
    });

    const response = await POST(
      new Request("http://localhost/api/assistant/strategy-suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build RSI strategy" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(429);
  });

  it("maps provider rate-limit failure to 429", async () => {
    mockGenerateWithProviderFallback.mockResolvedValue({
      success: false,
      kind: "rate_limit",
      statusCode: 429,
      message: "AI service is rate-limited.",
      latencyMs: 10,
      providerErrors: [],
    });

    const response = await POST(
      new Request("http://localhost/api/assistant/strategy-suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build RSI strategy" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(429);
  });

  it("aborts in-flight provider call when request deadline is exceeded", async () => {
    jest.useFakeTimers();
    let capturedAbortSignal: AbortSignal | undefined;
    mockGenerateWithProviderFallback.mockImplementation((_: unknown, options?: { abortSignal?: AbortSignal }) => {
      capturedAbortSignal = options?.abortSignal;
      return new Promise(() => undefined);
    });

    try {
      const responsePromise = POST(
        new Request("http://localhost/api/assistant/strategy-suggest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: "Build RSI strategy" }),
        }) as unknown as import("next/server").NextRequest
      );

      await jest.advanceTimersByTimeAsync(31_000);
      const response = await responsePromise;

      expect(response.status).toBe(504);
      expect(capturedAbortSignal?.aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("returns 200 with parsed strategy", async () => {
    mockGenerateWithProviderFallback.mockResolvedValue({
      success: true,
      text: JSON.stringify({
        name: "RSI Strategy",
        nodes: [
          { type: "dataSource", label: "Source", config: { stocks: ["VNM"], timeframe: "1d" } },
          { type: "indicator", label: "RSI(14)", config: { indicatorType: "rsi", period: 14 } },
        ],
        edges: [{ from: 0, to: 1 }],
      }),
      providerUsed: "openrouter",
      fallbackUsed: false,
      latencyMs: 25,
    });

    const response = await POST(
      new Request("http://localhost/api/assistant/strategy-suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build RSI strategy" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { success?: boolean; provider?: string };
    expect(json.success).toBe(true);
    expect(json.provider).toBe("openrouter");
    expect(mockGenerateWithProviderFallback).toHaveBeenCalled();
    const callOptions = mockGenerateWithProviderFallback.mock.calls[0]?.[1] as
      | { responseFormat?: { type?: string }; abortSignal?: AbortSignal }
      | undefined;
    expect(callOptions?.responseFormat?.type).toBe("json_schema");
    expect(callOptions?.abortSignal).toBeDefined();
  });
});
