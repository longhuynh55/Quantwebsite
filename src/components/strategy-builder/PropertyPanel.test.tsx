import { fireEvent, render, screen } from "@testing-library/react";
import { PropertyPanel } from "./PropertyPanel";
import type { StrategyNode, StrategyNodeData } from "@/lib/stores/strategyBuilderStore";

function createNode(data: StrategyNodeData): StrategyNode {
  return {
    id: "node-1",
    type: data.type,
    position: { x: 0, y: 0 },
    data,
  };
}

describe("PropertyPanel", () => {
  it("renders empty state when no node is selected", () => {
    render(
      <PropertyPanel
        selectedNode={null}
        onUpdateNode={jest.fn()}
        onDeleteNode={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText("No Node Selected")).toBeInTheDocument();
  });

  it("updates node label while preserving typed config", () => {
    const onUpdateNode = jest.fn();
    const node = createNode({
      type: "dataSource",
      label: "Old Label",
      config: {
        label: "Old Label",
        stocks: ["FPT"],
        timeframe: "1d",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      },
    });

    render(
      <PropertyPanel
        selectedNode={node}
        onUpdateNode={onUpdateNode}
        onDeleteNode={jest.fn()}
        onClose={jest.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Enter label..."), {
      target: { value: "New Label" },
    });

    expect(onUpdateNode).toHaveBeenCalledWith(
      "node-1",
      expect.objectContaining({
        type: "dataSource",
        label: "New Label",
        config: expect.objectContaining({
          label: "New Label",
          stocks: ["FPT"],
        }),
      })
    );
  });

  it("toggles output metric selection", () => {
    const onUpdateNode = jest.fn();
    const node = createNode({
      type: "output",
      label: "Output",
      config: {
        label: "Output",
        metrics: ["returns", "sharpe"],
      },
    });

    render(
      <PropertyPanel
        selectedNode={node}
        onUpdateNode={onUpdateNode}
        onDeleteNode={jest.fn()}
        onClose={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Net Profit" }));

    expect(onUpdateNode).toHaveBeenLastCalledWith(
      "node-1",
      expect.objectContaining({
        type: "output",
        config: expect.objectContaining({
          metrics: expect.arrayContaining(["returns", "sharpe", "profit"]),
        }),
      })
    );
  });

  it("triggers close and delete actions", () => {
    const onClose = jest.fn();
    const onDeleteNode = jest.fn();
    const node = createNode({
      type: "signal",
      label: "Signal",
      config: {
        label: "Signal",
        signalType: "buy",
        condition: "close > sma",
        quantity: 100,
      },
    });

    render(
      <PropertyPanel
        selectedNode={node}
        onUpdateNode={jest.fn()}
        onDeleteNode={onDeleteNode}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Close properties panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Node" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDeleteNode).toHaveBeenCalledWith("node-1");
  });
});
