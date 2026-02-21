import {
  __resetStrategyLabForTests,
  cancelStrategyLabRun,
  createStrategyLabRun,
  getStrategyLabRun,
  getStrategyLabRunEvents,
  getStrategyLabRunResult,
} from "@/lib/strategy-lab/orchestrator";

jest.mock("@/lib/strategy-lab/executor", () => ({
  normalizeCreateRunRequest: jest.fn((payload: Record<string, unknown>) => ({
    name: String(payload.name ?? "Test Run"),
    exchange: "HOSE",
    symbol: String(payload.symbol ?? "VNM").toUpperCase(),
    strategyType: String(payload.strategyType ?? "sma_crossover"),
    dateRange: undefined,
    capital: 100000,
    params: {},
    config: {},
    priority: "normal",
  })),
  executeRunInput: jest.fn(),
  getExecutionErrorMeta: jest.fn((error: unknown) => ({
    code: (error as { code?: string } | undefined)?.code ?? "RUN_FAILED",
    message: error instanceof Error ? error.message : "Run failed",
  })),
  isValidationError: jest.fn(() => false),
  toValidationError: jest.fn(() => ({ message: "Invalid input." })),
}));

function createMockExecutionResult(runId: string): {
  runId: string;
  symbol: string;
  strategyType: "sma_crossover";
  strategyName: string;
  initialCapital: number;
  generatedAt: string;
  reproMetadata: {
    engineVersion: string;
    dataSnapshotId: string;
    inputHash: string;
  };
  antiBiasSignals: {
    coverageRatio: number;
    largestGapDays: number;
    warnings: string[];
    warningsCount: number;
    tradesPerYear: number;
    lowCoverage: boolean;
  };
  result: {
    trades: never[];
    equityCurve: Array<{ date: Date; equity: number }>;
    metrics: {
      totalReturn: number;
      netReturn: number;
      grossReturn: number;
      cagr: number;
      sharpeRatio: number;
      sortinoRatio: number;
      maxDrawdown: number;
      maxDrawdownDuration: number;
      winRate: number;
      profitFactor: number;
      totalTrades: number;
      avgReturn: number;
      avgWin: number;
      avgLoss: number;
      bestTrade: number;
      worstTrade: number;
      turnover: number;
      exposureRatio: number;
    };
    configApplied: {
      executionModel: "next_open";
      costs: { feeBps: number; sellTaxBps: number; slippageBps: number };
      positionSizing: { mode: "all_in"; lotSize: number };
    };
    diagnostics: {
      inputRows: number;
      usableRows: number;
      droppedRows: number;
      coverageRatio: number;
      largestGapDays: number;
      firstDate: Date;
      lastDate: Date;
      warnings: string[];
    };
  };
} {
  return {
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
  };
}

const executorModule = jest.requireMock("@/lib/strategy-lab/executor") as {
  executeRunInput: jest.Mock;
  getExecutionErrorMeta: jest.Mock;
};

async function flushScheduledRuns(): Promise<void> {
  await jest.runOnlyPendingTimersAsync();
  await Promise.resolve();
}

describe("strategy-lab orchestrator", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await __resetStrategyLabForTests();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("creates and completes a run lifecycle", async () => {
    executorModule.executeRunInput.mockImplementation(async (runId: string) => createMockExecutionResult(runId));

    const created = await createStrategyLabRun({
      symbol: "VNM",
      strategyType: "sma_crossover",
    });

    expect(created.runId).toMatch(/^run_/);
    expect(created.jobId).toMatch(/^job_/);
    expect(created.status).toBe("queued");

    await flushScheduledRuns();

    const run = await getStrategyLabRun(created.runId);
    expect(run.status).toBe("succeeded");
    expect(run.summary?.totalTrades).toBe(0);
    expect(run.attemptCount).toBe(1);
    expect(run.retryCount).toBe(0);

    const summary = await getStrategyLabRunResult(created.runId, "summary");
    expect(summary).toHaveProperty("summary");

    const events = await getStrategyLabRunEvents(created.runId);
    expect(events.map((event) => event.type)).toEqual([
      "run_created",
      "run_started",
      "run_succeeded",
    ]);
  });

  it("cancels a queued run before execution", async () => {
    executorModule.executeRunInput.mockImplementation(async (runId: string) => createMockExecutionResult(runId));

    const created = await createStrategyLabRun({
      symbol: "VNM",
      strategyType: "sma_crossover",
    });

    const cancelled = await cancelStrategyLabRun(created.runId);
    expect(cancelled.status).toBe("cancelled");

    await flushScheduledRuns();

    const run = await getStrategyLabRun(created.runId);
    expect(run.status).toBe("cancelled");
    expect(executorModule.executeRunInput).not.toHaveBeenCalled();

    const events = await getStrategyLabRunEvents(created.runId);
    const cancelledEvent = events.find((event) => event.type === "run_cancelled");
    expect(cancelledEvent?.payload?.["reason"]).toBe("cancel_requested_before_start");
  });

  it("marks run as failed when executor throws", async () => {
    executorModule.executeRunInput.mockRejectedValue(new Error("execution failed"));

    const created = await createStrategyLabRun({
      symbol: "VNM",
      strategyType: "sma_crossover",
    });

    await flushScheduledRuns();

    const run = await getStrategyLabRun(created.runId);
    expect(run.status).toBe("failed");
    expect(run.error?.message).toBe("execution failed");
  });

  it("retries transient execution failure and succeeds", async () => {
    executorModule.getExecutionErrorMeta.mockImplementationOnce(() => ({
      code: "INTERNAL_ERROR",
      message: "temporary backend error",
    }));
    executorModule.executeRunInput
      .mockRejectedValueOnce(new Error("temporary backend error"))
      .mockImplementationOnce(async (runId: string) => createMockExecutionResult(runId));

    const created = await createStrategyLabRun({
      symbol: "VNM",
      strategyType: "sma_crossover",
    });

    await flushScheduledRuns();
    await flushScheduledRuns();

    const run = await getStrategyLabRun(created.runId);
    expect(run.status).toBe("succeeded");
    expect(run.attemptCount).toBe(2);
    expect(run.retryCount).toBe(1);
    expect(run.nextRetryAt).toBeUndefined();
    expect(executorModule.executeRunInput).toHaveBeenCalledTimes(2);

    const events = await getStrategyLabRunEvents(created.runId);
    expect(events.map((event) => event.type)).toEqual([
      "run_created",
      "run_started",
      "run_retry_scheduled",
      "run_started",
      "run_succeeded",
    ]);
    const retryEvent = events.find((event) => event.type === "run_retry_scheduled");
    expect(typeof retryEvent?.payload?.["nextRetryAt"]).toBe("string");
  });

  it("does not retry non-retryable failures", async () => {
    executorModule.getExecutionErrorMeta.mockImplementationOnce(() => ({
      code: "INVALID_INPUT",
      message: "invalid strategy params",
    }));
    executorModule.executeRunInput.mockRejectedValueOnce(new Error("invalid strategy params"));

    const created = await createStrategyLabRun({
      symbol: "VNM",
      strategyType: "sma_crossover",
    });

    await flushScheduledRuns();

    const run = await getStrategyLabRun(created.runId);
    expect(run.status).toBe("failed");
    expect(run.attemptCount).toBe(1);
    expect(run.retryCount).toBe(0);
    expect(executorModule.executeRunInput).toHaveBeenCalledTimes(1);

    const events = await getStrategyLabRunEvents(created.runId);
    expect(events.map((event) => event.type)).toEqual([
      "run_created",
      "run_started",
      "run_failed",
    ]);
  });

  it("fails after max retries are exhausted", async () => {
    executorModule.getExecutionErrorMeta
      .mockImplementationOnce(() => ({
        code: "INTERNAL_ERROR",
        message: "transient outage",
      }))
      .mockImplementationOnce(() => ({
        code: "INTERNAL_ERROR",
        message: "transient outage",
      }))
      .mockImplementationOnce(() => ({
        code: "INTERNAL_ERROR",
        message: "transient outage",
      }));
    executorModule.executeRunInput.mockRejectedValue(new Error("transient outage"));

    const created = await createStrategyLabRun({
      symbol: "VNM",
      strategyType: "sma_crossover",
    });

    await flushScheduledRuns();
    await flushScheduledRuns();
    await flushScheduledRuns();

    const run = await getStrategyLabRun(created.runId);
    expect(run.status).toBe("failed");
    expect(run.attemptCount).toBe(3);
    expect(run.retryCount).toBe(2);
    expect(run.nextRetryAt).toBeUndefined();
    expect(executorModule.executeRunInput).toHaveBeenCalledTimes(3);

    const events = await getStrategyLabRunEvents(created.runId);
    expect(events.map((event) => event.type)).toEqual([
      "run_created",
      "run_started",
      "run_retry_scheduled",
      "run_started",
      "run_retry_scheduled",
      "run_started",
      "run_failed",
    ]);
  });

  it("treats duplicate cancel calls as idempotent while run is still running", async () => {
    executorModule.executeRunInput.mockImplementation(
      (_runId: string, _input: unknown, options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          const rejectAborted = () => {
            const error = new Error("Run was cancelled.");
            (error as Error & { code?: string }).code = "RUN_ABORTED";
            reject(error);
          };

          if (options?.signal?.aborted) {
            rejectAborted();
            return;
          }

          options?.signal?.addEventListener("abort", rejectAborted, { once: true });
        })
    );

    const created = await createStrategyLabRun({
      symbol: "VNM",
      strategyType: "sma_crossover",
    });

    await flushScheduledRuns();
    expect((await getStrategyLabRun(created.runId)).status).toBe("running");

    const first = await cancelStrategyLabRun(created.runId);
    expect(first.cancelRequested).toBe(true);

    let secondCallHandled = false;
    try {
      const second = await cancelStrategyLabRun(created.runId);
      secondCallHandled = second.cancelRequested;
    } catch (error) {
      expect(error).toMatchObject({
        code: "RUN_NOT_CANCELLABLE",
        status: 409,
      });
      secondCallHandled = true;
    }
    expect(secondCallHandled).toBe(true);

    await Promise.resolve();

    const run = await getStrategyLabRun(created.runId);
    expect(run.status).toBe("cancelled");

    const events = await getStrategyLabRunEvents(created.runId);
    expect(events.filter((event) => event.type === "run_cancel_requested")).toHaveLength(1);
    expect(events.filter((event) => event.type === "run_cancelled")).toHaveLength(1);
  });

  it("cancels a running run via abort signal", async () => {
    executorModule.executeRunInput.mockImplementation(
      (_runId: string, _input: unknown, options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          const rejectAborted = () => {
            const error = new Error("Run was cancelled.");
            (error as Error & { code?: string }).code = "RUN_ABORTED";
            reject(error);
          };

          if (options?.signal?.aborted) {
            rejectAborted();
            return;
          }

          options?.signal?.addEventListener("abort", rejectAborted, { once: true });
        })
    );

    const created = await createStrategyLabRun({
      symbol: "VNM",
      strategyType: "sma_crossover",
    });

    await flushScheduledRuns();
    const runWhileRunning = await getStrategyLabRun(created.runId);
    expect(runWhileRunning.status).toBe("running");

    const cancelResponse = await cancelStrategyLabRun(created.runId);
    expect(cancelResponse.cancelRequested).toBe(true);

    await Promise.resolve();
    const runAfterCancel = await getStrategyLabRun(created.runId);
    expect(runAfterCancel.status).toBe("cancelled");

    const events = await getStrategyLabRunEvents(created.runId);
    expect(events.map((event) => event.type)).toContain("run_cancel_requested");
    expect(events.map((event) => event.type)).toContain("run_cancelled");
    const cancelledEvent = events.find((event) => event.type === "run_cancelled");
    expect(cancelledEvent?.payload?.["reason"]).toBe("abort_signal");
  });
});
