import {
  createQueuedRun,
  getRun,
  resetStrategyLabStore,
  setStrategyLabStoreAdapter,
  updateRun,
  type StrategyLabStoreAdapter,
  type StrategyLabStoreSnapshot,
} from "@/lib/strategy-lab/store";

describe("strategy-lab store persistence adapter", () => {
  beforeEach(() => {
    setStrategyLabStoreAdapter(null);
    resetStrategyLabStore();
  });

  afterEach(() => {
    setStrategyLabStoreAdapter(null);
    resetStrategyLabStore();
  });

  it("hydrates state from adapter snapshot", () => {
    const snapshot: StrategyLabStoreSnapshot = {
      version: 1,
      counters: {
        runCounter: 42,
        jobCounter: 42,
        eventCounter: 0,
      },
      runs: [
        {
          runId: "run_00000042",
          jobId: "job_00000042",
          status: "queued",
          input: {
            name: "Snapshot run",
            exchange: "HOSE",
            symbol: "VNM",
            strategyType: "sma_crossover",
            capital: 100000,
            params: {},
            config: {},
            priority: "normal",
          },
          cancelRequested: false,
          createdAt: "2026-02-21T00:00:00.000Z",
          updatedAt: "2026-02-21T00:00:00.000Z",
        },
      ],
      jobs: [
        {
          jobId: "job_00000042",
          runId: "run_00000042",
          status: "queued",
          createdAt: "2026-02-21T00:00:00.000Z",
          updatedAt: "2026-02-21T00:00:00.000Z",
        },
      ],
      results: [],
      eventsByRunId: [],
    };

    const adapter: StrategyLabStoreAdapter = {
      name: "test-adapter",
      loadSnapshot: () => snapshot,
    };
    setStrategyLabStoreAdapter(adapter);

    const hydratedRun = getRun("run_00000042");
    expect(hydratedRun).not.toBeNull();
    expect(hydratedRun?.input.symbol).toBe("VNM");

    const created = createQueuedRun({
      name: "new run",
      exchange: "HOSE",
      symbol: "AAA",
      strategyType: "sma_crossover",
      capital: 100000,
      params: {},
      config: {},
      priority: "normal",
    });
    expect(created.run.runId).toBe("run_00000043");
  });

  it("persists snapshot on store mutations", () => {
    const persistSnapshot = jest.fn();
    const adapter: StrategyLabStoreAdapter = {
      name: "persist-spy",
      loadSnapshot: () => null,
      persistSnapshot,
    };
    setStrategyLabStoreAdapter(adapter);

    const created = createQueuedRun({
      name: "persist run",
      exchange: "HOSE",
      symbol: "VNM",
      strategyType: "sma_crossover",
      capital: 100000,
      params: {},
      config: {},
      priority: "normal",
    });
    expect(persistSnapshot).toHaveBeenCalledTimes(1);

    updateRun(created.run.runId, { cancelRequested: true });
    expect(persistSnapshot).toHaveBeenCalledTimes(2);
  });
});
