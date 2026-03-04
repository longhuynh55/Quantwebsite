/** @jest-environment node */

const mockCheckRateLimitAsync = jest.fn();
const mockCreateRateLimitKey = jest.fn();
const mockGetClientIdentifier = jest.fn();
const mockBuildAssistantQueryPlan = jest.fn();
const mockRunGroundingTools = jest.fn();
const mockEvaluateAssistantPolicy = jest.fn();
const mockGenerateWithProviderFallback = jest.fn();

jest.mock("@/lib/rateLimit", () => ({
  checkRateLimitAsync: (...args: unknown[]) => mockCheckRateLimitAsync(...args),
  createRateLimitKey: (...args: unknown[]) => mockCreateRateLimitKey(...args),
  getClientIdentifier: (...args: unknown[]) => mockGetClientIdentifier(...args),
}));

jest.mock("@/lib/assistant/planner", () => ({
  buildAssistantQueryPlan: (...args: unknown[]) => mockBuildAssistantQueryPlan(...args),
}));

jest.mock("@/lib/assistant/tools", () => ({
  runGroundingTools: (...args: unknown[]) => mockRunGroundingTools(...args),
}));

jest.mock("@/lib/assistant/policy", () => ({
  evaluateAssistantPolicy: (...args: unknown[]) => mockEvaluateAssistantPolicy(...args),
}));

jest.mock("@/lib/assistant/providers", () => ({
  generateWithProviderFallback: (...args: unknown[]) => mockGenerateWithProviderFallback(...args),
}));

import { POST } from "./route";

type JsonRecord = Record<string, unknown>;

async function readJson(response: Response): Promise<JsonRecord> {
  return (await response.json()) as JsonRecord;
}

describe("POST /api/assistant error traces", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockCreateRateLimitKey.mockReturnValue("assistant:test");
    mockGetClientIdentifier.mockReturnValue("client-test");
    mockCheckRateLimitAsync.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetTime: Date.now() + 30_000,
    });
    mockBuildAssistantQueryPlan.mockReturnValue({
      intent: "market",
      confidence: "high",
      source: "signal",
      symbols: [],
      filters: {},
      steps: [],
      summary: "test-plan",
    });
    mockRunGroundingTools.mockResolvedValue({
      facts: [],
      citations: [],
      usedTools: [],
      messageBlocks: [],
      groundingSource: "none",
    });
    mockEvaluateAssistantPolicy.mockReturnValue({
      mode: "shadow",
      status: "ok",
      dataConfidence: "medium",
      groundingRequired: false,
      groundingSatisfied: false,
      shouldBypassLlm: false,
      shadowBlocked: false,
    });
    mockGenerateWithProviderFallback.mockResolvedValue({
      success: true,
      text: "ok",
      providerUsed: "openrouter",
      fallbackUsed: false,
      latencyMs: 10,
      providerErrors: [],
    });
  });

  it("returns requestId in 429 rate-limit response meta", async () => {
    mockCheckRateLimitAsync.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 30_000,
    });

    const response = await POST(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      }) as unknown as import("next/server").NextRequest
    );
    const json = await readJson(response);
    const meta = json.meta as Record<string, unknown>;

    expect(response.status).toBe(429);
    expect(json.success).toBe(false);
    expect(typeof meta.requestId).toBe("string");
  });

  it("returns requestId in 400 invalid-json response meta", async () => {
    const response = await POST(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{invalid",
      }) as unknown as import("next/server").NextRequest
    );
    const json = await readJson(response);
    const meta = json.meta as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(typeof meta.requestId).toBe("string");
  });

  it("returns requestId in 500 unexpected-error response meta", async () => {
    mockBuildAssistantQueryPlan.mockImplementation(() => {
      throw new Error("planner exploded");
    });

    const response = await POST(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      }) as unknown as import("next/server").NextRequest
    );
    const json = await readJson(response);
    const meta = json.meta as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(typeof meta.requestId).toBe("string");
  });

  it("blocks numeric LLM output when tokens do not align with grounded evidence", async () => {
    mockBuildAssistantQueryPlan.mockReturnValue({
      intent: "stock_snapshot",
      confidence: "high",
      source: "signal",
      symbols: ["VNM"],
      filters: {},
      steps: [
        {
          tool: "stockSnapshot",
          endpoint: "/api/stocks",
          required: true,
          reason: "grounded",
        },
      ],
      summary: "intent=stock_snapshot",
    });
    mockRunGroundingTools.mockResolvedValue({
      facts: ["VNM close=80000 volume=1000000"],
      citations: [
        {
          id: "c1",
          sourceType: "api",
          title: "stocks",
          endpoint: "/api/stocks?symbol=VNM",
          symbol: "VNM",
        },
      ],
      usedTools: [
        {
          name: "stockSnapshot",
          status: "success",
          evidenceCount: 2,
          warningCount: 0,
          requestParams: { symbol: "VNM" },
        },
      ],
      messageBlocks: [],
      groundingSource: "/api/stocks?symbol=VNM",
    });
    mockEvaluateAssistantPolicy.mockReturnValue({
      mode: "shadow",
      status: "ok",
      dataConfidence: "high",
      groundingRequired: true,
      groundingSatisfied: true,
      shouldBypassLlm: false,
      shadowBlocked: false,
    });
    mockGenerateWithProviderFallback.mockResolvedValue({
      success: true,
      text: "VCB close 99999, volume 88888.",
      providerUsed: "openrouter",
      fallbackUsed: false,
      latencyMs: 22,
      providerErrors: [],
    });

    const response = await POST(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Gia dong cua VNM hom nay" }),
      }) as unknown as import("next/server").NextRequest
    );
    const json = await readJson(response);
    const meta = json.meta as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.policyStatus).toBe("fallback");
    expect(json.message).toContain("INSUFFICIENT_DATA");
    expect(meta.providerUsed).toBe("policy-post-guard");
  });

  it("keeps successful LLM response when numeric tokens align with grounded evidence", async () => {
    mockBuildAssistantQueryPlan.mockReturnValue({
      intent: "stock_snapshot",
      confidence: "high",
      source: "signal",
      symbols: ["VNM"],
      filters: {},
      steps: [
        {
          tool: "stockSnapshot",
          endpoint: "/api/stocks",
          required: true,
          reason: "grounded",
        },
      ],
      summary: "intent=stock_snapshot",
    });
    mockRunGroundingTools.mockResolvedValue({
      facts: ["VNM close=80000 volume=1000000"],
      citations: [
        {
          id: "c1",
          sourceType: "api",
          title: "stocks",
          endpoint: "/api/stocks?symbol=VNM",
          symbol: "VNM",
        },
      ],
      usedTools: [
        {
          name: "stockSnapshot",
          status: "success",
          evidenceCount: 2,
          warningCount: 0,
          requestParams: { symbol: "VNM" },
        },
      ],
      messageBlocks: [],
      groundingSource: "/api/stocks?symbol=VNM",
    });
    mockEvaluateAssistantPolicy.mockReturnValue({
      mode: "shadow",
      status: "ok",
      dataConfidence: "high",
      groundingRequired: true,
      groundingSatisfied: true,
      shouldBypassLlm: false,
      shadowBlocked: false,
    });
    mockGenerateWithProviderFallback.mockResolvedValue({
      success: true,
      text: "Gia dong VNM 80,000 va khoi luong 1,000,000.",
      providerUsed: "openrouter",
      fallbackUsed: false,
      latencyMs: 25,
      providerErrors: [],
    });

    const response = await POST(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Gia dong cua VNM hom nay" }),
      }) as unknown as import("next/server").NextRequest
    );
    const json = await readJson(response);
    const meta = json.meta as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.policyStatus).toBe("ok");
    expect(json.message).toContain("80,000");
    expect(meta.providerUsed).toBe("openrouter");
  });
});
