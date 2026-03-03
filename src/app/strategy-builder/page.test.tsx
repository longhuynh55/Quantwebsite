import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StrategyBuilderPage from "./page";

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
};

const mockBuildStrategyLabRunRequest = jest.fn();
const mockCreateStrategyLabRunClient = jest.fn();
const mockWaitForStrategyLabRunTerminal = jest.fn();
const mockGetStrategyLabRunSummaryClient = jest.fn();
const mockCancelStrategyLabRunClient = jest.fn();
const mockTrackUiKpiEvent = jest.fn();

type MockStoreState = {
  currentStrategy: {
    id: string;
    name: string;
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  createNewStrategy: jest.Mock;
  saveStrategy: jest.Mock;
  updateStrategyName: jest.Mock;
  updateNodeData: jest.Mock;
  addNode: jest.Mock;
  setGraph: jest.Mock;
  deleteNode: jest.Mock;
  setSelectedNode: jest.Mock;
  isSaving: boolean;
  isDirty: boolean;
  reset: jest.Mock;
};

let mockStoreState: MockStoreState;

jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToast.success(...args),
    error: (...args: unknown[]) => mockToast.error(...args),
    info: (...args: unknown[]) => mockToast.info(...args),
  },
}));

jest.mock("@/components/strategy-builder", () => ({
  StrategyCanvas: () => <div data-testid="strategy-canvas" />,
  NodePalette: () => <div data-testid="node-palette" />,
  PropertyPanel: () => <div data-testid="property-panel" />,
  TemplateGallery: () => <div data-testid="template-gallery" />,
  AiSuggestDialog: () => <div data-testid="ai-suggest-dialog" />,
}));

jest.mock("@/lib/stores/strategyBuilderStore", () => ({
  useStrategyBuilderStore: () => mockStoreState,
  useSelectedNode: () => null,
}));

jest.mock("@/lib/strategy-lab/builder-mapper", () => ({
  buildStrategyLabRunRequest: (...args: unknown[]) =>
    mockBuildStrategyLabRunRequest(...args),
}));

jest.mock("@/lib/strategy-lab/client", () => ({
  createStrategyLabRunClient: (...args: unknown[]) =>
    mockCreateStrategyLabRunClient(...args),
  waitForStrategyLabRunTerminal: (...args: unknown[]) =>
    mockWaitForStrategyLabRunTerminal(...args),
  getStrategyLabRunSummaryClient: (...args: unknown[]) =>
    mockGetStrategyLabRunSummaryClient(...args),
  cancelStrategyLabRunClient: (...args: unknown[]) =>
    mockCancelStrategyLabRunClient(...args),
  StrategyLabClientError: class extends Error {},
}));

jest.mock("@/lib/uiKpi", () => ({
  trackUiKpiEvent: (...args: unknown[]) => mockTrackUiKpiEvent(...args),
}));

function createStoreState(overrides?: Partial<MockStoreState>): MockStoreState {
  return {
    currentStrategy: {
      id: "strategy-1",
      name: "Strategy One",
      nodes: [{ id: "node-1" }],
      edges: [],
      createdAt: new Date("2026-02-20T00:00:00.000Z"),
      updatedAt: new Date("2026-02-20T00:00:00.000Z"),
    },
    createNewStrategy: jest.fn(),
    saveStrategy: jest.fn().mockResolvedValue(undefined),
    updateStrategyName: jest.fn(),
    updateNodeData: jest.fn(),
    addNode: jest.fn(),
    setGraph: jest.fn(),
    deleteNode: jest.fn(),
    setSelectedNode: jest.fn(),
    isSaving: false,
    isDirty: false,
    reset: jest.fn(),
    ...overrides,
  };
}

function createRun(status: "queued" | "running" | "succeeded" | "failed" | "cancelled") {
  return {
    runId: "run-1",
    jobId: "job-1",
    status,
    input: {
      name: "Strategy One",
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
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("strategy-builder page", () => {
  beforeEach(() => {
    mockStoreState = createStoreState();
    mockToast.success.mockReset();
    mockToast.error.mockReset();
    mockToast.info.mockReset();
    mockBuildStrategyLabRunRequest.mockReset();
    mockCreateStrategyLabRunClient.mockReset();
    mockWaitForStrategyLabRunTerminal.mockReset();
    mockGetStrategyLabRunSummaryClient.mockReset();
    mockCancelStrategyLabRunClient.mockReset();
    mockTrackUiKpiEvent.mockReset();
  });

  it("runs a strategy and renders summary metrics on success", async () => {
    mockBuildStrategyLabRunRequest.mockReturnValue({
      name: "Strategy One",
      exchange: "HOSE",
      symbol: "FPT",
      strategyType: "sma_crossover",
      capital: 100000,
      params: { shortPeriod: 10, longPeriod: 20 },
    });
    mockCreateStrategyLabRunClient.mockResolvedValue({
      runId: "run-1",
      jobId: "job-1",
      status: "queued",
      pollUrl: "/api/strategy-lab/runs/run-1",
      eventsUrl: "/api/strategy-lab/runs/run-1/events",
      resultUrl: "/api/strategy-lab/runs/run-1/result",
    });
    mockWaitForStrategyLabRunTerminal.mockResolvedValue(createRun("succeeded"));
    mockGetStrategyLabRunSummaryClient.mockResolvedValue({
      runId: "run-1",
      status: "succeeded",
      symbol: "FPT",
      strategyType: "sma_crossover",
      strategyName: "SMA Crossover",
      initialCapital: 100000,
      generatedAt: "2026-02-20T00:00:00.000Z",
      summary: {
        metrics: {
          totalReturn: 0.1234,
          netReturn: 0.12,
          grossReturn: 0.13,
          cagr: 0.05,
          sharpeRatio: 1.5,
          sortinoRatio: 2.1,
          maxDrawdown: 0.08,
          maxDrawdownDuration: 12,
          winRate: 0.55,
          profitFactor: 1.3,
          totalTrades: 18,
          avgReturn: 0.01,
          avgWin: 0.02,
          avgLoss: -0.01,
          bestTrade: 0.09,
          worstTrade: -0.07,
          turnover: 1.4,
          exposureRatio: 0.65,
        },
        diagnostics: {
          inputRows: 250,
          usableRows: 250,
          droppedRows: 0,
          coverageRatio: 0.92,
          largestGapDays: 2,
          firstDate: new Date("2025-01-01T00:00:00.000Z"),
          lastDate: new Date("2026-01-01T00:00:00.000Z"),
          warnings: [],
        },
        totalTrades: 18,
        equityPoints: 250,
      },
    });

    render(<StrategyBuilderPage />);
    fireEvent.click(screen.getByRole("button", { name: "Run Backtest" }));

    await waitFor(() => {
      expect(mockCreateStrategyLabRunClient).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("Latest Backtest")).toBeInTheDocument();
    expect(screen.getByText("Return")).toBeInTheDocument();
    expect(screen.getByText("12.34%")).toBeInTheDocument();
    expect(mockToast.success).toHaveBeenCalledWith(
      "Backtest completed successfully."
    );
    expect(mockTrackUiKpiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: "strategy_builder_interaction",
        event: "backtest_run_requested",
      })
    );
    expect(mockTrackUiKpiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: "strategy_builder_interaction",
        event: "backtest_run_succeeded",
      })
    );
  });

  it("shows failure message when run fails", async () => {
    mockBuildStrategyLabRunRequest.mockReturnValue({
      name: "Strategy One",
      exchange: "HOSE",
      symbol: "FPT",
      strategyType: "sma_crossover",
      capital: 100000,
      params: { shortPeriod: 10, longPeriod: 20 },
    });
    mockCreateStrategyLabRunClient.mockResolvedValue({
      runId: "run-1",
      jobId: "job-1",
      status: "queued",
      pollUrl: "/api/strategy-lab/runs/run-1",
      eventsUrl: "/api/strategy-lab/runs/run-1/events",
      resultUrl: "/api/strategy-lab/runs/run-1/result",
    });
    mockWaitForStrategyLabRunTerminal.mockResolvedValue({
      ...createRun("failed"),
      error: {
        code: "RUN_DATA_NOT_FOUND",
        message: "No OHLCV data found for symbol FPT.",
      },
    });

    render(<StrategyBuilderPage />);
    fireEvent.click(screen.getByRole("button", { name: "Run Backtest" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No OHLCV data found for symbol FPT."
    );
    expect(mockToast.error).toHaveBeenCalledWith(
      "No OHLCV data found for symbol FPT."
    );
  });

  it("submits cancel request for an active run", async () => {
    const deferred = createDeferred<ReturnType<typeof createRun>>();

    mockBuildStrategyLabRunRequest.mockReturnValue({
      name: "Strategy One",
      exchange: "HOSE",
      symbol: "FPT",
      strategyType: "sma_crossover",
      capital: 100000,
      params: { shortPeriod: 10, longPeriod: 20 },
    });
    mockCreateStrategyLabRunClient.mockResolvedValue({
      runId: "run-1",
      jobId: "job-1",
      status: "queued",
      pollUrl: "/api/strategy-lab/runs/run-1",
      eventsUrl: "/api/strategy-lab/runs/run-1/events",
      resultUrl: "/api/strategy-lab/runs/run-1/result",
    });
    mockWaitForStrategyLabRunTerminal.mockReturnValue(deferred.promise);
    mockCancelStrategyLabRunClient.mockResolvedValue(createRun("running"));

    render(<StrategyBuilderPage />);
    fireEvent.click(screen.getByRole("button", { name: "Run Backtest" }));

    const cancelButton = await screen.findByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(mockCancelStrategyLabRunClient).toHaveBeenCalledWith("run-1");

    deferred.resolve(createRun("cancelled"));
    await waitFor(() => {
      expect(mockToast.info).toHaveBeenCalledWith("Backtest cancelled.");
    });
  });

  it("does not call API when run config is invalid", () => {
    mockBuildStrategyLabRunRequest.mockImplementation(() => {
      throw new Error("Please add a Data Source node.");
    });

    render(<StrategyBuilderPage />);
    fireEvent.click(screen.getByRole("button", { name: "Run Backtest" }));

    expect(mockCreateStrategyLabRunClient).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith("Please add a Data Source node.");
  });

  it("renders preview warnings when strategy has legacy nodes and connections", () => {
    mockStoreState = createStoreState({
      currentStrategy: {
        id: "strategy-legacy",
        name: "Legacy Strategy",
        nodes: [
          {
            id: "node-legacy-signal",
            data: { type: "signal", label: "Buy Signal", config: {} },
          },
        ],
        edges: [{ id: "edge-1", source: "node-a", target: "node-b" }],
        createdAt: new Date("2026-02-20T00:00:00.000Z"),
        updatedAt: new Date("2026-02-20T00:00:00.000Z"),
      },
    });

    mockBuildStrategyLabRunRequest.mockReturnValue({
      name: "Legacy Strategy",
      exchange: "HOSE",
      symbol: "FPT",
      strategyType: "sma_crossover",
      capital: 100000,
      params: { shortPeriod: 10, longPeriod: 20 },
    });

    render(<StrategyBuilderPage />);

    expect(
      screen.getByText(/legacy node\(s\) \(Signal\/Output\) are ignored/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Connections are visual only and do not change execution logic/i)
    ).toBeInTheDocument();
  });
});
