import { render, screen } from "@testing-library/react";
import { ResultsSection } from "../sections/ResultsSection";

// Mock Next.js Link
jest.mock("next/link", () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

describe("ResultsSection", () => {
  it("renders the section badge", () => {
    render(<ResultsSection />);

    expect(screen.getByText(/Kết quả thực tế/i)).toBeInTheDocument();
  });

  it("renders the main headline with before/after values", () => {
    render(<ResultsSection />);

    // Multiple 15% and 35% values appear in the component
    expect(screen.getAllByText("15%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("35%").length).toBeGreaterThan(0);
    // "lợi nhuận" appears multiple times
    expect(screen.getAllByText(/lợi nhuận/i).length).toBeGreaterThan(0);
  });

  it("renders case study person info", () => {
    render(<ResultsSection />);

    expect(screen.getByText("Trần Minh Tuấn")).toBeInTheDocument();
    expect(screen.getByText(/Nhà đầu tư cá nhân/i)).toBeInTheDocument();
    expect(screen.getByText(/3 năm kinh nghiệm/i)).toBeInTheDocument();
    expect(screen.getByText(/TP\. Hồ Chí Minh/i)).toBeInTheDocument();
  });

  it("renders the strategy badge", () => {
    render(<ResultsSection />);

    expect(screen.getByText(/Chiến lược sử dụng/i)).toBeInTheDocument();
    expect(screen.getByText("MA Crossover")).toBeInTheDocument();
  });

  it("renders before section with correct data", () => {
    render(<ResultsSection />);

    expect(screen.getByText("TRƯỚC QUANTVN")).toBeInTheDocument();
    // These values appear in the before section
    expect(screen.getByText("3+ giờ/ngày")).toBeInTheDocument();
    expect(screen.getByText("Cảm tính")).toBeInTheDocument();
  });

  it("renders after section with correct data", () => {
    render(<ResultsSection />);

    expect(screen.getByText("SAU 3 THÁNG")).toBeInTheDocument();
    expect(screen.getByText("30 phút")).toBeInTheDocument();
    expect(screen.getByText("Dữ liệu")).toBeInTheDocument();
  });

  it("renders the testimonial quote", () => {
    render(<ResultsSection />);

    expect(screen.getByText(/Tôi đã thử nhiều tools/i)).toBeInTheDocument();
    expect(screen.getByText(/ROI tăng 133%/i)).toBeInTheDocument();
  });

  it("renders stats row with correct values", () => {
    render(<ResultsSection />);

    // Multiple values may appear, just check they exist
    expect(screen.getAllByText("35%").length).toBeGreaterThan(0);
    expect(screen.getByText("3 phút")).toBeInTheDocument();
    expect(screen.getByText("400+")).toBeInTheDocument();
    expect(screen.getByText(/Mã HOSE/i)).toBeInTheDocument();
  });

  it("renders the CTA button", () => {
    render(<ResultsSection />);

    const cta = screen.getByRole("link", { name: /Bắt đầu dùng thử miễn phí/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute("href", "/dashboard");
  });

  it("renders the CTA prompt text", () => {
    render(<ResultsSection />);

    expect(screen.getByText(/Sẵn sàng đạt kết quả tương tự/i)).toBeInTheDocument();
  });
});
