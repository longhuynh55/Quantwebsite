/** @jest-environment node */

const mockCheckRateLimitAsync = jest.fn();
const mockCreateRateLimitKey = jest.fn();
const mockGetClientIdentifier = jest.fn();
const mockGenerateStrategyFromPrompt = jest.fn();

jest.mock("@/lib/rateLimit", () => ({
  checkRateLimitAsync: (...args: unknown[]) => mockCheckRateLimitAsync(...args),
  createRateLimitKey: (...args: unknown[]) => mockCreateRateLimitKey(...args),
  getClientIdentifier: (...args: unknown[]) => mockGetClientIdentifier(...args),
}));

jest.mock("@/lib/ai/strategy-generator", () => ({
  generateStrategyFromPrompt: (...args: unknown[]) => mockGenerateStrategyFromPrompt(...args),
}));

import { POST } from "./route";

function buildValidGraph() {
  return {
    nodes: [
      {
        id: "node-1",
        type: "dataSource",
        position: { x: 50, y: 50 },
        data: { type: "dataSource", label: "Source", config: { stocks: ["VNM"], timeframe: "1d" } },
      },
      {
        id: "node-2",
        type: "output",
        position: { x: 320, y: 50 },
        data: { type: "output", label: "Output", config: { metrics: ["returns"] } },
      },
    ],
    edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
    explanation: "ok",
  };
}

describe("POST /api/ai/generate-strategy", () => {
  const previousDemoAvailabilityMode = process.env.ASSISTANT_DEMO_AVAILABILITY_MODE;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.ASSISTANT_DEMO_AVAILABILITY_MODE = previousDemoAvailabilityMode;
    mockCreateRateLimitKey.mockReturnValue("strategy-generation:test");
    mockGetClientIdentifier.mockReturnValue("client-test");
    mockCheckRateLimitAsync.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetTime: Date.now() + 30_000,
    });
  });

  afterAll(() => {
    process.env.ASSISTANT_DEMO_AVAILABILITY_MODE = previousDemoAvailabilityMode;
  });

  it("returns 400 when prompt is empty", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/generate-strategy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(400);
  });

  it("maps timeout failure to 504", async () => {
    mockGenerateStrategyFromPrompt.mockResolvedValue({
      success: false,
      error: "AI service timed out. Please try again.",
      latencyMs: 12,
      failureKind: "timeout",
      statusCode: 504,
    });

    const response = await POST(
      new Request("http://localhost/api/ai/generate-strategy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build RSI strategy" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(504);
  });

  it("maps request-aborted failure to 499", async () => {
    mockGenerateStrategyFromPrompt.mockResolvedValue({
      success: false,
      error: "Request was cancelled by client.",
      latencyMs: 12,
      failureKind: "request_aborted",
      statusCode: 499,
    });

    const response = await POST(
      new Request("http://localhost/api/ai/generate-strategy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build RSI strategy" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(499);
  });

  it("maps parse failure to 422", async () => {
    mockGenerateStrategyFromPrompt.mockResolvedValue({
      success: false,
      error: "Failed to parse strategy",
      rawResponse: "bad response",
      latencyMs: 15,
      failureKind: "parse",
      statusCode: 422,
    });

    const response = await POST(
      new Request("http://localhost/api/ai/generate-strategy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build RSI strategy" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(422);
    const json = (await response.json()) as { rawResponse?: string };
    expect(json.rawResponse).toBe("bad response");
  });

  it("maps configuration failure to 502", async () => {
    mockGenerateStrategyFromPrompt.mockResolvedValue({
      success: false,
      error: "schema unavailable",
      latencyMs: 8,
      failureKind: "configuration",
      statusCode: 502,
    });

    const response = await POST(
      new Request("http://localhost/api/ai/generate-strategy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build RSI strategy" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(502);
  });

  it("returns deterministic template fallback in demo availability mode when provider times out", async () => {
    process.env.ASSISTANT_DEMO_AVAILABILITY_MODE = "true";
    mockGenerateStrategyFromPrompt.mockResolvedValue({
      success: false,
      error: "AI service timed out. Please try again.",
      latencyMs: 90,
      failureKind: "timeout",
      statusCode: 504,
    });

    const response = await POST(
      new Request("http://localhost/api/ai/generate-strategy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Tao chien luoc RSI mean reversion cho VNM" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      success: boolean;
      generationMode?: string;
      degraded?: boolean;
      degradeReason?: string;
      strategy?: { nodes?: unknown[]; edges?: unknown[] };
      providerUsed?: string;
      userNotice?: string;
    };
    expect(json.success).toBe(true);
    expect(json.generationMode).toBe("template_fallback");
    expect(json.degraded).toBe(true);
    expect(json.degradeReason).toBe("timeout");
    expect(json.providerUsed).toBe("demo-template-fallback");
    expect(json.userNotice).toContain("Demo availability mode");
    expect((json.strategy?.nodes ?? []).length).toBeGreaterThanOrEqual(2);
    expect((json.strategy?.edges ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it("returns 200 and schema flags when generation succeeds", async () => {
    mockGenerateStrategyFromPrompt.mockResolvedValue({
      success: true,
      strategy: buildValidGraph(),
      latencyMs: 20,
      providerUsed: "openrouter",
      schemaApplied: true,
      responseFormatFallbackUsed: false,
    });

    const response = await POST(
      new Request("http://localhost/api/ai/generate-strategy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build RSI strategy", requestId: "client-1" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      success: boolean;
      providerUsed?: string;
      schemaApplied?: boolean;
      responseFormatFallbackUsed?: boolean;
    };
    expect(json.success).toBe(true);
    expect(json.providerUsed).toBe("openrouter");
    expect(json.schemaApplied).toBe(true);
    expect(json.responseFormatFallbackUsed).toBe(false);

    expect(mockGenerateStrategyFromPrompt).toHaveBeenCalledWith(
      "Build RSI strategy",
      expect.objectContaining({
        requestId: expect.any(String),
        parseRepairRetries: expect.any(Number),
        timeoutMs: expect.any(Number),
        providerTimeoutMs: expect.any(Number),
      })
    );
  });

  it("returns 422 when generated strategy is not minimum viable", async () => {
    mockGenerateStrategyFromPrompt.mockResolvedValue({
      success: true,
      strategy: {
        nodes: [
          {
            id: "node-1",
            type: "dataSource",
            position: { x: 50, y: 50 },
            data: { type: "dataSource", label: "Source", config: {} },
          },
          {
            id: "node-2",
            type: "indicator",
            position: { x: 320, y: 50 },
            data: { type: "indicator", label: "RSI", config: {} },
          },
        ],
        edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
        explanation: "missing output node",
      },
      latencyMs: 20,
      providerUsed: "openrouter",
      schemaApplied: true,
      responseFormatFallbackUsed: false,
    });

    const response = await POST(
      new Request("http://localhost/api/ai/generate-strategy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build RSI strategy" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(422);
    const json = (await response.json()) as {
      success: boolean;
      validation?: { minimumViable: boolean; warnings: string[] };
    };
    expect(json.success).toBe(false);
    expect(json.validation?.minimumViable).toBe(false);
    expect(json.validation?.warnings).toContain("strategy_requires_output_node");
  });
});
