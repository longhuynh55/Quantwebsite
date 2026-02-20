import type {
  DcfAssumptions,
  DcfProjectionPoint,
  DcfResult,
  FinancialPeriodStatements,
  PeerMultiplesResult,
  PeerMultiplesRow,
  SensitivityResult,
} from "@/lib/finance/contracts";
import { loadFinancialPeriods, readNumericByAliases, safeRatio, yoy as buildYoy } from "@/lib/finance/data";
import { loadOHLCVForSymbol, loadStockMetadata } from "@/lib/data";

const VAL_ALIASES = {
  revenue: ["net_sales", "sales", "revenue"],
  netIncome: ["net_profit_for_the_year", "attributable_to_parent_company", "net_profit"],
  operatingCashFlow: ["net_cash_inflows_outflows_from_operating_activities", "net_cash_flows_from_operating_activities_before_bit"],
  capex: ["purchase_of_fixed_assets"],
  totalLiabilities: ["liabilities", "total_liabilities"],
  cash: ["cash_and_cash_equivalents", "cash_and_cash_equivalents_at_the_end_of_period", "cash"],
  shortInvestments: ["short_term_investments", "trading_securities"],
  equity: ["owner_s_equity", "equity", "capital_and_reserves"],
  sharesOutstanding: [
    "shares_outstanding",
    "total_shares_outstanding",
    "weighted_average_shares_outstanding",
    "weighted_average_number_of_shares",
  ],
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function avg(values: Array<number | null>): number | null {
  const filtered = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (filtered.length === 0) return null;
  return filtered.reduce((acc, item) => acc + item, 0) / filtered.length;
}

function sum(values: Array<number | null>): number | null {
  const filtered = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (filtered.length === 0) return null;
  return filtered.reduce((acc, item) => acc + item, 0);
}

function getTtmRevenue(rows: FinancialPeriodStatements[]): number | null {
  return sum(rows.slice(-4).map((row) => readNumericByAliases(row.is, [...VAL_ALIASES.revenue])));
}

function getTtmFcf(rows: FinancialPeriodStatements[]): number | null {
  const values = rows.slice(-4).map((row) => {
    const ocf = readNumericByAliases(row.cf, [...VAL_ALIASES.operatingCashFlow]);
    const capex = readNumericByAliases(row.cf, [...VAL_ALIASES.capex]);
    if (ocf === null) return null;
    return ocf - Math.abs(capex ?? 0);
  });
  return sum(values);
}

function inferGrowthRate(rows: FinancialPeriodStatements[]): number {
  const revenues = rows.map((row) => ({
    period: row.period,
    value: readNumericByAliases(row.is, [...VAL_ALIASES.revenue]),
  }));
  const base = avg(buildYoy(revenues).map((point) => point.value)) ?? 0.08;
  return clamp(base, -0.1, 0.3);
}

function inferFcfMargin(rows: FinancialPeriodStatements[]): number {
  const margins = rows.slice(-4).map((row) => {
    const revenue = readNumericByAliases(row.is, [...VAL_ALIASES.revenue]);
    const ocf = readNumericByAliases(row.cf, [...VAL_ALIASES.operatingCashFlow]);
    const capex = readNumericByAliases(row.cf, [...VAL_ALIASES.capex]);
    if (revenue === null || revenue === 0 || ocf === null) return null;
    const fcf = ocf - Math.abs(capex ?? 0);
    return fcf / revenue;
  });
  const base = avg(margins) ?? 0.08;
  return clamp(base, -0.2, 0.35);
}

function inferNetDebt(latest: FinancialPeriodStatements | undefined): number {
  if (!latest?.bs) return 0;
  const liabilities = readNumericByAliases(latest.bs, [...VAL_ALIASES.totalLiabilities]) ?? 0;
  const cash = readNumericByAliases(latest.bs, [...VAL_ALIASES.cash]) ?? 0;
  const shortInvestments = readNumericByAliases(latest.bs, [...VAL_ALIASES.shortInvestments]) ?? 0;
  return liabilities - cash - shortInvestments;
}

function inferSharesOutstanding(latest: FinancialPeriodStatements | undefined): number | null {
  if (!latest?.bs) return null;
  const raw = readNumericByAliases(latest.bs, [...VAL_ALIASES.sharesOutstanding]);
  if (raw === null || raw <= 0) return null;
  return raw;
}

function buildProjection(
  baseRevenue: number,
  assumptions: DcfAssumptions
): { projections: DcfProjectionPoint[]; pvSum: number; terminalInputFcf: number } {
  const projections: DcfProjectionPoint[] = [];
  let revenue = baseRevenue;
  let pvSum = 0;
  let terminalInputFcf = baseRevenue * assumptions.fcfMargin;

  for (let year = 1; year <= assumptions.forecastYears; year += 1) {
    revenue = revenue * (1 + assumptions.revenueGrowth);
    const fcf = revenue * assumptions.fcfMargin;
    const discountFactor = 1 / Math.pow(1 + assumptions.wacc, year);
    const discountedFcf = fcf * discountFactor;
    pvSum += discountedFcf;
    terminalInputFcf = fcf;
    projections.push({
      year,
      revenue,
      fcf,
      discountFactor,
      discountedFcf,
    });
  }

  return { projections, pvSum, terminalInputFcf };
}

function computeFairValueFromAssumptions(
  baseRevenue: number,
  assumptions: DcfAssumptions
): { fairValuePerShare: number; enterpriseValue: number; equityValue: number; terminalValue: number; projections: DcfProjectionPoint[] } {
  const { projections, pvSum, terminalInputFcf } = buildProjection(baseRevenue, assumptions);
  const terminalFcf = terminalInputFcf * (1 + assumptions.terminalGrowth);
  const terminalValue = terminalFcf / Math.max(assumptions.wacc - assumptions.terminalGrowth, 0.0001);
  const discountedTerminalValue = terminalValue / Math.pow(1 + assumptions.wacc, assumptions.forecastYears);
  const enterpriseValue = pvSum + discountedTerminalValue;
  const equityValue = enterpriseValue - assumptions.netDebt;
  const fairValuePerShare = equityValue / Math.max(assumptions.sharesOutstanding, 1);
  return { fairValuePerShare, enterpriseValue, equityValue, terminalValue: discountedTerminalValue, projections };
}

export async function buildDcfValuation(symbol: string): Promise<DcfResult> {
  const upper = symbol.toUpperCase();
  const rows = await loadFinancialPeriods(upper, 8);
  const latest = rows[rows.length - 1];
  const asOfPeriod = latest?.period ?? "n/a";
  const warnings: string[] = [];

  const revenueTtm = getTtmRevenue(rows);
  const fcfTtm = getTtmFcf(rows);
  if (revenueTtm === null) warnings.push("Revenue history is incomplete; using conservative defaults.");
  if (fcfTtm === null) warnings.push("Cashflow history is incomplete; FCF assumptions may be less reliable.");

  const growth = inferGrowthRate(rows);
  const margin = inferFcfMargin(rows);
  const netDebt = inferNetDebt(latest);
  const shares = inferSharesOutstanding(latest);
  const sharesOutstanding = shares ?? 1;

  const assumptions: DcfAssumptions = {
    forecastYears: 5,
    revenueGrowth: growth,
    fcfMargin: margin,
    wacc: 0.12,
    terminalGrowth: 0.03,
    netDebt,
    sharesOutstanding,
  };

  const baseRevenue = revenueTtm ?? Math.max((fcfTtm ?? 0) / Math.max(margin, 0.01), 1);
  const valuation = computeFairValueFromAssumptions(baseRevenue, assumptions);

  const historyRevenue = rows
    .map((row) => ({
      period: row.period,
      value: readNumericByAliases(row.is, [...VAL_ALIASES.revenue]),
    }))
    .filter((item): item is { period: string; value: number } => item.value !== null);

  const historyFcf = rows
    .map((row) => {
      const ocf = readNumericByAliases(row.cf, [...VAL_ALIASES.operatingCashFlow]);
      const capex = readNumericByAliases(row.cf, [...VAL_ALIASES.capex]);
      if (ocf === null) return { period: row.period, value: null };
      return { period: row.period, value: ocf - Math.abs(capex ?? 0) };
    })
    .filter((item): item is { period: string; value: number } => item.value !== null);

  const priceRows = await loadOHLCVForSymbol(upper);
  const currentPrice = priceRows.length > 0 ? priceRows[priceRows.length - 1].close : null;
  const upsideDownsidePct =
    currentPrice !== null && currentPrice !== 0
      ? (valuation.fairValuePerShare - currentPrice) / currentPrice
      : null;

  if (currentPrice === null) {
    warnings.push("Current market price is unavailable from OHLCV data.");
  }
  if (shares === null) {
    warnings.push("Missing shares_outstanding field; per-share valuation uses fallback denominator and is low-confidence.");
  }

  return {
    symbol: upper,
    asOfPeriod,
    assumptions,
    historical: {
      revenue: historyRevenue,
      fcf: historyFcf,
    },
    projections: valuation.projections,
    terminalValue: valuation.terminalValue,
    enterpriseValue: valuation.enterpriseValue,
    equityValue: valuation.equityValue,
    fairValuePerShare: valuation.fairValuePerShare,
    currentPrice,
    upsideDownsidePct,
    warnings,
  };
}

export async function buildSensitivityMatrix(symbol: string): Promise<SensitivityResult> {
  const dcf = await buildDcfValuation(symbol);
  const baseRevenue = dcf.projections.length > 0 ? dcf.projections[0].revenue / (1 + dcf.assumptions.revenueGrowth) : 1;
  const waccShifts = [-0.02, -0.01, 0, 0.01, 0.02];
  const growthShifts = [-0.01, -0.005, 0, 0.005, 0.01];

  const cells: SensitivityResult["cells"] = [];
  for (const wShift of waccShifts) {
    for (const gShift of growthShifts) {
      const wacc = clamp(dcf.assumptions.wacc + wShift, 0.06, 0.22);
      const terminalGrowth = clamp(dcf.assumptions.terminalGrowth + gShift, 0.0, 0.06);
      if (terminalGrowth >= wacc) continue;
      const assumptions: DcfAssumptions = {
        ...dcf.assumptions,
        wacc,
        terminalGrowth,
      };
      const priced = computeFairValueFromAssumptions(baseRevenue, assumptions);
      cells.push({
        wacc,
        terminalGrowth,
        fairValuePerShare: priced.fairValuePerShare,
      });
    }
  }

  return {
    symbol: dcf.symbol,
    asOfPeriod: dcf.asOfPeriod,
    baseFairValuePerShare: dcf.fairValuePerShare,
    cells,
  };
}

function median(values: Array<number | null>): number | null {
  const items = values.filter((v): v is number => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  if (items.length === 0) return null;
  const mid = Math.floor(items.length / 2);
  if (items.length % 2 === 1) return items[mid];
  return (items[mid - 1] + items[mid]) / 2;
}

async function buildPeerRow(symbol: string): Promise<PeerMultiplesRow> {
  const rows = await loadFinancialPeriods(symbol, 8);
  const latest = rows[rows.length - 1];
  const ttmNetIncome = sum(rows.slice(-4).map((row) => readNumericByAliases(row.is, [...VAL_ALIASES.netIncome])));
  const equity = latest ? readNumericByAliases(latest.bs, [...VAL_ALIASES.equity]) : null;
  const shares = inferSharesOutstanding(latest);

  const prices = await loadOHLCVForSymbol(symbol);
  const price = prices.length > 0 ? prices[prices.length - 1].close : null;
  const eps = shares !== null ? safeRatio(ttmNetIncome, shares) : null;
  const bvps = shares !== null ? safeRatio(equity, shares) : null;
  const pe = price !== null && eps !== null && eps > 0 ? price / eps : null;
  const pb = price !== null && bvps !== null && bvps > 0 ? price / bvps : null;
  const marketCapApprox = price !== null && shares !== null ? price * shares : null;

  return {
    symbol,
    price,
    marketCapApprox,
    pe,
    pb,
  };
}

export async function buildPeerMultiples(symbol: string): Promise<PeerMultiplesResult> {
  const upper = symbol.toUpperCase();
  const warnings: string[] = [];
  const metadata = await loadStockMetadata();
  const me = metadata.find((item) => item.symbol.toUpperCase() === upper);
  if (!me) {
    return {
      symbol: upper,
      peers: [await buildPeerRow(upper)],
      medianPe: null,
      medianPb: null,
      warnings: ["Metadata unavailable for this symbol; peer selection fallback is limited."],
    };
  }

  const peers = metadata
    .filter((item) => item.status.toUpperCase() === "ACTIVE")
    .filter((item) => item.symbol.toUpperCase() !== upper)
    .filter((item) => item.icbName3 && me.icbName3 && item.icbName3 === me.icbName3)
    .slice(0, 7)
    .map((item) => item.symbol.toUpperCase());

  if (peers.length === 0) {
    warnings.push("No same-industry peers found. Returning only target symbol multiples.");
  }

  const rows = await Promise.all([buildPeerRow(upper), ...peers.map((peer) => buildPeerRow(peer))]);
  return {
    symbol: upper,
    peers: rows,
    medianPe: median(rows.map((row) => row.pe)),
    medianPb: median(rows.map((row) => row.pb)),
    warnings,
  };
}
