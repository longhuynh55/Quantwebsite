import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CommandPalette } from "./CommandPalette";
import { COMMAND_PALETTE_OPEN_EVENT } from "@/lib/commandPaletteEvents";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("CommandPalette", () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it("opens when receiving the explicit open event", async () => {
    render(<CommandPalette />);

    expect(screen.queryByPlaceholderText("Type a command or search for stocks...")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event(COMMAND_PALETTE_OPEN_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type a command or search for stocks...")).toBeInTheDocument();
    });
  });

  it("toggles with Ctrl+K keyboard shortcut", async () => {
    render(<CommandPalette />);

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type a command or search for stocks...")).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });

    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Type a command or search for stocks...")).not.toBeInTheDocument();
    });
  });
});
