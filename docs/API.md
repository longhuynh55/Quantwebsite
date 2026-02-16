# QuantVN API Documentation

This document provides comprehensive documentation for all QuantVN API endpoints. The API follows RESTful conventions and returns JSON responses.

**Base URL:** `/api`

---

## Table of Contents

1. [Stocks API](#stocks-api)
2. [Fundamentals API](#fundamentals-api)
3. [Backtesting API](#backtesting-api)
4. [Portfolio Optimization API](#portfolio-optimization-api)
5. [Risk Analysis API](#risk-analysis-api)
6. [Factor Analysis API](#factor-analysis-api)
7. [Market Overview API](#market-overview-api)
8. [Data Health API](#data-health-api)
9. [Error Handling](#error-handling)
10. [Rate Limiting](#rate-limiting)

---

## Stocks API

Retrieve stock metadata and historical OHLCV (Open, High, Low, Close, Volume) data.

### Endpoint

```
GET /api/stocks
```

### Request Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| `symbol`  | string | No       | -       | Stock symbol (1-10 uppercase letters). If omitted, returns stock metadata list. |
| `search`  | string | No       | -       | Filter the stock list by symbol substring (ignored when `symbol` is provided). |
| `limit`   | number \| string | No | 100     | Maximum number of results to return (1-1000) or `"all"`. |

### Response Format

#### TypeScript Interfaces

```typescript
// Response when symbol is provided
interface StockOHLCVResponse {
  symbol: string;
  metadata: StockMetadata | null;
  data: OHLCV[];
  total: number;
}

// Response when symbol is omitted
interface StockMetadataResponse {
  stocks: StockMetadata[];
  total: number;
}

interface OHLCV {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StockMetadata {
  symbol: string;
  exchange: string;
  status: string;
  dataRows: number;
  source: string;
  firstDate: Date;
  lastDate: Date;
  totalTradingDays: number;
  avgVolume: number;
  listingPhase: string;
  organName?: string;
  icbName4?: string;
}
```

### Example Requests

**Get all stocks metadata:**
```bash
curl "https://quantvn.example.com/api/stocks?limit=50"
```

**Get specific stock OHLCV data:**
```bash
curl "https://quantvn.example.com/api/stocks?symbol=VNM&limit=252"
```

### Example Responses

**Stock metadata list:**
```json
{
  "stocks": [
    {
      "symbol": "VNM",
      "exchange": "HOSE",
      "status": "ACTIVE",
      "dataRows": 1999,
      "avgVolume": 1500000,
      "listingPhase": "FULL_PERIOD",
      "icbName4": "Food"
    }
  ],
  "total": 367
}
```

**Stock OHLCV data:**
```json
{
  "symbol": "VNM",
  "metadata": {
    "symbol": "VNM",
    "exchange": "HOSE",
    "status": "ACTIVE",
    "dataRows": 1999,
    "avgVolume": 1500000,
    "listingPhase": "FULL_PERIOD",
    "icbName4": "Food"
  },
  "data": [
    {
      "date": "2024-01-15T00:00:00.000Z",
      "open": 85000,
      "high": 86500,
      "low": 84500,
      "close": 86000,
      "volume": 1250000
    }
  ],
  "total": 1999
}
```

### Error Codes

| Status Code | Message                                        | Description                                |
|-------------|------------------------------------------------|--------------------------------------------|
| 400         | `Limit must be between 1 and 1000, or "all"`   | Invalid limit parameter                    |
| 400         | `Invalid symbol format...`                     | Symbol format validation failed            |
| 404         | `Symbol not found`                             | Requested symbol does not exist            |
| 429         | `Too many requests. Please try again later.`   | Rate limit exceeded                        |
| 500         | `Failed to load stock data`                    | Internal server error                      |

### Rate Limiting

- **Limit:** 100 requests per minute
- **Headers:** `Retry-After` header included on 429 responses

---

## Fundamentals API

Retrieve quarterly financial statements (Balance Sheet / Income Statement / Cash Flow) for a stock symbol.

### Endpoint

```
GET /api/fundamentals
```

### Request Parameters

| Parameter | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `symbol` | string | Yes | - | Stock symbol (1-10 uppercase letters). |
| `period` | string | No | `latest` | `latest` or `YYYYQn` (e.g., `2025Q4`). |
| `statement` | string | No | `all` | `all`, `bs`, `is`, or `cf`. |

### Response Format

```typescript
type StatementObject = Record<string, number | null | string>;

interface FundamentalsResponse {
  symbol: string;
  period: string; // e.g. "2025Q4"
  availablePeriods: string[];
  balanceSheet: StatementObject | null;
  incomeStatement: StatementObject | null;
  cashFlow: StatementObject | null;
  meta: {
    sourceFiles: {
      balanceSheet: string;
      incomeStatement: string;
      cashFlow: string;
    };
    fieldNotes: string;
  };
}
```

### Example Request

```bash
curl "https://quantvn.example.com/api/fundamentals?symbol=AAA&period=latest&statement=all"
```

### Error Codes

| Status Code | Message | Description |
|------------|---------|-------------|
| 400 | `symbol is required` | Missing required parameter |
| 400 | `Invalid symbol format...` | Symbol format validation failed |
| 400 | `Invalid period...` | Invalid period parameter |
| 404 | `No fundamentals available for this symbol` | No data for symbol |
| 429 | `Too many requests. Please try again later.` | Rate limit exceeded |
| 503 | `...file not found...` | Fundamentals dataset missing on server |
| 500 | `Failed to load fundamentals` | Internal server error |

### Rate Limiting

- **Limit:** 60 requests per minute
- **Headers:** `Retry-After` header included on 429 responses

---

## Backtesting API

Run backtests on trading strategies with historical data.

### Endpoints

```
GET /api/backtesting
POST /api/backtesting
```

### Request Parameters

#### GET Parameters

| Parameter  | Type   | Required | Default   | Description                                           |
|------------|--------|----------|-----------|-------------------------------------------------------|
| `symbol`   | string | Yes      | -         | Stock symbol (1-10 uppercase letters)                 |
| `strategy` | string | Yes      | -         | Trading strategy type                                 |
| `capital`  | number | No       | 100000    | Initial capital (1 - 1e12)                            |
| `executionModel` | string | No | `next_open` | `next_open` or `same_close`                         |
| `feeBps` | number | No | `15` | Fee in basis points per side                             |
| `sellTaxBps` | number | No | `10` | Sell tax in basis points                                 |
| `slippageBps` | number | No | `5` | Slippage in basis points per side                        |
| `lotSize` | number | No | `1` | Share lot size used by all-in sizing                     |
| `shortPeriod` / `longPeriod` / etc. | number | No | strategy defaults | Optional strategy params via query |

#### POST Body

```typescript
interface BacktestRequest {
  symbol: string;      // Required: Stock symbol (1-10 uppercase letters)
  strategy: string;    // Required: Trading strategy type
  capital?: number;    // Optional: Initial capital (default: 100000)
  params?: Record<string, number>; // Optional: Strategy-specific parameters
  executionModel?: "next_open" | "same_close";
  feeBps?: number;
  sellTaxBps?: number;
  slippageBps?: number;
  lotSize?: number;
}
```

### Valid Strategies

| Strategy               | Description                              |
|------------------------|------------------------------------------|
| `sma_crossover`        | Simple Moving Average Crossover          |
| `ema_crossover`        | Exponential Moving Average Crossover     |
| `rsi_mean_reversion`   | RSI Mean Reversion                       |
| `bollinger_bands`      | Bollinger Bands Strategy                 |
| `momentum`             | Momentum Strategy                        |

### Response Format

```typescript
interface BacktestResponse {
  symbol: string;
  strategy: string;
  initialCapital: number;
  metrics: {
    totalReturn: number; // alias of netReturn for backward compatibility
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
  configApplied: {
    executionModel: "next_open" | "same_close";
    costs: { feeBps: number; sellTaxBps: number; slippageBps: number };
    positionSizing: { mode: "all_in"; lotSize: number };
  };
  diagnostics: {
    inputRows: number;
    usableRows: number;
    droppedRows: number;
    coverageRatio: number;
    largestGapDays: number;
    warnings: string[];
  };
  trades: Trade[];
  equityCurve: EquityPoint[];
}

interface Trade {
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  pnl: number;
  pnlPercent: number;
  grossPnl: number;
  totalCosts: number;
  turnover: number;
  forcedExit?: boolean;
}

interface EquityPoint {
  date: Date;
  equity: number;
}
```

### Example Requests

**GET Request:**
```bash
curl "https://quantvn.example.com/api/backtesting?symbol=VNM&strategy=sma_crossover&capital=500000"
```

**POST Request:**
```bash
curl -X POST "https://quantvn.example.com/api/backtesting" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "VNM",
    "strategy": "sma_crossover",
    "capital": 500000,
    "executionModel": "next_open",
    "feeBps": 15,
    "sellTaxBps": 10,
    "slippageBps": 5,
    "params": {
      "shortPeriod": 10,
      "longPeriod": 30
    }
  }'
```

### Example Response

```json
{
  "symbol": "VNM",
  "strategy": "SMA Crossover",
  "initialCapital": 500000,
  "metrics": {
    "totalReturn": 0.21,
    "netReturn": 0.21,
    "grossReturn": 0.24,
    "cagr": 0.16,
    "sharpeRatio": 1.28,
    "maxDrawdown": 0.13,
    "totalTrades": 22,
    "turnover": 3.45,
    "exposureRatio": 0.64
  },
  "configApplied": {
    "executionModel": "next_open",
    "costs": { "feeBps": 15, "sellTaxBps": 10, "slippageBps": 5 },
    "positionSizing": { "mode": "all_in", "lotSize": 1 }
  },
  "diagnostics": {
    "inputRows": 1800,
    "usableRows": 1798,
    "droppedRows": 2,
    "coverageRatio": 0.69,
    "largestGapDays": 6,
    "warnings": []
  },
  "trades": [
    {
      "entryDate": "2024-01-20T00:00:00.000Z",
      "exitDate": "2024-02-15T00:00:00.000Z",
      "entryPrice": 85000,
      "exitPrice": 91000,
      "shares": 50,
      "pnl": 263000,
      "pnlPercent": 0.0619,
      "grossPnl": 300000,
      "totalCosts": 37000,
      "turnover": 8800000
    }
  ],
  "equityCurve": [
    {
      "date": "2024-01-15T00:00:00.000Z",
      "equity": 500000
    }
  ]
}
```

### Error Codes

| Status Code | Message                                                    | Description                           |
|-------------|------------------------------------------------------------|---------------------------------------|
| 400         | `Symbol is required`                                       | Missing symbol parameter              |
| 400         | `Strategy is required`                                     | Missing strategy parameter            |
| 400         | `Invalid symbol format...`                                 | Symbol format validation failed       |
| 400         | `Invalid strategy. Valid options: ...`                     | Invalid strategy type                 |
| 400         | `Invalid strategy parameters: ...`                         | Strategy parameter validation failed  |
| 400         | `Invalid backtest configuration: ...`                      | Execution/cost config validation failed |
| 400         | `Capital must be between 1 and 1e+12`                      | Capital out of valid range            |
| 400         | `Insufficient data for backtesting (minimum 30 data points)`| Not enough historical data           |
| 400         | `Insufficient usable data for backtesting after cleaning...`| Too many invalid/duplicate rows      |
| 400         | `Invalid JSON body`                                        | Malformed JSON in POST body           |
| 404         | `Symbol not found`                                         | Requested symbol does not exist       |
| 415         | `Content-Type must be application/json`                    | Missing/invalid Content-Type header   |
| 429         | `Too many requests. Please try again later.`               | Rate limit exceeded                   |
| 500         | `Failed to run backtest`                                   | Internal server error                 |

### Rate Limiting

- **Limit:** 30 requests per minute (computationally expensive)
- **Headers:** `Retry-After` header included on 429 responses

---

## Portfolio Optimization API

Optimize portfolio allocation using various methods.

### Endpoint

```
POST /api/optimize
```

### Request Body

```typescript
interface OptimizeRequest {
  symbols: string[];  // Required: Array of stock symbols (2-50 symbols)
  method?: string;    // Optional: Optimization method (default: "mean_variance")
}
```

### Valid Methods

| Method           | Description                              |
|------------------|------------------------------------------|
| `mean_variance`  | Mean-Variance Optimization (default)     |
| `risk_parity`    | Risk Parity Optimization                 |
| `equal_weight`   | Equal Weight Allocation                  |

### Response Format

```typescript
interface OptimizeResponse {
  method: string;
  weights: Record<string, number>;
  expectedReturn: number;
  expectedVolatility: number;
  sharpeRatio: number;
}
```

### Example Request

```bash
curl -X POST "https://quantvn.example.com/api/optimize" \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["VNM", "FPT", "VIC", "VHM"],
    "method": "mean_variance"
  }'
```

### Example Response

```json
{
  "method": "mean_variance",
  "weights": {
    "VNM": 0.35,
    "FPT": 0.25,
    "VIC": 0.20,
    "VHM": 0.20
  },
  "expectedReturn": 0.15,
  "expectedVolatility": 0.18,
  "sharpeRatio": 0.83
}
```

### Error Codes

| Status Code | Message                                              | Description                         |
|-------------|------------------------------------------------------|-------------------------------------|
| 400         | `Symbols must be an array`                           | Symbols is not an array             |
| 400         | `At least 2 symbols are required`                    | Insufficient symbols provided       |
| 400         | `Maximum 50 symbols allowed`                         | Too many symbols                    |
| 400         | `Invalid symbol format: ...`                         | Symbol format validation failed     |
| 400         | `Invalid symbol type: ...`                           | Symbol is not a string              |
| 400         | `Duplicate symbols are not allowed`                  | Duplicate symbols in array          |
| 400         | `Invalid optimization method. Valid options: ...`    | Invalid method specified            |
| 400         | `Not enough valid symbols...`                        | Insufficient valid data for symbols |
| 400         | `Invalid JSON body`                                  | Malformed JSON body                 |
| 415         | `Content-Type must be application/json`              | Missing/invalid Content-Type header |
| 429         | `Too many requests. Please try again later.`         | Rate limit exceeded                 |
| 500         | `Failed to optimize portfolio`                       | Internal server error               |

### Rate Limiting

- **Limit:** 30 requests per minute (computationally expensive)
- **Headers:** `Retry-After` header included on 429 responses

---

## Risk Analysis API

Calculate comprehensive risk metrics for a specific stock.

### Endpoint

```
GET /api/risk
```

### Request Parameters

| Parameter   | Type   | Required | Default   | Description                                           |
|-------------|--------|----------|-----------|-------------------------------------------------------|
| `symbol`    | string | Yes      | -         | Stock symbol (1-10 uppercase letters)                 |
| `benchmark` | string | No       | `VNINDEX` | Benchmark index for comparison                        |

### Valid Benchmarks

| Benchmark  | Description              |
|------------|--------------------------|
| `VNINDEX`  | VN-Index (default)       |
| `VN100`    | VN100 Index              |
| `VN30`     | VN30 Index               |

### Response Format

```typescript
interface RiskResponse {
  symbol: string;
  benchmark: string;
  metrics: RiskMetrics;
  drawdowns: DrawdownPoint[];
  rollingVolatility: VolatilityPoint[];
}

interface RiskMetrics {
  volatility: number;           // Annualized volatility
  sharpeRatio: number;          // Sharpe ratio
  sortinoRatio: number;         // Sortino ratio
  maxDrawdown: number;          // Maximum drawdown
  var95: number;                // Value at Risk (95%)
  cvar95: number;               // Conditional VaR (95%)
  beta?: number;                // Beta relative to benchmark
  trackingError?: number;       // Tracking error vs benchmark
  informationRatio?: number;    // Information ratio
}

interface DrawdownPoint {
  date: Date;
  drawdown: number;
}

interface VolatilityPoint {
  date: Date;
  volatility: number;
}
```

### Example Request

```bash
curl "https://quantvn.example.com/api/risk?symbol=VNM&benchmark=VNINDEX"
```

### Example Response

```json
{
  "symbol": "VNM",
  "benchmark": "VNINDEX",
  "metrics": {
    "volatility": 0.28,
    "sharpeRatio": 0.95,
    "sortinoRatio": 1.25,
    "maxDrawdown": -0.32,
    "var95": -0.045,
    "cvar95": -0.062,
    "beta": 0.85,
    "trackingError": 0.12,
    "informationRatio": 0.45
  },
  "drawdowns": [
    {
      "date": "2024-01-15T00:00:00.000Z",
      "drawdown": -0.05
    }
  ],
  "rollingVolatility": [
    {
      "date": "2024-01-15T00:00:00.000Z",
      "volatility": 0.25
    }
  ]
}
```

### Error Codes

| Status Code | Message                                                    | Description                           |
|-------------|------------------------------------------------------------|---------------------------------------|
| 400         | `Symbol is required`                                       | Missing symbol parameter              |
| 400         | `Invalid symbol format...`                                 | Symbol format validation failed       |
| 400         | `Invalid benchmark. Valid options: ...`                    | Invalid benchmark specified           |
| 400         | `Insufficient data for risk analysis (minimum 30 data points)`| Not enough historical data          |
| 404         | `Symbol not found`                                         | Requested symbol does not exist       |
| 429         | `Too many requests. Please try again later.`               | Rate limit exceeded                   |
| 500         | `Failed to calculate risk metrics`                         | Internal server error                 |

### Rate Limiting

- **Limit:** 60 requests per minute
- **Headers:** `Retry-After` header included on 429 responses

---

## Factor Analysis API

Analyze stocks by various quantitative factors.

### Endpoint

```
GET /api/factors
```

### Request Parameters

| Parameter | Type   | Required | Default    | Description                                           |
|-----------|--------|----------|------------|-------------------------------------------------------|
| `factor`  | string | No       | `momentum` | Factor type for ranking                               |
| `limit`   | number | No       | 50         | Maximum number of stocks to analyze (1-500)           |

### Valid Factors

| Factor       | Description                              |
|--------------|------------------------------------------|
| `momentum`   | Price momentum factor (default)          |
| `value`      | Value factor (price-to-earnings based)   |
| `volatility` | Volatility factor                        |
| `size`       | Market capitalization factor             |

### Response Format

```typescript
interface FactorsResponse {
  factor: string;
  topStocks: FactorExposure[];
  bottomStocks: FactorExposure[];
  total: number;
}

interface FactorExposure {
  symbol: string;
  momentum: number;
  value: number;
  volatility: number;
  size: number;
  overall: number;
}
```

### Example Request

```bash
curl "https://quantvn.example.com/api/factors?factor=momentum&limit=100"
```

### Example Response

```json
{
  "factor": "momentum",
  "topStocks": [
    {
      "symbol": "VNM",
      "momentum": 0.85,
      "value": 0.45,
      "volatility": 0.32,
      "size": 0.78,
      "overall": 0.60
    }
  ],
  "bottomStocks": [
    {
      "symbol": "ABC",
      "momentum": -0.42,
      "value": 0.55,
      "volatility": 0.65,
      "size": 0.30,
      "overall": 0.27
    }
  ],
  "total": 100
}
```

### Error Codes

| Status Code | Message                                                      | Description                         |
|-------------|--------------------------------------------------------------|-------------------------------------|
| 400         | `Invalid factor. Valid options: ...`                         | Invalid factor specified            |
| 400         | `Limit must be between 1 and 500`                            | Limit out of valid range            |
| 404         | `No valid factor exposures could be calculated...`           | No valid data available             |
| 429         | `Too many requests. Please try again later.`                 | Rate limit exceeded                 |
| 500         | `No stock metadata available`                                | Metadata not loaded                 |
| 500         | `Failed to calculate factors`                                | Internal server error               |

### Rate Limiting

- **Limit:** 30 requests per minute (computationally expensive)
- **Headers:** `Retry-After` header included on 429 responses

---

## Market Overview API

Get overall market statistics, top gainers/losers, and market trends.

### Endpoint

```
GET /api/market-overview
```

### Request Parameters

No parameters required.

### Response Format

```typescript
interface MarketOverviewResponse {
  totalStocks: number;
  avgVolume: number;
  benchmark: string;
  topGainers: StockReturn[];
  topLosers: StockReturn[];
  marketTrend: TrendPoint[];
  mtdReturn: number;
  currentIndex: number;
}

interface StockReturn {
  symbol: string;
  change: number;  // Decimal format (e.g., 0.05 for 5%)
}

interface TrendPoint {
  date: string;     // Formatted date string (e.g., "Jan 15")
  value: number;    // Normalized index value (base 100)
}
```

### Example Request

```bash
curl "https://quantvn.example.com/api/market-overview"
```

### Example Response

```json
{
  "totalStocks": 500,
  "avgVolume": 1250000,
  "benchmark": "VNINDEX",
  "topGainers": [
    {
      "symbol": "VNM",
      "change": 0.068
    },
    {
      "symbol": "FPT",
      "change": 0.052
    }
  ],
  "topLosers": [
    {
      "symbol": "ABC",
      "change": -0.045
    },
    {
      "symbol": "XYZ",
      "change": -0.038
    }
  ],
  "marketTrend": [
    {
      "date": "Jan 15",
      "value": 100
    },
    {
      "date": "Jan 16",
      "value": 101.5
    }
  ],
  "mtdReturn": 0.025,
  "currentIndex": 1250.50
}
```

### Error Codes

| Status Code | Message                                          | Description                |
|-------------|--------------------------------------------------|----------------------------|
| 429         | `Too many requests. Please try again later.`     | Rate limit exceeded        |
| 500         | `Failed to load market data`                     | Internal server error      |

### Rate Limiting

- **Limit:** 100 requests per minute
- **Headers:** `Retry-After` header included on 429 responses

---

## Data Health API

Get runtime data-readiness diagnostics for backend selection, manifest integrity, dataset quality, and fundamentals availability.

### Endpoint

```
GET /api/health/data
```

### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `probe` | boolean | No | `false` | Lightweight readiness mode (used by Docker healthcheck). |
| `refresh` | boolean | No | `false` | Clears data/fundamentals caches before evaluating health. |
| `includeFundamentals` | boolean | No | `true` | Include fundamentals readiness checks (`false` for faster probe). |

### Response Modes

`probe=true` returns fast checks only:

```typescript
interface DataHealthProbeResponse {
  ok: boolean;
  mode: "probe";
  timestamp: string;
  durationMs: number;
  backend: {
    ok: true;
    requested: "auto" | "csv" | "duckdb";
    active: "csv" | "duckdb";
    reason: string;
    dataDir: string;
    duckdbPath: string;
  };
  manifest: { available: boolean; schemaVersion?: number; generatedAt?: string | null; datasets?: unknown };
  checks: Array<{ name: string; ok: boolean; detail: string | null }>;
}
```

`probe=false` returns full dataset/fundamentals checks:

```typescript
interface DataHealthFullResponse {
  ok: boolean;
  mode: "full";
  timestamp: string;
  durationMs: number;
  backend: {
    ok: true;
    requested: "auto" | "csv" | "duckdb";
    active: "csv" | "duckdb";
    reason: string;
    dataDir: string;
    duckdbPath: string;
  };
  manifest: { available: boolean; schemaVersion?: number; generatedAt?: string | null; datasets?: unknown };
  datasets: {
    stockMetadata: DatasetHealth;
    ohlcv: DatasetHealth;
    index: DatasetHealth;
  };
  fundamentals: {
    checked: boolean;
    ok: boolean;
    sourceFiles: Record<string, string> | null;
    error: string | null;
  };
}

interface DatasetHealth {
  ok: boolean;
  loadedRows: number;
  totalRows: number;
  acceptedRows: number;
  acceptedRatio: number;
  parseErrorCount: number;
  rejectionReasons: Record<string, number>;
  generatedAt: string | null;
}
```

### Example Requests

```bash
# Full health check
curl "https://quantvn.example.com/api/health/data"

# Fast probe (recommended for liveness/readiness)
curl "https://quantvn.example.com/api/health/data?probe=true&includeFundamentals=false"

# Force cache refresh before check
curl "https://quantvn.example.com/api/health/data?refresh=true"
```

### Error Codes

| Status Code | Message | Description |
|-------------|---------|-------------|
| 200 | `ok=true` | Health checks passed |
| 503 | `ok=false` | Backend/data/manifest/fundamentals checks failed |

### Operational Notes

- Docker `app` / `app-prod` healthcheck uses: `/api/health/data?probe=true&includeFundamentals=false`.
- Prefer `probe=true` for high-frequency checks, and `probe=false` for deep diagnostics.

---

## Error Handling

All API endpoints follow a consistent error response format:

```typescript
interface ErrorResponse {
  error: string;
}
```

### Common HTTP Status Codes

| Status Code | Description                                              |
|-------------|----------------------------------------------------------|
| 200         | Success                                                  |
| 400         | Bad Request - Invalid parameters or request body         |
| 404         | Not Found - Requested resource does not exist            |
| 415         | Unsupported Media Type - Invalid Content-Type header     |
| 429         | Too Many Requests - Rate limit exceeded                  |
| 500         | Internal Server Error - Server-side error occurred       |

### Error Response Headers

When rate limited (429), the response includes:
- `Retry-After`: Seconds until the rate limit resets

---

## Rate Limiting

### Overview

All API endpoints implement rate limiting to ensure fair usage and system stability.

### Rate Limits by Endpoint

| Endpoint              | Rate Limit              | Notes                              |
|-----------------------|-------------------------|------------------------------------|
| `/api/stocks`         | 100 requests/minute     | Standard data retrieval            |
| `/api/backtesting`    | 30 requests/minute      | Computationally expensive          |
| `/api/optimize`       | 30 requests/minute      | Computationally expensive          |
| `/api/risk`           | 60 requests/minute      | Moderate computation               |
| `/api/factors`        | 30 requests/minute      | Computationally expensive          |
| `/api/market-overview`| 100 requests/minute     | Standard data retrieval            |
| `/api/health/data`    | No explicit limit       | Internal readiness/diagnostic use  |

### Rate Limit Headers

When rate limited, responses include:
```
HTTP/1.1 429 Too Many Requests
Retry-After: 45
Content-Type: application/json

{
  "error": "Too many requests. Please try again later."
}
```

### Best Practices

1. **Implement exponential backoff** when receiving 429 responses
2. **Cache responses** when possible to reduce API calls
3. **Batch requests** for multiple symbols using available endpoints
4. **Monitor the `Retry-After` header** to determine when to retry

---

## Version History

| Version | Date       | Changes                               |
|---------|------------|---------------------------------------|
| 1.0.0   | 2024-01-01 | Initial API release                   |

---

## Support

For API support or to report issues, please contact the QuantVN development team.
