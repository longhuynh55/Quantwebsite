import { runOneStrategyLabWorkerStep } from "@/lib/strategy-lab/worker";
import type { StrategyLabPostgresClient } from "@/lib/strategy-lab/repository.postgres";

jest.mock("@/lib/strategy-lab/executor", () => ({
  normalizeCreateRunRequest: jest.fn(() => ({
    name: "Worker test run",
    exchange: "HOSE",
    symbol: "VNM",
    strategyType: "sma_crossover",
    dateRange: undefined,
    capital: 100000,
    params: {},
    config: {},
    priority: "normal",
  })),
  executeRunInput: jest.fn(),
  getExecutionErrorMeta: jest.fn((error: unknown) => ({
    code: "RUN_FAILED",
    message: error instanceof Error ? error.message : "Run failed",
  })),
}));

const executorModule = jest.requireMock("@/lib/strategy-lab/executor") as {
  executeRunInput: jest.Mock;
  getExecutionErrorMeta: jest.Mock;
};

function createMockClient(): { client: StrategyLabPostgresClient; query: jest.Mock } {
  const query = jest.fn(async (queryText: string, _values?: readonly unknown[]) => {
    if (queryText.includes("SELECT id, request_payload, cancel_requested")) {
      return {
        rows: [
          {
            id: "run_1",
            request_payload: {
              symbol: "VNM",
              strategyType: "sma_crossover",
            },
            cancel_requested: false,
          },
        ],
        rowCount: 1,
      };
    }
    if (queryText.includes("SELECT cancel_requested")) {
      return {
        rows: [{ cancel_requested: false }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  });
  return {
    client: {
      query: async <T = unknown>(queryText: string, values?: readonly unknown[]) => {
        const result = await query(queryText, values);
        return {
          rows: result.rows as T[],
          rowCount: result.rowCount as number | null,
        };
      },
    },
    query,
  };
}

describe("strategy-lab worker step", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns idle when no job is leased", async () => {
    const { client } = createMockClient();
    const result = await runOneStrategyLabWorkerStep(
      {
        client,
        workerId: "worker-a",
      },
      {
        recoverExpired: jest.fn(async () => 0),
        leaseNext: jest.fn(async () => null),
        heartbeat: jest.fn(async () => true),
      }
    );

    expect(result).toEqual({ status: "idle" });
  });

  it("moves job to retry_wait for retryable failures", async () => {
    const { client, query } = createMockClient();
    executorModule.getExecutionErrorMeta.mockReturnValueOnce({
      code: "INTERNAL_ERROR",
      message: "temporary failure",
    });
    executorModule.executeRunInput.mockRejectedValueOnce(new Error("temporary failure"));

    const result = await runOneStrategyLabWorkerStep(
      {
        client,
        workerId: "worker-a",
      },
      {
        recoverExpired: jest.fn(async () => 0),
        leaseNext: jest.fn(async () => ({
          jobId: "job_1",
          runId: "run_1",
          queueName: "strategy_lab_default",
          attempt: 0,
          maxAttempts: 3,
          priority: 5,
          leaseExpiresAt: null,
        })),
        heartbeat: jest.fn(async () => true),
      }
    );

    expect(result.status).toBe("retry_wait");
    const sqlCalls = query.mock.calls.map((call) => String(call[0]));
    const paramsCalls = query.mock.calls.map((call) => call[1]);
    expect(sqlCalls.some((sql) => sql.includes("status = 'retry_wait'"))).toBe(true);
    expect(paramsCalls.some((params) => Array.isArray(params) && params.includes("run_retry_scheduled"))).toBe(true);
  });

  it("marks run/job succeeded when execution succeeds", async () => {
    const { client, query } = createMockClient();
    executorModule.executeRunInput.mockResolvedValueOnce({
      runId: "run_1",
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
    });

    const result = await runOneStrategyLabWorkerStep(
      {
        client,
        workerId: "worker-a",
      },
      {
        recoverExpired: jest.fn(async () => 0),
        leaseNext: jest.fn(async () => ({
          jobId: "job_1",
          runId: "run_1",
          queueName: "strategy_lab_default",
          attempt: 0,
          maxAttempts: 3,
          priority: 5,
          leaseExpiresAt: null,
        })),
        heartbeat: jest.fn(async () => true),
      }
    );

    expect(result.status).toBe("succeeded");
    const sqlCalls = query.mock.calls.map((call) => String(call[0]));
    const paramsCalls = query.mock.calls.map((call) => call[1]);
    expect(sqlCalls.some((sql) => sql.includes("status = 'succeeded'"))).toBe(true);
    expect(paramsCalls.some((params) => Array.isArray(params) && params.includes("run_succeeded"))).toBe(true);
  });
});
