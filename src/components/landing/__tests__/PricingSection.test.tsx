import { render, screen } from "@testing-library/react";
import { PricingSection } from "../sections/PricingSection";

// Mock PricingCard component
jest.mock("../ui/PricingCard", () => ({
  PricingCard: ({ name, price, buttonText, buttonHref }: {
    name: string;
    price: string;
    buttonText: string;
    buttonHref: string;
  }) => (
    <div data-testid={`pricing-card-${name.toLowerCase()}`}>
      <h3>{name}</h3>
      <span>{price}</span>
      <a href={buttonHref}>{buttonText}</a>
    </div>
  ),
}));

describe("PricingSection", () => {
  it("renders the section header", () => {
    render(<PricingSection />);

    expect(screen.getByText(/Cam kết không rủi ro/i)).toBeInTheDocument();
    expect(screen.getByText(/Bảng giá minh bạch/i)).toBeInTheDocument();
  });

  it("renders the subheader about no credit card needed", () => {
    render(<PricingSection />);

    expect(screen.getByText(/Không cần thẻ tín dụng/i)).toBeInTheDocument();
  });

  it("renders free pricing card", () => {
    render(<PricingSection />);

    expect(screen.getByTestId("pricing-card-miễn phí")).toBeInTheDocument();
    expect(screen.getByText("₫0")).toBeInTheDocument();
  });

  it("renders pro pricing card", () => {
    render(<PricingSection />);

    expect(screen.getByTestId("pricing-card-pro")).toBeInTheDocument();
    expect(screen.getByText("₫199,000")).toBeInTheDocument();
  });

  it("renders guarantee badges", () => {
    render(<PricingSection />);

    expect(screen.getByText(/Hoàn tiền 30 ngày/i)).toBeInTheDocument();
    expect(screen.getByText(/Thiết lập 30 giây/i)).toBeInTheDocument();
    expect(screen.getByText(/Hủy bất cứ lúc nào/i)).toBeInTheDocument();
  });

  it("renders annual discount offer", () => {
    render(<PricingSection />);

    expect(screen.getByText(/Gói năm: ₫1,990,000/i)).toBeInTheDocument();
    expect(screen.getByText(/Tiết kiệm ₫400,000/i)).toBeInTheDocument();
  });

  it("renders ROI calculator section", () => {
    render(<PricingSection />);

    expect(screen.getByText(/Tính ROI của bạn/i)).toBeInTheDocument();
    expect(screen.getByText(/156 giờ/i)).toBeInTheDocument();
    expect(screen.getByText(/tiết kiệm\/năm/i)).toBeInTheDocument();
  });
});
