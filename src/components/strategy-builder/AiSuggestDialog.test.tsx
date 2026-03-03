import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AiSuggestDialog } from "./AiSuggestDialog";

const mockTrackUiKpiEvent = jest.fn();

jest.mock("@/lib/uiKpi", () => ({
  trackUiKpiEvent: (...args: unknown[]) => mockTrackUiKpiEvent(...args),
}));

jest.mock("@/components/ai-assistant", () => ({
  StrategyGenerator: ({ onApplyToBuilder }: { onApplyToBuilder: (strategy: unknown) => void }) => (
    <div>
      <div data-testid="mock-strategy-generator" />
      <button
        data-testid="mock-apply-generated"
        onClick={() =>
          onApplyToBuilder({
            name: "AI Strategy",
            nodes: [
              {
                id: "node-1",
                type: "dataSource",
                position: { x: 80, y: 100 },
                data: {
                  type: "dataSource",
                  label: "Data Source",
                  config: {
                    label: "Data Source",
                    stocks: ["VNM"],
                    timeframe: "1d",
                    startDate: "",
                    endDate: "",
                  },
                },
              },
            ],
            edges: [],
            explanation: "Generated for testing",
          })
        }
      >
        Apply Mock Strategy
      </button>
    </div>
  ),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

describe("AiSuggestDialog tracking", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("tracks dialog open and tab switch events", async () => {
    render(
      <AiSuggestDialog
        onApplyStrategy={() => true}
        currentNodes={[]}
        currentEdges={[]}
        strategyName="Untitled Strategy"
      />
    );

    fireEvent.click(screen.getByTestId("ai-suggest-open-button"));
    expect(await screen.findByTestId("ai-suggest-dialog")).toBeInTheDocument();

    expect(mockTrackUiKpiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: "strategy_builder_ai_assist",
        event: "dialog_opened",
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Graph" }));
    expect(mockTrackUiKpiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: "strategy_builder_ai_assist",
        event: "tab_switched",
      })
    );
  });

  it("tracks generate_apply_cancelled when apply callback returns false", async () => {
    const onApplyStrategy = jest.fn().mockReturnValue(false);

    render(
      <AiSuggestDialog
        onApplyStrategy={onApplyStrategy}
        currentNodes={[]}
        currentEdges={[]}
        strategyName="Untitled Strategy"
      />
    );

    fireEvent.click(screen.getByTestId("ai-suggest-open-button"));
    expect(await screen.findByTestId("ai-suggest-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-apply-generated"));

    await waitFor(() => {
      expect(onApplyStrategy).toHaveBeenCalledTimes(1);
    });
    expect(mockTrackUiKpiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: "strategy_builder_ai_assist",
        event: "generate_apply_cancelled",
      })
    );
    expect(
      mockTrackUiKpiEvent.mock.calls.some(
        (call) =>
          call[0] &&
          typeof call[0] === "object" &&
          "event" in call[0] &&
          (call[0] as { event?: string }).event === "generate_apply_success"
      )
    ).toBe(false);
  });
});
