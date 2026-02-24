import { render, screen, fireEvent } from "@testing-library/react";
import { LandingNav } from "../LandingNav";

// Mock Next.js Link
jest.mock("next/link", () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

describe("LandingNav", () => {
  it("renders the logo", () => {
    render(<LandingNav />);

    expect(screen.getByRole("link", { name: /q\s*uantvn/i })).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    render(<LandingNav />);

    // Navigation links appear in both desktop and mobile views
    expect(screen.getAllByText("Strategy Builder").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Strategy Lab").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tính năng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bảng giá").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FAQ").length).toBeGreaterThan(0);
  });

  it("renders login link", () => {
    render(<LandingNav />);

    // Login links appear in both desktop and mobile
    const loginLinks = screen.getAllByRole("link").filter((link) => link.textContent?.includes("Đăng nhập"));
    expect(loginLinks.length).toBeGreaterThan(0);
    expect(loginLinks[0]).toHaveAttribute("href", "/dashboard");
  });

  it("renders primary CTA button", () => {
    render(<LandingNav />);

    // CTA buttons appear in both desktop and mobile
    const ctaButtons = screen.getAllByRole("link").filter((link) => link.textContent?.includes("Dùng thử"));
    expect(ctaButtons.length).toBeGreaterThan(0);
    expect(ctaButtons[0]).toHaveAttribute("href", "/dashboard");
  });

  it("renders mobile menu button", () => {
    render(<LandingNav />);

    const menuButton = screen.getByRole("button", { name: /Open menu/i });
    expect(menuButton).toBeInTheDocument();
  });

  it("toggles mobile menu when button is clicked", () => {
    render(<LandingNav />);

    const menuButton = screen.getByRole("button", { name: /Open menu/i });

    // Open menu
    fireEvent.click(menuButton);

    // Check that menu is open (button label changes)
    expect(screen.getByRole("button", { name: /Close menu/i })).toBeInTheDocument();

    // Close menu
    fireEvent.click(screen.getByRole("button", { name: /Close menu/i }));

    // Check that menu is closed
    expect(screen.getByRole("button", { name: /Open menu/i })).toBeInTheDocument();
  });

  it("has correct navigation structure", () => {
    render(<LandingNav />);

    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveAttribute("aria-label", "Main navigation");
  });
});
