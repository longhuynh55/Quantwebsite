import { fireEvent, render, screen } from "@testing-library/react";
import type { DashboardLayouts, WidgetType } from "@/lib/stores/dashboardStore";
import { DashboardLayout } from "./DashboardLayout";

type MockWidget = {
  id: string;
  type: WidgetType;
  title: string;
  config?: Record<string, unknown>;
};

type MockDashboardStoreState = {
  layouts: DashboardLayouts;
  widgets: MockWidget[];
  isPaletteOpen: boolean;
  addWidget: jest.Mock;
  removeWidget: jest.Mock;
  updateLayout: jest.Mock;
  togglePalette: jest.Mock;
  resetToDefault: jest.Mock;
};

const mockChangedLayouts: DashboardLayouts = {
  lg: [{ i: "widget-1", x: 0, y: 0, w: 6, h: 4 }],
  md: [{ i: "widget-1", x: 0, y: 0, w: 6, h: 4 }],
  sm: [{ i: "widget-1", x: 0, y: 0, w: 6, h: 4 }],
  xs: [{ i: "widget-1", x: 0, y: 0, w: 4, h: 4 }],
  xxs: [{ i: "widget-1", x: 0, y: 0, w: 2, h: 4 }],
};

const mockAddWidget = jest.fn();
const mockRemoveWidget = jest.fn();
const mockUpdateLayout = jest.fn();
const mockTogglePalette = jest.fn();
const mockResetToDefault = jest.fn();
let mockDashboardState: MockDashboardStoreState;

jest.mock("next/dynamic", () => {
  return () => {
    const DynamicWidgetMock = ({ config }: { config?: Record<string, unknown> }) => (
      <div data-testid="dynamic-widget">{JSON.stringify(config ?? {})}</div>
    );
    DynamicWidgetMock.displayName = "DynamicWidgetMock";
    return DynamicWidgetMock;
  };
});

jest.mock("react-grid-layout/legacy", () => ({
  WidthProvider: (Component: React.ComponentType) => Component,
  Responsive: ({
    children,
    onLayoutChange,
  }: {
    children: React.ReactNode;
    onLayoutChange?: (layout: unknown, allLayouts: DashboardLayouts) => void;
  }) => (
    <div data-testid="responsive-grid">
      <button type="button" onClick={() => onLayoutChange?.([], mockChangedLayouts)}>
        Emit layout change
      </button>
      {children}
    </div>
  ),
}));

jest.mock("@/lib/stores/dashboardStore", () => ({
  useDashboardStore: () => mockDashboardState,
}));

jest.mock("./WidgetWrapper", () => ({
  WidgetWrapper: ({
    id,
    title,
    onRemove,
    children,
  }: {
    id: string;
    title: string;
    onRemove?: () => void;
    children: React.ReactNode;
  }) => (
    <div data-testid={`widget-${id}`}>
      <h3>{title}</h3>
      <button type="button" onClick={onRemove}>
        Remove {id}
      </button>
      {children}
    </div>
  ),
}));

jest.mock("./WidgetPalette", () => ({
  WidgetPalette: ({
    isOpen,
    onClose,
    onAddWidget,
    existingWidgets,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onAddWidget: (type: WidgetType) => void;
    existingWidgets: WidgetType[];
  }) => (
    <div data-testid="widget-palette">
      <span>{isOpen ? "palette-open" : "palette-closed"}</span>
      <span data-testid="existing-widget-types">{existingWidgets.join(",")}</span>
      <button type="button" onClick={onClose}>
        Palette close
      </button>
      <button type="button" onClick={() => onAddWidget("news")}>
        Palette add news
      </button>
    </div>
  ),
}));

function createLayouts(): DashboardLayouts {
  return {
    lg: [{ i: "widget-1", x: 0, y: 0, w: 6, h: 4 }],
    md: [{ i: "widget-1", x: 0, y: 0, w: 6, h: 4 }],
    sm: [{ i: "widget-1", x: 0, y: 0, w: 6, h: 4 }],
    xs: [{ i: "widget-1", x: 0, y: 0, w: 4, h: 4 }],
    xxs: [{ i: "widget-1", x: 0, y: 0, w: 2, h: 4 }],
  };
}

function createState(
  overrides?: Partial<MockDashboardStoreState>
): MockDashboardStoreState {
  return {
    layouts: createLayouts(),
    widgets: [
      {
        id: "widget-1",
        type: "portfolio-value",
        title: "Portfolio Value",
        config: { currency: "VND" },
      },
    ],
    isPaletteOpen: false,
    addWidget: mockAddWidget,
    removeWidget: mockRemoveWidget,
    updateLayout: mockUpdateLayout,
    togglePalette: mockTogglePalette,
    resetToDefault: mockResetToDefault,
    ...overrides,
  };
}

describe("DashboardLayout", () => {
  beforeEach(() => {
    mockAddWidget.mockReset();
    mockRemoveWidget.mockReset();
    mockUpdateLayout.mockReset();
    mockTogglePalette.mockReset();
    mockResetToDefault.mockReset();
    mockDashboardState = createState();
  });

  it("renders widgets and triggers core toolbar/layout callbacks", () => {
    render(<DashboardLayout />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Portfolio Value")).toBeInTheDocument();
    expect(screen.getByTestId("existing-widget-types")).toHaveTextContent("portfolio-value");

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    fireEvent.click(screen.getByRole("button", { name: "Emit layout change" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove widget-1" }));

    expect(mockResetToDefault).toHaveBeenCalledTimes(1);
    expect(mockTogglePalette).toHaveBeenCalledTimes(1);
    expect(mockUpdateLayout).toHaveBeenCalledWith(mockChangedLayouts);
    expect(mockRemoveWidget).toHaveBeenCalledWith("widget-1");
  });

  it("delegates palette events to store actions", () => {
    render(<DashboardLayout />);

    fireEvent.click(screen.getByRole("button", { name: "Palette add news" }));
    fireEvent.click(screen.getByRole("button", { name: "Palette close" }));

    expect(mockAddWidget).toHaveBeenCalledWith("news");
    expect(mockTogglePalette).toHaveBeenCalledTimes(1);
  });

  it("shows empty state and handles add widget CTA", () => {
    mockDashboardState = createState({ widgets: [] });
    render(<DashboardLayout />);

    expect(screen.getByText("Dashboard is empty")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Widget" }));

    expect(mockTogglePalette).toHaveBeenCalledTimes(1);
  });
});
