import { createStrategyLabRepository } from "@/lib/strategy-lab/repository";
import { resetStrategyLabStore } from "@/lib/strategy-lab/store";

describe("strategy-lab repository in-memory fallback", () => {
  beforeEach(() => {
    resetStrategyLabStore();
  });

  afterEach(() => {
    resetStrategyLabStore();
  });

  it("uses in-memory backend and preserves existing store behavior", async () => {
    const repository = createStrategyLabRepository();
    expect(repository.backend).toBe("memory");

    const created = await repository.createQueuedRun({
      name: "Repo fallback run",
      exchange: "HOSE",
      symbol: "VNM",
      strategyType: "sma_crossover",
      capital: 100000,
      params: {},
      config: {},
      priority: "normal",
    });

    const run = await repository.getRun(created.run.runId);
    expect(run).not.toBeNull();
    expect(run?.input.symbol).toBe("VNM");
    expect(run?.status).toBe("queued");
  });
});
