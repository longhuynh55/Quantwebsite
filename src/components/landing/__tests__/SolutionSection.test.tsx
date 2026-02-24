import { render, screen } from "@testing-library/react";
import { SolutionSection } from "../sections/SolutionSection";

// Mock Next.js Link
jest.mock("next/link", () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

describe("SolutionSection", () => {
  it("renders the section header badge", () => {
    render(<SolutionSection />);

    expect(screen.getByText(/Điểm khác biệt của QuantVN/i)).toBeInTheDocument();
  });

  it("renders the main headline", () => {
    render(<SolutionSection />);

    expect(screen.getByText(/Chúng tôi/i)).toBeInTheDocument();
    expect(screen.getByText(/thị trường Việt Nam/i)).toBeInTheDocument();
  });

  it("renders all four solution points", () => {
    render(<SolutionSection />);

    expect(screen.getByText("Dữ liệu HOSE chính thức")).toBeInTheDocument();
    expect(screen.getByText("AI được đào tạo cho Việt Nam")).toBeInTheDocument();
    expect(screen.getByText("Không cần cài đặt")).toBeInTheDocument();
    expect(screen.getByText("Đội ngũ Việt Nam")).toBeInTheDocument();
  });

  it("renders solution point descriptions", () => {
    render(<SolutionSection />);

    expect(screen.getByText(/400\+ mã cổ phiếu với 7 năm dữ liệu/i)).toBeInTheDocument();
    expect(screen.getByText(/Hiểu ngữ cảnh địa phương/i)).toBeInTheDocument();
    expect(screen.getByText(/Hoạt động trên mọi thiết bị/i)).toBeInTheDocument();
    // "Giao diện tiếng Việt" appears multiple times
    expect(screen.getAllByText(/Giao diện tiếng Việt/i).length).toBeGreaterThan(0);
  });

  it("renders differentiator tags", () => {
    render(<SolutionSection />);

    // These appear multiple times, use getAllByText
    expect(screen.getAllByText("Dành riêng cho HOSE").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AI Assistant tiếng Việt/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Không cần coding").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Giá hợp lý").length).toBeGreaterThan(0);
  });

  it("renders the comparison table header", () => {
    render(<SolutionSection />);

    expect(screen.getByText(/So sánh với các lựa chọn khác/i)).toBeInTheDocument();
  });

  it("renders comparison table column headers", () => {
    render(<SolutionSection />);

    expect(screen.getByText("Excel / Google Sheets")).toBeInTheDocument();
    expect(screen.getByText("Tools nước ngoài")).toBeInTheDocument();
    expect(screen.getByText("QuantVN")).toBeInTheDocument();
  });

  it("renders comparison table features", () => {
    render(<SolutionSection />);

    // These appear in multiple places
    expect(screen.getAllByText("Dữ liệu HOSE").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AI Assistant tiếng Việt/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Backtest tự động")).toBeInTheDocument();
    expect(screen.getByText("Tối ưu danh mục")).toBeInTheDocument();
  });

  it("renders the CTA button", () => {
    render(<SolutionSection />);

    const cta = screen.getByRole("link", { name: /Trải nghiệm ngay/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute("href", "/dashboard");
  });
});
