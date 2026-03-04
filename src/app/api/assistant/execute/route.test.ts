/** @jest-environment node */

const mockCheckRateLimitAsync = jest.fn();
const mockCreateRateLimitKey = jest.fn();
const mockGetClientIdentifier = jest.fn();

jest.mock("@/lib/rateLimit", () => ({
  checkRateLimitAsync: (...args: unknown[]) => mockCheckRateLimitAsync(...args),
  createRateLimitKey: (...args: unknown[]) => mockCreateRateLimitKey(...args),
  getClientIdentifier: (...args: unknown[]) => mockGetClientIdentifier(...args),
}));

import { POST } from "./route";

type JsonRecord = Record<string, unknown>;

const ORIGINAL_ENV = process.env;
const ORIGINAL_FETCH = global.fetch;

function makeJsonRequest(body: unknown): Request {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost/api/assistant/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
  });
}

async function readJson(response: Response): Promise<JsonRecord> {
  return (await response.json()) as JsonRecord;
}

function clearExecutionEnv(): void {
  delete process.env.ASSISTANT_EXECUTE_APPROVAL_TOKEN;
  delete process.env.ASSISTANT_TOOL_BASE_URL;
  delete process.env.INTERNAL_API_BASE_URL;
  delete process.env.APP_BASE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
}

describe("POST /api/assistant/execute", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...ORIGINAL_ENV };
    clearExecutionEnv();
    process.env = { ...process.env, NODE_ENV: "test" };
    process.env.ASSISTANT_EXECUTE_FETCH_MAX_ATTEMPTS = "1";
    global.fetch = jest.fn() as unknown as typeof fetch;
    mockGetClientIdentifier.mockReturnValue("client-test");
    mockCreateRateLimitKey.mockImplementation((scope: string, id: string) => `${scope}:${id}`);
    mockCheckRateLimitAsync.mockResolvedValue({
      allowed: true,
      remaining: 29,
      resetTime: Date.now() + 60_000,
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    global.fetch = ORIGINAL_FETCH;
  });

  it("returns 415 when content-type is not application/json", async () => {
    const request = new Request("http://localhost/api/assistant/execute", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "plain",
    });

    const response = await POST(request);
    const json = await readJson(response);

    expect(response.status).toBe(415);
    expect(json.error).toBe("Content-Type must be application/json");
  });

  it("returns 400 for invalid JSON body", async () => {
    const response = await POST(makeJsonRequest("{invalid"));
    const json = await readJson(response);

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid JSON body");
  });

  it("returns 503 when approval token config is missing in non-production", async () => {
    const response = await POST(
      makeJsonRequest({
        toolName: "risk_metrics",
        arguments: { symbol: "VNM" },
        approvalToken: "token-1",
      })
    );
    const json = await readJson(response);

    expect(response.status).toBe(503);
    expect(json.error).toBe("Missing ASSISTANT_EXECUTE_APPROVAL_TOKEN configuration.");
  });

  it("returns 503 with generic message in production when approval token config is missing", async () => {
    process.env = { ...process.env, NODE_ENV: "production" };

    const response = await POST(
      makeJsonRequest({
        toolName: "risk_metrics",
        arguments: { symbol: "VNM" },
        approvalToken: "token-1",
      })
    );
    const json = await readJson(response);

    expect(response.status).toBe(503);
    expect(json.error).toBe("Assistant execution is temporarily unavailable.");
  });

  it("returns 403 when approvalToken does not match configured token", async () => {
    process.env.ASSISTANT_EXECUTE_APPROVAL_TOKEN = "expected-token";

    const response = await POST(
      makeJsonRequest({
        toolName: "risk_metrics",
        arguments: { symbol: "VNM" },
        approvalToken: "wrong-token",
      })
    );
    const json = await readJson(response);

    expect(response.status).toBe(403);
    expect(json.error).toBe("Invalid approvalToken for human-in-loop execution.");
  });

  it("returns 503 in production when trusted internal base URL is missing", async () => {
    process.env = { ...process.env, NODE_ENV: "production" };
    process.env.ASSISTANT_EXECUTE_APPROVAL_TOKEN = "expected-token";

    const response = await POST(
      makeJsonRequest({
        toolName: "risk_metrics",
        arguments: { symbol: "VNM" },
        approvalToken: "expected-token",
      })
    );
    const json = await readJson(response);

    expect(response.status).toBe(503);
    expect(json.error).toBe("Missing trusted internal API base URL configuration.");
  });

  it("proxies downstream error payload and status", async () => {
    process.env.ASSISTANT_EXECUTE_APPROVAL_TOKEN = "expected-token";
    process.env.ASSISTANT_TOOL_BASE_URL = "https://internal.example.com/base/";
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "downstream-failed" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(
      makeJsonRequest({
        toolName: "risk_metrics",
        arguments: { symbol: "VNM", benchmark: "VNINDEX" },
        approvalToken: "expected-token",
      })
    );
    const json = await readJson(response);

    expect(response.status).toBe(502);
    expect(json).toEqual({ error: "downstream-failed" });

    const [calledUrl, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const parsed = new URL(calledUrl);

    expect(parsed.origin).toBe("https://internal.example.com");
    expect(parsed.pathname).toBe("/api/risk");
    expect(parsed.searchParams.get("symbol")).toBe("VNM");
    expect(parsed.searchParams.get("benchmark")).toBe("VNINDEX");
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
  });

  it("returns 502 when downstream fetch fails before getting response", async () => {
    process.env.ASSISTANT_EXECUTE_APPROVAL_TOKEN = "expected-token";
    process.env.ASSISTANT_TOOL_BASE_URL = "https://internal.example.com/base/";
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("socket hang up"));

    const response = await POST(
      makeJsonRequest({
        toolName: "risk_metrics",
        arguments: { symbol: "VNM", benchmark: "VNINDEX" },
        approvalToken: "expected-token",
      })
    );
    const json = await readJson(response);

    expect(response.status).toBe(502);
    const error = json.error as Record<string, unknown>;
    expect(error.message).toContain("failed");
    expect(error.code).toBe("downstream_unreachable");
    expect(json.requestId).toEqual(expect.any(String));
  });

  it("returns 504 when downstream request aborts by timeout", async () => {
    process.env.ASSISTANT_EXECUTE_APPROVAL_TOKEN = "expected-token";
    process.env.ASSISTANT_TOOL_BASE_URL = "https://internal.example.com/base/";
    const abortError = new Error("The operation was aborted");
    Object.assign(abortError, { name: "AbortError" });
    (global.fetch as jest.Mock).mockRejectedValueOnce(abortError);

    const response = await POST(
      makeJsonRequest({
        toolName: "risk_metrics",
        arguments: { symbol: "VNM", benchmark: "VNINDEX" },
        approvalToken: "expected-token",
      })
    );
    const json = await readJson(response);

    expect(response.status).toBe(504);
    const error = json.error as Record<string, unknown>;
    expect(error.message).toContain("timed out");
    expect(error.code).toBe("downstream_timeout");
    expect(json.requestId).toEqual(expect.any(String));
  });

  it("returns success payload and executes built plan for valuation rankings", async () => {
    process.env.ASSISTANT_EXECUTE_APPROVAL_TOKEN = "expected-token";
    process.env.ASSISTANT_TOOL_BASE_URL = "https://internal.example.com/base/";
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ rows: [{ symbol: "VCB", pe: 12.3 }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(
      makeJsonRequest({
        toolName: "valuation_rankings",
        arguments: { metric: "pe", order: "desc", limit: 5, date: "2025-12-31" },
        approvalToken: "expected-token",
      })
    );
    const json = await readJson(response);

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.requestId).toEqual(expect.any(String));
    expect(json.execution).toEqual(
      expect.objectContaining({
        toolName: "valuation_rankings",
        approved: true,
      })
    );
    expect(json.result).toEqual({ rows: [{ symbol: "VCB", pe: 12.3 }] });

    const [calledUrl, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const parsed = new URL(calledUrl);

    expect(parsed.pathname).toBe("/api/analytics/valuation-rankings");
    expect(parsed.searchParams.get("exchange")).toBe("HOSE");
    expect(parsed.searchParams.get("metric")).toBe("pe");
    expect(parsed.searchParams.get("order")).toBe("desc");
    expect(parsed.searchParams.get("limit")).toBe("5");
    expect(parsed.searchParams.get("date")).toBe("2025-12-31");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("uses POST body plan for backtest_run including normalized executionModel", async () => {
    process.env.ASSISTANT_EXECUTE_APPROVAL_TOKEN = "expected-token";
    process.env.ASSISTANT_TOOL_BASE_URL = "https://internal.example.com/";
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, metrics: { netReturn: 0.1 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(
      makeJsonRequest({
        toolName: "backtest_run",
        arguments: {
          symbol: "VCB",
          strategy: "sma_crossover",
          executionModel: "SAME_CLOSE",
          feeBps: 10,
        },
        approvalToken: "expected-token",
      })
    );
    const json = await readJson(response);

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.execution).toEqual(
      expect.objectContaining({
        trace: {
          method: "POST",
          path: "/api/backtesting",
        },
      })
    );

    const [calledUrl, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const parsed = new URL(calledUrl);
    expect(parsed.pathname).toBe("/api/backtesting");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(typeof init.body).toBe("string");

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toEqual({
      symbol: "VCB",
      strategy: "sma_crossover",
      executionModel: "same_close",
      feeBps: 10,
    });
  });

  it("returns 502 when downstream fetch rejects and includes structured payload", async () => {
    process.env.ASSISTANT_EXECUTE_APPROVAL_TOKEN = "expected-token";
    process.env.ASSISTANT_TOOL_BASE_URL = "https://internal.example.com/base/";
    const networkError = new Error("network failure");
    (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

    const response = await POST(
      makeJsonRequest({
        toolName: "risk_metrics",
        arguments: { symbol: "VNM" },
        approvalToken: "expected-token",
      })
    );
    const json = await readJson(response);

    expect(response.status).toBe(502);
    expect(json.error).toEqual({
      code: "downstream_unreachable",
      message: "Downstream tool request failed to reach the internal API.",
    });
    const networkDownstream = json.downstream as Record<string, unknown> | undefined;
    expect(networkDownstream?.method).toBe("GET");
    expect(networkDownstream?.path).toBe("/api/risk");
    expect(networkDownstream?.status).toBe(502);
  });

  it("returns 502 with downstream metadata when response is not valid JSON", async () => {
    process.env.ASSISTANT_EXECUTE_APPROVAL_TOKEN = "expected-token";
    process.env.ASSISTANT_TOOL_BASE_URL = "https://internal.example.com/base/";
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );

    const response = await POST(
      makeJsonRequest({
        toolName: "risk_metrics",
        arguments: { symbol: "VNM" },
        approvalToken: "expected-token",
      })
    );
    const json = await readJson(response);

    expect(response.status).toBe(502);
    expect(json.error).toEqual({
      code: "downstream_invalid_json",
      message: "Downstream service returned an invalid JSON payload.",
    });
    const invalidDownstream = json.downstream as Record<string, unknown> | undefined;
    expect(invalidDownstream?.status).toBe(200);
    expect(invalidDownstream?.path).toBe("/api/risk");
    expect(invalidDownstream?.bodyPreview).toBeUndefined();
  });
});
