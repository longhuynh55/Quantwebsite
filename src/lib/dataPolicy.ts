export const MAX_RECENCY_GAP_TRADING_DAYS = 5;
export const MIN_HISTORY_DAYS_OPTIMIZE = 504;
export const MIN_OVERLAP_DAYS_OPTIMIZE = 504;
export const DEFAULT_BENCHMARK_SYMBOL = "VNINDEX";

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
