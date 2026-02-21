import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AiAssistantPanel } from "./AiAssistantPanel";

type MockMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type MockAssistantState = {
  isOpen: boolean;
  isLoading: boolean;
  messages: MockMessage[];
  experienceLevel: "beginner" | "intermediate" | "advanced";
  uiMode: "copilot" | "screener";
  conversationScope: null | Record<string, unknown>;
  togglePanel: jest.Mock;
  closePanel: jest.Mock;
  addMessage: jest.Mock;
  clearMessages: jest.Mock;
  setLoading: jest.Mock;
  setUIMode: jest.Mock;
  setConversationScope: jest.Mock;
  clearConversationScope: jest.Mock;
};

const mockPush = jest.fn();
let mockPathname = "/charts";
const mockLogUiEvent = jest.fn();
const mockTrackUiKpiEvent = jest.fn();
const mockFetch = jest.fn();
let mockAssistantState: MockAssistantState;

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("@/lib/stores/assistantStore", () => {
  const useAssistantStore = (() => mockAssistantState) as (() => MockAssistantState) & {
    getState: () => MockAssistantState;
  };
  useAssistantStore.getState = () => mockAssistantState;

  return {
    useAssistantStore,
  };
});

jest.mock("@/lib/frontendTelemetry", () => ({
  logUiEvent: (...args: unknown[]) => mockLogUiEvent(...args),
}));

jest.mock("@/lib/uiKpi", () => ({
  trackUiKpiEvent: (...args: unknown[]) => mockTrackUiKpiEvent(...args),
}));

jest.mock("@/lib/featureFlags", () => ({
  uiFeatureFlags: {
    assistantContextualActions: true,
  },
}));

jest.mock("./ChatMessage", () => ({
  MemoizedChatMessage: ({ message }: { message: { content: string } }) => <div>{message.content}</div>,
}));

jest.mock("./TypingIndicator", () => ({
  TypingIndicator: () => <div>Typing...</div>,
}));

jest.mock("./ChatInput", () => ({
  ChatInput: ({
    onSend,
    isLoading,
  }: {
    onSend: (message: string) => void;
    isLoading: boolean;
  }) => (
    <button type="button" disabled={isLoading} onClick={() => onSend("Test request")}>
      Mock send
    </button>
  ),
}));

jest.mock("./QuickActions", () => ({
  QuickActions: ({
    onAction,
    disabled,
  }: {
    onAction: (prompt: string) => void;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={() => onAction("Quick action prompt")}>
      Run quick action
    </button>
  ),
}));

function createState(overrides?: Partial<MockAssistantState>): MockAssistantState {
  return {
    isOpen: true,
    isLoading: false,
    messages: [],
    experienceLevel: "intermediate",
    uiMode: "copilot",
    conversationScope: null,
    togglePanel: jest.fn(),
    closePanel: jest.fn(),
    addMessage: jest.fn(),
    clearMessages: jest.fn(),
    setLoading: jest.fn(),
    setUIMode: jest.fn(),
    setConversationScope: jest.fn(),
    clearConversationScope: jest.fn(),
    ...overrides,
  };
}

function createFetchResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve({
    status,
    json: async () => body,
  } as Response);
}

describe("AiAssistantPanel", () => {
  beforeAll(() => {
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      value: jest.fn(),
      writable: true,
    });
  });

  beforeEach(() => {
    mockPathname = "/charts";
    mockAssistantState = createState();
    mockPush.mockReset();
    mockLogUiEvent.mockReset();
    mockTrackUiKpiEvent.mockReset();
    mockFetch.mockReset();
    global.fetch = mockFetch as typeof fetch;
  });

  it("returns null when panel is closed", () => {
    mockAssistantState = createState({ isOpen: false });
    render(<AiAssistantPanel />);

    expect(screen.queryByRole("dialog", { name: "AI Assistant" })).not.toBeInTheDocument();
  });

  it("switches to screener mode and navigates", () => {
    render(<AiAssistantPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Screener" }));

    expect(mockAssistantState.setUIMode).toHaveBeenCalledWith("screener");
    expect(mockAssistantState.closePanel).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/screener");
  });

  it("clears chat after confirmation", () => {
    mockAssistantState = createState({
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Hello",
        },
      ],
    });

    render(<AiAssistantPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Clear chat" }));
    expect(screen.getByText("Clear all chat messages?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Clear all chat messages?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear chat" }));
    fireEvent.click(screen.getByText("Clear chat"));
    expect(mockAssistantState.clearMessages).toHaveBeenCalledTimes(1);
  });

  it("sends message and adds assistant response on success", async () => {
    mockFetch.mockResolvedValue(
      createFetchResponse({
        success: true,
        message: "Assistant answer",
        grounded: true,
        policyStatus: "grounded",
        citations: [],
        usedTools: [],
        meta: {},
      })
    );

    render(<AiAssistantPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Mock send" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    expect(mockAssistantState.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        role: "user",
        content: "Test request",
      })
    );
    expect(mockAssistantState.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        role: "assistant",
        content: "Assistant answer",
      })
    );
    expect(mockAssistantState.setLoading).toHaveBeenCalledWith(true);
    expect(mockAssistantState.setLoading).toHaveBeenLastCalledWith(false);
  });

  it("shows error alert when API returns unsuccessful payload", async () => {
    mockFetch.mockResolvedValue(
      createFetchResponse(
        {
          success: false,
          error: "Rate limited",
          policyStatus: "fallback",
          meta: {
            requestId: "req-1",
          },
        },
        429
      )
    );

    render(<AiAssistantPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Mock send" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Rate limited")).toBeInTheDocument();
    expect(screen.getByText(/Request ID:/i)).toHaveTextContent("req-1");
  });

  it("handles global keyboard shortcuts", () => {
    render(<AiAssistantPanel />);

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(window, { key: "A", ctrlKey: true, shiftKey: true });

    expect(mockAssistantState.closePanel).toHaveBeenCalled();
    expect(mockAssistantState.togglePanel).toHaveBeenCalled();
  });
});
