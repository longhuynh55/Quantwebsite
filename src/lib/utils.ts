import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrency(num: number): string {
  if (num >= 1e9) {
    return `${(num / 1e9).toFixed(2)}B`;
  } else if (num >= 1e6) {
    return `${(num / 1e6).toFixed(2)}M`;
  } else if (num >= 1e3) {
    return `${(num / 1e3).toFixed(2)}K`;
  }
  return num.toFixed(2);
}

export function formatPercent(num: number): string {
  const sign = num >= 0 ? "+" : "";
  return `${sign}${(num * 100).toFixed(2)}%`;
}

export function parseCSVDate(dateStr: string): Date {
  // Input validation
  if (!dateStr || typeof dateStr !== "string" || dateStr.trim() === "") {
    return new Date(NaN);  // Return Invalid Date
  }

  try {
    const normalized = dateStr.trim();
    let year: number;
    let month: number;
    let day: number;

    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
      // Parse YYYY-MM-DD as local date to avoid timezone-dependent day shifts.
      const parts = normalized.split("-");
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(normalized)) {
      // Parse M/D/YYYY as local date.
      const parts = normalized.split("/");
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    } else {
      return new Date(NaN);
    }

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return new Date(NaN);
    }

    const date = new Date(year, month - 1, day);

    // Ensure date components are preserved (reject invalid dates like 2024-02-31).
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return new Date(NaN);
    }

    return date;
  } catch {
    return new Date(NaN);
  }
}

export function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
