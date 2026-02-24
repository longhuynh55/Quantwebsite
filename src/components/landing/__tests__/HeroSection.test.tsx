import { render, screen } from "@testing-library/react";
import { HeroSection } from "../sections/HeroSection";

// Mock Next.js Link
jest.mock("next/link", () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

// Mock UI components
jest.mock("../ui", () => ({
  GradientBackground: Object.assign(
    ({ children }: { children: React.ReactNode }) => (
      <div data-testid="gradient-background">{children}</div>
    ),
    { displayName: "MockGradientBackground" }
  ),
  TrustLogos: Object.assign(
    ({ className }: { className?: string }) => (
      <div data-testid="trust-logos" className={className}>
        Trust Logos
      </div>
    ),
    { displayName: "MockTrustLogos" }
  ),
}));

describe("HeroSection", () => {
  it("renders the main headline correctly", () => {
    render(<HeroSection />);

    expect(screen.getByText(/Biến dữ liệu thành lợi nhuận/i)).toBeInTheDocument();
    expect(screen.getByText(/Không cần chuyên môn tài chính/i)).toBeInTheDocument();
  });

  it("renders the subheadline with key value proposition", () => {
    render(<HeroSection />);

    expect(screen.getByText(/duy nhất tại Việt Nam/i)).toBeInTheDocument();
    expect(screen.getByText(/5 phút/i)).toBeInTheDocument();
  });

  it("renders primary CTA with correct text", () => {
    render(<HeroSection />);

    const primaryCTA = screen.getByRole("link", { name: /Dùng thử 14 ngày Pro/i });
    expect(primaryCTA).toBeInTheDocument();
    expect(primaryCTA).toHaveAttribute("href", "/dashboard");
  });

  it("renders secondary CTA for demo", () => {
    render(<HeroSection />);

    const secondaryCTA = screen.getByRole("link", { name: /Xem demo 2 phút/i });
    expect(secondaryCTA).toBeInTheDocument();
    expect(secondaryCTA).toHaveAttribute("href", "/learn");
  });

  it("renders trust indicators", () => {
    render(<HeroSection />);

    expect(screen.getByText(/Không cần thẻ tín dụng/i)).toBeInTheDocument();
    expect(screen.getByText(/Thiết lập 30 giây/i)).toBeInTheDocument();
    expect(screen.getByText(/Hủy bất cứ lúc nào/i)).toBeInTheDocument();
  });

  it("renders feature highlights with correct data", () => {
    render(<HeroSection />);

    expect(screen.getByText("400+ mã HOSE")).toBeInTheDocument();
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    expect(screen.getByText("Backtest 3 phút")).toBeInTheDocument();
    expect(screen.getByText("35% lợi nhuận TB")).toBeInTheDocument();
  });

  it("renders the Graduation Thesis badge", () => {
    render(<HeroSection />);

    expect(screen.getByText(/Graduation Thesis Project/i)).toBeInTheDocument();
  });

  it("renders the dashboard preview", () => {
    render(<HeroSection />);

    expect(screen.getByText(/Interactive Dashboard Preview/i)).toBeInTheDocument();
  });

  it("renders trust logos component", () => {
    render(<HeroSection />);

    expect(screen.getByTestId("trust-logos")).toBeInTheDocument();
  });

  it("renders all stat cards in preview", () => {
    render(<HeroSection />);

    expect(screen.getByText("Universe Size")).toBeInTheDocument();
    expect(screen.getByText("400+")).toBeInTheDocument();
    expect(screen.getByText("Avg Liquidity")).toBeInTheDocument();
    expect(screen.getByText("₫125B")).toBeInTheDocument();
  });
});
