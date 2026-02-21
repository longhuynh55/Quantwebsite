import {
  createStrategyLabRunClient,
  StrategyLabClientError,
  waitForStrategyLabRunTerminal,
} from "@/lib/strategy-lab/client";

function createResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("strategy-lab client", () => {
  beforeEach(() => {
    (global as typeof globalThis & { fetch?: typeof fetch }).fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates run successfully", async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(
      createResponse({
        ok: true,
        data: {
          runId: "run-1",
          jobId: "job-1",
          status: "queued",
          pollUrl: "/api/strategy-lab/runs/run-1",
          eventsUrl: "/api/strategy-lab/runs/run-1/events",
          resultUrl: "/api/strategy-lab/runs/run-1/result",
        },
      }) as Response
    );

    const response = await createStrategyLabRunClient({
      symbol: "FPT",
      strategyType: "sma_crossover",
      params: { shortPeriod: 10, longPeriod: 20 },
      exchange: "HOSE",
    });

    expect(response.runId).toBe("run-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/strategy-lab/runs",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("throws typed error for API failures", async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(
      createResponse(
        {
          ok: false,
          error: {
            code: "INVALID_INPUT",
            message: "symbol is required.",
          },
        },
        400
      ) as Response
    );

    await expect(
      createStrategyLabRunClient({
        symbol: "",
        strategyType: "sma_crossover",
        exchange: "HOSE",
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<StrategyLabClientError>>({
        code: "INVALID_INPUT",
        status: 400,
        message: "symbol is required.",
      })
    );
  });

  it("polls run until terminal status", async () => {
    const runResponses = [
      { status: "queued" },
      { status: "running" },
      { status: "succeeded" },
    ];
    const statusEvents: string[] = [];

    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockImplementation(async () => {
      const current = runResponses.shift() ?? { status: "succeeded" };
      return createResponse({
        ok: true,
        data: {
          runId: "run-1",
          jobId: "job-1",
          status: current.status,
          input: {
            name: "Test",
            exchange: "HOSE",
            symbol: "FPT",
            strategyType: "sma_crossover",
            capital: 100000,
            params: { shortPeriod: 10, longPeriod: 20 },
            config: {},
            priority: "normal",
          },
          cancelRequested: false,
          createdAt: "2026-02-20T00:00:00.000Z",
          updatedAt: "2026-02-20T00:00:00.000Z",
        },
      }) as Response;
    });

    const run = await waitForStrategyLabRunTerminal("run-1", {
      pollIntervalMs: 1,
      timeoutMs: 100,
      sleep: async () => undefined,
      onStatusChange: (nextRun) => statusEvents.push(nextRun.status),
    });

    expect(run.status).toBe("succeeded");
    expect(statusEvents).toEqual(["queued", "running", "succeeded"]);
  });
});
