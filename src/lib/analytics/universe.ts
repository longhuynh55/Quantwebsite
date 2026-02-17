import { getDatasetLoadStatus, loadOHLCVData, loadStockMetadata, type OHLCV, type StockMetadata } from "@/lib/data";
import { toDateKey } from "@/lib/dataPolicy";
import { readNumericByAliases } from "@/lib/finance/data";
import { getAvailablePeriods, getStatementSnapshot, type FundamentalsValue } from "@/lib/fundamentals";

export type IcbLevel = "2" | "3" | "4";
export type ValuationMetric = "pe" | "pb" | "ev_ebitda";
export type RankingOrder = "desc" | "asc";

export interface IcbSnapshotParams {
  asOfDateKey?: string;
  requestedDate?: string;
  exchange?: string;
  icbLevel?: IcbLevel;
  icbFilter?: string;
  limit?: number;
}

export interface IcbSnapshotGroup {
  rank: number;
  icbCode: string | null;
  icbName: string;
  symbolCount: number;
  pricedSymbolCount: number;
  exactDateMatchCount: number;
  avgClose: number | null;
  avgDayChangePct: number | null;
  totalVolume: number;
  totalTradedValueApprox: number | null;
  topSymbolsByValue: string[];
}

export interface IcbSnapshotResult {
  asOfDate: string;
  requestedDate?: string;
  exchange: string;
  icbLevel: IcbLevel;
  totalSymbols: number;
  pricedSymbols: number;
  exactDateMatchCount: number;
  groups: IcbSnapshotGroup[];
  warnings: string[];
}

export interface ValuationRankingParams {
  asOfDateKey?: string;
  requestedDate?: string;
  exchange?: string;
  icbLevel?: IcbLevel;
  icbFilter?: string;
  metric?: ValuationMetric;
  order?: RankingOrder;
  limit?: number;
}

export interface ValuationRankingRow {
  rank: number;
  symbol: string;
  metricValue: number;
  pe: number | null;
  pb: number | null;
  evEbitda: number | null;
  price: number;
  priceDate: string;
  exactDateMatch: boolean;
  icbName2?: string;
  icbName3?: string;
  icbName4?: string;
  fundamentalPeriod: string | null;
  incomePeriodsUsed: number;
}

export interface ValuationRankingResult {
  asOfDate: string;
  requestedDate?: string;
  exchange: string;
  metric: ValuationMetric;
  order: RankingOrder;
  icbLevel?: IcbLevel;
  icbFilter?: string;
  totalCandidates: number;
  pricedCandidates: number;
  fundamentalCandidates: number;
  eligibleRanked: number;
  rows: ValuationRankingRow[];
  warnings: string[];
  coverage: {
    excludedByReason: Record<string, number>;
  };
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const DEFAULT_EXCHANGE = "HOSE";
const DEFAULT_ICB_LEVEL: IcbLevel = "3";
const DEFAULT_METRIC: ValuationMetric = "pe";
const DEFAULT_ORDER: RankingOrder = "desc";
const VALUATION_CONCURRENCY = 12;

const NET_INCOME_ALIASES = [
  "net_profit_for_the_year",
  "attributable_to_parent_company",
  "net_profit",
  "profit_after_tax",
];
const EBITDA_ALIASES = [
  "ebitda",
  "earnings_before_interest_taxes_depreciation_and_amortization",
  "operating_profit_before_depreciation_and_amortization",
];
const EQUITY_ALIASES = ["owner_s_equity", "equity", "capital_and_reserves"];
const TOTAL_LIABILITIES_ALIASES = ["liabilities", "total_liabilities"];
const CASH_ALIASES = [
  "cash_and_cash_equivalents",
  "cash_and_cash_equivalents_at_the_end_of_period",
  "cash",
];
const SHORT_INVESTMENTS_ALIASES = ["short_term_investments", "trading_securities"];
const SHARES_ALIASES = ["common_shares", "paid_in_capital", "capital", "shares_outstanding"];

const quarterEndByNumber: Record<string, string> = {
  "1": "03-31",
  "2": "06-30",
  "3": "09-30",
  "4": "12-31",
};

interface PricePoint {
  close: number;
  volume: number;
  dateKey: string;
  exactDateMatch: boolean;
  dayChangePct: number | null;
}

interface GroupAccumulator {
  icbCode: string | null;
  icbName: string;
  symbols: Set<string>;
  pricedSymbolCount: number;
  exactDateMatchCount: number;
  closeSum: number;
  closeCount: number;
  dayChangeSum: number;
  dayChangeCount: number;
  totalVolume: number;
  totalTradedValueApprox: number;
  symbolValuePairs: Array<{ symbol: string; value: number }>;
}

interface ValuationComputationRow {
  symbol: string;
  pe: number | null;
  pb: number | null;
  evEbitda: number | null;
  price: number;
  priceDate: string;
  exactDateMatch: boolean;
  icbName2?: string;
  icbName3?: string;
  icbName4?: string;
  fundamentalPeriod: string | null;
  incomePeriodsUsed: number;
}

interface ValuationComputationResult {
  row: ValuationComputationRow | null;
  reason?: "no_eligible_period" | "missing_balance_sheet" | "insufficient_income_history" | "metric_unavailable";
}

export function parseIcbLevel(raw: string | null | undefined): IcbLevel | null {
  const value = String(raw ?? "").trim();
  if (!value) return DEFAULT_ICB_LEVEL;
  if (value === "2" || value === "3" || value === "4") return value;
  return null;
}

export function parseValuationMetric(raw: string | null | undefined): ValuationMetric | null {
  const normalized = normalizeText(String(raw ?? ""));
  if (!normalized) return DEFAULT_METRIC;
  if (normalized === "pe" || normalized === "p/e" || normalized === "p_e") return "pe";
  if (normalized === "pb" || normalized === "p/b" || normalized === "p_b") return "pb";
  if (normalized.includes("ev") && normalized.includes("ebitda")) return "ev_ebitda";
  return null;
}

export function parseRankingOrder(raw: string | null | undefined): RankingOrder | null {
  const normalized = normalizeText(String(raw ?? ""));
  if (!normalized) return DEFAULT_ORDER;
  if (normalized === "desc" || normalized === "descending" || normalized === "top") return "desc";
  if (normalized === "asc" || normalized === "ascending" || normalized === "bottom") return "asc";
  return null;
}

export function parsePositiveLimit(raw: string | null | undefined): number | null {
  const normalized = String(raw ?? "").trim();
  if (!normalized) return DEFAULT_LIMIT;
  const value = Number.parseInt(normalized, 10);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(MAX_LIMIT, value);
}

export function parseFlexibleDate(raw: string | null | undefined): Date | null {
  const input = String(raw ?? "").trim();
  if (!input) return null;

  const yyyyMmDd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(input);
  if (yyyyMmDd) {
    const year = Number(yyyyMmDd[1]);
    const month = Number(yyyyMmDd[2]);
    const day = Number(yyyyMmDd[3]);
    return createStrictDate(year, month, day);
  }

  const ddMmYyyy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(input);
  if (ddMmYyyy) {
    const first = Number(ddMmYyyy[1]);
    const second = Number(ddMmYyyy[2]);
    const year = Number(ddMmYyyy[3]);
    if (first > 12 && second <= 12) {
      return createStrictDate(year, second, first);
    }
    if (second > 12 && first <= 12) {
      return createStrictDate(year, first, second);
    }
    return createStrictDate(year, second, first);
  }

  const maybeIso = new Date(input);
  if (!Number.isNaN(maybeIso.getTime())) {
    return new Date(maybeIso.getFullYear(), maybeIso.getMonth(), maybeIso.getDate());
  }

  return null;
}

export async function buildIcbSnapshot(params: IcbSnapshotParams): Promise<IcbSnapshotResult> {
  const exchange = normalizeExchange(params.exchange);
  const icbLevel = params.icbLevel ?? DEFAULT_ICB_LEVEL;
  const limit = normalizeLimit(params.limit);
  const warnings: string[] = [];
  const [metadata, ohlcvMap] = await Promise.all([loadStockMetadata(), loadOHLCVData()]);
  const metadataStatus = getDatasetLoadStatus("stockMetadata");
  const ohlcvStatus = getDatasetLoadStatus("ohlcv");
  if (metadata.length === 0 && metadataStatus.status === "error") {
    throw new Error(`DATASET_UNAVAILABLE:stockMetadata:${metadataStatus.reason ?? "read_failure"}`);
  }
  if (ohlcvMap.size === 0 && ohlcvStatus.status === "error") {
    throw new Error(`DATASET_UNAVAILABLE:ohlcv:${ohlcvStatus.reason ?? "read_failure"}`);
  }

  const asOfDateKey = params.asOfDateKey ?? resolveLatestDateKey(metadata, ohlcvMap);
  if (!asOfDateKey) {
    throw new Error("Unable to determine as-of date for ICB snapshot.");
  }

  const universe = metadata
    .filter((item) => item.exchange.toUpperCase() === exchange)
    .filter((item) => item.status.toUpperCase() === "ACTIVE")
    .filter((item) => matchesIcbFilter(item, params.icbFilter, icbLevel));

  const groups = new Map<string, GroupAccumulator>();
  let pricedSymbols = 0;
  let exactDateMatchCount = 0;

  for (const item of universe) {
    const groupKey = getIcbGroupKey(item, icbLevel);
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        icbCode: getIcbCodeByLevel(item, icbLevel),
        icbName: getIcbNameByLevel(item, icbLevel),
        symbols: new Set<string>(),
        pricedSymbolCount: 0,
        exactDateMatchCount: 0,
        closeSum: 0,
        closeCount: 0,
        dayChangeSum: 0,
        dayChangeCount: 0,
        totalVolume: 0,
        totalTradedValueApprox: 0,
        symbolValuePairs: [],
      };
      groups.set(groupKey, group);
    }

    group.symbols.add(item.symbol);
    const series = ohlcvMap.get(item.symbol);
    if (!series || series.length === 0) continue;

    const point = pickPricePoint(series, asOfDateKey);
    if (!point) continue;

    pricedSymbols += 1;
    group.pricedSymbolCount += 1;
    group.closeSum += point.close;
    group.closeCount += 1;
    group.totalVolume += point.volume;
    group.totalTradedValueApprox += point.close * point.volume;
    group.symbolValuePairs.push({ symbol: item.symbol, value: point.close * point.volume });
    if (point.dayChangePct !== null) {
      group.dayChangeSum += point.dayChangePct;
      group.dayChangeCount += 1;
    }
    if (point.exactDateMatch) {
      exactDateMatchCount += 1;
      group.exactDateMatchCount += 1;
    }
  }

  if (pricedSymbols === 0) {
    warnings.push(`No OHLCV rows found on or before ${asOfDateKey} for the selected universe.`);
  } else if (exactDateMatchCount < pricedSymbols) {
    warnings.push(
      `Only ${exactDateMatchCount}/${pricedSymbols} symbols traded exactly on ${asOfDateKey}; others used previous sessions.`
    );
  }

  const rankedGroups = Array.from(groups.values())
    .map((group) => ({
      icbCode: group.icbCode,
      icbName: group.icbName,
      symbolCount: group.symbols.size,
      pricedSymbolCount: group.pricedSymbolCount,
      exactDateMatchCount: group.exactDateMatchCount,
      avgClose: group.closeCount > 0 ? group.closeSum / group.closeCount : null,
      avgDayChangePct: group.dayChangeCount > 0 ? group.dayChangeSum / group.dayChangeCount : null,
      totalVolume: group.totalVolume,
      totalTradedValueApprox: group.pricedSymbolCount > 0 ? group.totalTradedValueApprox : null,
      topSymbolsByValue: group.symbolValuePairs
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
        .map((item) => item.symbol),
    }))
    .sort((a, b) => {
      const valueA = a.totalTradedValueApprox ?? 0;
      const valueB = b.totalTradedValueApprox ?? 0;
      if (valueB !== valueA) return valueB - valueA;
      return b.symbolCount - a.symbolCount;
    })
    .slice(0, limit)
    .map((group, index) => ({ rank: index + 1, ...group }));

  return {
    asOfDate: asOfDateKey,
    requestedDate: params.requestedDate,
    exchange,
    icbLevel,
    totalSymbols: universe.length,
    pricedSymbols,
    exactDateMatchCount,
    groups: rankedGroups,
    warnings,
  };
}

export async function buildValuationRankings(params: ValuationRankingParams): Promise<ValuationRankingResult> {
  const exchange = normalizeExchange(params.exchange);
  const metric = params.metric ?? DEFAULT_METRIC;
  const order = params.order ?? DEFAULT_ORDER;
  const limit = normalizeLimit(params.limit);
  const warnings: string[] = [];
  const [metadata, ohlcvMap] = await Promise.all([loadStockMetadata(), loadOHLCVData()]);
  const metadataStatus = getDatasetLoadStatus("stockMetadata");
  const ohlcvStatus = getDatasetLoadStatus("ohlcv");
  if (metadata.length === 0 && metadataStatus.status === "error") {
    throw new Error(`DATASET_UNAVAILABLE:stockMetadata:${metadataStatus.reason ?? "read_failure"}`);
  }
  if (ohlcvMap.size === 0 && ohlcvStatus.status === "error") {
    throw new Error(`DATASET_UNAVAILABLE:ohlcv:${ohlcvStatus.reason ?? "read_failure"}`);
  }

  const asOfDateKey = params.asOfDateKey ?? resolveLatestDateKey(metadata, ohlcvMap);
  if (!asOfDateKey) {
    throw new Error("Unable to determine as-of date for valuation ranking.");
  }

  const universe = metadata
    .filter((item) => item.exchange.toUpperCase() === exchange)
    .filter((item) => item.status.toUpperCase() === "ACTIVE")
    .filter((item) => matchesIcbFilter(item, params.icbFilter, params.icbLevel));

  let pricedCandidates = 0;
  let fundamentalCandidates = 0;
  let exactDateMatchCount = 0;
  const excludedByReason = new Map<string, number>();
  const trackExclusion = (reason: string | undefined) => {
    if (!reason) return;
    excludedByReason.set(reason, (excludedByReason.get(reason) ?? 0) + 1);
  };

  const valuationRows = await mapWithConcurrency(universe, VALUATION_CONCURRENCY, async (item) => {
    const series = ohlcvMap.get(item.symbol);
    if (!series || series.length === 0) {
      trackExclusion("missing_price_series");
      return null;
    }

    const price = pickPricePoint(series, asOfDateKey);
    if (!price) {
      trackExclusion("missing_price_as_of_date");
      return null;
    }
    pricedCandidates += 1;
    if (price.exactDateMatch) exactDateMatchCount += 1;

    const computed = await computeValuationRow(item, asOfDateKey, price);
    if (!computed.row) {
      trackExclusion(computed.reason);
      return null;
    }
    fundamentalCandidates += 1;

    const metricValue = getMetricValue(computed.row, metric);
    if (metricValue === null || !Number.isFinite(metricValue) || metricValue <= 0) {
      trackExclusion("metric_not_positive");
      return null;
    }

    return {
      row: computed.row,
      metricValue,
    };
  });

  if (pricedCandidates === 0) {
    warnings.push(`No OHLCV rows found on or before ${asOfDateKey} for the selected universe.`);
  } else if (exactDateMatchCount < pricedCandidates) {
    warnings.push(
      `Only ${exactDateMatchCount}/${pricedCandidates} symbols traded exactly on ${asOfDateKey}; others used previous sessions.`
    );
  }

  const ranked = valuationRows
    .filter((item): item is { row: ValuationComputationRow; metricValue: number } => item !== null)
    .sort((a, b) => (order === "desc" ? b.metricValue - a.metricValue : a.metricValue - b.metricValue));

  if (ranked.length === 0) {
    warnings.push("No symbols had enough fundamentals to compute the requested valuation metric.");
  }
  if (excludedByReason.size > 0) {
    const summary = Array.from(excludedByReason.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => `${reason}:${count}`)
      .join(", ");
    warnings.push(`Valuation coverage exclusions (${universe.length} symbols): ${summary}.`);
  }

  const rows: ValuationRankingRow[] = ranked.slice(0, limit).map((item, index) => ({
    rank: index + 1,
    symbol: item.row.symbol,
    metricValue: item.metricValue,
    pe: item.row.pe,
    pb: item.row.pb,
    evEbitda: item.row.evEbitda,
    price: item.row.price,
    priceDate: item.row.priceDate,
    exactDateMatch: item.row.exactDateMatch,
    icbName2: item.row.icbName2,
    icbName3: item.row.icbName3,
    icbName4: item.row.icbName4,
    fundamentalPeriod: item.row.fundamentalPeriod,
    incomePeriodsUsed: item.row.incomePeriodsUsed,
  }));

  return {
    asOfDate: asOfDateKey,
    requestedDate: params.requestedDate,
    exchange,
    metric,
    order,
    icbLevel: params.icbLevel,
    icbFilter: normalizeText(params.icbFilter ?? "") || undefined,
    totalCandidates: universe.length,
    pricedCandidates,
    fundamentalCandidates,
    eligibleRanked: ranked.length,
    rows,
    warnings,
    coverage: {
      excludedByReason: Object.fromEntries(excludedByReason.entries()),
    },
  };
}

function normalizeExchange(raw: string | undefined): string {
  const value = String(raw ?? DEFAULT_EXCHANGE).trim().toUpperCase();
  return value || DEFAULT_EXCHANGE;
}

function normalizeLimit(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(raw)));
}

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .trim();
}

function createStrictDate(year: number, month: number, day: number): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 1900 || year > 2200) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function resolveLatestDateKey(metadata: StockMetadata[], ohlcvMap: Map<string, OHLCV[]>): string | null {
  let latest = "";
  for (const item of metadata) {
    if (item.lastDate instanceof Date && !Number.isNaN(item.lastDate.getTime())) {
      const key = toDateKey(item.lastDate);
      if (key > latest) latest = key;
    }
  }

  for (const series of ohlcvMap.values()) {
    if (series.length === 0) continue;
    const key = toDateKey(series[series.length - 1].date);
    if (key > latest) latest = key;
  }
  return latest || null;
}

function getIcbNameByLevel(item: StockMetadata, level: IcbLevel): string {
  if (level === "2") return item.icbName2 || "Unclassified";
  if (level === "3") return item.icbName3 || "Unclassified";
  return item.icbName4 || "Unclassified";
}

function getIcbCodeByLevel(item: StockMetadata, level: IcbLevel): string | null {
  if (level === "2") return item.icbCode2 ?? null;
  if (level === "3") return item.icbCode3 ?? null;
  return item.icbCode4 ?? null;
}

function getIcbGroupKey(item: StockMetadata, level: IcbLevel): string {
  const code = getIcbCodeByLevel(item, level) ?? "NA";
  const name = getIcbNameByLevel(item, level);
  return `${code}|${name}`;
}

function matchesIcbFilter(item: StockMetadata, icbFilter: string | undefined, level: IcbLevel | undefined): boolean {
  const query = normalizeText(String(icbFilter ?? ""));
  if (!query) return true;

  const candidateSet =
    level === "2"
      ? [item.icbName2, item.icbCode2]
      : level === "3"
        ? [item.icbName3, item.icbCode3]
        : level === "4"
          ? [item.icbName4, item.icbCode4]
          : [item.icbName2, item.icbName3, item.icbName4, item.icbCode2, item.icbCode3, item.icbCode4];

  return candidateSet
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => normalizeText(value))
    .some((value) => value.includes(query));
}

function pickPricePoint(series: OHLCV[], asOfDateKey: string): PricePoint | null {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const current = series[i];
    const currentKey = toDateKey(current.date);
    if (currentKey > asOfDateKey) continue;
    const previous = i > 0 ? series[i - 1] : null;
    const dayChangePct =
      previous && Number.isFinite(previous.close) && previous.close !== 0
        ? (current.close - previous.close) / previous.close
        : null;

    return {
      close: current.close,
      volume: current.volume,
      dateKey: currentKey,
      exactDateMatch: currentKey === asOfDateKey,
      dayChangePct,
    };
  }
  return null;
}

function toFiniteNumber(value: FundamentalsValue | unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function computeValuationRow(
  item: StockMetadata,
  asOfDateKey: string,
  price: PricePoint
): Promise<ValuationComputationResult> {
  const periods = await getAvailablePeriods(item.symbol);
  const eligiblePeriods = periods.filter((period) => {
    const periodDateKey = periodToDateKey(period);
    return periodDateKey ? periodDateKey <= asOfDateKey : false;
  });

  if (eligiblePeriods.length === 0) {
    return { row: null, reason: "no_eligible_period" };
  }

  const latestBalanceSnapshot = await getLatestStatementSnapshot(item.symbol, "bs", eligiblePeriods);
  if (!latestBalanceSnapshot) return { row: null, reason: "missing_balance_sheet" };

  const incomePeriods = eligiblePeriods.slice(-4);
  const incomeSnapshots = await Promise.all(
    incomePeriods.map((period) => getStatementSnapshot(item.symbol, "is", period))
  );

  const netIncomeValues = incomeSnapshots
    .map((snapshot) => readNumericByAliases(snapshot?.fields ?? null, NET_INCOME_ALIASES))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const ebitdaValues = incomeSnapshots
    .map((snapshot) => readNumericByAliases(snapshot?.fields ?? null, EBITDA_ALIASES))
    .filter((value): value is number => value !== null && Number.isFinite(value));

  const ttmNetIncome = netIncomeValues.length >= 2 ? netIncomeValues.reduce((sum, value) => sum + value, 0) : null;
  const ttmEbitda = ebitdaValues.length >= 2 ? ebitdaValues.reduce((sum, value) => sum + value, 0) : null;
  if (ttmNetIncome === null && ttmEbitda === null) {
    return { row: null, reason: "insufficient_income_history" };
  }

  const equity = readNumericByAliases(latestBalanceSnapshot.fields, EQUITY_ALIASES);
  const totalLiabilities = readNumericByAliases(latestBalanceSnapshot.fields, TOTAL_LIABILITIES_ALIASES);
  const cash = readNumericByAliases(latestBalanceSnapshot.fields, CASH_ALIASES);
  const shortInvestments = readNumericByAliases(latestBalanceSnapshot.fields, SHORT_INVESTMENTS_ALIASES);
  const sharesRaw = readNumericByAliases(latestBalanceSnapshot.fields, SHARES_ALIASES);
  const shares = sharesRaw !== null && sharesRaw > 0 ? sharesRaw : null;

  const marketCap = shares !== null ? price.close * shares : null;
  const eps = shares !== null && ttmNetIncome !== null ? ttmNetIncome / shares : null;
  const bvps = shares !== null && equity !== null ? equity / shares : null;
  const pe = eps !== null && eps > 0 ? price.close / eps : null;
  const pb = bvps !== null && bvps > 0 ? price.close / bvps : null;

  const netDebt =
    totalLiabilities !== null
      ? totalLiabilities - (toFiniteNumber(cash) ?? 0) - (toFiniteNumber(shortInvestments) ?? 0)
      : null;
  const enterpriseValue = marketCap !== null && netDebt !== null ? marketCap + netDebt : null;
  const evEbitda =
    enterpriseValue !== null && ttmEbitda !== null && ttmEbitda > 0
      ? enterpriseValue / ttmEbitda
      : null;

  if (pe === null && pb === null && evEbitda === null) {
    return { row: null, reason: "metric_unavailable" };
  }

  return {
    row: {
      symbol: item.symbol,
      pe,
      pb,
      evEbitda,
      price: price.close,
      priceDate: price.dateKey,
      exactDateMatch: price.exactDateMatch,
      icbName2: item.icbName2,
      icbName3: item.icbName3,
      icbName4: item.icbName4,
      fundamentalPeriod: latestBalanceSnapshot.period,
      incomePeriodsUsed: incomeSnapshots.filter((snapshot) => snapshot !== null).length,
    },
  };
}

async function getLatestStatementSnapshot(
  symbol: string,
  statement: "bs" | "is" | "cf",
  periods: string[]
): Promise<{ period: string; fields: Record<string, FundamentalsValue> } | null> {
  for (let i = periods.length - 1; i >= 0; i -= 1) {
    const period = periods[i];
    const snapshot = await getStatementSnapshot(symbol, statement, period);
    if (!snapshot) continue;
    return {
      period,
      fields: snapshot.fields,
    };
  }
  return null;
}

function periodToDateKey(period: string): string | null {
  const match = /^(\d{4})Q([1-4])$/.exec(period.trim());
  if (!match) return null;
  const year = match[1];
  const quarter = match[2];
  const endDate = quarterEndByNumber[quarter];
  if (!endDate) return null;
  return `${year}-${endDate}`;
}

function getMetricValue(row: ValuationComputationRow, metric: ValuationMetric): number | null {
  if (metric === "pe") return row.pe;
  if (metric === "pb") return row.pb;
  return row.evEbitda;
}

async function mapWithConcurrency<T, R>(
  input: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  if (input.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, input.length));
  const output: R[] = new Array(input.length);
  let cursor = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= input.length) return;
      output[index] = await mapper(input[index]);
    }
  });

  await Promise.all(workers);
  return output;
}
