import type { FundamentalsValue } from "@/lib/fundamentals";
import {
  getAvailablePeriods,
  getStatementSnapshot,
} from "@/lib/fundamentals";
import type { FinancialPeriodStatements, FinanceCoverage } from "@/lib/finance/contracts";

const MAX_PERIODS = 8;

export interface LoadFinancialPeriodsOptions {
  endPeriod?: string;
}

function comparePeriodAsc(a: string, b: string): number {
  const ma = /^(\d{4})Q([1-4])$/.exec(a);
  const mb = /^(\d{4})Q([1-4])$/.exec(b);
  if (!ma || !mb) return a.localeCompare(b);
  const ya = Number(ma[1]);
  const yb = Number(mb[1]);
  if (ya !== yb) return ya - yb;
  return Number(ma[2]) - Number(mb[2]);
}

export async function loadFinancialPeriods(
  symbol: string,
  maxPeriods = MAX_PERIODS,
  options?: LoadFinancialPeriodsOptions
): Promise<FinancialPeriodStatements[]> {
  const periods = await getAvailablePeriods(symbol);
  if (periods.length === 0) {
    return [];
  }

  const endPeriod = options?.endPeriod;
  const scopedPeriods =
    endPeriod && endPeriod.trim().length > 0
      ? periods.filter((period) => comparePeriodAsc(period, endPeriod) <= 0)
      : periods;
  if (scopedPeriods.length === 0) {
    return [];
  }

  const selected = scopedPeriods.slice(-Math.max(1, maxPeriods));
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
  const noisySuffixPattern = /(yoy|qoq|margin|ratio|pct|percent|growth|change)$/;
  const noisyTokenPattern = /_(yoy|qoq|margin|ratio|pct|percent|growth|change|trend)(_|$)/;

  let bestScore = Number.NEGATIVE_INFINITY;
  let bestValue: number | null = null;

  for (const [key, rawValue] of entries) {
    const numeric = toNumber(rawValue);
    if (numeric === null) continue;
    const normalizedKey = normalizeKey(key);

    let entryBestScore = Number.NEGATIVE_INFINITY;
    for (const alias of targetAliases) {
      let score = Number.NEGATIVE_INFINITY;
      if (normalizedKey === alias) {
        score = 120;
      } else if (normalizedKey === `${alias}_bn_vnd` || normalizedKey === `${alias}_mn_vnd`) {
        score = 115;
      } else if (normalizedKey.startsWith(`${alias}_`)) {
        score = 90;
      } else if (normalizedKey.includes(alias)) {
        score = 60;
      }

      if (score > Number.NEGATIVE_INFINITY) {
        if (noisySuffixPattern.test(normalizedKey) || noisyTokenPattern.test(normalizedKey)) {
          score -= 80;
        }
        entryBestScore = Math.max(entryBestScore, score);
      }
    }

    if (entryBestScore > bestScore) {
      bestScore = entryBestScore;
      bestValue = numeric;
    }
  }

  return bestScore > Number.NEGATIVE_INFINITY ? bestValue : null;
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

function getPriorYearSameQuarter(period: string): string | null {
  const match = /^(\d{4})Q([1-4])$/.exec(period.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const quarter = match[2];
  if (!Number.isFinite(year)) return null;
  return `${year - 1}Q${quarter}`;
}

export function yoy(points: Array<{ period: string; value: number | null }>): Array<{ period: string; value: number | null }> {
  const byPeriod = new Map(points.map((point) => [point.period, point.value]));
  const out: Array<{ period: string; value: number | null }> = [];
  for (const current of points) {
    const previousPeriod = getPriorYearSameQuarter(current.period);
    const previousValue = previousPeriod ? (byPeriod.get(previousPeriod) ?? null) : null;
    if (
      current.value === null
      || previousValue === null
      || previousValue === 0
    ) {
      out.push({ period: current.period, value: null });
      continue;
    }
    out.push({ period: current.period, value: (current.value - previousValue) / Math.abs(previousValue) });
  }
  return out;
}
