import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Navbar } from "./Navbar";

let mockPathname = "/";
let mockResolvedTheme: "dark" | "light" = "dark";
const mockSetTheme = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

jest.mock("next/link", () => {
  return {
    __esModule: true,
    default: ({
      href,
      children,
      onClick,
      ...props
    }: {
      href: string;
      children: React.ReactNode;
      onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a
        href={href}
        onClick={(event) => {
          event.preventDefault();
          onClick?.(event);
        }}
        {...props}
      >
        {children}
      </a>
    ),
  };
});

jest.mock("@/components/providers/ThemeProvider", () => ({
  useTheme: () => ({
    resolvedTheme: mockResolvedTheme,
    setTheme: mockSetTheme,
  }),
}));

jest.mock("@/components/assistant", () => ({
  AiAssistantTrigger: () => <button type="button">AI Assistant</button>,
}));

describe("Navbar", () => {
  beforeEach(() => {
    mockPathname = "/";
    mockResolvedTheme = "dark";
    mockSetTheme.mockReset();
  });

  it("opens mobile menu and closes on escape", async () => {
    render(<Navbar />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("dialog", { name: "Navigation menu" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Navigation menu" })).not.toBeInTheDocument();
    });
  });

  it("closes mobile menu when selecting an item", async () => {
    render(<Navbar />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("link", { name: "Screener" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Navigation menu" })).not.toBeInTheDocument();
    });
  });

  it("toggles theme", () => {
    render(<Navbar />);

    const toggleButtons = screen.getAllByRole("button", { name: "Toggle theme" });
    fireEvent.click(toggleButtons[0]);

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });
});
