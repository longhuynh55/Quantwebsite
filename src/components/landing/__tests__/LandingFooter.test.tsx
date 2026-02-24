import { render, screen } from "@testing-library/react";
import { LandingFooter } from "../LandingFooter";

// Mock Next.js Link
jest.mock("next/link", () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

describe("LandingFooter", () => {
  it("renders the logo", () => {
    render(<LandingFooter />);

    // QuantVN logo - both Quant and VN appear in logo
    expect(screen.getAllByText(/Quant/i).length).toBeGreaterThan(0);
    expect(screen.getByText("VN")).toBeInTheDocument();
  });

  it("renders the tagline", () => {
    render(<LandingFooter />);

    expect(screen.getByText(/Dữ liệu thôi thúc quyết định/i)).toBeInTheDocument();
  });

  it("renders contact information", () => {
    render(<LandingFooter />);

    expect(screen.getByText("contact@quantvn.vn")).toBeInTheDocument();
    expect(screen.getByText(/TP\. Hồ Chí Minh, Việt Nam/i)).toBeInTheDocument();
  });

  it("renders product links", () => {
    render(<LandingFooter />);

    expect(screen.getByText("Sản phẩm")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Screener" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Backtesting" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Charts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AI Assistant" })).toBeInTheDocument();
  });

  it("renders resource links", () => {
    render(<LandingFooter />);

    expect(screen.getByText("Tài nguyên")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tài liệu" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hướng dẫn" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cộng đồng" })).toBeInTheDocument();
  });

  it("product links have correct hrefs", () => {
    render(<LandingFooter />);

    expect(screen.getByRole("link", { name: "Screener" })).toHaveAttribute("href", "/screener");
    expect(screen.getByRole("link", { name: "Backtesting" })).toHaveAttribute("href", "/backtesting");
    expect(screen.getByRole("link", { name: "Charts" })).toHaveAttribute("href", "/charts");
    expect(screen.getByRole("link", { name: "AI Assistant" })).toHaveAttribute("href", "/dashboard");
  });

  it("renders social links with aria labels", () => {
    render(<LandingFooter />);

    expect(screen.getByLabelText("Facebook")).toBeInTheDocument();
    expect(screen.getByLabelText("YouTube")).toBeInTheDocument();
    expect(screen.getByLabelText("LinkedIn")).toBeInTheDocument();
    expect(screen.getByLabelText("GitHub")).toBeInTheDocument();
  });

  it("social links have correct hrefs", () => {
    render(<LandingFooter />);

    expect(screen.getByLabelText("Facebook")).toHaveAttribute("href", "https://facebook.com/quantvn");
    expect(screen.getByLabelText("YouTube")).toHaveAttribute("href", "https://youtube.com/@quantvn");
    expect(screen.getByLabelText("LinkedIn")).toHaveAttribute("href", "https://linkedin.com/company/quantvn");
    expect(screen.getByLabelText("GitHub")).toHaveAttribute("href", "https://github.com/quantvn");
  });

  it("renders copyright with thesis project note", () => {
    render(<LandingFooter />);

    expect(screen.getByText(/2025 QuantVN/i)).toBeInTheDocument();
    expect(screen.getByText(/Graduation Thesis Project/i)).toBeInTheDocument();
  });
});
