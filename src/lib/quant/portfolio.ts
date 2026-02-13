import { MIN_HISTORY_DAYS_OPTIMIZE, MIN_OVERLAP_DAYS_OPTIMIZE, toDateKey } from "@/lib/dataPolicy";
import { OHLCV } from "./indicators";

interface ReturnSeries {
  symbol: string;
  orderedDates: string[];
  returns: number[];
  returnsByDate: Map<string, number>;
  meanReturn: number;
  volatility: number;
}

export interface AssetStats {
  symbol: string;
  returns: number[];
  meanReturn: number;
  volatility: number;
}

export interface ExcludedSymbol {
  symbol: string;
  reason: string;
}

export interface OverlapDiagnostic {
  left: string;
  right: string;
  overlapDays: number;
}

export interface OptimizationOptions {
  minHistoryDays?: number;
  minOverlapDays?: number;
}

export interface OptimizationResult {
  method: string;
  allocations: { symbol: string; weight: number; expectedReturn: number }[];
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  correlationMatrix: { symbols: string[]; matrix: number[][] };
  assetStats: { symbol: string; meanReturn: number; volatility: number }[];
  excludedSymbols: ExcludedSymbol[];
  effectiveUniverse: string[];
  overlapDiagnostics: OverlapDiagnostic[];
}

export class PortfolioOptimizationError extends Error {
  readonly excludedSymbols: ExcludedSymbol[];
  readonly effectiveUniverse: string[];

  constructor(message: string, excludedSymbols: ExcludedSymbol[] = [], effectiveUniverse: string[] = []) {
    super(message);
    this.name = "PortfolioOptimizationError";
    this.excludedSymbols = excludedSymbols;
    this.effectiveUniverse = effectiveUniverse;
  }
}

function calculateMean(values: number[]): number {
  if (!values || values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calculateStd(values: number[], mean?: number): number {
  if (!values || values.length === 0) return 0;
  const m = mean ?? calculateMean(values);
  const variance = values.reduce((a, b) => a + Math.pow(b - m, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function calculateCovariance(values1: number[], values2: number[]): number {
  if (!values1 || !values2 || values1.length === 0 || values2.length === 0) return 0;
  const len = Math.min(values1.length, values2.length);
  if (len === 0) return 0;

  const series1 = values1.slice(0, len);
  const series2 = values2.slice(0, len);

  const mean1 = calculateMean(series1);
  const mean2 = calculateMean(series2);

  let covariance = 0;
  for (let i = 0; i < len; i++) {
    covariance += (series1[i] - mean1) * (series2[i] - mean2);
  }

  return covariance / len;
}

function buildReturnSeries(symbol: string, series: OHLCV[]): ReturnSeries | null {
  if (!series || series.length < 2) return null;

  const sorted = [...series].sort((a, b) => a.date.getTime() - b.date.getTime());
  const returnsByDate = new Map<string, number>();

  for (let i = 1; i < sorted.length; i++) {
    const previousClose = sorted[i - 1].close;
    const currentClose = sorted[i].close;
    if (!Number.isFinite(previousClose) || !Number.isFinite(currentClose) || previousClose === 0) {
      continue;
    }

    const value = (currentClose - previousClose) / previousClose;
    if (!Number.isFinite(value)) continue;
    returnsByDate.set(toDateKey(sorted[i].date), value);
  }

  const orderedDates = [...returnsByDate.keys()].sort((a, b) => a.localeCompare(b));
  const returns = orderedDates.map((date) => returnsByDate.get(date) as number);
  if (returns.length === 0) return null;

  const meanDaily = calculateMean(returns);
  const stdDaily = calculateStd(returns, meanDaily);

  return {
    symbol,
    orderedDates,
    returns,
    returnsByDate,
    meanReturn: meanDaily * 252,
    volatility: stdDaily * Math.sqrt(252),
  };
}

function countOverlapDays(left: ReturnSeries, right: ReturnSeries): number {
  const [smaller, larger] =
    left.orderedDates.length <= right.orderedDates.length ? [left, right] : [right, left];

  let overlap = 0;
  for (const date of smaller.orderedDates) {
    if (larger.returnsByDate.has(date)) overlap += 1;
  }
  return overlap;
}

function getAlignedReturns(left: ReturnSeries, right: ReturnSeries): { left: number[]; right: number[]; overlapDays: number } {
  const alignedLeft: number[] = [];
  const alignedRight: number[] = [];

  for (const date of left.orderedDates) {
    const rightValue = right.returnsByDate.get(date);
    if (rightValue === undefined) continue;

    const leftValue = left.returnsByDate.get(date);
    if (leftValue === undefined) continue;

    alignedLeft.push(leftValue);
    alignedRight.push(rightValue);
  }

  return { left: alignedLeft, right: alignedRight, overlapDays: alignedLeft.length };
}

function selectRemovalIndex(
  activeSeries: ReturnSeries[],
  overlapMatrix: number[][],
  idxA: number,
  idxB: number
): number {
  const averageOverlap = (index: number): number => {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < activeSeries.length; i++) {
      if (i === index) continue;
      sum += overlapMatrix[index][i];
      count += 1;
    }
    return count > 0 ? sum / count : 0;
  };

  const avgA = averageOverlap(idxA);
  const avgB = averageOverlap(idxB);

  if (avgA < avgB) return idxA;
  if (avgB < avgA) return idxB;

  const lenA = activeSeries[idxA].returns.length;
  const lenB = activeSeries[idxB].returns.length;
  if (lenA < lenB) return idxA;
  if (lenB < lenA) return idxB;

  return activeSeries[idxA].symbol > activeSeries[idxB].symbol ? idxA : idxB;
}

export function optimizePortfolio(
  data: Record<string, OHLCV[]>,
  symbols: string[],
  method: string = "mean_variance",
  options: OptimizationOptions = {}
): OptimizationResult {
  const minHistoryDays = options.minHistoryDays ?? MIN_HISTORY_DAYS_OPTIMIZE;
  const minOverlapDays = options.minOverlapDays ?? MIN_OVERLAP_DAYS_OPTIMIZE;

  const excludedSymbols: ExcludedSymbol[] = [];
  const initialSeries: ReturnSeries[] = [];

  for (const symbol of symbols) {
    const series = data[symbol] || [];
    if (series.length < 2) {
      excludedSymbols.push({ symbol, reason: "insufficient_price_points" });
      continue;
    }

    const returnSeries = buildReturnSeries(symbol, series);
    if (!returnSeries) {
      excludedSymbols.push({ symbol, reason: "invalid_return_series" });
      continue;
    }

    if (returnSeries.returns.length < minHistoryDays) {
      excludedSymbols.push({
        symbol,
        reason: `insufficient_history_${returnSeries.returns.length}_lt_${minHistoryDays}`,
      });
      continue;
    }

    initialSeries.push(returnSeries);
  }

  if (initialSeries.length < 2) {
    throw new PortfolioOptimizationError(
      "Not enough valid symbols with sufficient history",
      excludedSymbols,
      initialSeries.map((item) => item.symbol)
    );
  }

  const activeSeries = [...initialSeries];

  while (activeSeries.length >= 2) {
    const n = activeSeries.length;
    const overlapMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

    let minPair: { i: number; j: number; overlap: number } | null = null;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const overlap = countOverlapDays(activeSeries[i], activeSeries[j]);
        overlapMatrix[i][j] = overlap;
        overlapMatrix[j][i] = overlap;

        if (overlap < minOverlapDays && (!minPair || overlap < minPair.overlap)) {
          minPair = { i, j, overlap };
        }
      }
    }

    if (!minPair) break;

    const removalIndex = selectRemovalIndex(activeSeries, overlapMatrix, minPair.i, minPair.j);
    const removed = activeSeries[removalIndex];
    const counterpartIndex = removalIndex === minPair.i ? minPair.j : minPair.i;
    const counterpart = activeSeries[counterpartIndex];

    excludedSymbols.push({
      symbol: removed.symbol,
      reason: `insufficient_overlap_with_${counterpart.symbol}_${minPair.overlap}_lt_${minOverlapDays}`,
    });

    activeSeries.splice(removalIndex, 1);
  }

  if (activeSeries.length < 2) {
    throw new PortfolioOptimizationError(
      "Not enough symbols after overlap filtering",
      excludedSymbols,
      activeSeries.map((item) => item.symbol)
    );
  }

  const n = activeSeries.length;
  const correlationMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const covarianceAnnualMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const overlapDiagnostics: OverlapDiagnostic[] = [];

  for (let i = 0; i < n; i++) {
    correlationMatrix[i][i] = 1;
    const dailyStd = activeSeries[i].volatility / Math.sqrt(252);
    covarianceAnnualMatrix[i][i] = dailyStd * dailyStd * 252;

    for (let j = i + 1; j < n; j++) {
      const aligned = getAlignedReturns(activeSeries[i], activeSeries[j]);
      overlapDiagnostics.push({
        left: activeSeries[i].symbol,
        right: activeSeries[j].symbol,
        overlapDays: aligned.overlapDays,
      });

      if (aligned.overlapDays < minOverlapDays) {
        throw new PortfolioOptimizationError(
          `Insufficient overlap between ${activeSeries[i].symbol} and ${activeSeries[j].symbol}`,
          excludedSymbols,
          activeSeries.map((item) => item.symbol)
        );
      }

      const covarianceDaily = calculateCovariance(aligned.left, aligned.right);
      const stdLeft = calculateStd(aligned.left);
      const stdRight = calculateStd(aligned.right);
      const correlation = stdLeft > 0 && stdRight > 0 ? covarianceDaily / (stdLeft * stdRight) : 0;

      const covarianceAnnual = covarianceDaily * 252;
      correlationMatrix[i][j] = correlation;
      correlationMatrix[j][i] = correlation;
      covarianceAnnualMatrix[i][j] = covarianceAnnual;
      covarianceAnnualMatrix[j][i] = covarianceAnnual;
    }
  }

  let weights: number[] = [];
  switch (method) {
    case "equal_weight":
      weights = new Array(n).fill(1 / n);
      break;

    case "risk_parity": {
      const volatilities = activeSeries.map((asset) => asset.volatility);
      const invVols = volatilities.map((vol) => (vol > 0 ? 1 / vol : 0));
      const sumInvVols = invVols.reduce((a, b) => a + b, 0);
      weights = sumInvVols > 0 ? invVols.map((value) => value / sumInvVols) : new Array(n).fill(1 / n);
      break;
    }

    case "mean_variance":
    default: {
      const sharpes = activeSeries.map((asset) =>
        asset.volatility > 0 ? asset.meanReturn / asset.volatility : 0
      );
      const minSharpe = Math.min(...sharpes);
      const adjustedSharpes = sharpes.map((value) => Math.max(0, value - minSharpe + 0.1));
      const sumAdjusted = adjustedSharpes.reduce((a, b) => a + b, 0);
      weights = adjustedSharpes.map((value) => (sumAdjusted > 0 ? value / sumAdjusted : 1 / n));
      break;
    }
  }

  const allocations = activeSeries.map((asset, i) => ({
    symbol: asset.symbol,
    weight: weights[i],
    expectedReturn: asset.meanReturn,
  }));

  let portfolioReturn = 0;
  let portfolioVarianceAnnual = 0;
  for (let i = 0; i < n; i++) {
    portfolioReturn += weights[i] * activeSeries[i].meanReturn;
    for (let j = 0; j < n; j++) {
      portfolioVarianceAnnual += weights[i] * weights[j] * covarianceAnnualMatrix[i][j];
    }
  }

  const portfolioVolatility = Math.sqrt(Math.max(0, portfolioVarianceAnnual));
  const sharpeRatio = portfolioVolatility > 0 ? portfolioReturn / portfolioVolatility : 0;

  return {
    method,
    allocations,
    expectedReturn: portfolioReturn,
    volatility: portfolioVolatility,
    sharpeRatio,
    correlationMatrix: { symbols: activeSeries.map((asset) => asset.symbol), matrix: correlationMatrix },
    assetStats: activeSeries.map((asset) => ({
      symbol: asset.symbol,
      meanReturn: asset.meanReturn,
      volatility: asset.volatility,
    })),
    excludedSymbols,
    effectiveUniverse: activeSeries.map((asset) => asset.symbol),
    overlapDiagnostics,
  };
}
