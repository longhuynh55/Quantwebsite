import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrategyGenerator } from "./StrategyGenerator";

const mockFetch = jest.fn();

jest.mock("./StrategyPreview", () => ({
  StrategyPreview: ({ strategy }: { strategy: { name?: string } }) => (
    <div data-testid="strategy-preview">{strategy.name ?? "preview"}</div>
  ),
}));

jest.mock("./AIResponsePanel", () => ({
  AIResponsePanel: ({ explanation, notice }: { explanation: string; notice?: string }) => (
    <div data-testid="ai-response-panel">
      <span>{explanation}</span>
      {notice && <span>{notice}</span>}
    </div>
  ),
}));

describe("StrategyGenerator", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it("shows degraded demo warning when API returns template fallback mode", async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({
        success: true,
        generationMode: "template_fallback",
        degraded: true,
        degradeReason: "timeout",
        userNotice: "Demo availability mode: deterministic template fallback.",
        strategy: {
          name: "VNM RSI Mean Reversion",
          explanation: "Fallback explanation",
          nodes: [
            {
              id: "n1",
              type: "dataSource",
              position: { x: 0, y: 0 },
              data: { type: "dataSource", label: "Data", config: { stocks: ["VNM"], timeframe: "1d" } },
            },
            {
              id: "n2",
              type: "output",
              position: { x: 100, y: 0 },
              data: { type: "output", label: "Output", config: { metrics: ["returns"] } },
            },
          ],
          edges: [{ id: "e1", source: "n1", target: "n2" }],
        },
      }),
    });

    render(<StrategyGenerator />);
    fireEvent.change(screen.getByLabelText("Mo ta chien luoc"), {
      target: { value: "Tao chien luoc RSI cho VNM" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tao Chien Luoc" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("Dang o che do demo availability")).toBeInTheDocument();
    expect(screen.getByText(/Ly do fallback:/i)).toBeInTheDocument();
    expect(screen.getByTestId("strategy-preview")).toBeInTheDocument();
    expect(screen.getByTestId("ai-response-panel")).toBeInTheDocument();
  });
});
