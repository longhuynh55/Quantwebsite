"use client";

import { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface MonthlyReturnsHeatmapProps {
  returns: { date: string; return: number }[];
  className?: string;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface MonthlyData {
  year: number;
  months: (number | null)[]; // null means no data for that month
  total: number | null;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: string;
}

// Color scale from deep red (-10%) to white (0%) to deep green (+10%)
function getReturnColor(returnValue: number, isDark: boolean = false): string {
  // Clamp the return value between -10% and +10% for color calculation
  const clampedReturn = Math.max(-10, Math.min(10, returnValue));

  if (clampedReturn === 0) {
    return isDark ? "#374151" : "#f3f4f6"; // neutral gray
  }

  if (clampedReturn > 0) {
    // Positive returns: light green to deep green
    const intensity = Math.abs(clampedReturn) / 10;

    if (isDark) {
      // Dark mode: darker shades of green
      if (intensity < 0.25) return "#14532d"; // Very light green
      if (intensity < 0.5) return "#166534";
      if (intensity < 0.75) return "#15803d";
      return "#16a34a"; // Deep green
    } else {
      // Light mode
      if (intensity < 0.25) return "#bbf7d0"; // Very light green
      if (intensity < 0.5) return "#86efac";
      if (intensity < 0.75) return "#4ade80";
      return "#22c55e"; // Deep green
    }
  } else {
    // Negative returns: light red to deep red
    const intensity = Math.abs(clampedReturn) / 10;

    if (isDark) {
      // Dark mode: darker shades of red
      if (intensity < 0.25) return "#7f1d1d"; // Very light red
      if (intensity < 0.5) return "#991b1b";
      if (intensity < 0.75) return "#b91c1c";
      return "#dc2626"; // Deep red
    } else {
      // Light mode
      if (intensity < 0.25) return "#fecaca"; // Very light red
      if (intensity < 0.5) return "#fca5a5";
      if (intensity < 0.75) return "#f87171";
      return "#ef4444"; // Deep red
    }
  }
}

// Get text color based on background intensity
function getTextColor(returnValue: number): string {
  const clampedReturn = Math.max(-10, Math.min(10, returnValue));
  const intensity = Math.abs(clampedReturn) / 10;

  if (intensity > 0.5) {
    return "text-white";
  }
  return clampedReturn >= 0 ? "text-green-800 dark:text-green-100" : "text-red-800 dark:text-red-100";
}

// Calculate cumulative return for a series of daily returns
// Returns are expected in decimal form (e.g., 0.015 for 1.5%)
function calculateCumulativeReturn(dailyReturns: number[]): number {
  if (dailyReturns.length === 0) return 0;

  let cumulative = 1;
  for (const dailyReturn of dailyReturns) {
    // Daily returns are decimals (e.g., 0.015 = 1.5%)
    cumulative *= (1 + dailyReturn);
  }

  // Convert to percentage for display
  return ((cumulative - 1) * 100);
}

// Format return value for display
function formatReturnValue(value: number | null): string {
  if (value === null) return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

// Calculate annual return from monthly returns (which are already in percentage form).
function calculateAnnualReturnFromMonthlyReturns(monthlyReturnsPct: number[]): number {
  let cumulative = 1;
  for (const monthlyReturnPct of monthlyReturnsPct) {
    cumulative *= (1 + monthlyReturnPct / 100);
  }
  return ((cumulative - 1) * 100);
}

export function MonthlyReturnsHeatmap({
  returns,
  className,
}: MonthlyReturnsHeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    content: "",
  });

  // Check if dark mode is active - use useEffect to avoid SSR/hydration mismatch
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      const dark = document.documentElement.classList.contains("dark") ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches &&
          !document.documentElement.classList.contains("light"));
      setIsDark(dark);
    };

    // Initial check
    checkDarkMode();

    // Listen for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", checkDarkMode);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", checkDarkMode);
    };
  }, []);

  // Process returns data into monthly format
  const monthlyData = useMemo(() => {
    if (!returns || returns.length === 0) return [];

    // Group returns by year and month
    const groupedData: Record<number, Record<number, number[]>> = {};

    for (const item of returns) {
      // Date strings are expected to be ISO or YYYY-MM-DD. Use UTC semantics to
      // prevent timezone-dependent month/year shifts on the client.
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(item.date);
      let year: number;
      let month: number; // 0-indexed

      if (m) {
        year = Number(m[1]);
        month = Number(m[2]) - 1;
      } else {
        const date = new Date(item.date);
        if (isNaN(date.getTime())) continue;
        year = date.getUTCFullYear();
        month = date.getUTCMonth();
      }

      if (!groupedData[year]) {
        groupedData[year] = {};
      }
      if (!groupedData[year][month]) {
        groupedData[year][month] = [];
      }
      groupedData[year][month].push(item.return);
    }

    // Get all years and sort in descending order
    const years = Object.keys(groupedData)
      .map(Number)
      .sort((a, b) => b - a);

    // Calculate cumulative returns for each month
    const result: MonthlyData[] = years.map((year) => {
      const months: (number | null)[] = [];

      for (let month = 0; month < 12; month++) {
        if (groupedData[year][month] && groupedData[year][month].length > 0) {
          months[month] = calculateCumulativeReturn(groupedData[year][month]);
        } else {
          months[month] = null;
        }
      }

      // Calculate annual total (cumulative of all months)
      const monthlyReturns = months.filter((m): m is number => m !== null);
      const total = monthlyReturns.length > 0
        ? calculateAnnualReturnFromMonthlyReturns(monthlyReturns)
        : null;

      return { year, months, total };
    });

    return result;
  }, [returns]);

  // Handle cell hover
  const handleMouseEnter = (
    e: React.MouseEvent<HTMLDivElement>,
    year: number,
    month: number | null,
    value: number | null
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const content = month !== null
      ? `${MONTHS_FULL[month]} ${year}: ${formatReturnValue(value)}`
      : `${year} Total: ${formatReturnValue(value)}`;

    setTooltip({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      content,
    });
  };

  const handleMouseLeave = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  // Empty state
  if (!returns || returns.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-64 text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg",
          className
        )}
      >
        <div className="text-center">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="font-medium">No returns data available</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Run a backtest to view monthly returns
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed z-50 px-3 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          {tooltip.content}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
        </div>
      )}

      {/* Heatmap Container - Scrollable on mobile */}
      <div className="overflow-x-auto scrollbar-thin">
        <div className="min-w-[700px]">
          {/* Header Row */}
          <div className="flex mb-1">
            <div className="w-14 flex-shrink-0" />
            {MONTHS.map((month) => (
              <div
                key={month}
                className="flex-1 min-w-[48px] text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2"
              >
                {month}
              </div>
            ))}
            <div className="w-16 flex-shrink-0 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2">
              Total
            </div>
          </div>

          {/* Data Rows */}
          {monthlyData.map((yearData) => (
            <div key={yearData.year} className="flex mb-1">
              {/* Year Label */}
              <div className="w-14 flex-shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center justify-start pr-2">
                {yearData.year}
              </div>

              {/* Month Cells */}
              {yearData.months.map((value, monthIndex) => (
                <div
                  key={`${yearData.year}-${monthIndex}`}
                  className="flex-1 min-w-[48px] h-10 mx-0.5 flex items-center justify-center rounded text-xs font-mono cursor-pointer transition-transform hover:scale-105 hover:z-10"
                  style={{
                    backgroundColor: value !== null ? getReturnColor(value, isDark) : (isDark ? "#1e293b" : "#f9fafb"),
                  }}
                  onMouseEnter={(e) => handleMouseEnter(e, yearData.year, monthIndex, value)}
                  onMouseLeave={handleMouseLeave}
                >
                  <span
                    className={cn(
                      "font-medium",
                      value !== null ? getTextColor(value) : "text-gray-400 dark:text-gray-600"
                    )}
                  >
                    {formatReturnValue(value)}
                  </span>
                </div>
              ))}

              {/* Annual Total */}
              <div
                className="w-16 flex-shrink-0 h-10 ml-1 flex items-center justify-center rounded text-xs font-mono cursor-pointer transition-transform hover:scale-105"
                style={{
                  backgroundColor: yearData.total !== null ? getReturnColor(yearData.total, isDark) : (isDark ? "#1e293b" : "#f9fafb"),
                }}
                onMouseEnter={(e) => handleMouseEnter(e, yearData.year, null, yearData.total)}
                onMouseLeave={handleMouseLeave}
              >
                <span
                  className={cn(
                    "font-bold",
                    yearData.total !== null ? getTextColor(yearData.total) : "text-gray-400 dark:text-gray-600"
                  )}
                >
                  {formatReturnValue(yearData.total)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Color Legend */}
      <div className="mt-6 flex items-center justify-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">-10%</span>
        <div className="flex h-3 rounded overflow-hidden">
          {/* Red gradient */}
          <div className="w-6 bg-red-500 dark:bg-red-600" />
          <div className="w-6 bg-red-300 dark:bg-red-700" />
          <div className="w-6 bg-red-100 dark:bg-red-800" />
          {/* Neutral */}
          <div className="w-6 bg-gray-100 dark:bg-gray-700" />
          {/* Green gradient */}
          <div className="w-6 bg-green-100 dark:bg-green-800" />
          <div className="w-6 bg-green-300 dark:bg-green-700" />
          <div className="w-6 bg-green-500 dark:bg-green-600" />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">+10%</span>
      </div>

      {/* Stats Summary */}
      {monthlyData.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Best Month
              </p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400 font-mono">
                {formatReturnValue(
                  (() => {
                    const allMonths = monthlyData.flatMap((d) =>
                      d.months.filter((m): m is number => m !== null)
                    );
                    return allMonths.length > 0 ? Math.max(...allMonths) : 0;
                  })()
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Worst Month
              </p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400 font-mono">
                {formatReturnValue(
                  (() => {
                    const allMonths = monthlyData.flatMap((d) =>
                      d.months.filter((m): m is number => m !== null)
                    );
                    return allMonths.length > 0 ? Math.min(...allMonths) : 0;
                  })()
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Avg Monthly
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">
                {formatReturnValue(
                  (() => {
                    const allMonths = monthlyData.flatMap((d) =>
                      d.months.filter((m): m is number => m !== null)
                    );
                    return allMonths.length > 0
                      ? allMonths.reduce((sum, val) => sum + val, 0) / allMonths.length
                      : 0;
                  })()
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Positive Months
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">
                {(() => {
                  const allMonths = monthlyData.flatMap((d) =>
                    d.months.filter((m): m is number => m !== null)
                  );
                  const positive = allMonths.filter((m) => m > 0).length;
                  const pct = allMonths.length > 0
                    ? ((positive / allMonths.length) * 100).toFixed(0)
                    : "0";
                  return `${positive}/${allMonths.length} (${pct}%)`;
                })()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MonthlyReturnsHeatmap;
