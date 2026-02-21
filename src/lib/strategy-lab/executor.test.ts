import { normalizeCreateRunRequest } from "@/lib/strategy-lab/executor";

describe("strategy-lab executor normalizeCreateRunRequest", () => {
  it("normalizes a valid payload", () => {
    const normalized = normalizeCreateRunRequest({
      name: "SMA run",
      symbol: "vnm",
      strategyType: "sma_crossover",
      params: { shortPeriod: 10, longPeriod: 20 },
      config: { executionModel: "next_open", feeBps: 15, sellTaxBps: 10, slippageBps: 5, lotSize: 1 },
      dateRange: { from: "2020-01-01", to: "2020-12-31" },
    });

    expect(normalized.exchange).toBe("HOSE");
    expect(normalized.symbol).toBe("VNM");
    expect(normalized.capital).toBe(100000);
    expect(normalized.priority).toBe("normal");
    expect(normalized.strategyType).toBe("sma_crossover");
    expect(normalized.params).toEqual({ shortPeriod: 10, longPeriod: 20 });
    expect(normalized.dateRange).toEqual({ from: "2020-01-01", to: "2020-12-31" });
  });

  it("rejects non-HOSE exchange", () => {
    expect(() =>
      normalizeCreateRunRequest({
        symbol: "VNM",
        strategyType: "sma_crossover",
        exchange: "HNX",
      })
    ).toThrow('Unsupported exchange. Only "HOSE" is supported.');
  });

  it("rejects invalid strategy params", () => {
    expect(() =>
      normalizeCreateRunRequest({
        symbol: "VNM",
        strategyType: "sma_crossover",
        params: { shortPeriod: 30, longPeriod: 20 },
      })
    ).toThrow("Invalid strategy parameters.");
  });
});
