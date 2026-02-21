import { __resetStrategyLabForTests } from "@/lib/strategy-lab/orchestrator";
import { POST as postRun } from "@/app/api/strategy-lab/runs/route";
import { GET as getRun } from "@/app/api/strategy-lab/runs/[runId]/route";
import { GET as getRunResult } from "@/app/api/strategy-lab/runs/[runId]/result/route";
import { GET as getRunEvents } from "@/app/api/strategy-lab/runs/[runId]/events/route";
import { POST as postRunCancel } from "@/app/api/strategy-lab/runs/[runId]/cancel/route";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/lib/strategy-lab/executor", () => ({
  normalizeCreateRunRequest: jest.fn((payload: Record<string, unknown>) => ({
    name: String(payload.name ?? "API test run"),
    exchange: "HOSE",
    symbol: String(payload.symbol ?? "VNM").toUpperCase(),
    strategyType: String(payload.strategyType ?? "sma_crossover"),
    dateRange: undefined,
    capital: 100000,
    params: {},
    config: {},
    priority: "normal",
  })),
  executeRunInput: jest.fn(async (runId: string) => ({
    runId,
    symbol: "VNM",
    strategyType: "sma_crossover",
    strategyName: "SMA Crossover",
    initialCapital: 100000,
    generatedAt: new Date().toISOString(),
    reproMetadata: {
      engineVersion: "quant-website@0.1.0",
      dataSnapshotId: "snapshot-1",
      inputHash: "hash-1",
    },
    antiBiasSignals: {
      coverageRatio: 1,
      largestGapDays: 2,
      warnings: [],
      warningsCount: 0,
      tradesPerYear: 0,
      lowCoverage: false,
    },
    result: {
      trades: [],
      equityCurve: [{ date: new Date("2020-01-02"), equity: 100000 }],
      metrics: {
        totalReturn: 0.1,
        netReturn: 0.1,
        grossReturn: 0.11,
        cagr: 0.05,
        sharpeRatio: 1.2,
        sortinoRatio: 1.5,
        maxDrawdown: 0.08,
        maxDrawdownDuration: 30,
        winRate: 0.55,
        profitFactor: 1.3,
        totalTrades: 10,
        avgReturn: 0.01,
        avgWin: 0.02,
        avgLoss: -0.01,
        bestTrade: 0.08,
        worstTrade: -0.05,
        turnover: 1.1,
        exposureRatio: 0.65,
      },
      configApplied: {
        executionModel: "next_open",
        costs: { feeBps: 15, sellTaxBps: 10, slippageBps: 5 },
        positionSizing: { mode: "all_in", lotSize: 1 },
      },
      diagnostics: {
        inputRows: 100,
        usableRows: 100,
        droppedRows: 0,
        coverageRatio: 1,
        largestGapDays: 2,
        firstDate: new Date("2020-01-01"),
        lastDate: new Date("2020-12-31"),
        warnings: [],
      },
    },
  })),
  getExecutionErrorMeta: jest.fn((error: unknown) => ({
    code: "RUN_FAILED",
    message: error instanceof Error ? error.message : "Run failed",
  })),
  isValidationError: jest.fn(() => false),
  toValidationError: jest.fn(() => ({ message: "Invalid input." })),
}));

async function flushScheduledRuns(): Promise<void> {
  await jest.runOnlyPendingTimersAsync();
  await Promise.resolve();
}

const executorModule = jest.requireMock("@/lib/strategy-lab/executor") as {
  executeRunInput: jest.Mock;
  getExecutionErrorMeta: jest.Mock;
};

function createMockRequest(input: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}): Request {
  const normalizedHeaders = new Map<string, string>();
  for (const [key, value] of Object.entries(input.headers ?? {})) {
    normalizedHeaders.set(key.toLowerCase(), value);
  }

  return {
    url: input.url,
    method: input.method ?? "GET",
    headers: {
      get: (name: string) => normalizedHeaders.get(name.toLowerCase()) ?? null,
    },
    json: async () => input.body,
  } as unknown as Request;
}

describe("POST/GET strategy-lab runs API flow", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await __resetStrategyLabForTests();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("creates a run and serves run/result endpoints", async () => {
    const createResponse = await postRun(
      createMockRequest({
        url: "http://localhost/api/strategy-lab/runs",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: {
          symbol: "VNM",
          strategyType: "sma_crossover",
        },
      })
    );

    expect(createResponse.status).toBe(202);
    const createBody = (await createResponse.json()) as {
      ok: boolean;
      data: { runId: string; jobId: string };
    };
    expect(createBody.ok).toBe(true);
    expect(createBody.data.runId).toMatch(/^run_/);
    expect(createBody.data.jobId).toMatch(/^job_/);

    await flushScheduledRuns();

    const runResponse = await getRun(
      createMockRequest({ url: `http://localhost/api/strategy-lab/runs/${createBody.data.runId}` }),
      { params: Promise.resolve({ runId: createBody.data.runId }) }
    );
    expect(runResponse.status).toBe(200);
    const runBody = (await runResponse.json()) as {
      ok: boolean;
      data: { status: string };
    };
    expect(runBody.ok).toBe(true);
    expect(runBody.data.status).toBe("succeeded");

    const resultResponse = await getRunResult(
      createMockRequest({ url: `http://localhost/api/strategy-lab/runs/${createBody.data.runId}/result?include=summary` }),
      { params: Promise.resolve({ runId: createBody.data.runId }) }
    );
    expect(resultResponse.status).toBe(200);
    const resultBody = (await resultResponse.json()) as {
      ok: boolean;
      data: { summary: { metrics: { totalReturn: number } } };
    };
    expect(resultBody.ok).toBe(true);
    expect(resultBody.data.summary.metrics.totalReturn).toBe(0.1);
  });

  it("returns same run for same Idempotency-Key and payload", async () => {
    const headers = {
      "content-type": "application/json",
      "idempotency-key": "idem-key-001",
    };

    const firstCreateResponse = await postRun(
      createMockRequest({
        url: "http://localhost/api/strategy-lab/runs",
        method: "POST",
        headers,
        body: {
          symbol: "VNM",
          strategyType: "sma_crossover",
        },
      })
    );
    const secondCreateResponse = await postRun(
      createMockRequest({
        url: "http://localhost/api/strategy-lab/runs",
        method: "POST",
        headers,
        body: {
          symbol: "VNM",
          strategyType: "sma_crossover",
        },
      })
    );

    expect(firstCreateResponse.status).toBe(202);
    expect(secondCreateResponse.status).toBe(202);

    const firstBody = (await firstCreateResponse.json()) as {
      ok: boolean;
      data: { runId: string; jobId: string };
    };
    const secondBody = (await secondCreateResponse.json()) as {
      ok: boolean;
      data: { runId: string; jobId: string };
    };

    expect(firstBody.ok).toBe(true);
    expect(secondBody.ok).toBe(true);
    expect(secondBody.data.runId).toBe(firstBody.data.runId);
    expect(secondBody.data.jobId).toBe(firstBody.data.jobId);

    await flushScheduledRuns();
    expect(executorModule.executeRunInput).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when same Idempotency-Key is reused with different payload", async () => {
    const headers = {
      "content-type": "application/json",
      "idempotency-key": "idem-key-conflict-001",
    };

    const firstCreateResponse = await postRun(
      createMockRequest({
        url: "http://localhost/api/strategy-lab/runs",
        method: "POST",
        headers,
        body: {
          symbol: "VNM",
          strategyType: "sma_crossover",
        },
      })
    );
    expect(firstCreateResponse.status).toBe(202);

    const conflictResponse = await postRun(
      createMockRequest({
        url: "http://localhost/api/strategy-lab/runs",
        method: "POST",
        headers,
        body: {
          symbol: "HPG",
          strategyType: "sma_crossover",
        },
      })
    );

    expect(conflictResponse.status).toBe(409);
    const conflictBody = (await conflictResponse.json()) as {
      ok: boolean;
      error: { code: string };
    };
    expect(conflictBody.ok).toBe(false);
    expect(conflictBody.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
  });

  it("supports cursor/limit pagination for result include=equity", async () => {
    executorModule.executeRunInput.mockImplementationOnce(async (runId: string) => ({
      runId,
      symbol: "VNM",
      strategyType: "sma_crossover",
      strategyName: "SMA Crossover",
      initialCapital: 100000,
      generatedAt: new Date().toISOString(),
      reproMetadata: {
        engineVersion: "quant-website@0.1.0",
        dataSnapshotId: "snapshot-1",
        inputHash: "hash-1",
      },
      antiBiasSignals: {
        coverageRatio: 1,
        largestGapDays: 2,
        warnings: [],
        warningsCount: 0,
        tradesPerYear: 0,
        lowCoverage: false,
      },
      result: {
        trades: [],
        equityCurve: [
          { date: new Date("2020-01-02"), equity: 100000 },
          { date: new Date("2020-01-03"), equity: 100500 },
          { date: new Date("2020-01-06"), equity: 100900 },
        ],
        metrics: {
          totalReturn: 0.1,
          netReturn: 0.1,
          grossReturn: 0.11,
          cagr: 0.05,
          sharpeRatio: 1.2,
          sortinoRatio: 1.5,
          maxDrawdown: 0.08,
          maxDrawdownDuration: 30,
          winRate: 0.55,
          profitFactor: 1.3,
          totalTrades: 10,
          avgReturn: 0.01,
          avgWin: 0.02,
          avgLoss: -0.01,
          bestTrade: 0.08,
          worstTrade: -0.05,
          turnover: 1.1,
          exposureRatio: 0.65,
        },
        configApplied: {
          executionModel: "next_open",
          costs: { feeBps: 15, sellTaxBps: 10, slippageBps: 5 },
          positionSizing: { mode: "all_in", lotSize: 1 },
        },
        diagnostics: {
          inputRows: 100,
          usableRows: 100,
          droppedRows: 0,
          coverageRatio: 1,
          largestGapDays: 2,
          firstDate: new Date("2020-01-01"),
          lastDate: new Date("2020-12-31"),
          warnings: [],
        },
      },
    }));

    const createResponse = await postRun(
      createMockRequest({
        url: "http://localhost/api/strategy-lab/runs",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: {
          symbol: "VNM",
          strategyType: "sma_crossover",
        },
      })
    );
    const createBody = (await createResponse.json()) as {
      data: { runId: string };
    };

    await flushScheduledRuns();

    const resultResponse = await getRunResult(
      createMockRequest({
        url: `http://localhost/api/strategy-lab/runs/${createBody.data.runId}/result?include=equity&cursor=1&limit=2`,
      }),
      { params: Promise.resolve({ runId: createBody.data.runId }) }
    );

    expect(resultResponse.status).toBe(200);
    const resultBody = (await resultResponse.json()) as {
      ok: boolean;
      data: {
        equityCurve: Array<{ equity: number }>;
        page: { cursor: string; limit: number; nextCursor: string | null; total: number };
      };
    };

    expect(resultBody.ok).toBe(true);
    expect(resultBody.data.equityCurve).toHaveLength(2);
    expect(resultBody.data.equityCurve[0]?.equity).toBe(100500);
    expect(resultBody.data.page).toEqual({
      cursor: "1",
      limit: 2,
      nextCursor: null,
      total: 3,
    });
  });

  it("paginates run events via since/limit", async () => {
    const createResponse = await postRun(
      createMockRequest({
        url: "http://localhost/api/strategy-lab/runs",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: {
          symbol: "VNM",
          strategyType: "sma_crossover",
        },
      })
    );
    const createBody = (await createResponse.json()) as {
      data: { runId: string };
    };

    await flushScheduledRuns();

    const eventsResponse = await getRunEvents(
      createMockRequest({
        url: `http://localhost/api/strategy-lab/runs/${createBody.data.runId}/events?since=1&limit=2`,
      }),
      { params: Promise.resolve({ runId: createBody.data.runId }) }
    );

    expect(eventsResponse.status).toBe(200);
    const eventsBody = (await eventsResponse.json()) as {
      ok: boolean;
      data: { events: Array<{ sequence: number; type: string }> };
    };
    expect(eventsBody.ok).toBe(true);
    expect(eventsBody.data.events).toHaveLength(2);
    expect(eventsBody.data.events.map((event) => event.type)).toEqual([
      "run_started",
      "run_succeeded",
    ]);
    expect(eventsBody.data.events.every((event) => event.sequence > 1)).toBe(true);
  });

  it("falls back to full event feed when since/limit are invalid", async () => {
    const createResponse = await postRun(
      createMockRequest({
        url: "http://localhost/api/strategy-lab/runs",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: {
          symbol: "VNM",
          strategyType: "sma_crossover",
        },
      })
    );
    const createBody = (await createResponse.json()) as {
      data: { runId: string };
    };

    await flushScheduledRuns();

    const eventsResponse = await getRunEvents(
      createMockRequest({
        url: `http://localhost/api/strategy-lab/runs/${createBody.data.runId}/events?since=-10&limit=0`,
      }),
      { params: Promise.resolve({ runId: createBody.data.runId }) }
    );
    expect(eventsResponse.status).toBe(200);

    const eventsBody = (await eventsResponse.json()) as {
      ok: boolean;
      data: { events: Array<{ type: string }> };
    };
    expect(eventsBody.ok).toBe(true);
    expect(eventsBody.data.events.map((event) => event.type)).toEqual([
      "run_created",
      "run_started",
      "run_succeeded",
    ]);
  });

  it("returns 409 when cancelling a terminal run", async () => {
    const createResponse = await postRun(
      createMockRequest({
        url: "http://localhost/api/strategy-lab/runs",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: {
          symbol: "VNM",
          strategyType: "sma_crossover",
        },
      })
    );
    const createBody = (await createResponse.json()) as {
      data: { runId: string };
    };

    await flushScheduledRuns();

    const cancelResponse = await postRunCancel(
      createMockRequest({
        url: `http://localhost/api/strategy-lab/runs/${createBody.data.runId}/cancel`,
        method: "POST",
      }),
      { params: Promise.resolve({ runId: createBody.data.runId }) }
    );
    expect(cancelResponse.status).toBe(409);
    const cancelBody = (await cancelResponse.json()) as {
      ok: boolean;
      error: { code: string };
    };
    expect(cancelBody.ok).toBe(false);
    expect(cancelBody.error.code).toBe("RUN_NOT_CANCELLABLE");
  });

  it("exposes retry event and counters after transient failure", async () => {
    executorModule.getExecutionErrorMeta.mockImplementationOnce(() => ({
      code: "INTERNAL_ERROR",
      message: "temporary backend error",
    }));
    executorModule.executeRunInput
      .mockRejectedValueOnce(new Error("temporary backend error"))
      .mockImplementationOnce(async (runId: string) => ({
        runId,
        symbol: "VNM",
        strategyType: "sma_crossover",
        strategyName: "SMA Crossover",
        initialCapital: 100000,
        generatedAt: new Date().toISOString(),
        reproMetadata: {
          engineVersion: "quant-website@0.1.0",
          dataSnapshotId: "snapshot-1",
          inputHash: "hash-1",
        },
        antiBiasSignals: {
          coverageRatio: 1,
          largestGapDays: 2,
          warnings: [],
          warningsCount: 0,
          tradesPerYear: 0,
          lowCoverage: false,
        },
        result: {
          trades: [],
          equityCurve: [{ date: new Date("2020-01-02"), equity: 100000 }],
          metrics: {
            totalReturn: 0.1,
            netReturn: 0.1,
            grossReturn: 0.11,
            cagr: 0.05,
            sharpeRatio: 1.2,
            sortinoRatio: 1.5,
            maxDrawdown: 0.08,
            maxDrawdownDuration: 30,
            winRate: 0.55,
            profitFactor: 1.3,
            totalTrades: 10,
            avgReturn: 0.01,
            avgWin: 0.02,
            avgLoss: -0.01,
            bestTrade: 0.08,
            worstTrade: -0.05,
            turnover: 1.1,
            exposureRatio: 0.65,
          },
          configApplied: {
            executionModel: "next_open",
            costs: { feeBps: 15, sellTaxBps: 10, slippageBps: 5 },
            positionSizing: { mode: "all_in", lotSize: 1 },
          },
          diagnostics: {
            inputRows: 100,
            usableRows: 100,
            droppedRows: 0,
            coverageRatio: 1,
            largestGapDays: 2,
            firstDate: new Date("2020-01-01"),
            lastDate: new Date("2020-12-31"),
            warnings: [],
          },
        },
      }));

    const createResponse = await postRun(
      createMockRequest({
        url: "http://localhost/api/strategy-lab/runs",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: {
          symbol: "VNM",
          strategyType: "sma_crossover",
        },
      })
    );
    const createBody = (await createResponse.json()) as {
      data: { runId: string };
    };

    await flushScheduledRuns();
    await flushScheduledRuns();

    const runResponse = await getRun(
      createMockRequest({ url: `http://localhost/api/strategy-lab/runs/${createBody.data.runId}` }),
      { params: Promise.resolve({ runId: createBody.data.runId }) }
    );
    const runBody = (await runResponse.json()) as {
      ok: boolean;
      data: { status: string; attemptCount: number; retryCount: number };
    };
    expect(runBody.ok).toBe(true);
    expect(runBody.data.status).toBe("succeeded");
    expect(runBody.data.attemptCount).toBe(2);
    expect(runBody.data.retryCount).toBe(1);

    const eventsResponse = await getRunEvents(
      createMockRequest({
        url: `http://localhost/api/strategy-lab/runs/${createBody.data.runId}/events`,
      }),
      { params: Promise.resolve({ runId: createBody.data.runId }) }
    );
    const eventsBody = (await eventsResponse.json()) as {
      ok: boolean;
      data: { events: Array<{ type: string }> };
    };
    expect(eventsBody.ok).toBe(true);
    expect(eventsBody.data.events.map((event) => event.type)).toEqual([
      "run_created",
      "run_started",
      "run_retry_scheduled",
      "run_started",
      "run_succeeded",
    ]);
  });
});
