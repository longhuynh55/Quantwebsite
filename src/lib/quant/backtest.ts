import { OHLCV, calculateSMA, calculateEMA, calculateRSI, calculateBollingerBands } from "./indicators";

export const STRATEGY_TYPES = [
  "sma_crossover",
  "ema_crossover",
  "rsi_mean_reversion",
  "bollinger_bands",
  "momentum",
] as const;

export type StrategyType = (typeof STRATEGY_TYPES)[number];
export type ExecutionModel = "next_open" | "same_close";
type Signal = "buy" | "sell" | null;

export interface BacktestValidationIssue {
  field: string;
  message: string;
}

export interface BacktestConfigInput {
  executionModel?: ExecutionModel | string;
  feeBps?: number | string;
  sellTaxBps?: number | string;
  slippageBps?: number | string;
  lotSize?: number | string;
}

export interface BacktestConfig {
  executionModel: ExecutionModel;
  costs: {
    feeBps: number;
    sellTaxBps: number;
    slippageBps: number;
  };
  positionSizing: {
    mode: "all_in";
    lotSize: number;
  };
}

export interface Trade {
  symbol?: string;
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  type: "long" | "short";
  pnl: number;
  pnlPercent: number;
  grossPnl: number;
  totalCosts: number;
  turnover: number;
  forcedExit?: boolean;
}

export interface BacktestDiagnostics {
  inputRows: number;
  usableRows: number;
  droppedRows: number;
  coverageRatio: number;
  largestGapDays: number;
  firstDate: Date | null;
  lastDate: Date | null;
  warnings: string[];
}

export interface BacktestResult {
  trades: Trade[];
  equityCurve: { date: Date; equity: number }[];
  metrics: {
    totalReturn: number;
    netReturn: number;
    grossReturn: number;
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
    turnover: number;
    exposureRatio: number;
  };
  configApplied: BacktestConfig;
  diagnostics: BacktestDiagnostics;
}

export interface StrategyConfig {
  name: string;
  type: StrategyType;
  params: Record<string, number>;
}

const DEFAULT_INITIAL_CAPITAL = 100000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_REQUIRED_ROWS = 30;
const MAX_COST_BPS = 1000;

const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  executionModel: "next_open",
  costs: { feeBps: 15, sellTaxBps: 10, slippageBps: 5 },
  positionSizing: { mode: "all_in", lotSize: 1 },
};

const STRATEGY_DEFAULT_PARAMS: Record<StrategyType, Record<string, number>> = {
  sma_crossover: { shortPeriod: 10, longPeriod: 20 },
  ema_crossover: { shortPeriod: 10, longPeriod: 20 },
  rsi_mean_reversion: { period: 14, oversold: 30, overbought: 70 },
  bollinger_bands: { period: 20, stdDev: 2 },
  momentum: { lookback: 20, threshold: 0.05 },
};

const STRATEGY_LABELS: Record<StrategyType, string> = {
  sma_crossover: "SMA Crossover",
  ema_crossover: "EMA Crossover",
  rsi_mean_reversion: "RSI Mean Reversion",
  bollinger_bands: "Bollinger Band Breakout",
  momentum: "Momentum Strategy",
};

const STRATEGY_PARAM_KEYS: Record<StrategyType, string[]> = {
  sma_crossover: ["shortPeriod", "longPeriod"],
  ema_crossover: ["shortPeriod", "longPeriod"],
  rsi_mean_reversion: ["period", "oversold", "overbought"],
  bollinger_bands: ["period", "stdDev"],
  momentum: ["lookback", "threshold"],
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toFiniteNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toPositiveInteger(value: unknown, fallback: number): number {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < 1) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidOhlcvRow(row: OHLCV): boolean {
  if (!row || !(row.date instanceof Date) || Number.isNaN(row.date.getTime())) return false;
  if (!Number.isFinite(row.open) || !Number.isFinite(row.high) || !Number.isFinite(row.low) || !Number.isFinite(row.close)) return false;
  if (!Number.isFinite(row.volume)) return false;
  if (row.open <= 0 || row.high <= 0 || row.low <= 0 || row.close <= 0) return false;
  if (row.volume < 0) return false;
  if (row.high < row.low) return false;
  if (row.high < row.open || row.high < row.close) return false;
  if (row.low > row.open || row.low > row.close) return false;
  return true;
}

function normalizeData(raw: OHLCV[]): { rows: OHLCV[]; diagnostics: BacktestDiagnostics } {
  const sorted = [...raw].sort((a, b) => a.date.getTime() - b.date.getTime());
  const deduped: OHLCV[] = [];
  let droppedRows = 0;

  for (const row of sorted) {
    if (!isValidOhlcvRow(row)) {
      droppedRows += 1;
      continue;
    }

    if (deduped.length === 0) {
      deduped.push(row);
      continue;
    }

    const last = deduped[deduped.length - 1];
    if (toDayKey(last.date) === toDayKey(row.date)) {
      deduped[deduped.length - 1] = row;
      droppedRows += 1;
      continue;
    }

    deduped.push(row);
  }

  let largestGapDays = 0;
  for (let i = 1; i < deduped.length; i++) {
    const dayGap = Math.max(0, Math.floor((deduped[i].date.getTime() - deduped[i - 1].date.getTime()) / MS_PER_DAY) - 1);
    if (dayGap > largestGapDays) {
      largestGapDays = dayGap;
    }
  }

  const firstDate = deduped.length > 0 ? deduped[0].date : null;
  const lastDate = deduped.length > 0 ? deduped[deduped.length - 1].date : null;
  const spanDays = firstDate && lastDate
    ? Math.max(1, Math.floor((lastDate.getTime() - firstDate.getTime()) / MS_PER_DAY) + 1)
    : 1;
  const coverageRatio = deduped.length > 0 ? deduped.length / spanDays : 0;

  const warnings: string[] = [];
  if (droppedRows > 0) warnings.push(`Dropped ${droppedRows} invalid/duplicate rows before backtest.`);
  if (coverageRatio < 0.35 && deduped.length > 0) warnings.push(`Low timeline coverage (${(coverageRatio * 100).toFixed(1)}%).`);
  if (largestGapDays >= 14) warnings.push(`Detected large data gap: ${largestGapDays} days.`);
  if (deduped.length > 0 && deduped.length < MIN_REQUIRED_ROWS) warnings.push(`Only ${deduped.length} rows after cleaning.`);

  return {
    rows: deduped,
    diagnostics: {
      inputRows: raw.length,
      usableRows: deduped.length,
      droppedRows,
      coverageRatio,
      largestGapDays,
      firstDate,
      lastDate,
      warnings,
    },
  };
}

function calculateDailyReturns(equityCurve: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
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
  if (negativeReturns.length === 0) return 999;
  const downSideVariance = negativeReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / negativeReturns.length;
  const downSideStd = Math.sqrt(downSideVariance);
  if (downSideStd === 0) return 0;
  const annualizedReturn = meanReturn * 252;
  const annualizedDownSideStd = downSideStd * Math.sqrt(252);
  return (annualizedReturn - riskFreeRate) / annualizedDownSideStd;
}

function calculateMaxDrawdown(equityCurve: number[]): { maxDrawdown: number; duration: number } {
  if (!equityCurve || equityCurve.length < 2) {
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
    } else if (peak > 0) {
      const drawdown = (peak - equityCurve[i]) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDuration = i - peakIndex;
      }
    }
  }

  return { maxDrawdown, duration: maxDuration };
}

function normalizeStrategyConfig(input: StrategyConfig): StrategyConfig {
  const defaults = STRATEGY_DEFAULT_PARAMS[input.type];
  const params = { ...defaults };
  for (const [key, value] of Object.entries(input.params ?? {})) {
    const parsed = toFiniteNumber(value);
    if (parsed !== null) {
      params[key] = parsed;
    }
  }

  return {
    name: input.name || STRATEGY_LABELS[input.type],
    type: input.type,
    params,
  };
}

function getSignalSeries(data: OHLCV[], strategy: StrategyConfig): Signal[] {
  const closes = data.map((d) => d.close);
  const signals: Signal[] = new Array(data.length).fill(null);

  switch (strategy.type) {
    case "sma_crossover": {
      const shortPeriod = toPositiveInteger(strategy.params.shortPeriod, STRATEGY_DEFAULT_PARAMS.sma_crossover.shortPeriod);
      const longPeriod = toPositiveInteger(strategy.params.longPeriod, STRATEGY_DEFAULT_PARAMS.sma_crossover.longPeriod);
      const shortSMA = calculateSMA(closes, shortPeriod);
      const longSMA = calculateSMA(closes, longPeriod);

      for (let i = 1; i < data.length; i++) {
        if (shortSMA[i] !== null && longSMA[i] !== null && shortSMA[i - 1] !== null && longSMA[i - 1] !== null) {
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
      const shortPeriod = toPositiveInteger(strategy.params.shortPeriod, STRATEGY_DEFAULT_PARAMS.ema_crossover.shortPeriod);
      const longPeriod = toPositiveInteger(strategy.params.longPeriod, STRATEGY_DEFAULT_PARAMS.ema_crossover.longPeriod);
      const shortEMA = calculateEMA(closes, shortPeriod);
      const longEMA = calculateEMA(closes, longPeriod);

      for (let i = 1; i < data.length; i++) {
        if (shortEMA[i] !== null && longEMA[i] !== null && shortEMA[i - 1] !== null && longEMA[i - 1] !== null) {
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
      const period = toPositiveInteger(strategy.params.period, STRATEGY_DEFAULT_PARAMS.rsi_mean_reversion.period);
      const oversold = toFiniteNumber(strategy.params.oversold) ?? STRATEGY_DEFAULT_PARAMS.rsi_mean_reversion.oversold;
      const overbought = toFiniteNumber(strategy.params.overbought) ?? STRATEGY_DEFAULT_PARAMS.rsi_mean_reversion.overbought;
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
      const period = toPositiveInteger(strategy.params.period, STRATEGY_DEFAULT_PARAMS.bollinger_bands.period);
      const stdDev = toFiniteNumber(strategy.params.stdDev) ?? STRATEGY_DEFAULT_PARAMS.bollinger_bands.stdDev;
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
      const lookback = toPositiveInteger(strategy.params.lookback, STRATEGY_DEFAULT_PARAMS.momentum.lookback);
      const threshold = toFiniteNumber(strategy.params.threshold) ?? STRATEGY_DEFAULT_PARAMS.momentum.threshold;

      for (let i = lookback; i < data.length; i++) {
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

  return signals;
}

function validateIntegerParam(
  value: unknown,
  field: string,
  min: number,
  max: number,
  issues: BacktestValidationIssue[]
): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null || !Number.isInteger(parsed)) {
    issues.push({ field, message: `${field} must be an integer.` });
    return null;
  }
  if (parsed < min || parsed > max) {
    issues.push({ field, message: `${field} must be between ${min} and ${max}.` });
    return null;
  }
  return parsed;
}

function validateRangeParam(
  value: unknown,
  field: string,
  min: number,
  max: number,
  issues: BacktestValidationIssue[]
): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null) {
    issues.push({ field, message: `${field} must be a number.` });
    return null;
  }
  if (parsed < min || parsed > max) {
    issues.push({ field, message: `${field} must be between ${min} and ${max}.` });
    return null;
  }
  return parsed;
}

export function extractNumericParams(raw: Record<string, unknown> | undefined): Record<string, number> {
  const parsed: Record<string, number> = {};
  if (!raw) return parsed;

  for (const [key, value] of Object.entries(raw)) {
    const num = toFiniteNumber(value);
    if (num !== null) {
      parsed[key] = num;
    }
  }

  return parsed;
}

export function validateStrategyParams(type: StrategyType, params: Record<string, unknown> | undefined): BacktestValidationIssue[] {
  const merged: Record<string, unknown> = { ...STRATEGY_DEFAULT_PARAMS[type], ...(params ?? {}) };
  const issues: BacktestValidationIssue[] = [];

  switch (type) {
    case "sma_crossover":
    case "ema_crossover": {
      const shortPeriod = validateIntegerParam(merged.shortPeriod, "params.shortPeriod", 2, 299, issues);
      const longPeriod = validateIntegerParam(merged.longPeriod, "params.longPeriod", 3, 300, issues);
      if (shortPeriod !== null && longPeriod !== null && shortPeriod >= longPeriod) {
        issues.push({ field: "params.shortPeriod", message: "params.shortPeriod must be less than params.longPeriod." });
      }
      break;
    }
    case "rsi_mean_reversion": {
      const oversold = validateRangeParam(merged.oversold, "params.oversold", 5, 50, issues);
      const overbought = validateRangeParam(merged.overbought, "params.overbought", 50, 95, issues);
      validateIntegerParam(merged.period, "params.period", 2, 100, issues);
      if (oversold !== null && overbought !== null && oversold >= overbought) {
        issues.push({ field: "params.oversold", message: "params.oversold must be less than params.overbought." });
      }
      break;
    }
    case "bollinger_bands":
      validateIntegerParam(merged.period, "params.period", 5, 200, issues);
      validateRangeParam(merged.stdDev, "params.stdDev", 0.5, 4, issues);
      break;
    case "momentum":
      validateIntegerParam(merged.lookback, "params.lookback", 2, 252, issues);
      validateRangeParam(merged.threshold, "params.threshold", 0.001, 0.5, issues);
      break;
  }

  return issues;
}

export function validateBacktestConfigInput(config: BacktestConfigInput | undefined): BacktestValidationIssue[] {
  if (!config) return [];
  const issues: BacktestValidationIssue[] = [];

  if (config.executionModel !== undefined && config.executionModel !== "next_open" && config.executionModel !== "same_close") {
    issues.push({ field: "executionModel", message: 'executionModel must be either "next_open" or "same_close".' });
  }

  const costFields: Array<keyof Pick<BacktestConfigInput, "feeBps" | "sellTaxBps" | "slippageBps">> = [
    "feeBps",
    "sellTaxBps",
    "slippageBps",
  ];

  for (const field of costFields) {
    const value = config[field];
    if (value === undefined) continue;
    const parsed = toFiniteNumber(value);
    if (parsed === null) {
      issues.push({ field, message: `${field} must be a number.` });
      continue;
    }
    if (parsed < 0 || parsed > MAX_COST_BPS) {
      issues.push({ field, message: `${field} must be between 0 and ${MAX_COST_BPS}.` });
    }
  }

  if (config.lotSize !== undefined) {
    const lotSize = toFiniteNumber(config.lotSize);
    if (lotSize === null || !Number.isInteger(lotSize) || lotSize < 1 || lotSize > 10000) {
      issues.push({ field: "lotSize", message: "lotSize must be an integer between 1 and 10000." });
    }
  }

  return issues;
}

export function normalizeBacktestConfig(config: BacktestConfigInput | undefined): BacktestConfig {
  const feeBps = toFiniteNumber(config?.feeBps);
  const sellTaxBps = toFiniteNumber(config?.sellTaxBps);
  const slippageBps = toFiniteNumber(config?.slippageBps);
  const lotSize = toFiniteNumber(config?.lotSize);

  return {
    executionModel: config?.executionModel === "same_close" ? "same_close" : DEFAULT_BACKTEST_CONFIG.executionModel,
    costs: {
      feeBps: feeBps !== null ? feeBps : DEFAULT_BACKTEST_CONFIG.costs.feeBps,
      sellTaxBps: sellTaxBps !== null ? sellTaxBps : DEFAULT_BACKTEST_CONFIG.costs.sellTaxBps,
      slippageBps: slippageBps !== null ? slippageBps : DEFAULT_BACKTEST_CONFIG.costs.slippageBps,
    },
    positionSizing: {
      mode: "all_in",
      lotSize: lotSize !== null ? Math.max(1, Math.floor(lotSize)) : DEFAULT_BACKTEST_CONFIG.positionSizing.lotSize,
    },
  };
}

function emptyResult(configApplied: BacktestConfig, diagnostics: BacktestDiagnostics): BacktestResult {
  return {
    trades: [],
    equityCurve: [],
    metrics: {
      totalReturn: 0,
      netReturn: 0,
      grossReturn: 0,
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
      turnover: 0,
      exposureRatio: 0,
    },
    configApplied,
    diagnostics,
  };
}

export function runBacktest(
  data: OHLCV[],
  strategy: StrategyConfig,
  initialCapital: number = DEFAULT_INITIAL_CAPITAL,
  configInput?: BacktestConfigInput
): BacktestResult {
  const config = normalizeBacktestConfig(configInput);
  const validatedCapital = initialCapital > 0 && Number.isFinite(initialCapital) ? initialCapital : DEFAULT_INITIAL_CAPITAL;

  const { rows: cleanedData, diagnostics } = normalizeData(data ?? []);
  if (cleanedData.length === 0) {
    diagnostics.warnings.push("No valid rows available after cleaning.");
    return emptyResult(config, diagnostics);
  }

  const normalizedStrategy = normalizeStrategyConfig(strategy);
  const strategyIssues = validateStrategyParams(normalizedStrategy.type, normalizedStrategy.params);
  if (strategyIssues.length > 0) {
    diagnostics.warnings.push(`Strategy validation warning: ${strategyIssues[0].message}`);
  }

  const signals = getSignalSeries(cleanedData, normalizedStrategy);
  if (config.executionModel === "next_open" && signals[signals.length - 1] !== null) {
    diagnostics.warnings.push("Last signal was ignored because next bar is unavailable for execution.");
  }

  const feeRate = config.costs.feeBps / 10000;
  const sellTaxRate = config.costs.sellTaxBps / 10000;
  const slippageRate = config.costs.slippageBps / 10000;

  const trades: Trade[] = [];
  const equityCurve: { date: Date; equity: number }[] = [];
  const grossEquityCurve: number[] = [];

  let netCash = validatedCapital;
  let grossCash = validatedCapital;
  let totalTurnover = 0;
  let daysInPosition = 0;

  let position: {
    symbol: string;
    shares: number;
    entryDate: Date;
    entryPrice: number;
    entryGrossNotional: number;
    entryNetCost: number;
  } | null = null;

  const tryEnterPosition = (index: number, executionPrice: number): void => {
    if (position || executionPrice <= 0) return;

    const perShareNetCost = executionPrice * (1 + feeRate + slippageRate);
    const lotSize = Math.max(1, config.positionSizing.lotSize);
    const affordableLots = Math.floor(netCash / (perShareNetCost * lotSize));
    const shares = affordableLots * lotSize;
    if (shares <= 0) return;

    const entryGrossNotional = shares * executionPrice;
    const entryNetCost = entryGrossNotional * (1 + feeRate + slippageRate);

    netCash -= entryNetCost;
    grossCash -= entryGrossNotional;
    totalTurnover += entryGrossNotional;

    position = {
      symbol: cleanedData[index].symbol,
      shares,
      entryDate: cleanedData[index].date,
      entryPrice: executionPrice,
      entryGrossNotional,
      entryNetCost,
    };
  };

  const exitPosition = (index: number, executionPrice: number, forcedExit: boolean): void => {
    if (!position || executionPrice <= 0) return;

    const exitGrossNotional = position.shares * executionPrice;
    const exitNetProceeds = exitGrossNotional * (1 - feeRate - slippageRate - sellTaxRate);
    const grossPnl = exitGrossNotional - position.entryGrossNotional;
    const netPnl = exitNetProceeds - position.entryNetCost;
    const totalCosts = (position.entryGrossNotional * (feeRate + slippageRate)) +
      (exitGrossNotional * (feeRate + slippageRate + sellTaxRate));

    netCash += exitNetProceeds;
    grossCash += exitGrossNotional;
    totalTurnover += exitGrossNotional;

    trades.push({
      symbol: position.symbol,
      entryDate: position.entryDate,
      exitDate: cleanedData[index].date,
      entryPrice: position.entryPrice,
      exitPrice: executionPrice,
      shares: position.shares,
      type: "long",
      pnl: netPnl,
      pnlPercent: position.entryNetCost > 0 ? netPnl / position.entryNetCost : 0,
      grossPnl,
      totalCosts,
      turnover: position.entryGrossNotional + exitGrossNotional,
      forcedExit,
    });

    position = null;
  };

  for (let i = 0; i < cleanedData.length; i++) {
    const executionSignal = config.executionModel === "next_open" ? (i > 0 ? signals[i - 1] : null) : signals[i];
    const executionPrice = config.executionModel === "next_open" ? cleanedData[i].open : cleanedData[i].close;

    if (executionSignal === "buy") {
      tryEnterPosition(i, executionPrice);
    } else if (executionSignal === "sell") {
      exitPosition(i, executionPrice, false);
    }

    if (position) {
      daysInPosition += 1;
    }

    const openShares = Number((position as { shares?: number } | null)?.shares ?? 0);
    const hasOpenPosition = openShares > 0;
    const netEquity = hasOpenPosition
      ? netCash + openShares * cleanedData[i].close * (1 - feeRate - slippageRate - sellTaxRate)
      : netCash;
    const grossEquity = hasOpenPosition ? grossCash + openShares * cleanedData[i].close : grossCash;

    equityCurve.push({ date: cleanedData[i].date, equity: netEquity });
    grossEquityCurve.push(grossEquity);
  }

  if (position) {
    const lastIndex = cleanedData.length - 1;
    exitPosition(lastIndex, cleanedData[lastIndex].close, true);
    if (equityCurve.length > 0) {
      equityCurve[equityCurve.length - 1].equity = netCash;
      grossEquityCurve[grossEquityCurve.length - 1] = grossCash;
    }
  }

  const equityValues = equityCurve.map((point) => point.equity);
  const dailyReturns = calculateDailyReturns(equityValues);
  const { maxDrawdown, duration: maxDrawdownDuration } = calculateMaxDrawdown(equityValues);

  const netReturn = validatedCapital > 0 ? (netCash - validatedCapital) / validatedCapital : 0;
  const grossReturn = validatedCapital > 0 ? (grossCash - validatedCapital) / validatedCapital : 0;
  const totalReturn = netReturn;

  const years = diagnostics.firstDate && diagnostics.lastDate
    ? (diagnostics.lastDate.getTime() - diagnostics.firstDate.getTime()) / (365 * MS_PER_DAY)
    : 0;
  const cagr = years > 0 && netCash > 0 ? Math.pow(netCash / validatedCapital, 1 / years) - 1 : 0;

  const winningTrades = trades.filter((trade) => trade.pnl > 0);
  const losingTrades = trades.filter((trade) => trade.pnl <= 0);
  const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;

  const grossProfit = winningTrades.reduce((acc, trade) => acc + trade.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((acc, trade) => acc + trade.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  const tradeReturns = trades.map((trade) => trade.pnlPercent);
  const avgReturn = tradeReturns.length > 0 ? tradeReturns.reduce((acc, value) => acc + value, 0) / tradeReturns.length : 0;
  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((acc, trade) => acc + trade.pnlPercent, 0) / winningTrades.length
    : 0;
  const avgLoss = losingTrades.length > 0
    ? losingTrades.reduce((acc, trade) => acc + trade.pnlPercent, 0) / losingTrades.length
    : 0;

  if (trades.length === 0) {
    diagnostics.warnings.push("No trades were executed for this configuration.");
  }

  return {
    trades,
    equityCurve,
    metrics: {
      totalReturn,
      netReturn,
      grossReturn,
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
      turnover: validatedCapital > 0 ? totalTurnover / validatedCapital : 0,
      exposureRatio: cleanedData.length > 0 ? daysInPosition / cleanedData.length : 0,
    },
    configApplied: config,
    diagnostics,
  };
}

export const STRATEGIES: StrategyConfig[] = STRATEGY_TYPES.map((type) => ({
  name: STRATEGY_LABELS[type],
  type,
  params: { ...STRATEGY_DEFAULT_PARAMS[type] },
}));

export function getDefaultParamsForStrategy(type: StrategyType): Record<string, number> {
  return { ...STRATEGY_DEFAULT_PARAMS[type] };
}

export function getParamKeysForStrategy(type: StrategyType): string[] {
  return [...STRATEGY_PARAM_KEYS[type]];
}
