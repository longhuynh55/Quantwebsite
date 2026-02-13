# QuantVN Library Documentation

A comprehensive TypeScript library for quantitative finance analysis, providing technical indicators, backtesting capabilities, portfolio optimization, risk metrics, and factor investing tools.

---

## Table of Contents

1. [Technical Indicators](#1-technical-indicators)
2. [Backtesting Engine](#2-backtesting-engine)
3. [Portfolio Optimization](#3-portfolio-optimization)
4. [Risk Calculations](#4-risk-calculations)
5. [Factor Investing](#5-factor-investing)

---

## 1. Technical Indicators

**Module:** `src/lib/quant/indicators.ts`

### Overview

The indicators module provides optimized implementations of common technical analysis indicators. All functions use O(n) algorithms where applicable and handle edge cases gracefully.

### Interfaces

#### OHLCV

```typescript
interface OHLCV {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
}
```

Standard OHLCV candlestick data structure.

---

### Functions

#### calculateSMA

Calculates the Simple Moving Average using an optimized O(n) sliding window algorithm.

```typescript
function calculateSMA(prices: number[], period: number): (number | null)[]
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `prices` | `number[]` | Array of price values (typically closing prices) |
| `period` | `number` | Lookback period for the moving average |

**Returns:** `(number | null)[]` - Array of SMA values. Returns `null` for periods where insufficient data exists.

**Mathematical Formula:**
```
SMA_t = (P_t-n+1 + P_t-n+2 + ... + P_t) / n
```

where `n` is the period and `P` represents prices.

**Example:**
```typescript
import { calculateSMA } from './indicators';

const prices = [10, 12, 15, 14, 16, 18, 17, 19, 21, 20];
const sma = calculateSMA(prices, 5);
// Result: [null, null, null, null, 13.4, 15, 16, 16.8, 18.2, 19]
```

**Edge Cases:**
- Empty prices array returns empty array
- Invalid period (<=0) returns empty array
- Prices length < period returns array of nulls

---

#### calculateEMA

Calculates the Exponential Moving Average, giving more weight to recent prices.

```typescript
function calculateEMA(prices: number[], period: number): (number | null)[]
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `prices` | `number[]` | Array of price values |
| `period` | `number` | Lookback period for EMA calculation |

**Returns:** `(number | null)[]` - Array of EMA values

**Mathematical Formula:**
```
EMA_t = (P_t - EMA_t-1) * k + EMA_t-1
k = 2 / (n + 1)
```

where `k` is the smoothing multiplier and `n` is the period.

**Example:**
```typescript
import { calculateEMA } from './indicators';

const prices = [10, 12, 15, 14, 16, 18, 17, 19, 21, 20];
const ema = calculateEMA(prices, 5);
// First EMA value uses SMA, then applies exponential smoothing
```

**Edge Cases:**
- Uses SMA for the first EMA value as a starting point
- Returns null for periods with insufficient data

---

#### calculateRSI

Calculates the Relative Strength Index, a momentum oscillator measuring overbought/oversold conditions.

```typescript
function calculateRSI(prices: number[], period: number = 14): (number | null)[]
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prices` | `number[]` | - | Array of price values |
| `period` | `number` | `14` | RSI period (standard is 14) |

**Returns:** `(number | null)[]` - Array of RSI values (0-100 scale)

**Mathematical Formula:**
```
RS = Average Gain / Average Loss
RSI = 100 - (100 / (1 + RS))
```

Uses Wilder's smoothing method for average gain/loss calculation.

**Example:**
```typescript
import { calculateRSI } from './indicators';

const prices = [/* 20+ daily closing prices */];
const rsi = calculateRSI(prices, 14);

// Interpretation
// RSI > 70: Potentially overbought
// RSI < 30: Potentially oversold
```

**Edge Cases:**
- When `avgLoss = 0` (all gains), returns RSI = 100
- Division by zero is handled explicitly

---

#### calculateMACD

Calculates Moving Average Convergence Divergence with signal line and histogram.

```typescript
function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] }
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prices` | `number[]` | - | Array of price values |
| `fastPeriod` | `number` | `12` | Fast EMA period |
| `slowPeriod` | `number` | `26` | Slow EMA period |
| `signalPeriod` | `number` | `9` | Signal line period |

**Returns:**
```typescript
{
  macd: (number | null)[];      // MACD line (fast EMA - slow EMA)
  signal: (number | null)[];    // Signal line (EMA of MACD)
  histogram: (number | null)[]  // MACD - Signal (momentum indicator)
}
```

**Mathematical Formula:**
```
MACD = EMA_fast - EMA_slow
Signal = EMA(MACD, signalPeriod)
Histogram = MACD - Signal
```

**Example:**
```typescript
import { calculateMACD } from './indicators';

const prices = [/* price history */];
const { macd, signal, histogram } = calculateMACD(prices);

// Bullish signal: MACD crosses above signal
// Bearish signal: MACD crosses below signal
```

---

#### calculateBollingerBands

Calculates Bollinger Bands for volatility-based trading signals.

```typescript
function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] }
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prices` | `number[]` | - | Array of price values |
| `period` | `number` | `20` | SMA period for middle band |
| `stdDev` | `number` | `2` | Standard deviation multiplier |

**Returns:**
```typescript
{
  upper: (number | null)[];   // Upper band (middle + stdDev * SD)
  middle: (number | null)[];  // Middle band (SMA)
  lower: (number | null)[];   // Lower band (middle - stdDev * SD)
}
```

**Mathematical Formula:**
```
Middle = SMA(prices, period)
SD = StandardDeviation(prices, period)
Upper = Middle + (stdDev * SD)
Lower = Middle - (stdDev * SD)
```

**Example:**
```typescript
import { calculateBollingerBands } from './indicators';

const prices = [/* price history */];
const { upper, middle, lower } = calculateBollingerBands(prices, 20, 2);

// Price near upper band: potentially overbought
// Price near lower band: potentially oversold
// Band width indicates volatility
```

---

#### calculateATR

Calculates Average True Range, a measure of market volatility.

```typescript
function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): (number | null)[]
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `highs` | `number[]` | - | Array of high prices |
| `lows` | `number[]` | - | Array of low prices |
| `closes` | `number[]` | - | Array of closing prices |
| `period` | `number` | `14` | ATR period |

**Returns:** `(number | null)[]` - Array of ATR values

**Mathematical Formula:**
```
TR = max(H - L, |H - C_prev|, |L - C_prev|)
ATR = SMA(TR, period) or EMA(TR, period)
```

where TR is True Range.

**Example:**
```typescript
import { calculateATR } from './indicators';

const highs = [52, 54, 53, 56, 55];
const lows = [48, 50, 49, 52, 51];
const closes = [50, 52, 51, 54, 53];
const atr = calculateATR(highs, lows, closes, 14);
```

**Limitations:**
- Requires equal-length arrays for highs, lows, and closes
- First TR uses only H-L (no previous close available)

---

#### calculateVolatility

Calculates annualized historical volatility.

```typescript
function calculateVolatility(prices: number[], period: number = 63): number
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prices` | `number[]` | - | Array of price values |
| `period` | `number` | `63` | Lookback period (~3 months of trading days) |

**Returns:** `number` - Annualized volatility (decimal form, e.g., 0.25 = 25%)

**Mathematical Formula:**
```
r_t = (P_t - P_t-1) / P_t-1
σ_daily = sqrt(Variance(returns))
σ_annual = σ_daily * sqrt(252)
```

**Example:**
```typescript
import { calculateVolatility } from './indicators';

const prices = [/* 63+ daily closing prices */];
const vol = calculateVolatility(prices, 63);
console.log(`Annualized volatility: ${(vol * 100).toFixed(2)}%`);
```

**Edge Cases:**
- Requires at least `period + 1` price points
- Returns 0 for insufficient data

---

## 2. Backtesting Engine

**Module:** `src/lib/quant/backtest.ts`

### Overview

The backtesting module provides a complete framework for testing trading strategies against historical data. It includes multiple built-in strategies, comprehensive performance metrics, and trade-level analysis.

### Interfaces

#### Trade

```typescript
interface Trade {
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  type: "long" | "short";
  pnl: number;          // Profit/loss in currency
  pnlPercent: number;   // Profit/loss as percentage
}
```

#### BacktestResult

```typescript
interface BacktestResult {
  trades: Trade[];
  equityCurve: { date: Date; equity: number }[];
  metrics: {
    totalReturn: number;      // Total return as decimal
    cagr: number;             // Compound annual growth rate
    sharpeRatio: number;      // Risk-adjusted return
    sortinoRatio: number;     // Downside risk-adjusted return
    maxDrawdown: number;      // Maximum peak-to-trough decline
    maxDrawdownDuration: number; // Duration of max drawdown in days
    winRate: number;          // Percentage of winning trades
    profitFactor: number;     // Gross profit / gross loss
    totalTrades: number;
    avgReturn: number;        // Average trade return
    avgWin: number;           // Average winning trade return
    avgLoss: number;          // Average losing trade return
    bestTrade: number;        // Best single trade return
    worstTrade: number;       // Worst single trade return
  };
}
```

#### StrategyConfig

```typescript
interface StrategyConfig {
  name: string;
  type: "sma_crossover" | "ema_crossover" | "rsi_mean_reversion" |
        "bollinger_bands" | "momentum";
  params: Record<string, number>;
}
```

---

### Functions

#### runBacktest

Executes a backtest for a given strategy on historical data.

```typescript
function runBacktest(
  data: OHLCV[],
  strategy: StrategyConfig,
  initialCapital: number = 100000
): BacktestResult
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `data` | `OHLCV[]` | - | Historical OHLCV data |
| `strategy` | `StrategyConfig` | - | Strategy configuration |
| `initialCapital` | `number` | `100000` | Starting capital |

**Returns:** `BacktestResult` - Complete backtest results with trades and metrics

**Supported Strategies:**

| Strategy | Type | Parameters |
|----------|------|------------|
| SMA Crossover | `sma_crossover` | `shortPeriod`, `longPeriod` |
| EMA Crossover | `ema_crossover` | `shortPeriod`, `longPeriod` |
| RSI Mean Reversion | `rsi_mean_reversion` | `period`, `oversold`, `overbought` |
| Bollinger Bands | `bollinger_bands` | `period`, `stdDev` |
| Momentum | `momentum` | `lookback`, `threshold` |

**Example:**
```typescript
import { runBacktest, STRATEGIES } from './backtest';

// Use predefined strategy
const result = runBacktest(historicalData, STRATEGIES[0], 100000);

// Custom strategy configuration
const customStrategy: StrategyConfig = {
  name: "Custom SMA",
  type: "sma_crossover",
  params: {
    shortPeriod: 5,
    longPeriod: 20
  }
};

const result = runBacktest(historicalData, customStrategy, 50000);

// Access results
console.log(`Total Return: ${(result.metrics.totalReturn * 100).toFixed(2)}%`);
console.log(`Sharpe Ratio: ${result.metrics.sharpeRatio.toFixed(2)}`);
console.log(`Max Drawdown: ${(result.metrics.maxDrawdown * 100).toFixed(2)}%`);
console.log(`Total Trades: ${result.metrics.totalTrades}`);
```

**Strategy Signal Logic:**

1. **SMA/EMA Crossover:**
   - Buy: Short MA crosses above long MA
   - Sell: Short MA crosses below long MA

2. **RSI Mean Reversion:**
   - Buy: RSI crosses above oversold level (default 30)
   - Sell: RSI crosses below overbought level (default 70)

3. **Bollinger Bands:**
   - Buy: Price crosses above lower band from below
   - Sell: Price crosses below upper band from above

4. **Momentum:**
   - Buy: Momentum > threshold (default 5%)
   - Sell: Momentum < -threshold

---

### Constants

#### STRATEGIES

Predefined strategy configurations:

```typescript
const STRATEGIES: StrategyConfig[] = [
  { name: "SMA Crossover", type: "sma_crossover", params: { shortPeriod: 10, longPeriod: 20 } },
  { name: "EMA Crossover", type: "ema_crossover", params: { shortPeriod: 10, longPeriod: 20 } },
  { name: "RSI Mean Reversion", type: "rsi_mean_reversion", params: { period: 14, oversold: 30, overbought: 70 } },
  { name: "Bollinger Band Breakout", type: "bollinger_bands", params: { period: 20, stdDev: 2 } },
  { name: "Momentum Strategy", type: "momentum", params: { lookback: 20, threshold: 0.05 } },
];
```

---

### Internal Functions

These helper functions are used internally but documented for reference:

#### calculateSharpeRatio

```typescript
function calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number
```

**Formula:**
```
Sharpe = (R_annual - R_f) / σ_annual
```

#### calculateSortinoRatio

```typescript
function calculateSortinoRatio(returns: number[], riskFreeRate: number = 0.02): number
```

**Formula:**
```
Sortino = (R_annual - R_f) / σ_downside
```

Returns 999 (large finite number) when no negative returns exist.

#### calculateMaxDrawdown

```typescript
function calculateMaxDrawdown(equityCurve: number[]): { maxDrawdown: number; duration: number }
```

---

## 3. Portfolio Optimization

**Module:** `src/lib/quant/portfolio.ts`

### Overview

The portfolio module provides tools for multi-asset portfolio optimization using various allocation methods. It calculates expected returns, volatilities, and correlations to construct optimal portfolios.

### Interfaces

#### AssetStats

```typescript
interface AssetStats {
  symbol: string;
  returns: number[];
  meanReturn: number;   // Annualized mean return
  volatility: number;   // Annualized volatility
}
```

#### OptimizationResult

```typescript
interface OptimizationResult {
  method: string;
  allocations: {
    symbol: string;
    weight: number;
    expectedReturn: number;
  }[];
  expectedReturn: number;    // Portfolio expected return (annualized)
  volatility: number;        // Portfolio volatility (annualized)
  sharpeRatio: number;       // Portfolio Sharpe ratio
  correlationMatrix: {
    symbols: string[];
    matrix: number[][];
  };
  assetStats: {
    symbol: string;
    meanReturn: number;
    volatility: number;
  }[];
}
```

---

### Functions

#### optimizePortfolio

Optimizes portfolio allocation using the specified method.

```typescript
function optimizePortfolio(
  data: Record<string, OHLCV[]>,
  symbols: string[],
  method: string = "mean_variance"
): OptimizationResult
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `data` | `Record<string, OHLCV[]>` | - | Price data keyed by symbol |
| `symbols` | `string[]` | - | Array of symbols to include |
| `method` | `string` | `"mean_variance"` | Optimization method |

**Returns:** `OptimizationResult` - Complete optimization results

**Supported Methods:**

| Method | Description |
|--------|-------------|
| `mean_variance` | Weights proportional to Sharpe ratio |
| `equal_weight` | Equal allocation across all assets |
| `risk_parity` | Weights inversely proportional to volatility |

**Example:**
```typescript
import { optimizePortfolio } from './portfolio';

const priceData = {
  'AAPL': aaplOhlcvData,
  'MSFT': msftOhlcvData,
  'GOOGL': googlOhlcvData
};

// Mean-variance optimization
const result = optimizePortfolio(priceData, ['AAPL', 'MSFT', 'GOOGL'], 'mean_variance');

console.log(`Expected Return: ${(result.expectedReturn * 100).toFixed(2)}%`);
console.log(`Volatility: ${(result.volatility * 100).toFixed(2)}%`);
console.log(`Sharpe Ratio: ${result.sharpeRatio.toFixed(2)}`);

// View allocations
result.allocations.forEach(a => {
  console.log(`${a.symbol}: ${(a.weight * 100).toFixed(1)}%`);
});

// Risk parity optimization
const riskParityResult = optimizePortfolio(priceData, ['AAPL', 'MSFT', 'GOOGL'], 'risk_parity');

// Equal weight
const equalWeightResult = optimizePortfolio(priceData, ['AAPL', 'MSFT', 'GOOGL'], 'equal_weight');
```

**Method Details:**

1. **Mean-Variance (`mean_variance`):**
   ```
   weight_i = max(0, Sharpe_i - min(Sharpe) + 0.1) / sum
   ```
   Allocates more to assets with higher risk-adjusted returns.

2. **Risk Parity (`risk_parity`):**
   ```
   weight_i = (1/σ_i) / sum(1/σ_j)
   ```
   Equalizes risk contribution from each asset.

3. **Equal Weight (`equal_weight`):**
   ```
   weight_i = 1/n
   ```
   Simple equal allocation.

**Requirements:**
- Minimum 2 valid symbols with at least 100 data points each
- Throws error if insufficient valid data

**Mathematical Formulas:**

Portfolio Return:
```
R_p = sum(w_i * R_i)
```

Portfolio Variance:
```
σ²_p = sum_i sum_j (w_i * w_j * σ_i * σ_j * ρ_ij)
```

Correlation:
```
ρ_ij = Cov(R_i, R_j) / (σ_i * σ_j)
```

---

## 4. Risk Calculations

**Module:** `src/lib/quant/risk.ts`

### Overview

The risk module provides comprehensive risk metrics including Value at Risk (VaR), Conditional VaR, drawdown analysis, volatility measures, and benchmark-relative metrics.

### Interfaces

#### RiskMetrics

```typescript
interface RiskMetrics {
  var95: number;            // 95% Value at Risk
  var99: number;            // 99% Value at Risk
  cvar95: number;           // 95% Conditional VaR (Expected Shortfall)
  cvar99: number;           // 99% Conditional VaR
  maxDrawdown: number;      // Maximum drawdown
  avgDrawdown: number;      // Average drawdown
  drawdownDuration: number; // Maximum drawdown duration (days)
  volatility: number;       // Annualized volatility
  beta: number;             // Beta vs benchmark
  trackingError: number;    // Annualized tracking error
  informationRatio: number; // Information ratio vs benchmark
}
```

---

### Functions

#### calculateRiskMetrics

Calculates comprehensive risk metrics for a price series.

```typescript
function calculateRiskMetrics(
  prices: number[],
  benchmarkPrices?: number[]
): RiskMetrics
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `prices` | `number[]` | Asset price history |
| `benchmarkPrices` | `number[]` | Optional benchmark prices for relative metrics |

**Returns:** `RiskMetrics` - Complete risk analysis

**Example:**
```typescript
import { calculateRiskMetrics } from './risk';

const assetPrices = [/* daily closing prices */];
const spyPrices = [/* SPY daily closing prices */];

// Standalone risk metrics
const risk = calculateRiskMetrics(assetPrices);
console.log(`95% VaR: ${(risk.var95 * 100).toFixed(2)}%`);
console.log(`Max Drawdown: ${(risk.maxDrawdown * 100).toFixed(2)}%`);
console.log(`Volatility: ${(risk.volatility * 100).toFixed(2)}%`);

// With benchmark
const riskVsBenchmark = calculateRiskMetrics(assetPrices, spyPrices);
console.log(`Beta: ${riskVsBenchmark.beta.toFixed(2)}`);
console.log(`Information Ratio: ${riskVsBenchmark.informationRatio.toFixed(2)}`);
console.log(`Tracking Error: ${(riskVsBenchmark.trackingError * 100).toFixed(2)}%`);
```

**Metric Definitions:**

| Metric | Formula | Description |
|--------|---------|-------------|
| VaR (95%) | Percentile(5%, returns) | 5% worst-case daily loss |
| VaR (99%) | Percentile(1%, returns) | 1% worst-case daily loss |
| CVaR (95%) | E[return \| return < VaR_95] | Average of losses beyond VaR |
| Max Drawdown | max((peak - price) / peak) | Largest peak-to-trough decline |
| Beta | Cov(R_asset, R_bench) / Var(R_bench) | Systematic risk |
| Tracking Error | sqrt(252) * std(R_asset - R_bench) | Active risk |
| Information Ratio | (R_asset - R_bench) / TE | Risk-adjusted active return |

---

#### calculateDrawdown

Calculates drawdown series and statistics.

```typescript
function calculateDrawdown(prices: number[]): {
  drawdowns: { drawdown: number; duration: number }[];
  maxDrawdown: number;
  maxDuration: number;
}
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `prices` | `number[]` | Price history |

**Returns:**
```typescript
{
  drawdowns: { drawdown: number; duration: number }[];  // Per-period drawdowns
  maxDrawdown: number;   // Maximum drawdown value
  maxDuration: number;   // Maximum drawdown duration (periods)
}
```

**Example:**
```typescript
import { calculateDrawdown } from './risk';

const prices = [100, 105, 110, 95, 90, 100, 105, 115];
const { drawdowns, maxDrawdown, maxDuration } = calculateDrawdown(prices);

console.log(`Max Drawdown: ${(maxDrawdown * 100).toFixed(2)}%`);
console.log(`Recovery Period: ${maxDuration} days`);
```

---

#### calculateRollingVolatility

Calculates rolling annualized volatility.

```typescript
function calculateRollingVolatility(prices: number[], window: number = 21): number[]
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prices` | `number[]` | - | Price history |
| `window` | `number` | `21` | Rolling window (default: 1 month) |

**Returns:** `number[]` - Array of annualized volatility values

**Example:**
```typescript
import { calculateRollingVolatility } from './risk';

const prices = [/* price history */];
const rollingVol = calculateRollingVolatility(prices, 21);

// Identify volatility spikes
rollingVol.forEach((vol, i) => {
  if (vol > 0.5) {
    console.log(`High volatility at day ${i}: ${(vol * 100).toFixed(1)}%`);
  }
});
```

---

### Internal Functions

#### calculateVaR

```typescript
function calculateVaR(returns: number[], confidence: number): number
```

Historical VaR calculation using the percentile method.

#### calculateCVaR

```typescript
function calculateCVaR(returns: number[], confidence: number): number
```

Expected Shortfall (CVaR) - average of tail losses.

#### calculateBeta

```typescript
function calculateBeta(assetReturns: number[], marketReturns: number[]): number
```

Covariance-based beta calculation.

---

## 5. Factor Investing

**Module:** `src/lib/quant/factors.ts`

### Overview

The factors module implements multi-factor analysis for equity selection. It calculates momentum, value, volatility, and size factors, then provides tools for ranking and portfolio construction.

### Interfaces

#### FactorExposure

```typescript
interface FactorExposure {
  symbol: string;
  momentum: number;    // 12-month momentum excluding last month
  value: number;       // Price relative to 200-day SMA (negative)
  volatility: number;  // Low volatility factor (negative)
  size: number;        // Size factor based on volume (negative)
  overall: number;     // Average of all factors
}
```

**Note:** All factors are signed such that **higher values indicate more favorable characteristics**:
- Positive momentum = strong price appreciation
- Positive value = undervalued relative to SMA
- Positive volatility factor = low volatility
- Positive size factor = small/illiquid

---

### Functions

#### calculateMomentum

Calculates 12-month momentum excluding the most recent month (to avoid short-term reversals).

```typescript
function calculateMomentum(prices: number[]): number
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `prices` | `number[]` | Price history (minimum 274 days) |

**Returns:** `number` - Momentum factor value

**Mathematical Formula:**
```
Momentum = (P_t-21 - P_t-252) / P_t-252
```

**Example:**
```typescript
import { calculateMomentum } from './factors';

const prices = [/* 274+ daily prices */];
const momentum = calculateMomentum(prices);
// Returns 12-month momentum excluding last month
```

**Requirements:** Minimum 274 price points (252 + 21 + 1)

---

#### calculateVolatilityFactor

Calculates low volatility factor (inverted volatility).

```typescript
function calculateVolatilityFactor(prices: number[], period: number = 63): number
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prices` | `number[]` | - | Price history |
| `period` | `number` | `63` | Volatility lookback period |

**Returns:** `number` - Negative volatility (higher = lower volatility)

**Mathematical Formula:**
```
σ_annual = sqrt(252 * Var(daily_returns))
Factor = -σ_annual
```

---

#### calculateSizeFactor

Calculates size factor based on trading volume (inverse).

```typescript
function calculateSizeFactor(volumes: number[], period: number = 63): number
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `volumes` | `number[]` | - | Volume history |
| `period` | `number` | `63` | Average volume period |

**Returns:** `number` - Size factor (higher = smaller/more illiquid)

**Mathematical Formula:**
```
Size = -ln(average_volume + 1)
```

---

#### calculateValueProxy

Calculates value factor using price relative to 200-day SMA.

```typescript
function calculateValueProxy(prices: number[]): number
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `prices` | `number[]` | Price history (minimum 200 days) |

**Returns:** `number` - Value factor (higher = more undervalued)

**Mathematical Formula:**
```
Value = -(P_t / SMA_200 - 1)
```

---

#### calculateFactorExposures

Calculates all factor exposures for a single asset.

```typescript
function calculateFactorExposures(symbol: string, ohlcv: OHLCV[]): FactorExposure
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `symbol` | `string` | Asset symbol |
| `ohlcv` | `OHLCV[]` | OHLCV data history |

**Returns:** `FactorExposure` - Complete factor analysis

**Example:**
```typescript
import { calculateFactorExposures } from './factors';

const exposures = calculateFactorExposures('AAPL', aaplOhlcvData);
console.log(`Momentum: ${exposures.momentum.toFixed(3)}`);
console.log(`Value: ${exposures.value.toFixed(3)}`);
console.log(`Overall: ${exposures.overall.toFixed(3)}`);
```

---

#### rankByFactor

Ranks assets by a specific factor.

```typescript
function rankByFactor(
  exposures: FactorExposure[],
  factor: keyof Omit<FactorExposure, "symbol" | "overall">
): FactorExposure[]
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `exposures` | `FactorExposure[]` | Array of factor exposures |
| `factor` | `keyof Omit<FactorExposure, "symbol" \| "overall">` | Factor to rank by |

**Returns:** `FactorExposure[]` - Sorted array (highest first)

**Example:**
```typescript
import { calculateFactorExposures, rankByFactor } from './factors';

const exposures = symbols.map(s => calculateFactorExposures(s, data[s]));

// Rank by momentum
const momentumRanked = rankByFactor(exposures, 'momentum');
console.log('Top momentum stocks:', momentumRanked.slice(0, 5).map(e => e.symbol));

// Rank by overall score
const overallRanked = rankByFactor(exposures, 'value');
```

---

#### createFactorPortfolios

Creates top/bottom portfolios based on factor ranking.

```typescript
function createFactorPortfolios(
  exposures: FactorExposure[],
  factor: keyof Omit<FactorExposure, "symbol" | "overall">,
  percentile: number = 0.2
): { top: string[]; bottom: string[] }
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `exposures` | `FactorExposure[]` | - | Array of factor exposures |
| `factor` | `keyof Omit<...>` | - | Factor to sort by |
| `percentile` | `number` | `0.2` | Top/bottom percentage (default: quintiles) |

**Returns:**
```typescript
{
  top: string[];     // Top percentile symbols
  bottom: string[];  // Bottom percentile symbols
}
```

**Example:**
```typescript
import { calculateFactorExposures, createFactorPortfolios } from './factors';

const exposures = symbols.map(s => calculateFactorExposures(s, data[s]));

// Create momentum quintile portfolios
const { top, bottom } = createFactorPortfolios(exposures, 'momentum', 0.2);

console.log('High momentum:', top);
console.log('Low momentum:', bottom);

// Long-short strategy: long top, short bottom
```

---

## Usage Examples

### Complete Backtest Workflow

```typescript
import { runBacktest, STRATEGIES } from './backtest';
import { calculateRiskMetrics } from './risk';

// Load historical data
const historicalData: OHLCV[] = loadData();

// Run multiple strategies
const results = STRATEGIES.map(strategy => ({
  strategy: strategy.name,
  result: runBacktest(historicalData, strategy, 100000)
}));

// Compare performance
results.forEach(({ strategy, result }) => {
  console.log(`${strategy}:`);
  console.log(`  Return: ${(result.metrics.totalReturn * 100).toFixed(1)}%`);
  console.log(`  Sharpe: ${result.metrics.sharpeRatio.toFixed(2)}`);
  console.log(`  Max DD: ${(result.metrics.maxDrawdown * 100).toFixed(1)}%`);
});
```

### Multi-Asset Portfolio Optimization

```typescript
import { optimizePortfolio } from './portfolio';

const assets = {
  'SPY': spyData,
  'TLT': tltData,
  'GLD': gldData,
  'VNQ': vnqData
};

// Optimize for maximum Sharpe ratio
const result = optimizePortfolio(assets, Object.keys(assets), 'mean_variance');

console.log('Optimal Portfolio:');
result.allocations.forEach(a => {
  if (a.weight > 0.01) {
    console.log(`  ${a.symbol}: ${(a.weight * 100).toFixed(1)}%`);
  }
});

console.log(`Expected Return: ${(result.expectedReturn * 100).toFixed(1)}%`);
console.log(`Expected Volatility: ${(result.volatility * 100).toFixed(1)}%`);
console.log(`Sharpe Ratio: ${result.sharpeRatio.toFixed(2)}`);
```

### Factor-Based Stock Selection

```typescript
import { calculateFactorExposures, createFactorPortfolios } from './factors';

const universe = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA'];

const exposures = universe.map(symbol => {
  const data = loadData(symbol);
  return calculateFactorExposures(symbol, data);
});

// Create long-only momentum portfolio
const { top } = createFactorPortfolios(exposures, 'momentum', 0.3);
console.log('Top 30% momentum stocks:', top);

// Multi-factor screen (positive overall score)
const qualityStocks = exposures.filter(e => e.overall > 0);
console.log('Quality stocks:', qualityStocks.map(e => e.symbol));
```

---

## Performance Characteristics

| Function | Time Complexity | Space Complexity |
|----------|----------------|------------------|
| calculateSMA | O(n) | O(n) |
| calculateEMA | O(n) | O(n) |
| calculateRSI | O(n) | O(n) |
| calculateMACD | O(n) | O(n) |
| calculateBollingerBands | O(n * period) | O(n) |
| calculateATR | O(n) | O(n) |
| runBacktest | O(n) | O(n) |
| optimizePortfolio | O(n * m^2) | O(m^2) |
| calculateRiskMetrics | O(n log n) | O(n) |
| calculateFactorExposures | O(n) | O(1) |

Where `n` = data points, `m` = number of assets.

---

## Limitations and Considerations

1. **Data Requirements:**
   - Most functions require at least 100+ data points for meaningful results
   - Factor calculations require 200-274 days of history
   - Portfolio optimization requires equal-length series across assets

2. **Numerical Stability:**
   - Division by zero is handled throughout
   - Large values (999) used instead of Infinity for JSON serialization
   - Null values returned for periods with insufficient data

3. **Assumptions:**
   - 252 trading days per year for annualization
   - Daily data frequency assumed
   - Long-only backtesting (no short positions)

4. **Not Implemented:**
   - Transaction costs in backtesting
   - Slippage modeling
   - Portfolio rebalancing
   - Factor regression analysis

---

## Version History

- **v1.0.0** - Initial release with core indicators, backtesting, portfolio optimization, risk metrics, and factor analysis

---

*Documentation generated for QuantVN Library - Quantitative Finance Toolkit*
