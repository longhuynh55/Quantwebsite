import { fireEvent, render, screen } from "@testing-library/react";
import { StrategyCanvas } from "./StrategyCanvas";

type MockNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

type MockEdge = {
  id: string;
  source: string;
  target: string;
};

type MockStrategyStoreState = {
  currentStrategy: {
    nodes: MockNode[];
    edges: MockEdge[];
  } | null;
  addNode: jest.Mock;
  addEdge: jest.Mock;
  setSelectedNode: jest.Mock;
  setNodes: jest.Mock;
  setEdges: jest.Mock;
};

let mockNodesState: MockNode[] = [];
let mockEdgesState: MockEdge[] = [];

const mockAddNode = jest.fn();
const mockStoreAddEdge = jest.fn();
const mockSetSelectedNode = jest.fn();
const mockSetNodes = jest.fn();
const mockSetEdges = jest.fn();
const mockFitView = jest.fn();
const mockToastError = jest.fn();
const mockToastMessage = jest.fn();

let mockStrategyStoreState: MockStrategyStoreState;

jest.mock("./nodes", () => ({
  nodeTypes: {},
}));

jest.mock("@/lib/stores/strategyBuilderStore", () => ({
  useStrategyBuilderStore: () => mockStrategyStoreState,
}));

jest.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    message: (...args: unknown[]) => mockToastMessage(...args),
  },
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
      <button
        type="button"
        onClick={() =>
          onConnect?.({
            source: "node-a",
            target: "node-a",
            sourceHandle: null,
            targetHandle: null,
          })
        }
      >
        Trigger self connect
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
  BackgroundVariant: { Dots: "dots" },
  applyNodeChanges: (_changes: unknown, nodes: MockNode[]) => nodes,
  applyEdgeChanges: (_changes: unknown, edges: MockEdge[]) => edges,
  useNodesState: (initial: MockNode[]) => {
    mockNodesState = initial;
    const setNodes = (
      updater: MockNode[] | ((prev: MockNode[]) => MockNode[])
    ) => {
      mockNodesState = typeof updater === "function" ? updater(mockNodesState) : updater;
    };
    return [mockNodesState, setNodes, jest.fn()];
  },
  useEdgesState: (initial: MockEdge[]) => {
    mockEdgesState = initial;
    const setEdges = (
      updater: MockEdge[] | ((prev: MockEdge[]) => MockEdge[])
    ) => {
      mockEdgesState = typeof updater === "function" ? updater(mockEdgesState) : updater;
    };
    return [mockEdgesState, setEdges, jest.fn()];
  },
  useReactFlow: () => ({
    fitView: mockFitView,
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
    getNode: (id: string) =>
      mockNodesState.find((node) => node.id === id) ?? null,
  }),
}));

function createStoreState(
  overrides?: Partial<MockStrategyStoreState>
): MockStrategyStoreState {
  return {
    currentStrategy: {
      nodes: [
        {
          id: "node-a",
          type: "dataSource",
          position: { x: 0, y: 0 },
          data: { type: "dataSource", label: "Source", config: {} },
        },
        {
          id: "node-b",
          type: "indicator",
          position: { x: 260, y: 0 },
          data: { type: "indicator", label: "RSI", config: {} },
        },
      ],
      edges: [],
    },
    addNode: mockAddNode,
    addEdge: mockStoreAddEdge,
    setSelectedNode: mockSetSelectedNode,
    setNodes: mockSetNodes,
    setEdges: mockSetEdges,
    ...overrides,
  };
}

describe("StrategyCanvas", () => {
  beforeEach(() => {
    mockAddNode.mockReset();
    mockStoreAddEdge.mockReset();
    mockSetSelectedNode.mockReset();
    mockSetNodes.mockReset();
    mockSetEdges.mockReset();
    mockFitView.mockReset();
    mockToastError.mockReset();
    mockToastMessage.mockReset();
    mockNodesState = [];
    mockEdgesState = [];
    mockStrategyStoreState = createStoreState();
  });

  it("renders empty state when there are no nodes", () => {
    mockStrategyStoreState = createStoreState({
      currentStrategy: {
        nodes: [],
        edges: [],
      },
    });

    render(<StrategyCanvas />);

    expect(screen.getByText("Add nodes to begin")).toBeInTheDocument();
  });

  it("adds node when dropping a supported type from palette", () => {
    const onBeforeMutate = jest.fn();
    render(<StrategyCanvas onBeforeMutate={onBeforeMutate} />);

    fireEvent.drop(screen.getByTestId("strategy-react-flow"), {
      clientX: 140,
      clientY: 90,
      dataTransfer: {
        getData: (key: string) => (key === "application/reactflow" ? "indicator" : ""),
      },
    });

    expect(mockAddNode).toHaveBeenCalledTimes(1);
    expect(onBeforeMutate).toHaveBeenCalledTimes(1);
    expect(mockAddNode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "indicator",
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

  it("creates edge for valid connections", () => {
    const onBeforeMutate = jest.fn();
    render(<StrategyCanvas onBeforeMutate={onBeforeMutate} />);

    fireEvent.click(screen.getByRole("button", { name: "Trigger connect" }));

    expect(mockStoreAddEdge).toHaveBeenCalledTimes(1);
    expect(onBeforeMutate).toHaveBeenCalledTimes(1);
  });

  it("blocks self connections", () => {
    render(<StrategyCanvas />);

    fireEvent.click(screen.getByRole("button", { name: "Trigger self connect" }));

    expect(mockStoreAddEdge).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it("blocks duplicate connections already present in strategy", () => {
    mockStrategyStoreState = createStoreState({
      currentStrategy: {
        nodes: [
          {
            id: "node-a",
            type: "dataSource",
            position: { x: 0, y: 0 },
            data: { type: "dataSource", label: "Source", config: {} },
          },
          {
            id: "node-b",
            type: "indicator",
            position: { x: 260, y: 0 },
            data: { type: "indicator", label: "RSI", config: {} },
          },
        ],
        edges: [{ id: "edge-1", source: "node-a", target: "node-b" }],
      },
    });

    render(<StrategyCanvas />);
    fireEvent.click(screen.getByRole("button", { name: "Trigger connect" }));

    expect(mockStoreAddEdge).not.toHaveBeenCalled();
    expect(mockToastMessage).toHaveBeenCalledTimes(1);
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
