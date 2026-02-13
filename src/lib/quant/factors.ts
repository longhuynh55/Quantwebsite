import { OHLCV, calculateSMA } from "./indicators";

export interface FactorExposure {
  symbol: string;
  momentum: number;
  value: number;
  volatility: number;
  size: number;
  overall: number;
}

export function calculateMomentum(prices: number[]): number {
  const lastMonth = 21;
  const lookback = 252;
  if (!prices || prices.length <= lookback || prices.length <= lastMonth) {
    return 0;
  }

  // 12-1 momentum: return from (t - lookback) to (t - lastMonth).
  const startIdx = prices.length - 1 - lookback;
  const endIdx = prices.length - 1 - lastMonth;
  if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
    return 0;
  }

  const denominator = prices[startIdx];
  if (denominator === 0) return 0;  // Avoid division by zero
  return (prices[endIdx] - denominator) / denominator;
}

export function calculateVolatilityFactor(prices: number[], period: number = 63): number {
  // Fix off-by-one error: need at least period + 1 prices to calculate period returns
  if (!prices || prices.length < period + 1 || period <= 0) {
    return 0;
  }
  const returns: number[] = [];
  // Start from prices.length - period, but ensure i > 0 to access i - 1
  for (let i = prices.length - period; i < prices.length; i++) {
    if (i > 0 && prices[i - 1] !== 0) {  // Bounds check and division by zero check
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    } else if (i > 0) {
      returns.push(0);
    }
  }
  if (returns.length === 0) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  return -Math.sqrt(variance * 252);
}

export function calculateSizeFactor(volumes: number[], period: number = 63): number {
  if (!volumes || volumes.length < period || period <= 0) {
    return 0;
  }
  const recentVolumes = volumes.slice(-period);
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / period;
  return -Math.log(avgVolume + 1);
}

export function calculateValueProxy(prices: number[]): number {
  if (!prices || prices.length < 200) {
    return 0;
  }
  const sma200 = calculateSMA(prices, 200);
  const currentSMA = sma200[prices.length - 1];
  if (currentSMA === null || currentSMA === 0) return 0;  // Avoid division by zero
  return -(prices[prices.length - 1] / currentSMA - 1);
}

export function calculateFactorExposures(symbol: string, ohlcv: OHLCV[]): FactorExposure {
  // Handle empty or insufficient data
  if (!ohlcv || ohlcv.length === 0) {
    return { symbol, momentum: 0, value: 0, volatility: 0, size: 0, overall: 0 };
  }

  const prices = ohlcv.map((d) => d.close);
  const volumes = ohlcv.map((d) => d.volume);

  const momentum = calculateMomentum(prices);
  const value = calculateValueProxy(prices);
  const volatility = calculateVolatilityFactor(prices);
  const size = calculateSizeFactor(volumes);
  const overall = (momentum + value + volatility + size) / 4;

  return { symbol, momentum, value, volatility, size, overall };
}

export function rankByFactor(
  exposures: FactorExposure[],
  factor: keyof Omit<FactorExposure, "symbol" | "overall">
): FactorExposure[] {
  if (!exposures || exposures.length === 0) {
    return [];
  }
  return [...exposures].sort((a, b) => b[factor] - a[factor]);
}

export function createFactorPortfolios(
  exposures: FactorExposure[],
  factor: keyof Omit<FactorExposure, "symbol" | "overall">,
  percentile: number = 0.2
): { top: string[]; bottom: string[] } {
  if (!exposures || exposures.length === 0 || percentile <= 0 || percentile > 1) {
    return { top: [], bottom: [] };
  }
  const sorted = rankByFactor(exposures, factor);
  const n = Math.max(1, Math.floor(sorted.length * percentile));

  return {
    top: sorted.slice(0, n).map((e) => e.symbol),
    bottom: sorted.slice(-n).map((e) => e.symbol),
  };
}
