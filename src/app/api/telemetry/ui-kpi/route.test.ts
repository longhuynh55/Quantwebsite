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
    mockCreateRateLimitKey.mockReturnValue("telemetry_ui_kpi:test");
    mockGetClientIdentifier.mockReturnValue("client-test");
    mockCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 100,
      resetTime: Date.now() + 30_000,
    });
  });

  it("accepts known strategy builder interaction event", async () => {
    const response = await POST(
      new Request("http://localhost/api/telemetry/ui-kpi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          metric: "strategy_builder_interaction",
          event: "template_applied",
          page: "strategy-builder",
        }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(202);
  });

  it("rejects unknown event name for strategy builder metric", async () => {
    const response = await POST(
      new Request("http://localhost/api/telemetry/ui-kpi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          metric: "strategy_builder_interaction",
          event: "template_loaded_typo",
        }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(400);
  });

  it("keeps non-strategy metrics flexible on event name", async () => {
    const response = await POST(
      new Request("http://localhost/api/telemetry/ui-kpi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          metric: "preset_reuse",
          event: "screen_opened",
        }),
      }) as unknown as import("next/server").NextRequest
    );

    expect(response.status).toBe(202);
  });
});
