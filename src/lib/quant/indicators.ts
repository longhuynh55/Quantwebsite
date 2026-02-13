export interface OHLCV {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
}

/**
 * Calculate Simple Moving Average with O(n) sliding window algorithm
 * Returns null values for periods where there isn't enough data
 */
export function calculateSMA(prices: number[], period: number): (number | null)[] {
  // Input validation
  if (!prices || prices.length === 0 || period <= 0) {
    return [];
  }
  if (prices.length < period) {
    return new Array(prices.length).fill(null);
  }

  const result: (number | null)[] = new Array(prices.length).fill(null);

  // Calculate initial sum - O(period)
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  result[period - 1] = sum / period;

  // Slide window - O(1) per iteration
  for (let i = period; i < prices.length; i++) {
    sum = sum - prices[i - period] + prices[i];
    result[i] = sum / period;
  }

  return result;
}

/**
 * Calculate Exponential Moving Average
 * Returns null values for periods where there isn't enough data
 */
export function calculateEMA(prices: number[], period: number): (number | null)[] {
  // Input validation
  if (!prices || prices.length === 0 || period <= 0) {
    return [];
  }
  if (prices.length < period) {
    return new Array(prices.length).fill(null);
  }

  const result: (number | null)[] = new Array(prices.length).fill(null);
  const multiplier = 2 / (period + 1);

  // Use SMA for the first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  result[period - 1] = sum / period;

  // Calculate EMA for remaining values
  for (let i = period; i < prices.length; i++) {
    result[i] = (prices[i] - result[i - 1]!) * multiplier + result[i - 1]!;
  }

  return result;
}

/**
 * Calculate Relative Strength Index
 * Returns null values for periods where there isn't enough data
 */
export function calculateRSI(prices: number[], period: number = 14): (number | null)[] {
  // Input validation
  if (!prices || prices.length === 0 || period <= 0) {
    return [];
  }
  if (prices.length < period + 1) {
    return new Array(prices.length).fill(null);
  }

  const result: (number | null)[] = new Array(prices.length).fill(null);

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Fix division by zero when avgLoss is 0
  if (avgLoss === 0) {
    result[period] = 100; // All gains, no losses
  } else {
    const rs = avgGain / avgLoss;
    result[period] = 100 - 100 / (1 + rs);
  }

  for (let i = period + 1; i < prices.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;

    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = 100 - 100 / (1 + rs);
    }
  }

  return result;
}

/**
 * Calculate Moving Average Convergence Divergence
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  // Input validation
  if (!prices || prices.length === 0) {
    return {
      macd: [],
      signal: [],
      histogram: []
    };
  }
  if (fastPeriod <= 0 || slowPeriod <= 0 || signalPeriod <= 0) {
    return {
      macd: new Array(prices.length).fill(null),
      signal: new Array(prices.length).fill(null),
      histogram: new Array(prices.length).fill(null)
    };
  }

  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  const macd: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (fastEMA[i] !== null && slowEMA[i] !== null) {
      macd.push(fastEMA[i]! - slowEMA[i]!);
    } else {
      macd.push(null);
    }
  }

  // Build signal only from valid MACD values to avoid biasing early periods with zeros.
  const signal: (number | null)[] = new Array(prices.length).fill(null);
  const firstValidMacdIdx = macd.findIndex((v) => v !== null);
  if (firstValidMacdIdx !== -1) {
    const validMacd = macd.slice(firstValidMacdIdx).filter((v): v is number => v !== null);
    const validSignal = calculateEMA(validMacd, signalPeriod);
    for (let i = 0; i < validSignal.length; i++) {
      signal[firstValidMacdIdx + i] = validSignal[i];
    }
  }

  const histogram: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (macd[i] !== null && signal[i] !== null) {
      histogram.push(macd[i]! - signal[i]!);
    } else {
      histogram.push(null);
    }
  }

  return { macd, signal, histogram };
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  // Input validation
  if (!prices || prices.length === 0 || period <= 0) {
    return {
      upper: [],
      middle: [],
      lower: []
    };
  }
  if (prices.length < period) {
    return {
      upper: new Array(prices.length).fill(null),
      middle: new Array(prices.length).fill(null),
      lower: new Array(prices.length).fill(null)
    };
  }

  const middle = calculateSMA(prices, period);
  const upper: (number | null)[] = new Array(prices.length).fill(null);
  const lower: (number | null)[] = new Array(prices.length).fill(null);

  for (let i = period - 1; i < prices.length; i++) {
    if (middle[i] !== null) {
      let sumSquares = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumSquares += Math.pow(prices[j] - middle[i]!, 2);
      }
      const std = Math.sqrt(sumSquares / period);
      upper[i] = middle[i]! + stdDev * std;
      lower[i] = middle[i]! - stdDev * std;
    }
  }

  return { upper, middle, lower };
}

/**
 * Calculate Average True Range
 */
export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): (number | null)[] {
  // Input validation
  if (!highs || !lows || !closes || highs.length === 0) {
    return [];
  }
  if (highs.length !== lows.length || highs.length !== closes.length) {
    return new Array(highs.length).fill(null);
  }
  if (period <= 0 || highs.length < period) {
    return new Array(highs.length).fill(null);
  }

  const result: (number | null)[] = new Array(highs.length).fill(null);
  const trueRanges: number[] = [];

  for (let i = 0; i < highs.length; i++) {
    if (i === 0) {
      trueRanges.push(highs[i] - lows[i]);
    } else {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }
  }

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trueRanges[i];
  }
  result[period - 1] = sum / period;

  for (let i = period; i < highs.length; i++) {
    result[i] = (result[i - 1]! * (period - 1) + trueRanges[i]) / period;
  }

  return result;
}

/**
 * Calculate annualized volatility from prices
 * Fixed off-by-one error: need at least period + 1 prices to calculate period returns
 */
export function calculateVolatility(prices: number[], period: number = 63): number {
  // Input validation - need at least period + 1 prices to calculate returns
  if (!prices || prices.length < period + 1 || period <= 0) {
    return 0;
  }

  const returns: number[] = [];
  // Fixed: start from prices.length - period, but ensure i > 0 to access i - 1
  for (let i = prices.length - period; i < prices.length; i++) {
    if (i > 0) {  // Bounds check to prevent accessing negative index
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }

  if (returns.length === 0) {
    return 0;
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;

  return Math.sqrt(variance * 252);
}
