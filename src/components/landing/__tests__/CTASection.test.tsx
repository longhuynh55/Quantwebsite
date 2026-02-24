import { render, screen } from "@testing-library/react";
import { CTASection } from "../sections/CTASection";

// Mock Next.js Link
jest.mock("next/link", () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

// Mock GradientBackground
jest.mock("../ui", () => ({
  GradientBackground: Object.assign(
    ({ children }: { children: React.ReactNode }) => (
      <div data-testid="gradient-background">{children}</div>
    ),
    { displayName: "MockGradientBackground" }
  ),
}));

describe("CTASection", () => {
  it("renders the main headline", () => {
    render(<CTASection />);

    expect(screen.getByText(/Sẵn sàng đầu tư/i)).toBeInTheDocument();
    expect(screen.getByText(/thông minh hơn/i)).toBeInTheDocument();
  });

  it("renders the subheadline with user count", () => {
    render(<CTASection />);

    expect(screen.getByText(/1,200\+ nhà đầu tư Việt Nam/i)).toBeInTheDocument();
    expect(screen.getByText(/Biến dữ liệu thành lợi nhuận/i)).toBeInTheDocument();
  });

  it("renders urgency points", () => {
    render(<CTASection />);

    expect(screen.getByText(/1,200\+ người đã tham gia/i)).toBeInTheDocument();
    expect(screen.getByText(/35% lợi nhuận TB/i)).toBeInTheDocument();
    expect(screen.getByText(/Bắt đầu phân tích trong 5 phút/i)).toBeInTheDocument();
  });

  it("renders primary CTA button", () => {
    render(<CTASection />);

    const cta = screen.getByRole("link", { name: /Dùng thử 14 ngày Pro - Miễn phí/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute("href", "/dashboard");
  });

  it("renders no credit card text", () => {
    render(<CTASection />);

    expect(screen.getByText(/Không cần thẻ tín dụng/i)).toBeInTheDocument();
    expect(screen.getByText(/Hoàn tiền 30 ngày/i)).toBeInTheDocument();
  });

  it("renders benefit list", () => {
    render(<CTASection />);

    expect(screen.getByText(/Dùng thử 14 ngày Pro miễn phí/i)).toBeInTheDocument();
    expect(screen.getByText(/Thiết lập 30 giây/i)).toBeInTheDocument();
    expect(screen.getByText(/Hỗ trợ 24\/7/i)).toBeInTheDocument();
  });

  it("renders the final push question", () => {
    render(<CTASection />);

    expect(screen.getByText(/Câu hỏi cuối cùng/i)).toBeInTheDocument();
    expect(screen.getByText(/tiết kiệm 3 giờ mỗi tuần/i)).toBeInTheDocument();
    expect(screen.getByText(/tăng 20% lợi nhuận/i)).toBeInTheDocument();
  });
});
