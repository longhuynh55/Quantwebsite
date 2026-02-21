import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MonthlyReturnsHeatmap } from "./MonthlyReturnsHeatmap";

const sampleReturns = [
  { date: "2025-01-02", return: 0.01 },
  { date: "2025-01-03", return: 0.02 },
  { date: "2025-02-03", return: -0.01 },
];

describe("MonthlyReturnsHeatmap", () => {
  it("renders empty state when no data exists", () => {
    render(<MonthlyReturnsHeatmap returns={[]} />);

    expect(screen.getByText("No returns data available")).toBeInTheDocument();
    expect(screen.getByText("Run a backtest to view monthly returns")).toBeInTheDocument();
  });

  it("renders monthly cells, annual total, and summary stats", () => {
    render(<MonthlyReturnsHeatmap returns={sampleReturns} />);

    expect(screen.getByText("2025")).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: "January 2025: +3.0%" })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: "February 2025: -1.0%" })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: "2025 total: +2.0%" })).toBeInTheDocument();

    expect(screen.getByText("Best Month")).toBeInTheDocument();
    expect(screen.getByText("Worst Month")).toBeInTheDocument();
    expect(screen.getByText("Avg Monthly")).toBeInTheDocument();
    expect(screen.getByText("Positive Months")).toBeInTheDocument();
    expect(screen.getByText("1/2 (50%)")).toBeInTheDocument();
  });

  it("shows and hides tooltip when a cell receives focus", async () => {
    render(<MonthlyReturnsHeatmap returns={sampleReturns} />);

    const januaryCell = screen.getByRole("gridcell", { name: "January 2025: +3.0%" });
    fireEvent.focus(januaryCell);
    expect(screen.getByText("January 2025: +3.0%")).toBeInTheDocument();

    fireEvent.blur(januaryCell);
    await waitFor(() => {
      expect(screen.queryByText("January 2025: +3.0%")).not.toBeInTheDocument();
    });
  });
});
