import { POST } from "@/app/api/strategy-lab/worker/tick/route";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/lib/strategy-lab/postgres-bootstrap", () => ({
  bootstrapStrategyLabPostgresClientFromEnv: jest.fn(async () => undefined),
}));

jest.mock("@/lib/strategy-lab/worker", () => ({
  runOneStrategyLabWorkerStep: jest.fn(async () => ({ status: "idle" })),
}));

const workerModule = jest.requireMock("@/lib/strategy-lab/worker") as {
  runOneStrategyLabWorkerStep: jest.Mock;
};

function createMockRequest(input: {
  headers?: Record<string, string>;
  body?: unknown;
}): Request {
  const normalizedHeaders = new Map<string, string>();
  for (const [key, value] of Object.entries(input.headers ?? {})) {
    normalizedHeaders.set(key.toLowerCase(), value);
  }
  return {
    headers: {
      get: (name: string) => normalizedHeaders.get(name.toLowerCase()) ?? null,
    },
    json: async () => input.body,
  } as unknown as Request;
}

describe("POST /api/strategy-lab/worker/tick", () => {
  const originalBackend = process.env.STRATEGY_LAB_REPOSITORY_BACKEND;
  const originalAdminToken = process.env.STRATEGY_LAB_ADMIN_TOKEN;
  const originalClient = globalThis.__strategyLabPostgresClient__;

  beforeEach(() => {
    jest.clearAllMocks();
    delete globalThis.__strategyLabPostgresClient__;
    process.env.STRATEGY_LAB_REPOSITORY_BACKEND = "postgres";
    delete process.env.STRATEGY_LAB_ADMIN_TOKEN;
  });

  afterAll(() => {
    process.env.STRATEGY_LAB_REPOSITORY_BACKEND = originalBackend;
    process.env.STRATEGY_LAB_ADMIN_TOKEN = originalAdminToken;
    globalThis.__strategyLabPostgresClient__ = originalClient;
  });

  it("returns 409 when backend mode is not postgres", async () => {
    process.env.STRATEGY_LAB_REPOSITORY_BACKEND = "memory";
    const response = await POST(createMockRequest({}));
    expect(response.status).toBe(409);
  });

  it("returns 403 when admin token is configured but missing", async () => {
    process.env.STRATEGY_LAB_ADMIN_TOKEN = "secret";
    const response = await POST(createMockRequest({}));
    expect(response.status).toBe(403);
  });

  it("returns 503 when postgres client is unavailable", async () => {
    const response = await POST(
      createMockRequest({
        headers: {
          "content-type": "application/json",
        },
        body: {},
      })
    );
    expect(response.status).toBe(503);
  });

  it("runs one worker step when postgres client is available", async () => {
    globalThis.__strategyLabPostgresClient__ = {
      query: async () => ({
        rows: [],
        rowCount: 0,
      }),
    };
    workerModule.runOneStrategyLabWorkerStep.mockResolvedValueOnce({
      status: "succeeded",
      runId: "run_1",
      jobId: "job_1",
    });

    const response = await POST(
      createMockRequest({
        headers: {
          "content-type": "application/json",
        },
        body: {
          workerId: "worker-a",
          queueName: "strategy_lab_default",
          leaseMs: 5000,
          heartbeatMs: 2500,
        },
      })
    );

    expect(response.status).toBe(200);
    expect(workerModule.runOneStrategyLabWorkerStep).toHaveBeenCalledTimes(1);
    const body = (await response.json()) as {
      ok: boolean;
      data: { status: string; runId: string; jobId: string };
    };
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("succeeded");
  });
});
