/** @jest-environment node */

import { GET } from "./route";

type JsonRecord = Record<string, unknown>;

const ORIGINAL_ENV = process.env;

async function readJson(response: Response): Promise<JsonRecord> {
  return (await response.json()) as JsonRecord;
}

describe("GET /api/health/assistant", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "test",
      OPENROUTER_API_KEY: "test-openrouter-key",
    };
    delete process.env.ASSISTANT_EXECUTE_APPROVAL_TOKEN;
    delete process.env.ASSISTANT_TOOL_BASE_URL;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns degraded in non-strict mode when execute token is missing", async () => {
    const response = await GET(new Request("http://localhost/api/health/assistant"));
    const json = await readJson(response);
    const checks = json.checks as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(json.status).toBe("degraded");
    expect(checks.providerConfigured).toBe(true);
    expect(checks.groundingConfigured).toBe(true);
    expect(checks.executeConfigured).toBe(false);
    expect(checks.chatReady).toBe(true);
    expect(checks.executeReady).toBe(false);
  });

  it("returns unhealthy in strict mode when execute token is missing", async () => {
    const response = await GET(new Request("http://localhost/api/health/assistant?strict=true"));
    const json = await readJson(response);

    expect(response.status).toBe(503);
    expect(json.status).toBe("unhealthy");
  });

  it("returns healthy in strict mode when provider, grounding, and execute are configured", async () => {
    process.env.ASSISTANT_EXECUTE_APPROVAL_TOKEN = "token-ok";
    process.env.ASSISTANT_TOOL_BASE_URL = "https://internal.example.com/base";

    const response = await GET(new Request("http://localhost/api/health/assistant?strict=true"));
    const json = await readJson(response);
    const checks = json.checks as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(json.status).toBe("healthy");
    expect(checks.chatReady).toBe(true);
    expect(checks.executeReady).toBe(true);
  });

  it("falls back to dev-localhost source when encoded traversal base URL is invalid", async () => {
    process.env.ASSISTANT_TOOL_BASE_URL = "https://internal.example.com/%2E%2E/private";

    const response = await GET(new Request("http://localhost/api/health/assistant"));
    const json = await readJson(response);
    const checks = json.checks as Record<string, unknown>;
    const details = json.details as Record<string, unknown>;

    expect(checks.groundingConfigured).toBe(true);
    expect(details.toolBaseUrlSource).toBe("dev-localhost");
    expect(json.status).toBe("degraded");
  });
});
