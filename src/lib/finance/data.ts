import type { FundamentalsValue } from "@/lib/fundamentals";
import {
  getAvailablePeriods,
  getStatementSnapshot,
} from "@/lib/fundamentals";
import type { FinancialPeriodStatements, FinanceCoverage } from "@/lib/finance/contracts";

const MAX_PERIODS = 8;

export async function loadFinancialPeriods(symbol: string, maxPeriods = MAX_PERIODS): Promise<FinancialPeriodStatements[]> {
  const periods = await getAvailablePeriods(symbol);
  if (periods.length === 0) {
    return [];
  }

  const selected = periods.slice(-Math.max(1, maxPeriods));
  const rows = await Promise.all(
    selected.map(async (period): Promise<FinancialPeriodStatements> => {
      const [bs, income, cf] = await Promise.all([
        getStatementSnapshot(symbol, "bs", period),
        getStatementSnapshot(symbol, "is", period),
        getStatementSnapshot(symbol, "cf", period),
      ]);

      return {
        period,
        bs: bs?.fields ?? null,
        is: income?.fields ?? null,
        cf: cf?.fields ?? null,
      };
    })
  );

  return rows;
}

export async function getCoverage(symbol: string, rows: FinancialPeriodStatements[]): Promise<FinanceCoverage> {
  const periodsAvailable = await getAvailablePeriods(symbol);
  const missingStatements: FinanceCoverage["missingStatements"] = [];

  for (const row of rows) {
    if (!row.bs) missingStatements.push({ period: row.period, statement: "bs" });
    if (!row.is) missingStatements.push({ period: row.period, statement: "is" });
    if (!row.cf) missingStatements.push({ period: row.period, statement: "cf" });
  }

  return {
    symbol: symbol.toUpperCase(),
    periodsAvailable,
    selectedPeriods: rows.map((row) => row.period),
    missingStatements,
  };
}

export function readNumericByAliases(
  fields: Record<string, FundamentalsValue> | null,
  aliases: string[]
): number | null {
  if (!fields) return null;

  const targetAliases = aliases.map(normalizeKey);
  const entries = Object.entries(fields);

  for (const [key, rawValue] of entries) {
    const normalizedKey = normalizeKey(key);
    if (!targetAliases.some((alias) => normalizedKey.includes(alias))) {
      continue;
    }
    const numeric = toNumber(rawValue);
    if (numeric !== null) return numeric;
  }
  return null;
}

export function toNumber(value: FundamentalsValue | unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function safeRatio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

export function yoy(points: Array<{ period: string; value: number | null }>): Array<{ period: string; value: number | null }> {
  const out: Array<{ period: string; value: number | null }> = [];
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const previous = i > 0 ? points[i - 1] : null;
    if (!previous || current.value === null || previous.value === null || previous.value === 0) {
      out.push({ period: current.period, value: null });
      continue;
    }
    out.push({ period: current.period, value: (current.value - previous.value) / Math.abs(previous.value) });
  }
  return out;
}

