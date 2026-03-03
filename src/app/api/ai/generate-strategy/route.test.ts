/** @jest-environment node */

const mockCheckRateLimit = jest.fn();
const mockCreateRateLimitKey = jest.fn();
const mockGetClientIdentifier = jest.fn();
const mockGenerateStrategyFromPrompt = jest.fn();
const mockSanitizeGeneratedStrategyForBuilder = jest.fn();

jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  createRateLimitKey: (...args: unknown[]) => mockCreateRateLimitKey(...args),
  getClientIdentifier: (...args: unknown[]) => mockGetClientIdentifier(...args),
}));

jest.mock("@/lib/ai/strategy-generator", () => ({
  generateStrategyFromPrompt: (...args: unknown[]) => mockGenerateStrategyFromPrompt(...args),
}));

jest.mock("@/lib/ai/strategy-builder-adapter", () => ({
  sanitizeGeneratedStrategyForBuilder: (...args: unknown[]) =>
    mockSanitizeGeneratedStrategyForBuilder(...args),
}));

import { POST } from "./route";

describe("POST /api/ai/generate-strategy", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockCreateRateLimitKey.mockReturnValue("strategy-generation:test");
    mockGetClientIdentifier.mockReturnValue("client-test");
    mockCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 10,
      resetTime: Date.now() + 30_000,
    });
    mockSanitizeGeneratedStrategyForBuilder.mockImplementation((strategy) => ({
      strategy,
      warnings: [],
    }));
  });

  it("maps parse failure to 422", async () => {
    mockGenerateStrategyFromPrompt.mockResolvedValue({
      success: false,
      error: "Failed to parse strategy from AI response.",
      failureKind: "parse",
      statusCode: 422,
      latencyMs: 30,
    });

    const response = await POST(
      new Request("http://localhost/api/ai/generate-strategy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build RSI strategy" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(422);
    const json = (await response.json()) as { success: boolean; error?: string };
    expect(json.success).toBe(false);
    expect(json.error).toContain("parse");
  });

  it("maps provider rate-limit failure to 429", async () => {
    mockGenerateStrategyFromPrompt.mockResolvedValue({
      success: false,
      error: "AI service is rate-limited.",
      failureKind: "rate_limit",
      statusCode: 429,
      latencyMs: 30,
    });

    const response = await POST(
      new Request("http://localhost/api/ai/generate-strategy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Build RSI strategy" }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(429);
    const json = (await response.json()) as { success: boolean };
    expect(json.success).toBe(false);
  });

  it("maps timeout failure to 504", async () => {
    mockGenerateStrategyFromPrompt.mockResolvedValue({
      success: false,
      error: "AI service timed out.",
      failureKind: "timeout",
      statusCode: 504,
      latencyMs: 30,
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
});
