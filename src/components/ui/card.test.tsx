import { render, screen } from "@testing-library/react";
import { MetricCard } from "./card";

describe("MetricCard", () => {
  it("uses local Tailwind classes for large metric layout", () => {
    const { container } = render(
      <MetricCard
        title="Portfolio Value"
        value="1,000,000"
        size="lg"
      />
    );

    const root = container.firstElementChild as HTMLElement;
    const value = screen.getByText("1,000,000");

    expect(root).toHaveClass("p-8");
    expect(root).not.toHaveClass("metric-hero");
    expect(value).toHaveClass("text-[2.5rem]");
    expect(value).not.toHaveClass("metric-value");
  });

  it("renders status badges without legacy status-* classes", () => {
    const { rerender } = render(
      <MetricCard title="Feed" value="Connected" status="live" />
    );

    const liveBadge = screen.getByText("Live").closest("span") as HTMLElement;
    expect(liveBadge).not.toHaveClass("status-live");
    expect(liveBadge.querySelector("span")).toHaveClass("animate-pulse");

    rerender(<MetricCard title="Feed" value="Delayed" status="stale" />);
    const staleBadge = screen.getByText("Stale").closest("span") as HTMLElement;
    expect(staleBadge).not.toHaveClass("status-stale");
    expect(staleBadge.querySelector("span")).toHaveClass(
      "animate-[pulse_3s_ease-in-out_infinite]"
    );

    rerender(<MetricCard title="Feed" value="Disconnected" status="error" />);
    const errorBadge = screen.getByText("Error").closest("span") as HTMLElement;
    expect(errorBadge).not.toHaveClass("status-error");
    expect(errorBadge.querySelector("span")).not.toHaveClass("animate-pulse");
  });

  it("renders progress fill animation via local utility classes", () => {
    const { container } = render(
      <MetricCard
        title="Allocation"
        value="50%"
        progress={{ value: 50, max: 100 }}
      />
    );

    const progressFill = container.querySelector(
      'div[style*="width: 50%"]'
    ) as HTMLElement;

    expect(progressFill).toBeInTheDocument();
    expect(progressFill).not.toHaveClass("progress-bar-animated");
    expect(progressFill).toHaveClass("after:animate-pulse");
  });
});
