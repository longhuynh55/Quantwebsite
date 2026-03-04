/**
 * Technical Indicators Library
 * Professional financial analysis indicators for Vietnamese stock market
 * Following Editorial Fintech Design System - Emerald/Stone palette
 */

import type { Time } from "lightweight-charts";

export interface OHLCV {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LineDataPoint {
  time: Time;
  value: number;
}

export interface HistogramDataPoint {
  time: Time;
  value: number;
  color?: string;
}

export interface BollingerBandsData {
  time: Time;
  upper: number;
  middle: number;
  lower: number;
}

export interface MACDData {
  time: Time;
  macd: number;
  signal: number;
  histogram: number;
}

export interface StochasticData {
  time: Time;
  k: number;
  d: number;
}

// Editorial Fintech Color Palette
export const INDICATOR_COLORS = {
  // Primary indicators (emerald scale)
  sma: "#059669",      // emerald-600
  ema: "#047857",      // emerald-700
  vwap: "#10b981",     // emerald-500

  // Bollinger Bands
  bollingerUpper: "#6ee7b7",  // emerald-300
  bollingerMiddle: "#059669", // emerald-600
  bollingerLower: "#6ee7b7",  // emerald-300
  bollingerFill: "rgba(5, 150, 105, 0.1)",

  // MACD
  macdLine: "#059669",        // emerald-600
  macdSignal: "#ea580c",      // orange-600
  macdHistogramPos: "#10b981", // emerald-500
  macdHistogramNeg: "#dc2626", // red-600

  // RSI
  rsiLine: "#059669",         // emerald-600
  rsiOverbought: "#dc2626",   // red-600
  rsiOversold: "#10b981",     // emerald-500

  // Stochastic
  stochasticK: "#059669",     // emerald-600
  stochasticD: "#ea580c",     // orange-600

  // ATR
  atrLine: "#78716c",         // stone-500

  // Neutral
  neutral: "#78716c",         // stone-500
  gridLine: "#e7e5e4",        // stone-200
} as const;

/**
 * Simple Moving Average (SMA)
 */
export function calculateSMA(data: OHLCV[], period: number, source: 'close' | 'open' | 'high' | 'low' = 'close'): LineDataPoint[] {
  if (data.length < period) return [];

  const result: LineDataPoint[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j][source];
    }
    result.push({
      time: data[i].time as Time,
      value: sum / period,
    });
  }

  return result;
}

/**
 * Exponential Moving Average (EMA)
 */
export function calculateEMA(data: OHLCV[], period: number, source: 'close' | 'open' | 'high' | 'low' = 'close'): LineDataPoint[] {
  if (period <= 0 || data.length < period) return [];

  const result: LineDataPoint[] = [];
  const multiplier = 2 / (period + 1);

  // First EMA is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i][source];
  }
  let ema = sum / period;

  result.push({
    time: data[period - 1].time as Time,
    value: ema,
  });

  // Calculate EMA for remaining data
  for (let i = period; i < data.length; i++) {
    ema = (data[i][source] - ema) * multiplier + ema;
    result.push({
      time: data[i].time as Time,
      value: ema,
    });
  }

  return result;
}

/**
 * Weighted Moving Average (WMA)
 */
export function calculateWMA(data: OHLCV[], period: number, source: 'close' | 'open' | 'high' | 'low' = 'close'): LineDataPoint[] {
  if (data.length < period) return [];

  const result: LineDataPoint[] = [];
  const weightSum = (period * (period + 1)) / 2;

  for (let i = period - 1; i < data.length; i++) {
    let weightedSum = 0;
    for (let j = 0; j < period; j++) {
      weightedSum += data[i - period + 1 + j][source] * (j + 1);
    }
    result.push({
      time: data[i].time as Time,
      value: weightedSum / weightSum,
    });
  }

  return result;
}

/**
 * Volume Weighted Average Price (VWAP)
 */
export function calculateVWAP(data: OHLCV[]): LineDataPoint[] {
  if (data.length === 0) return [];

  const result: LineDataPoint[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (const candle of data) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeTPV += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;

    if (cumulativeVolume > 0) {
      result.push({
        time: candle.time as Time,
        value: cumulativeTPV / cumulativeVolume,
      });
    }
  }

  return result;
}

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(
  data: OHLCV[],
  period: number = 20,
  stdDev: number = 2
): BollingerBandsData[] {
  if (data.length < period) return [];

  const result: BollingerBandsData[] = [];

  for (let i = period - 1; i < data.length; i++) {
    // Calculate SMA
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    const sma = sum / period;

    // Calculate Standard Deviation
    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sqSum += Math.pow(data[j].close - sma, 2);
    }
    const std = Math.sqrt(sqSum / period);

    result.push({
      time: data[i].time as Time,
      upper: sma + stdDev * std,
      middle: sma,
      lower: sma - stdDev * std,
    });
  }

  return result;
}

/**
 * Relative Strength Index (RSI)
 */
export function calculateRSI(data: OHLCV[], period: number = 14): LineDataPoint[] {
  if (data.length < period + 1) return [];

  const result: LineDataPoint[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate initial gains and losses
  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // Calculate initial average gain and loss
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // First RSI value
  if (avgLoss === 0) {
    result.push({
      time: data[period].time as Time,
      value: 100,
    });
  } else {
    const rs = avgGain / avgLoss;
    result.push({
      time: data[period].time as Time,
      value: 100 - (100 / (1 + rs)),
    });
  }

  // Calculate remaining RSI values using smoothed method
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    if (avgLoss === 0) {
      result.push({
        time: data[i + 1].time as Time,
        value: 100,
      });
    } else {
      const rs = avgGain / avgLoss;
      result.push({
        time: data[i + 1].time as Time,
        value: 100 - (100 / (1 + rs)),
      });
    }
  }

  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  data: OHLCV[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDData[] {
  if (data.length < slowPeriod) return [];

  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  if (fastEMA.length === 0 || slowEMA.length === 0) return [];

  // Calculate MACD line
  const macdLine: { time: Time; value: number }[] = [];
  const slowStartIndex = slowEMA.length - fastEMA.length;

  for (let i = 0; i < slowEMA.length; i++) {
    const fastIndex = i - slowStartIndex;
    if (fastIndex >= 0 && fastIndex < fastEMA.length) {
      macdLine.push({
        time: slowEMA[i].time,
        value: fastEMA[fastIndex].value - slowEMA[i].value,
      });
    }
  }

  if (macdLine.length < signalPeriod) return [];

  // Calculate Signal line (EMA of MACD)
  const signalLine: { time: Time; value: number }[] = [];
  const multiplier = 2 / (signalPeriod + 1);

  let sum = 0;
  for (let i = 0; i < signalPeriod; i++) {
    sum += macdLine[i].value;
  }
  let signal = sum / signalPeriod;

  signalLine.push({
    time: macdLine[signalPeriod - 1].time,
    value: signal,
  });

  for (let i = signalPeriod; i < macdLine.length; i++) {
    signal = (macdLine[i].value - signal) * multiplier + signal;
    signalLine.push({
      time: macdLine[i].time,
      value: signal,
    });
  }

  // Combine into result
  const result: MACDData[] = [];

  for (let i = 0; i < signalLine.length; i++) {
    const macdIndex = i + signalPeriod - 1;
    if (macdIndex < macdLine.length) {
      const macd = macdLine[macdIndex].value;
      const sig = signalLine[i].value;
      result.push({
        time: signalLine[i].time,
        macd,
        signal: sig,
        histogram: macd - sig,
      });
    }
  }

  return result;
}

/**
 * Stochastic Oscillator
 */
export function calculateStochastic(
  data: OHLCV[],
  kPeriod: number = 14,
  dPeriod: number = 3
): StochasticData[] {
  if (data.length < kPeriod) return [];

  const kValues: { time: Time; value: number }[] = [];

  // Calculate %K
  for (let i = kPeriod - 1; i < data.length; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;

    for (let j = i - kPeriod + 1; j <= i; j++) {
      highestHigh = Math.max(highestHigh, data[j].high);
      lowestLow = Math.min(lowestLow, data[j].low);
    }

    const range = highestHigh - lowestLow;
    const k = range === 0 ? 50 : ((data[i].close - lowestLow) / range) * 100;

    kValues.push({
      time: data[i].time as Time,
      value: k,
    });
  }

  if (kValues.length < dPeriod) return [];

  // Calculate %D (SMA of %K)
  const result: StochasticData[] = [];

  for (let i = dPeriod - 1; i < kValues.length; i++) {
    let sum = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) {
      sum += kValues[j].value;
    }
    const d = sum / dPeriod;

    result.push({
      time: kValues[i].time,
      k: kValues[i].value,
      d,
    });
  }

  return result;
}

/**
 * Average True Range (ATR)
 */
export function calculateATR(data: OHLCV[], period: number = 14): LineDataPoint[] {
  if (data.length < period + 1) return [];

  const trueRanges: number[] = [];

  // Calculate True Range for each period
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );

    trueRanges.push(tr);
  }

  if (trueRanges.length < period) return [];

  const result: LineDataPoint[] = [];

  // First ATR is simple average
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;

  result.push({
    time: data[period].time as Time,
    value: atr,
  });

  // Subsequent ATRs use smoothing
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    result.push({
      time: data[i + 1].time as Time,
      value: atr,
    });
  }

  return result;
}

/**
 * On-Balance Volume (OBV)
 */
export function calculateOBV(data: OHLCV[]): LineDataPoint[] {
  if (data.length === 0) return [];

  const result: LineDataPoint[] = [];
  let obv = 0;

  result.push({
    time: data[0].time as Time,
    value: obv,
  });

  for (let i = 1; i < data.length; i++) {
    if (data[i].close > data[i - 1].close) {
      obv += data[i].volume;
    } else if (data[i].close < data[i - 1].close) {
      obv -= data[i].volume;
    }

    result.push({
      time: data[i].time as Time,
      value: obv,
    });
  }

  return result;
}

/**
 * Money Flow Index (MFI)
 */
export function calculateMFI(data: OHLCV[], period: number = 14): LineDataPoint[] {
  if (data.length < period + 1) return [];

  const result: LineDataPoint[] = [];
  const moneyFlows: { positive: number; negative: number }[] = [];

  for (let i = 1; i < data.length; i++) {
    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
    const prevTypicalPrice = (data[i - 1].high + data[i - 1].low + data[i - 1].close) / 3;
    const rawMoneyFlow = typicalPrice * data[i].volume;

    if (typicalPrice > prevTypicalPrice) {
      moneyFlows.push({ positive: rawMoneyFlow, negative: 0 });
    } else {
      moneyFlows.push({ positive: 0, negative: rawMoneyFlow });
    }
  }

  for (let i = period - 1; i < moneyFlows.length; i++) {
    let positiveSum = 0;
    let negativeSum = 0;

    for (let j = i - period + 1; j <= i; j++) {
      positiveSum += moneyFlows[j].positive;
      negativeSum += moneyFlows[j].negative;
    }

    // Handle edge cases: if negativeSum is 0 and positiveSum > 0, MFI = 100
    // If both are 0, MFI = 50 (neutral)
    let mfi: number;
    if (negativeSum === 0 && positiveSum === 0) {
      mfi = 50; // No money flow in either direction
    } else if (negativeSum === 0) {
      mfi = 100; // All positive money flow
    } else {
      const moneyRatio = positiveSum / negativeSum;
      mfi = 100 - (100 / (1 + moneyRatio));
    }

    result.push({
      time: data[i + 1].time as Time,
      value: mfi,
    });
  }

  return result;
}

/**
 * Indicator Configuration Types
 */
export type IndicatorType =
  | 'sma'
  | 'ema'
  | 'wma'
  | 'vwap'
  | 'bollinger'
  | 'rsi'
  | 'macd'
  | 'stochastic'
  | 'atr'
  | 'obv'
  | 'mfi';

export interface IndicatorConfig {
  type: IndicatorType;
  period?: number;
  period2?: number;
  period3?: number;
  stdDev?: number;
  color?: string;
  color2?: string;
  visible?: boolean;
}

export const DEFAULT_INDICATOR_CONFIGS: Record<string, IndicatorConfig> = {
  sma20: { type: 'sma', period: 20, color: INDICATOR_COLORS.sma, visible: true },
  sma50: { type: 'sma', period: 50, color: '#047857', visible: true },
  sma200: { type: 'sma', period: 200, color: '#065f46', visible: false },
  ema12: { type: 'ema', period: 12, color: INDICATOR_COLORS.ema, visible: false },
  ema26: { type: 'ema', period: 26, color: '#064e3b', visible: false },
  vwap: { type: 'vwap', color: INDICATOR_COLORS.vwap, visible: false },
  bollinger: {
    type: 'bollinger',
    period: 20,
    stdDev: 2,
    color: INDICATOR_COLORS.bollingerMiddle,
    visible: false
  },
  rsi: { type: 'rsi', period: 14, color: INDICATOR_COLORS.rsiLine, visible: false },
  macd: {
    type: 'macd',
    period: 12,
    period2: 26,
    period3: 9,
    color: INDICATOR_COLORS.macdLine,
    color2: INDICATOR_COLORS.macdSignal,
    visible: false
  },
  stochastic: {
    type: 'stochastic',
    period: 14,
    period2: 3,
    color: INDICATOR_COLORS.stochasticK,
    color2: INDICATOR_COLORS.stochasticD,
    visible: false
  },
  atr: { type: 'atr', period: 14, color: INDICATOR_COLORS.atrLine, visible: false },
  obv: { type: 'obv', color: INDICATOR_COLORS.neutral, visible: false },
  mfi: { type: 'mfi', period: 14, color: INDICATOR_COLORS.rsiLine, visible: false },
};
