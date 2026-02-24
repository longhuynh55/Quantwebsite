import { render, screen } from "@testing-library/react";
import { SocialProofBar } from "../sections/SocialProofBar";

describe("SocialProofBar", () => {
  it("renders all four stats", () => {
    render(<SocialProofBar />);

    expect(screen.getByText("1,200+")).toBeInTheDocument();
    expect(screen.getByText("400+")).toBeInTheDocument();
    expect(screen.getByText("7 năm")).toBeInTheDocument();
    expect(screen.getByText("99.9%")).toBeInTheDocument();
  });

  it("renders stat labels correctly", () => {
    render(<SocialProofBar />);

    expect(screen.getByText("Nhà đầu tư")).toBeInTheDocument();
    expect(screen.getByText("Mã HOSE")).toBeInTheDocument();
    expect(screen.getByText("Dữ liệu lịch sử")).toBeInTheDocument();
    expect(screen.getByText("Uptime")).toBeInTheDocument();
  });

  it("renders stat sublabels", () => {
    render(<SocialProofBar />);

    expect(screen.getByText("đang sử dụng")).toBeInTheDocument();
    expect(screen.getByText("có dữ liệu")).toBeInTheDocument();
    expect(screen.getByText("đầy đủ")).toBeInTheDocument();
    expect(screen.getByText("đảm bảo")).toBeInTheDocument();
  });

  it("renders trust text", () => {
    render(<SocialProofBar />);

    expect(screen.getByText(/Được tin tưởng bởi nhà đầu tư Việt Nam/i)).toBeInTheDocument();
  });

  it("renders trust logos", () => {
    render(<SocialProofBar />);

    expect(screen.getByText("CF")).toBeInTheDocument();
    expect(screen.getByText("VS")).toBeInTheDocument();
    expect(screen.getByText("VN")).toBeInTheDocument();
    expect(screen.getByText("NDH")).toBeInTheDocument();
  });

  it("renders the graduation thesis badge", () => {
    render(<SocialProofBar />);

    expect(screen.getByText(/Graduation Thesis Project/i)).toBeInTheDocument();
  });
});
