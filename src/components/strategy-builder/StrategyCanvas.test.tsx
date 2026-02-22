import { fireEvent, render, screen } from "@testing-library/react";
import { StrategyCanvas } from "./StrategyCanvas";

type MockStrategyStoreState = {
  currentStrategy: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  } | null;
  addNode: jest.Mock;
  addEdge: jest.Mock;
  setSelectedNode: jest.Mock;
  setNodes: jest.Mock;
};

const mockOnNodesChange = jest.fn();
const mockOnEdgesChange = jest.fn();
let mockNodesState: Array<Record<string, unknown>> = [];
let mockEdgesState: Array<Record<string, unknown>> = [];

const mockAddNode = jest.fn();
const mockStoreAddEdge = jest.fn();
const mockSetSelectedNode = jest.fn();
const mockSetNodes = jest.fn();
const mockFitView = jest.fn();

let mockStrategyStoreState: MockStrategyStoreState;

jest.mock("./nodes", () => ({
  nodeTypes: {},
}));

jest.mock("@/lib/stores/strategyBuilderStore", () => ({
  useStrategyBuilderStore: () => mockStrategyStoreState,
}));

jest.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReactFlow: ({
    children,
    onConnect,
    onNodeClick,
    onPaneClick,
    onDrop,
    onDragOver,
  }: {
    children: React.ReactNode;
    onConnect?: (connection: {
      source?: string | null;
      target?: string | null;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }) => void;
    onNodeClick?: (event: React.MouseEvent, node: { id: string }) => void;
    onPaneClick?: () => void;
    onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  }) => (
    <div data-testid="strategy-react-flow" onDrop={onDrop} onDragOver={onDragOver}>
      <button
        type="button"
        onClick={() =>
          onConnect?.({
            source: "node-a",
            target: "node-b",
            sourceHandle: null,
            targetHandle: null,
          })
        }
      >
        Trigger connect
      </button>
      <button type="button" onClick={(event) => onNodeClick?.(event, { id: "node-a" })}>
        Trigger node click
      </button>
      <button type="button" onClick={() => onPaneClick?.()}>
        Trigger pane click
      </button>
      {children}
    </div>
  ),
  Background: () => <div>Background</div>,
  Controls: () => <div>Controls</div>,
  MiniMap: () => <div>MiniMap</div>,
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  addEdge: (edge: Record<string, unknown>, edges: Array<Record<string, unknown>>) => [...edges, edge],
  useNodesState: (initial: Array<Record<string, unknown>>) => {
    mockNodesState = initial;
    return [mockNodesState, jest.fn(), mockOnNodesChange];
  },
  useEdgesState: (initial: Array<Record<string, unknown>>) => {
    mockEdgesState = initial;
    const setEdges = (
      updater:
        | Array<Record<string, unknown>>
        | ((prev: Array<Record<string, unknown>>) => Array<Record<string, unknown>>)
    ) => {
      mockEdgesState = typeof updater === "function" ? updater(mockEdgesState) : updater;
    };
    return [mockEdgesState, setEdges, mockOnEdgesChange];
  },
  useReactFlow: () => ({
    fitView: mockFitView,
  }),
}));

function createStoreState(
  overrides?: Partial<MockStrategyStoreState>
): MockStrategyStoreState {
  return {
    currentStrategy: {
      nodes: [],
      edges: [],
    },
    addNode: mockAddNode,
    addEdge: mockStoreAddEdge,
    setSelectedNode: mockSetSelectedNode,
    setNodes: mockSetNodes,
    ...overrides,
  };
}

describe("StrategyCanvas", () => {
  beforeEach(() => {
    mockAddNode.mockReset();
    mockStoreAddEdge.mockReset();
    mockSetSelectedNode.mockReset();
    mockSetNodes.mockReset();
    mockFitView.mockReset();
    mockOnNodesChange.mockReset();
    mockOnEdgesChange.mockReset();
    mockNodesState = [];
    mockEdgesState = [];
    mockStrategyStoreState = createStoreState();
  });

  it("renders empty state when there are no nodes", () => {
    render(<StrategyCanvas />);

    expect(screen.getByText("Start Building Your Strategy")).toBeInTheDocument();
  });

  it("adds node when dropping a supported type from palette", () => {
    render(<StrategyCanvas />);

    fireEvent.drop(screen.getByTestId("strategy-react-flow"), {
      clientX: 140,
      clientY: 90,
      dataTransfer: {
        getData: (key: string) => (key === "application/reactflow" ? "indicator" : ""),
      },
    });

    expect(mockAddNode).toHaveBeenCalledTimes(1);
    expect(mockAddNode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "indicator",
        data: expect.objectContaining({
          type: "indicator",
          label: "RSI",
        }),
      })
    );
  });

  it("reads node type from text/plain drop data as fallback", () => {
    render(<StrategyCanvas />);

    fireEvent.drop(screen.getByTestId("strategy-react-flow"), {
      clientX: 40,
      clientY: 70,
      dataTransfer: {
        getData: (key: string) => (key === "text/plain" ? "filter" : ""),
      },
    });

    expect(mockAddNode).toHaveBeenCalledTimes(1);
    expect(mockAddNode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "filter",
        data: expect.objectContaining({
          type: "filter",
          label: "Filter",
        }),
      })
    );
  });

  it("ignores unsupported drop types", () => {
    render(<StrategyCanvas />);

    fireEvent.drop(screen.getByTestId("strategy-react-flow"), {
      clientX: 10,
      clientY: 20,
      dataTransfer: {
        getData: () => "unsupported",
      },
    });

    expect(mockAddNode).not.toHaveBeenCalled();
  });

  it("ignores connect attempts because connections are disabled", () => {
    render(<StrategyCanvas />);

    fireEvent.click(screen.getByRole("button", { name: "Trigger connect" }));

    expect(mockStoreAddEdge).not.toHaveBeenCalled();
  });

  it("updates selected node for node click and pane click", () => {
    render(<StrategyCanvas />);

    fireEvent.click(screen.getByRole("button", { name: "Trigger node click" }));
    fireEvent.click(screen.getByRole("button", { name: "Trigger pane click" }));

    expect(mockSetSelectedNode).toHaveBeenNthCalledWith(1, "node-a");
    expect(mockSetSelectedNode).toHaveBeenNthCalledWith(2, null);
  });

  it("sets move dropEffect on drag over", () => {
    render(<StrategyCanvas />);

    const dataTransfer = {
      dropEffect: "",
    };

    fireEvent.dragOver(screen.getByTestId("strategy-react-flow"), { dataTransfer });
    expect(dataTransfer.dropEffect).toBe("move");
  });
});
