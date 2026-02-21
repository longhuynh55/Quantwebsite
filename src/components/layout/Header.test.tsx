import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Header } from "./Header";

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

describe("Header", () => {
  beforeEach(() => {
    mockPathname = "/";
    mockResolvedTheme = "dark";
    mockSetTheme.mockReset();
  });

  it("opens and closes mobile menu via button and overlay", async () => {
    render(<Header />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close menu overlay" }));
    await waitFor(() => {
      expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument();
    });
  });

  it("closes mobile menu on Escape key", async () => {
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument();
    });
  });

  it("closes menu when pathname changes", async () => {
    const { rerender } = render(<Header />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();

    mockPathname = "/charts";
    rerender(<Header />);

    await waitFor(() => {
      expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument();
    });
  });

  it("toggles theme correctly", () => {
    render(<Header />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });
});
