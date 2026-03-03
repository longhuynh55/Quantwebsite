/** @jest-environment node */

const mockCheckRateLimit = jest.fn();
const mockCreateRateLimitKey = jest.fn();
const mockGetClientIdentifier = jest.fn();

jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  createRateLimitKey: (...args: unknown[]) => mockCreateRateLimitKey(...args),
  getClientIdentifier: (...args: unknown[]) => mockGetClientIdentifier(...args),
}));

import { POST } from "./route";

describe("POST /api/telemetry/ui-kpi", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockCreateRateLimitKey.mockReturnValue("telemetry:test");
    mockGetClientIdentifier.mockReturnValue("client-test");
    mockCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 100,
      resetTime: Date.now() + 60_000,
    });
  });

  it("accepts strategy builder interaction metric", async () => {
    const response = await POST(
      new Request("http://localhost/api/telemetry/ui-kpi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          metric: "strategy_builder_interaction",
          event: "node_added",
          page: "strategy-builder",
        }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(202);
    const json = (await response.json()) as { accepted?: boolean };
    expect(json.accepted).toBe(true);
  });

  it("accepts strategy builder ai assist metric", async () => {
    const response = await POST(
      new Request("http://localhost/api/telemetry/ui-kpi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          metric: "strategy_builder_ai_assist",
          event: "generate_apply_success",
          page: "strategy-builder",
        }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(202);
    const json = (await response.json()) as { accepted?: boolean };
    expect(json.accepted).toBe(true);
  });
});

