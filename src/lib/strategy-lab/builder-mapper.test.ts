import type { Strategy, StrategyNodeData } from "@/lib/stores/strategyBuilderStore";
import {
  buildStrategyLabRunRequest,
  StrategyBuilderMappingError,
} from "@/lib/strategy-lab/builder-mapper";

function createNode(id: string, data: StrategyNodeData, type = data.type) {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data,
  };
}

function createStrategy(nodes: ReturnType<typeof createNode>[]): Strategy {
  return {
    id: "strategy-1",
    name: "Test Strategy",
    nodes,
    edges: [],
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  };
}

describe("buildStrategyLabRunRequest", () => {
  it("maps MA indicators to sma_crossover params", () => {
    const strategy = createStrategy([
      createNode("data-1", {
        type: "dataSource",
        label: "Data",
        config: {
          label: "Data",
          stocks: ["fpt"],
          timeframe: "1d",
          startDate: "2023-01-01",
          endDate: "2024-01-01",
        },
      }),
      createNode("indicator-1", {
        type: "indicator",
        label: "MA short",
        config: {
          label: "MA short",
          indicatorType: "ma",
          period: 10,
        },
      }),
      createNode("indicator-2", {
        type: "indicator",
        label: "MA long",
        config: {
          label: "MA long",
          indicatorType: "ma",
          period: 30,
        },
      }),
    ]);

    const payload = buildStrategyLabRunRequest(strategy, { capital: 250000 });
    expect(payload.symbol).toBe("FPT");
    expect(payload.strategyType).toBe("sma_crossover");
    expect(payload.params).toEqual({ shortPeriod: 10, longPeriod: 30 });
    expect(payload.capital).toBe(250000);
    expect(payload.dateRange).toEqual({
      from: "2023-01-01",
      to: "2024-01-01",
    });
  });

  it("maps RSI indicator and filter thresholds", () => {
    const strategy = createStrategy([
      createNode("data-1", {
        type: "dataSource",
        label: "Data",
        config: {
          label: "Data",
          stocks: ["VNM"],
          timeframe: "1d",
          startDate: "",
          endDate: "",
        },
      }),
      createNode("indicator-1", {
        type: "indicator",
        label: "RSI",
        config: {
          label: "RSI",
          indicatorType: "rsi",
          period: 9,
        },
      }),
      createNode("filter-1", {
        type: "filter",
        label: "Oversold",
        config: {
          label: "Oversold",
          filterType: "rsi_oversold",
          value: 25,
          comparisonOperator: "<",
        },
      }),
      createNode("filter-2", {
        type: "filter",
        label: "Overbought",
        config: {
          label: "Overbought",
          filterType: "rsi_overbought",
          value: 75,
          comparisonOperator: ">",
        },
      }),
    ]);

    const payload = buildStrategyLabRunRequest(strategy);
    expect(payload.strategyType).toBe("rsi_mean_reversion");
    expect(payload.params).toEqual({
      period: 9,
      oversold: 25,
      overbought: 75,
    });
  });

  it("maps unsupported indicator types to momentum fallback", () => {
    const strategy = createStrategy([
      createNode("data-1", {
        type: "dataSource",
        label: "Data",
        config: {
          label: "Data",
          stocks: ["HPG"],
          timeframe: "1d",
          startDate: "",
          endDate: "",
        },
      }),
      createNode("indicator-1", {
        type: "indicator",
        label: "MACD",
        config: {
          label: "MACD",
          indicatorType: "macd",
          period: 20,
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
        },
      }),
      createNode("filter-1", {
        type: "filter",
        label: "Threshold",
        config: {
          label: "Threshold",
          filterType: "price_above",
          value: 8,
          comparisonOperator: ">",
        },
      }),
    ]);

    const payload = buildStrategyLabRunRequest(strategy);
    expect(payload.strategyType).toBe("momentum");
    expect(payload.params).toEqual({
      lookback: 20,
      threshold: 0.08,
    });
  });

  it("throws when symbol is missing", () => {
    const strategy = createStrategy([
      createNode("data-1", {
        type: "dataSource",
        label: "Data",
        config: {
          label: "Data",
          stocks: [],
          timeframe: "1d",
          startDate: "",
          endDate: "",
        },
      }),
      createNode("indicator-1", {
        type: "indicator",
        label: "RSI",
        config: {
          label: "RSI",
          indicatorType: "rsi",
          period: 14,
        },
      }),
    ]);

    expect(() => buildStrategyLabRunRequest(strategy)).toThrow(
      StrategyBuilderMappingError
    );
  });

  it("throws when indicator node is missing", () => {
    const strategy = createStrategy([
      createNode("data-1", {
        type: "dataSource",
        label: "Data",
        config: {
          label: "Data",
          stocks: ["SSI"],
          timeframe: "1d",
          startDate: "",
          endDate: "",
        },
      }),
    ]);

    expect(() => buildStrategyLabRunRequest(strategy)).toThrow(
      "Please add at least one Indicator node."
    );
  });
});
