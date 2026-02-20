export interface RiskMetrics {
  var95: number;
  var99: number;
  cvar95: number;
  cvar99: number;
  downsideDeviation: number;
  sortinoRatio: number;
  tailLossRatio95: number;
  maxDrawdown: number;
  avgDrawdown: number;
  drawdownDuration: number;
  volatility: number;
  beta: number;
  trackingError: number;
  informationRatio: number;
}

const TAIL_WINSORIZE_PERCENTILE = 0.01;

function calculateReturns(prices: number[]): number[] {
  if (!prices || prices.length < 2) return [];
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] !== 0) {  // Avoid division by zero
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    } else {
      returns.push(0);
    }
  }
  return returns;
}

function calculateVaR(returns: number[], confidence: number): number {
  // Validate inputs
  if (!returns || returns.length === 0) {
    return 0;
  }
  if (confidence <= 0 || confidence >= 1) {
    return 0;
  }

  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * sorted.length);

  // Bounds check
  if (index < 0 || index >= sorted.length) {
    return 0;
  }

  return -sorted[index];
}

function calculateCVaR(returns: number[], confidence: number): number {
  // Validate inputs
  if (!returns || returns.length === 0) {
    return 0;
  }
  if (confidence <= 0 || confidence >= 1) {
    return 0;
  }

  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * sorted.length);

  // Include the VaR threshold observation in the expected tail loss set.
  const tailReturns = sorted.slice(0, Math.max(1, index + 1));

  if (tailReturns.length === 0) {
    return -sorted[0];  // Return worst case
  }

  return -tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length;
}

function sanitizeReturnsForTailRisk(returns: number[]): number[] {
  if (!returns || returns.length === 0) return [];
  const finiteReturns = returns.filter((value) => Number.isFinite(value));
  if (finiteReturns.length === 0) return [];
  if (finiteReturns.length < 20) return finiteReturns;

  const sorted = [...finiteReturns].sort((a, b) => a - b);
  const lowerIndex = Math.floor((sorted.length - 1) * TAIL_WINSORIZE_PERCENTILE);
  const upperIndex = Math.ceil((sorted.length - 1) * (1 - TAIL_WINSORIZE_PERCENTILE));
  const lowerBound = sorted[lowerIndex];
  const upperBound = sorted[upperIndex];

  return finiteReturns.map((value) => Math.min(Math.max(value, lowerBound), upperBound));
}

function calculateDrawdowns(prices: number[]): { drawdown: number; duration: number }[] {
  // Handle empty array
  if (!prices || prices.length === 0) {
    return [];
  }

  const drawdowns: { drawdown: number; duration: number }[] = [];
  let peak = prices[0];
  let peakIndex = 0;

  for (let i = 0; i < prices.length; i++) {
    if (prices[i] > peak) {
      peak = prices[i];
      peakIndex = i;
      drawdowns.push({ drawdown: 0, duration: 0 });
    } else if (peak > 0) {  // Avoid division by zero
      const drawdown = (peak - prices[i]) / peak;
      drawdowns.push({ drawdown, duration: i - peakIndex });
    } else {
      drawdowns.push({ drawdown: 0, duration: i - peakIndex });
    }
  }

  return drawdowns;
}

function calculateBeta(assetReturns: number[], marketReturns: number[]): number {
  // Validate equal lengths and non-empty
  if (!assetReturns || !marketReturns || assetReturns.length === 0 || marketReturns.length === 0) {
    return 0;
  }

  // Use only the overlapping portion
  const len = Math.min(assetReturns.length, marketReturns.length);
  if (len === 0) return 0;

  // Align on most recent overlapping window.
  const asset = assetReturns.slice(-len);
  const market = marketReturns.slice(-len);

  const assetMean = asset.reduce((a, b) => a + b, 0) / len;
  const marketMean = market.reduce((a, b) => a + b, 0) / len;

  let covariance = 0;
  let marketVariance = 0;

  for (let i = 0; i < len; i++) {
    covariance += (asset[i] - assetMean) * (market[i] - marketMean);
    marketVariance += Math.pow(market[i] - marketMean, 2);
  }

  covariance /= len;
  marketVariance /= len;

  return marketVariance > 0 ? covariance / marketVariance : 0;
}

export function calculateRiskMetrics(
  prices: number[],
  benchmarkPrices?: number[]
): RiskMetrics {
  // Handle empty prices
  if (!prices || prices.length < 2) {
    return {
      var95: 0,
      var99: 0,
      cvar95: 0,
      cvar99: 0,
      downsideDeviation: 0,
      sortinoRatio: 0,
      tailLossRatio95: 0,
      maxDrawdown: 0,
      avgDrawdown: 0,
      drawdownDuration: 0,
      volatility: 0,
      beta: 0,
      trackingError: 0,
      informationRatio: 0,
    };
  }

  const returns = calculateReturns(prices);
  const tailRiskReturns = sanitizeReturnsForTailRisk(returns);

  // VaR
  const var95 = calculateVaR(tailRiskReturns, 0.95);
  const var99 = calculateVaR(tailRiskReturns, 0.99);

  // CVaR
  const cvar95 = calculateCVaR(tailRiskReturns, 0.95);
  const cvar99 = calculateCVaR(tailRiskReturns, 0.99);

  // Drawdowns
  const drawdowns = calculateDrawdowns(prices);
  const maxDrawdown = drawdowns.length > 0 ? Math.max(...drawdowns.map((d) => d.drawdown)) : 0;
  const avgDrawdown = drawdowns.length > 0 ? drawdowns.reduce((a, d) => a + d.drawdown, 0) / drawdowns.length : 0;
  const maxDuration = drawdowns.length > 0 ? Math.max(...drawdowns.map((d) => d.duration)) : 0;

  // Volatility
  const mean = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length > 0 ? returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length : 0;
  const volatility = Math.sqrt(variance * 252);
  const downsideVariance =
    returns.length > 0
      ? returns.reduce((sum, value) => sum + Math.pow(Math.min(value, 0), 2), 0) / returns.length
      : 0;
  const downsideDeviation = Math.sqrt(downsideVariance * 252);
  const annualizedMeanReturn = mean * 252;
  const sortinoRatio = downsideDeviation > 0 ? annualizedMeanReturn / downsideDeviation : 0;
  const tailLossRatio95 = var95 > 0 ? cvar95 / var95 : 0;

  // Beta and tracking error
  let beta = 0;
  let trackingError = 0;
  let informationRatio = 0;

  if (benchmarkPrices && benchmarkPrices.length >= 2) {
    const benchmarkReturns = calculateReturns(benchmarkPrices);
    beta = calculateBeta(returns, benchmarkReturns);

    // Use overlapping portion for active returns
    const len = Math.min(returns.length, benchmarkReturns.length);
    if (len > 0) {
      const alignedAssetReturns = returns.slice(-len);
      const alignedBenchmarkReturns = benchmarkReturns.slice(-len);
      const activeReturns = alignedAssetReturns.map((r, i) => r - alignedBenchmarkReturns[i]);
      const activeMean = activeReturns.reduce((a, b) => a + b, 0) / len;
      const activeVariance = activeReturns.reduce((a, b) => a + Math.pow(b - activeMean, 2), 0) / len;
      trackingError = Math.sqrt(activeVariance * 252);

      const assetMeanReturn = (alignedAssetReturns.reduce((a, b) => a + b, 0) / len) * 252;
      const benchmarkMeanReturn = (alignedBenchmarkReturns.reduce((a, b) => a + b, 0) / len) * 252;
      informationRatio = trackingError > 0 ? (assetMeanReturn - benchmarkMeanReturn) / trackingError : 0;
    }
  }

  return {
    var95,
    var99,
    cvar95,
    cvar99,
    downsideDeviation,
    sortinoRatio,
    tailLossRatio95,
    maxDrawdown,
    avgDrawdown,
    drawdownDuration: maxDuration,
    volatility,
    beta,
    trackingError,
    informationRatio,
  };
}

export function calculateDrawdown(prices: number[]): {
  drawdowns: { drawdown: number; duration: number }[];
  maxDrawdown: number;
  maxDuration: number;
} {
  // Handle empty array
  if (!prices || prices.length === 0) {
    return {
      drawdowns: [],
      maxDrawdown: 0,
      maxDuration: 0,
    };
  }
  const drawdowns = calculateDrawdowns(prices);
  return {
    drawdowns,
    maxDrawdown: drawdowns.length > 0 ? Math.max(...drawdowns.map((d) => d.drawdown)) : 0,
    maxDuration: drawdowns.length > 0 ? Math.max(...drawdowns.map((d) => d.duration)) : 0,
  };
}

export function calculateRollingVolatility(prices: number[], window: number = 21): number[] {
  if (!prices || prices.length < 2 || window <= 0) {
    return [];
  }

  const returns = calculateReturns(prices);
  const rollingVol: number[] = [];

  for (let i = 0; i < returns.length; i++) {
    if (i < window - 1) {
      rollingVol.push(0);
    } else {
      const windowReturns = returns.slice(i - window + 1, i + 1);
      const mean = windowReturns.reduce((a, b) => a + b, 0) / window;
      const variance = windowReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / window;
      rollingVol.push(Math.sqrt(variance * 252));
    }
  }

  return rollingVol;
}
