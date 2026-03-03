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

function makeBaseGraph() {
  return {
    name: "Test Strategy",
    nodes: [
      {
        id: "n1",
        type: "dataSource",
        position: { x: 80, y: 100 },
        data: {
          type: "dataSource",
          label: "Data Source",
          config: {
            label: "Data Source",
            stocks: ["VNM"],
            timeframe: "1d",
            startDate: "",
            endDate: "",
          },
        },
      },
      {
        id: "n2",
        type: "indicator",
        position: { x: 340, y: 100 },
        data: {
          type: "indicator",
          label: "RSI",
          config: {
            label: "RSI",
            indicatorType: "rsi",
            period: 14,
          },
        },
      },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2" }],
  };
}

function makeOversizedGraph(nodeCount: number) {
  const templateNode = makeBaseGraph().nodes[0];
  return {
    name: "Large Strategy",
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      ...templateNode,
      id: `n-${index}`,
      position: { x: 80 + index * 10, y: 120 },
      data: {
        ...templateNode.data,
        label: `Node ${index}`,
        config: {
          ...(templateNode.data.config as Record<string, unknown>),
          label: `Node ${index}`,
        },
      },
    })),
    edges: [],
  };
}

describe("POST /api/ai/strategy-patch", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockCreateRateLimitKey.mockReturnValue("strategy-patch:test");
    mockGetClientIdentifier.mockReturnValue("client-test");
    mockCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 10,
      resetTime: Date.now() + 30_000,
    });
  });

  it("returns 400 when prompt is empty", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/strategy-patch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "", graph: makeBaseGraph() }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as { success: boolean; error?: string };
    expect(json.success).toBe(false);
    expect(json.error).toContain("Prompt is required");
  });

  it("returns 422 when model response is not valid JSON patch", async () => {
    mockGenerateWithProviderFallback.mockResolvedValue({
      success: true,
      text: "not json",
      providerUsed: "openrouter",
      fallbackUsed: false,
      latencyMs: 20,
      providerErrors: [],
    });

    const response = await POST(
      new Request("http://localhost/api/ai/strategy-patch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "add a signal node",
          mode: "preview",
          graph: makeBaseGraph(),
        }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(422);
    const json = (await response.json()) as { success: boolean; error?: string };
    expect(json.success).toBe(false);
    expect(json.error).toContain("Invalid patch response format");
  });

  it("returns 400 for malformed graph payload items", async () => {
    const malformedGraph = {
      ...makeBaseGraph(),
      nodes: [null],
    };

    const response = await POST(
      new Request("http://localhost/api/ai/strategy-patch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Add node",
          mode: "preview",
          graph: malformedGraph,
        }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as { success: boolean; error?: string };
    expect(json.success).toBe(false);
    expect(json.error).toContain("Invalid graph payload");
  });

  it("maps provider rate-limit failure to 429", async () => {
    mockGenerateWithProviderFallback.mockResolvedValue({
      success: false,
      kind: "rate_limit",
      statusCode: 429,
      message: "AI service is rate-limited",
      latencyMs: 20,
      providerErrors: [],
    });

    const response = await POST(
      new Request("http://localhost/api/ai/strategy-patch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "add a signal node",
          mode: "preview",
          graph: makeBaseGraph(),
        }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(429);
    const json = (await response.json()) as { success: boolean; error?: string };
    expect(json.success).toBe(false);
    expect(json.error).toContain("rate-limited");
  });

  it("maps provider timeout failure to 504", async () => {
    mockGenerateWithProviderFallback.mockResolvedValue({
      success: false,
      kind: "timeout",
      statusCode: 504,
      message: "AI service timed out.",
      latencyMs: 20,
      providerErrors: [],
    });

    const response = await POST(
      new Request("http://localhost/api/ai/strategy-patch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "add a signal node",
          mode: "preview",
          graph: makeBaseGraph(),
        }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(504);
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
        new Request("http://localhost/api/ai/strategy-patch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prompt: "add a signal node",
            mode: "preview",
            graph: makeBaseGraph(),
          }),
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

  it("returns 422 when current graph exceeds guardrail limits", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/strategy-patch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "add a signal node",
          mode: "preview",
          graph: makeOversizedGraph(81),
        }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(422);
    const json = (await response.json()) as { success: boolean; error?: string };
    expect(json.success).toBe(false);
    expect(json.error).toContain("validation issues");
    expect(mockGenerateWithProviderFallback).not.toHaveBeenCalled();
  });

  it("returns patched graph in preview mode when patch is valid", async () => {
    mockGenerateWithProviderFallback.mockResolvedValue({
      success: true,
      text: JSON.stringify({
        ops: [
          {
            op: "add_node",
            nodeType: "signal",
            nodeId: "n3",
            label: "Buy Signal",
            config: { signalType: "buy", condition: "RSI < 30" },
          },
          {
            op: "add_edge",
            source: "n2",
            target: "n3",
          },
        ],
        summary: "Added signal node with condition.",
      }),
      providerUsed: "openrouter",
      fallbackUsed: false,
      latencyMs: 20,
      providerErrors: [],
    });

    const response = await POST(
      new Request("http://localhost/api/ai/strategy-patch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Add buy signal when RSI below 30",
          mode: "preview",
          graph: makeBaseGraph(),
        }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      success: boolean;
      patchedGraph?: { nodes: Array<{ id: string }> };
      diffSummary?: string[];
      mode?: string;
    };
    expect(json.success).toBe(true);
    expect(json.mode).toBe("preview");
    expect(json.patchedGraph?.nodes.some((node) => node.id === "n3")).toBe(true);
    expect(Array.isArray(json.diffSummary)).toBe(true);
    expect(mockGenerateWithProviderFallback).toHaveBeenCalled();
    const callOptions = mockGenerateWithProviderFallback.mock.calls[0]?.[1] as
      | { responseFormat?: { type?: string }; abortSignal?: AbortSignal }
      | undefined;
    expect(callOptions?.responseFormat?.type).toBe("json_schema");
    expect(callOptions?.abortSignal).toBeDefined();
  });
});
