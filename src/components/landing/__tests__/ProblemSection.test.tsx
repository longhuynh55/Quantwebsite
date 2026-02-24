import { render, screen } from "@testing-library/react";
import { ProblemSection } from "../sections/ProblemSection";

describe("ProblemSection", () => {
  it("renders the problem badge", () => {
    render(<ProblemSection />);

    expect(screen.getByText(/Có phải bạn đang gặp tình trạng này/i)).toBeInTheDocument();
  });

  it("renders the main headline with statistics", () => {
    render(<ProblemSection />);

    expect(screen.getByText(/Tại sao/i)).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getAllByText(/nhà đầu tư cá nhân thua lỗ/i).length).toBeGreaterThan(0);
  });

  it("renders all four problem cards", () => {
    render(<ProblemSection />);

    expect(screen.getByText(/3\+ giờ mỗi ngày lướt tin tức/i)).toBeInTheDocument();
    expect(screen.getByText(/Mua theo tin đồn, bán theo cảm xúc/i)).toBeInTheDocument();
    expect(screen.getByText(/Biết cần phân tích/i)).toBeInTheDocument();
    expect(screen.getByText(/Công cụ phân tích quá đắt đỏ/i)).toBeInTheDocument();
  });

  it("renders problem descriptions", () => {
    render(<ProblemSection />);

    expect(screen.getByText(/Group Zalo, Facebook, CafeF/i)).toBeInTheDocument();
    expect(screen.getByText(/FOMO, panic selling/i)).toBeInTheDocument();
    expect(screen.getByText(/Excel phức tạp, tools nước ngoài/i)).toBeInTheDocument();
    expect(screen.getByText(/Bloomberg Terminal/i)).toBeInTheDocument();
  });

  it("renders the agitation section", () => {
    render(<ProblemSection />);

    expect(screen.getByText(/Thực tế phũ phàng/i)).toBeInTheDocument();
    expect(screen.getByText(/80% nhà đầu tư cá nhân thua lỗ 2 năm liên tiếp/i)).toBeInTheDocument();
  });

  it("renders the 'thiếu' (lack) cards", () => {
    render(<ProblemSection />);

    const thieuElements = screen.getAllByText("Thiếu");
    expect(thieuElements.length).toBeGreaterThanOrEqual(3);
    // These texts may appear multiple times (uppercase in subheadline + lowercase in cards)
    expect(screen.getAllByText(/Công cụ chuyên nghiệp/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Dữ liệu chính xác/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Kiến thức hệ thống/i).length).toBeGreaterThan(0);
  });

  it("renders the bridge to solution", () => {
    render(<ProblemSection />);

    expect(screen.getByText(/QuantVN/i)).toBeInTheDocument();
    expect(screen.getByText(/ra đời để thay đổi điều đó/i)).toBeInTheDocument();
  });
});
