import { fireEvent, render, screen } from "@testing-library/react";
import { AiSuggestDialog } from "./AiSuggestDialog";

const mockTrackUiKpiEvent = jest.fn();

jest.mock("@/lib/uiKpi", () => ({
  trackUiKpiEvent: (...args: unknown[]) => mockTrackUiKpiEvent(...args),
}));

jest.mock("@/components/ai-assistant", () => ({
  StrategyGenerator: () => <div data-testid="mock-strategy-generator" />,
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
        onApplyStrategy={jest.fn()}
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
});
