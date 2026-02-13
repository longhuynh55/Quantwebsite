import { OHLCV, calculateSMA, calculateEMA, calculateRSI, calculateBollingerBands } from "./indicators";

export interface Trade {
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  type: "long" | "short";
  pnl: number;
  pnlPercent: number;
}

export interface BacktestResult {
  trades: Trade[];
  equityCurve: { date: Date; equity: number }[];
  metrics: {
    totalReturn: number;
    cagr: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    maxDrawdownDuration: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    avgReturn: number;
    avgWin: number;
    avgLoss: number;
    bestTrade: number;
    worstTrade: number;
  };
}

export interface StrategyConfig {
  name: string;
  type: "sma_crossover" | "ema_crossover" | "rsi_mean_reversion" | "bollinger_bands" | "momentum";
  params: Record<string, number>;
}

function calculateDailyReturns(equityCurve: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    // Fix division by zero
    if (equityCurve[i - 1] !== 0) {
      returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
    } else {
      returns.push(0);
    }
  }
  return returns;
}

function calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
  if (returns.length === 0) return 0;
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  const annualizedReturn = meanReturn * 252;
  const annualizedStd = std * Math.sqrt(252);
  return (annualizedReturn - riskFreeRate) / annualizedStd;
}

function calculateSortinoRatio(returns: number[], riskFreeRate: number = 0.02): number {
  if (returns.length === 0) return 0;
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const negativeReturns = returns.filter((r) => r < 0);
  // Fix: Return large finite number instead of Infinity when no negative returns
  if (negativeReturns.length === 0) return 999;
  const downSideVariance = negativeReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / negativeReturns.length;
  const downSideStd = Math.sqrt(downSideVariance);
  if (downSideStd === 0) return 0;
  const annualizedReturn = meanReturn * 252;
  const annualizedDownSideStd = downSideStd * Math.sqrt(252);
  return (annualizedReturn - riskFreeRate) / annualizedDownSideStd;
}

function calculateMaxDrawdown(equityCurve: number[]): { maxDrawdown: number; duration: number } {
  // Handle empty or single-element arrays
  if (!equityCurve || equityCurve.length === 0) {
    return { maxDrawdown: 0, duration: 0 };
  }
  if (equityCurve.length === 1) {
    return { maxDrawdown: 0, duration: 0 };
  }

  let maxDrawdown = 0;
  let maxDuration = 0;
  let peak = equityCurve[0];
  let peakIndex = 0;

  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) {
      peak = equityCurve[i];
      peakIndex = i;
    } else if (peak > 0) {  // Avoid division by zero
      const drawdown = (peak - equityCurve[i]) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDuration = i - peakIndex;
      }
    }
  }

  return { maxDrawdown, duration: maxDuration };
}

export function runBacktest(
  data: OHLCV[],
  strategy: StrategyConfig,
  initialCapital: number = 100000
): BacktestResult {
  // Input validation
  if (!data || data.length === 0) {
    return {
      trades: [],
      equityCurve: [],
      metrics: {
        totalReturn: 0,
        cagr: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        maxDrawdown: 0,
        maxDrawdownDuration: 0,
        winRate: 0,
        profitFactor: 0,
        totalTrades: 0,
        avgReturn: 0,
        avgWin: 0,
        avgLoss: 0,
        bestTrade: 0,
        worstTrade: 0,
      },
    };
  }

  // Validate initial capital
  if (initialCapital <= 0) {
    initialCapital = 100000;
  }

  const closes = data.map((d) => d.close);
  const trades: Trade[] = [];
  const equityCurve: { date: Date; equity: number }[] = [];
  let equity = initialCapital;
  let position: { shares: number; entryPrice: number; entryDate: Date } | null = null;

  const signals: ("buy" | "sell" | null)[] = new Array(data.length).fill(null);

  switch (strategy.type) {
    case "sma_crossover": {
      const shortPeriod = strategy.params.shortPeriod || 10;
      const longPeriod = strategy.params.longPeriod || 20;
      const shortSMA = calculateSMA(closes, shortPeriod);
      const longSMA = calculateSMA(closes, longPeriod);

      for (let i = 1; i < data.length; i++) {
        if (shortSMA[i] !== null && longSMA[i] !== null &&
            shortSMA[i - 1] !== null && longSMA[i - 1] !== null) {
          if (shortSMA[i - 1]! <= longSMA[i - 1]! && shortSMA[i]! > longSMA[i]!) {
            signals[i] = "buy";
          } else if (shortSMA[i - 1]! >= longSMA[i - 1]! && shortSMA[i]! < longSMA[i]!) {
            signals[i] = "sell";
          }
        }
      }
      break;
    }

    case "ema_crossover": {
      const shortPeriod = strategy.params.shortPeriod || 10;
      const longPeriod = strategy.params.longPeriod || 20;
      const shortEMA = calculateEMA(closes, shortPeriod);
      const longEMA = calculateEMA(closes, longPeriod);

      for (let i = 1; i < data.length; i++) {
        if (shortEMA[i] !== null && longEMA[i] !== null &&
            shortEMA[i - 1] !== null && longEMA[i - 1] !== null) {
          if (shortEMA[i - 1]! <= longEMA[i - 1]! && shortEMA[i]! > longEMA[i]!) {
            signals[i] = "buy";
          } else if (shortEMA[i - 1]! >= longEMA[i - 1]! && shortEMA[i]! < longEMA[i]!) {
            signals[i] = "sell";
          }
        }
      }
      break;
    }

    case "rsi_mean_reversion": {
      const period = strategy.params.period || 14;
      const oversold = strategy.params.oversold || 30;
      const overbought = strategy.params.overbought || 70;
      const rsi = calculateRSI(closes, period);

      for (let i = 1; i < data.length; i++) {
        if (rsi[i] !== null && rsi[i - 1] !== null) {
          if (rsi[i - 1]! < oversold && rsi[i]! >= oversold) {
            signals[i] = "buy";
          } else if (rsi[i - 1]! > overbought && rsi[i]! <= overbought) {
            signals[i] = "sell";
          }
        }
      }
      break;
    }

    case "bollinger_bands": {
      const period = strategy.params.period || 20;
      const stdDev = strategy.params.stdDev || 2;
      const bb = calculateBollingerBands(closes, period, stdDev);

      for (let i = 1; i < data.length; i++) {
        const prevLower = bb.lower[i - 1];
        const prevUpper = bb.upper[i - 1];
        const currLower = bb.lower[i];
        const currUpper = bb.upper[i];

        if (prevLower !== null && prevUpper !== null && currLower !== null && currUpper !== null) {
          if (closes[i - 1] <= prevLower && closes[i] > currLower) {
            signals[i] = "buy";
          } else if (closes[i - 1] >= prevUpper && closes[i] < currUpper) {
            signals[i] = "sell";
          }
        }
      }
      break;
    }

    case "momentum": {
      const lookback = strategy.params.lookback || 20;
      const threshold = strategy.params.threshold || 0.05;

      for (let i = lookback; i < data.length; i++) {
        // Fix division by zero
        const lookbackPrice = closes[i - lookback];
        if (lookbackPrice === 0) continue;
        const momentum = (closes[i] - lookbackPrice) / lookbackPrice;
        if (momentum > threshold) {
          signals[i] = "buy";
        } else if (momentum < -threshold) {
          signals[i] = "sell";
        }
      }
      break;
    }
  }

  for (let i = 0; i < data.length; i++) {
    if (signals[i] === "buy" && !position) {
      const shares = Math.floor(equity / data[i].close);
      if (shares > 0) {
        position = { shares, entryPrice: data[i].close, entryDate: data[i].date };
        equity -= shares * data[i].close;
      }
    } else if (signals[i] === "sell" && position) {
      const pnl = position.shares * (data[i].close - position.entryPrice);
      const pnlPercent = (data[i].close - position.entryPrice) / position.entryPrice;

      trades.push({
        entryDate: position.entryDate,
        exitDate: data[i].date,
        entryPrice: position.entryPrice,
        exitPrice: data[i].close,
        shares: position.shares,
        type: "long",
        pnl,
        pnlPercent,
      });

      equity += position.shares * data[i].close;
      position = null;
    }

    const currentEquity = position ? equity + position.shares * data[i].close : equity;
    equityCurve.push({ date: data[i].date, equity: currentEquity });
  }

  if (position) {
    const lastIdx = data.length - 1;
    const pnl = position.shares * (data[lastIdx].close - position.entryPrice);
    const pnlPercent = (data[lastIdx].close - position.entryPrice) / position.entryPrice;

    trades.push({
      entryDate: position.entryDate,
      exitDate: data[lastIdx].date,
      entryPrice: position.entryPrice,
      exitPrice: data[lastIdx].close,
      shares: position.shares,
      type: "long",
      pnl,
      pnlPercent,
    });

    equity += position.shares * data[lastIdx].close;
  }

  const equityValues = equityCurve.map((e) => e.equity);
  const dailyReturns = calculateDailyReturns(equityValues);
  const { maxDrawdown, duration: maxDrawdownDuration } = calculateMaxDrawdown(equityValues);

  const totalReturn = initialCapital > 0 ? (equity - initialCapital) / initialCapital : 0;
  const years = (data[data.length - 1].date.getTime() - data[0].date.getTime()) / (365 * 24 * 60 * 60 * 1000);

  // Fix CAGR calculation: validate years > 0, equity > 0, and initialCapital > 0
  let cagr = 0;
  if (years > 0 && equity > 0 && initialCapital > 0) {
    cagr = Math.pow(equity / initialCapital, 1 / years) - 1;
  }

  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades = trades.filter((t) => t.pnl <= 0);
  const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;

  const grossProfit = winningTrades.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((a, t) => a + t.pnl, 0));
  // Use 999 instead of Infinity to avoid JSON serialization issues
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  const tradeReturns = trades.map((t) => t.pnlPercent);
  const avgReturn = tradeReturns.length > 0 ? tradeReturns.reduce((a, b) => a + b, 0) / tradeReturns.length : 0;
  const avgWin = winningTrades.length > 0 ? winningTrades.reduce((a, t) => a + t.pnlPercent, 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((a, t) => a + t.pnlPercent, 0) / losingTrades.length : 0;

  return {
    trades,
    equityCurve,
    metrics: {
      totalReturn,
      cagr,
      sharpeRatio: calculateSharpeRatio(dailyReturns),
      sortinoRatio: calculateSortinoRatio(dailyReturns),
      maxDrawdown,
      maxDrawdownDuration,
      winRate,
      profitFactor,
      totalTrades: trades.length,
      avgReturn,
      avgWin,
      avgLoss,
      bestTrade: tradeReturns.length > 0 ? Math.max(...tradeReturns) : 0,
      worstTrade: tradeReturns.length > 0 ? Math.min(...tradeReturns) : 0,
    },
  };
}

export const STRATEGIES: StrategyConfig[] = [
  { name: "SMA Crossover", type: "sma_crossover", params: { shortPeriod: 10, longPeriod: 20 } },
  { name: "EMA Crossover", type: "ema_crossover", params: { shortPeriod: 10, longPeriod: 20 } },
  { name: "RSI Mean Reversion", type: "rsi_mean_reversion", params: { period: 14, oversold: 30, overbought: 70 } },
  { name: "Bollinger Band Breakout", type: "bollinger_bands", params: { period: 20, stdDev: 2 } },
  { name: "Momentum Strategy", type: "momentum", params: { lookback: 20, threshold: 0.05 } },
];
