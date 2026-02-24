import { render, screen } from "@testing-library/react";
import { FeaturesSection } from "../sections/FeaturesSection";

jest.mock("next/link", () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

describe("FeaturesSection", () => {
  const expectedHandoffs = [
    { label: "Stock Screener", href: "/screener" },
    { label: "Backtesting Engine", href: "/backtesting" },
    { label: "AI Assistant", href: "/dashboard" },
    { label: "Portfolio Optimizer", href: "/portfolio" },
  ];

  it("renders all feature cards as links", () => {
    render(<FeaturesSection />);

    expectedHandoffs.forEach(({ label }) => {
      expect(screen.getByRole("link", { name: new RegExp(label, "i") })).toBeInTheDocument();
    });
  });

  it("uses real app routes for landing-to-app handoff", () => {
    render(<FeaturesSection />);

    expectedHandoffs.forEach(({ label, href }) => {
      expect(screen.getByRole("link", { name: new RegExp(label, "i") })).toHaveAttribute("href", href);
    });
  });

  it("does not use deprecated /app/* paths", () => {
    render(<FeaturesSection />);

    screen.getAllByRole("link").forEach((link) => {
      expect(link).not.toHaveAttribute("href", expect.stringMatching(/^\/app\//));
    });
  });
});
