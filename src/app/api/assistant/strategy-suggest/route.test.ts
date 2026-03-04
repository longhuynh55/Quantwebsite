/** @jest-environment node */

const mockCheckRateLimitAsync = jest.fn();
const mockCreateRateLimitKey = jest.fn();
const mockGetClientIdentifier = jest.fn();
const mockGenerateWithProviderFallback = jest.fn();

jest.mock("@/lib/rateLimit", () => ({
  checkRateLimitAsync: (...args: unknown[]) => mockCheckRateLimitAsync(...args),
  createRateLimitKey: (...args: unknown[]) => mockCreateRateLimitKey(...args),
  getClientIdentifier: (...args: unknown[]) => mockGetClientIdentifier(...args),
}));

jest.mock("@/lib/assistant/providers", () => ({
  generateWithProviderFallback: (...args: unknown[]) => mockGenerateWithProviderFallback(...args),
}));

import { POST } from "./route";

function buildValidSuggestedStrategy() {
  return {
    name: "RSI Strategy",
    nodes: [
      { type: "dataSource", label: "Source", config: { stocks: ["VNM"], timeframe: "1d" } },
      { type: "indicator", label: "RSI(14)", config: { indicatorType: "rsi", period: 14 } },
      { type: "output", label: "Output", config: { metrics: ["returns", "sharpe"] } },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ],
  };
}

function buildAdvancedSuggestedStrategy() {
  return {
    name: "Advanced Graph",
    nodes: [
      { type: "dataSource", label: "Source", config: { stocks: ["VNM"], timeframe: "1d" } },
      { type: "indicator", label: "EMA(20)", config: { indicatorType: "ema", period: 20 } },
      { type: "merge", label: "Merge", config: { logic: "and" } },
      { type: "signal", label: "Buy", config: { signalType: "buy", condition: "EMA uptrend" } },
      { type: "risk", label: "Risk", config: { method: "fixed", maxPosition: 10, maxDrawdown: 20 } },
      { type: "output", label: "Output", config: { metrics: ["returns", "sharpe"] } },
      { type: "backtest", label: "Backtest", config: { initialCapital: 100000000, commission: 0.15, slippage: 0.05 } },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 4, to: 6 },
    ],
  };
}

describe("POST /api/assistant/strategy-suggest", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockCreateRateLimitKey.mockReturnValue("strategy-suggest:test");
    mockGetClientIdentifier.mockReturnValue("client-test");
    mockCheckRateLimitAsync.mockResolvedValue({
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
    mockCheckRateLimitAsync.mockResolvedValue({
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
      text: JSON.stringify(buildValidSuggestedStrategy()),
      providerUsed: "openrouter",
      fallbackUsed: false,
      latencyMs: 25,
      responseFormatApplied: true,
      responseFormatFallbackUsed: false,
    });

    const response = await POST(
      new Request("http://localhost/api/assistant/strategy-suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build RSI strategy" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { success?: boolean; provider?: string; schemaApplied?: boolean };
    expect(json.success).toBe(true);
    expect(json.provider).toBe("openrouter");
    expect(json.schemaApplied).toBe(true);
    expect(mockGenerateWithProviderFallback).toHaveBeenCalledTimes(1);
    expect(mockGenerateWithProviderFallback.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        responseFormat: expect.objectContaining({ type: "json_schema" }),
        responseFormatMode: "force",
        requireResponseFormatApplied: true,
        abortSignal: expect.any(Object),
      })
    );
  });

  it("parses prose-wrapped JSON response", async () => {
    const payload = JSON.stringify(buildValidSuggestedStrategy(), null, 2);
    mockGenerateWithProviderFallback.mockResolvedValue({
      success: true,
      text: `Here is your strategy:\n${payload}\nAdjust as needed.`,
      providerUsed: "openrouter",
      fallbackUsed: false,
      latencyMs: 25,
      responseFormatApplied: true,
      responseFormatFallbackUsed: false,
    });

    const response = await POST(
      new Request("http://localhost/api/assistant/strategy-suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build RSI strategy" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(200);
  });

  it("parses the correct strategy object when response contains multiple JSON blocks", async () => {
    const decoy = JSON.stringify(
      {
        ...buildValidSuggestedStrategy(),
        name: "Decoy Strategy",
      },
      null,
      2
    );
    const strategy = JSON.stringify(
      {
        ...buildValidSuggestedStrategy(),
        name: "Expected Strategy",
      },
      null,
      2
    );
    mockGenerateWithProviderFallback.mockResolvedValue({
      success: true,
      text: `${decoy}\n\n${strategy}`,
      providerUsed: "openrouter",
      fallbackUsed: false,
      latencyMs: 25,
      responseFormatApplied: true,
      responseFormatFallbackUsed: false,
    });

    const response = await POST(
      new Request("http://localhost/api/assistant/strategy-suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build RSI strategy" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { strategy?: { name?: string } };
    expect(json.strategy?.name).toBe("Expected Strategy");
  });

  it("accepts advanced node types merge/risk/backtest", async () => {
    mockGenerateWithProviderFallback.mockResolvedValue({
      success: true,
      text: JSON.stringify(buildAdvancedSuggestedStrategy()),
      providerUsed: "openrouter",
      fallbackUsed: false,
      latencyMs: 25,
      responseFormatApplied: true,
      responseFormatFallbackUsed: false,
    });

    const response = await POST(
      new Request("http://localhost/api/assistant/strategy-suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build advanced strategy with risk and backtest" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { strategy?: { nodes?: Array<{ type?: string }> } };
    const nodeTypes = (json.strategy?.nodes ?? []).map((node) => node.type);
    expect(nodeTypes).toContain("merge");
    expect(nodeTypes).toContain("risk");
    expect(nodeTypes).toContain("backtest");
  });

  it("returns 502 when schema is required but provider did not apply response format", async () => {
    mockGenerateWithProviderFallback.mockResolvedValue({
      success: true,
      text: JSON.stringify(buildValidSuggestedStrategy()),
      providerUsed: "openrouter",
      fallbackUsed: false,
      latencyMs: 25,
      responseFormatApplied: false,
      responseFormatFallbackUsed: true,
    });

    const response = await POST(
      new Request("http://localhost/api/assistant/strategy-suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build RSI strategy" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(502);
  });

  it("returns 422 when parsed strategy violates invariants", async () => {
    const invalid = {
      name: "Invalid",
      nodes: [
        { type: "dataSource", label: "Source", config: {} },
        { type: "indicator", label: "RSI", config: { indicatorType: "rsi", period: 14 } },
      ],
      edges: [{ from: 0, to: 1 }],
    };

    mockGenerateWithProviderFallback.mockResolvedValue({
      success: true,
      text: JSON.stringify(invalid),
      providerUsed: "openrouter",
      fallbackUsed: false,
      latencyMs: 25,
      responseFormatApplied: true,
      responseFormatFallbackUsed: false,
    });

    const response = await POST(
      new Request("http://localhost/api/assistant/strategy-suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build RSI strategy" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(422);
    const json = (await response.json()) as { details?: string };
    expect(json.details).toBe("strategy_requires_output_node");
  });
});
