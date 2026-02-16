# QuantVN Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [System Architecture Diagram](#system-architecture-diagram)
3. [Directory Structure](#directory-structure)
4. [Data Flow Diagram](#data-flow-diagram)
5. [Component Hierarchy](#component-hierarchy)
6. [State Management](#state-management)
7. [API Design Patterns](#api-design-patterns)
8. [Security Considerations](#security-considerations)
9. [Performance Optimization](#performance-optimization)
10. [Future Scalability](#future-scalability)

---

## System Overview

QuantVN is a comprehensive quantitative finance platform designed for the Vietnamese stock market (HOSE - Ho Chi Minh City Stock Exchange). Built on Next.js 16 with the App Router architecture, it provides professional-grade tools for stock screening, strategy backtesting, portfolio optimization, factor investing analysis, and risk management.

### Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.1.6 (App Router) |
| UI Library | React 19.2.3 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| State Management | Zustand 4.5.7 |
| Data Fetching | TanStack Query 5.28.4 |
| Charts | Recharts 2.15.4, Lightweight Charts 4.2.0 |
| Technical Analysis | technicalindicators 3.1.0 |
| CSV Parsing | PapaParse 5.4.1 |
| Icons | Lucide React 0.358.0 |

---

## System Architecture Diagram

```
+------------------------------------------------------------------+
|                          CLIENT BROWSER                           |
|  +------------------------------------------------------------+  |
|  |                    React Application                        |  |
|  |  +------------------+  +------------------+  +-----------+ |  |
|  |  |     Pages        |  |   Components     |  |  Charts   | |  |
|  |  |  (App Router)    |  |   (UI/Layout)    |  | (Recharts)| |  |
|  |  +------------------+  +------------------+  +-----------+ |  |
|  +--------------------------+-----------------------------------+  |
+-----------------------------|-------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                        NEXT.JS SERVER                             |
|  +------------------------------------------------------------+  |
|  |                    API Routes (/api/*)                      |  |
|  |  +-------------+  +-------------+  +--------+  +---------+  |  |
|  |  |   /stocks   |  |/backtesting|  |/factors|  |/optimize|  |  |
|  |  +-------------+  +-------------+  +--------+  +---------+  |  |
|  |  |    /risk    |  |/market-overview| | /fundamentals |   |  |  |
|  |  +-------------+  +-----------------+ +---------------+   |  |
|  |  |        /health/data (probe/full data readiness)     |   |  |
|  |  +------------------------------------------------------+   |  |
|  +--------------------------+-----------------------------------+  |
|                             |                                     |
|  +--------------------------v-----------------------------------+  |
|  |                     Core Libraries                           |  |
|  |  +------------------+  +------------------+  +-------------+ |  |
|  |  |   data.ts        |  |   rateLimit.ts   |  |  utils.ts   | |  |
|  |  | (Data Loading)   |  | (Rate Limiting)  |  | (Utilities) | |  |
|  |  +------------------+  +------------------+  +-------------+ |  |
|  +--------------------------+-----------------------------------+  |
|                             |                                     |
|  +--------------------------v-----------------------------------+  |
|  |                  Quant Library (/lib/quant)                  |  |
|  |  +-------------+  +-------------+  +--------+  +-----------+ |  |
|  |  | indicators  |  |  backtest   |  | risk   |  | portfolio | |  |
|  |  +-------------+  +-------------+  +--------+  +-----------+ |  |
|  |  |   factors   |  |                                              |  |
|  |  +-------------+                                                |  |
|  +--------------------------+-----------------------------------+  |
+-----------------------------|-------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                      DATA LAYER                                   |
|  +------------------------------------------------------------+  |
|  |        Runtime Data (CSV preferred, DuckDB optional)      |  |
|  |  +-------------------------------+  +--------------------+ |  |
|  |  | stock_metadata_2018_2025.csv |  | ohlcv_2018_2025.csv| |  |
|  |  | (fallback: HOSE_VERIFIED_*)  |  | (fallback: *.csv)  | |  |
|  |  +-------------------------------+  +--------------------+ |  |
|  |  | Market_Indices_Daily_2020_2025.csv                     | |  |
|  |  | quant_data.duckdb (when DATA_BACKEND=duckdb/auto)      | |  |
|  |  +---------------------------------------------------------+ |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

---

## Directory Structure

```
quant-website/
+-- public/
|   +-- data/
|       +-- stock_metadata_2018_2025.csv       # Preferred metadata dataset
|       +-- ohlcv_2018_2025.csv                # Preferred OHLCV dataset
|       +-- Market_Indices_Daily_2020_2025.csv  # Market index data
|       +-- data_manifest_2018_2025.json        # Data quality contract
|       +-- data_manifest.json                   # Compatibility alias
|       +-- quant_data.duckdb                    # Optional DuckDB artifact
|       +-- HOSE_VERIFIED_2020_2025.csv          # Legacy metadata fallback
|       +-- ohlcv_enriched.csv                   # Legacy OHLCV fallback
|
+-- src/
|   +-- app/                               # Next.js App Router
|   |   +-- layout.tsx                     # Root layout (Navbar/Footer)
|   |   +-- page.tsx                       # Home page
|   |   +-- globals.css                    # Global styles
|   |   |
|   |   +-- api/                           # API Route Handlers
|   |   |   +-- stocks/route.ts            # Stock data endpoint
|   |   |   +-- backtesting/route.ts       # Backtesting endpoint
|   |   |   +-- factors/route.ts           # Factor analysis endpoint
|   |   |   +-- optimize/route.ts          # Portfolio optimization endpoint
|   |   |   +-- risk/route.ts              # Risk metrics endpoint
|   |   |   +-- market-overview/route.ts   # Market overview endpoint
|   |   |   +-- fundamentals/route.ts      # BCT/BCTT/LCTT endpoint
|   |   |   +-- health/data/route.ts       # Data readiness + quality health
|   |   |
|   |   +-- screener/page.tsx              # Stock screener page
|   |   +-- backtesting/page.tsx           # Strategy backtesting page
|   |   +-- charts/page.tsx                # Price charts page
|   |   +-- portfolio/page.tsx             # Portfolio optimization page
|   |   +-- factors/page.tsx               # Factor investing page
|   |   +-- risk/page.tsx                  # Risk management page
|   |   +-- ml-lab/page.tsx                # Machine learning lab page
|   |   +-- learn/page.tsx                 # Educational content page
|   |   +-- learn/[topic]/page.tsx         # Dynamic topic pages
|   |
|   +-- components/
|   |   +-- ui/                            # Reusable UI components
|   |   |   +-- button.tsx                 # Button component
|   |   |   +-- card.tsx                   # Card component
|   |   |   +-- input.tsx                  # Input component
|   |   |   +-- select.tsx                 # Select dropdown
|   |   |   +-- badge.tsx                  # Badge component
|   |   |   +-- tabs.tsx                   # Tabs component
|   |   |   +-- index.ts                   # UI barrel export
|   |   |
|   |   +-- layout/                        # Layout components
|   |   |   +-- Navbar.tsx                 # Navigation bar
|   |   |   +-- Footer.tsx                 # Footer component
|   |   |   +-- index.ts                   # Layout barrel export
|   |   |
|   |   +-- charts/                        # Chart components
|   |   |   +-- LineChart.tsx              # Line chart component
|   |   |   +-- CandlestickChart.tsx       # Candlestick chart
|   |   |   +-- index.ts                   # Charts barrel export
|   |
|   +-- lib/
|       +-- utils.ts                       # Utility functions
|       +-- data.ts                        # Data loading & caching
|       +-- rateLimit.ts                   # Rate limiting utility
|       |
|       +-- quant/                         # Quantitative finance library
|           +-- index.ts                   # Barrel export
|           +-- indicators.ts              # Technical indicators
|           +-- backtest.ts                # Backtesting engine
|           +-- risk.ts                    # Risk metrics
|           +-- portfolio.ts               # Portfolio optimization
|           +-- factors.ts                 # Factor analysis
|
+-- package.json
+-- tsconfig.json
+-- tailwind.config.ts
+-- next.config.ts
```

---

## Data Flow Diagram

```
                    USER INTERACTION
                          |
                          v
    +-------------------------------------------+
    |              PAGE COMPONENT               |
    |   (Client-Side React Component)          |
    +-------------------------------------------+
            |                       |
            | useState/useEffect    | fetch()
            v                       v
    +---------------+     +-------------------+
    |  Local State  |     |    API Routes     |
    |  (Zustand)    |     |   (/api/...)      |
    +---------------+     +-------------------+
                                  |
                                  v
                          +---------------+
                          |  Data Layer   |
                          |  (data.ts)    |
                          +---------------+
                                  |
                          +----------------------+
                          | Backend Router       |
                          | (auto/csv/duckdb)    |
                          +----------------------+
                             |               |
                             v               v
                    +----------------+   +----------------+
                    | Runtime CSVs   |   | quant_data.duckdb |
                    | + manifest     |   | (DuckDB)       |
                    +----------------+   +----------------+
```

### Data Loading Process

1. **Client Request**: Page component initiates fetch to API endpoint
2. **API Handler**: Validates input, checks rate limits, calls data layer
3. **Data Layer**: Resolves backend (`auto`/`csv`/`duckdb`), applies manifest/parse gates, uses cache
4. **Quant Library**: Processes normalized data through calculations
5. **Response**: JSON response returned to client
6. **UI Update**: Component state updates, triggers re-render
7. **Ops Monitoring**: `/api/health/data` exposes probe/full readiness for Docker + QA

---

## Component Hierarchy

```
RootLayout (layout.tsx)
+-- Navbar
|   +-- Logo
|   +-- Navigation Links (Home, Screener, Backtesting, etc.)
|   +-- Mobile Menu
|
+-- Main Content (children)
|   |
|   +-- HomePage (page.tsx)
|   |   +-- Hero Section
|   |   +-- Market Overview
|   |   |   +-- Stat Cards
|   |   |   +-- LineChart (Market Trend)
|   |   |   +-- Top Movers
|   |   +-- Features Grid
|   |   +-- CTA Section
|   |
|   +-- ScreenerPage
|   |   +-- Filter Controls
|   |   +-- Stock Table
|   |
|   +-- BacktestingPage
|   |   +-- Strategy Selector
|   |   +-- Parameter Inputs
|   |   +-- Results Display
|   |   +-- CandlestickChart
|   |
|   +-- PortfolioPage
|   |   +-- Stock Selector
|   |   +-- Optimization Method
|   |   +-- Allocation Results
|   |
|   +-- FactorsPage
|   |   +-- Factor Selection
|   |   +-- Stock Rankings
|   |
|   +-- RiskPage
|   |   +-- Stock Input
|   |   +-- Risk Metrics Display
|   |
|   +-- LearnPage
|       +-- Topic Cards
|       +-- Dynamic Content
|
+-- Footer
```

### Component Categories

| Category | Components | Purpose |
|----------|------------|---------|
| UI | Button, Card, Input, Select, Badge, Tabs | Reusable primitive components |
| Layout | Navbar, Footer | Page structure and navigation |
| Charts | LineChart, CandlestickChart | Data visualization |
| Pages | Home, Screener, Backtesting, etc. | Feature-specific views |

---

## State Management

QuantVN employs a **lightweight state management approach** optimized for its data-fetching patterns:

### Strategy: Local State + Server State Separation

```
+---------------------------+
|      CLIENT STATE         |
+---------------------------+
|                           |
|  Local UI State           |  <-- useState, useReducer
|  (form inputs, toggles)   |
|                           |
+---------------------------+

+---------------------------+
|      SERVER STATE         |
+---------------------------+
|                           |
|  Fetched Data             |  <-- React Query / fetch
|  (stocks, backtest data)  |
|                           |
+---------------------------+
```

### State Management Tools

| Tool | Usage | Location |
|------|-------|----------|
| React `useState` | Component-local state | All page components |
| React `useEffect` | Side effects & data fetching | All page components |
| React `useMemo` | Memoized computations | Charts, expensive calculations |
| Zustand | Global state (if needed) | Available via dependency |
| TanStack Query | Server state caching | Available via dependency |

### Example Pattern (from HomePage)

```typescript
// Local state pattern used across the application
const [marketData, setMarketData] = useState<MarketOverview | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  let isMounted = true;

  async function fetchMarketData() {
    try {
      const response = await fetch("/api/market-overview");
      const data = await response.json();
      if (isMounted) {
        setMarketData(data);
      }
    } catch (err) {
      if (isMounted) setError(err.message);
    } finally {
      if (isMounted) setLoading(false);
    }
  }

  fetchMarketData();
  return () => { isMounted = false; };
}, []);
```

### Data Caching Strategy

The application implements **in-memory caching** at the server level:

```typescript
// In-memory caches in data.ts
let stockMetadataCache: StockMetadata[] | null = null;
let ohlcvCache: Map<string, OHLCV[]> | null = null;
let indexCache: IndexData[] | null = null;

// Cache persists for server lifetime
export async function loadStockMetadata(): Promise<StockMetadata[]> {
  if (stockMetadataCache) return stockMetadataCache;
  // ... load and cache data
}
```

---

## API Design Patterns

### RESTful API Structure

All API endpoints follow REST conventions with consistent patterns:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/stocks` | GET | List stocks or get specific symbol data |
| `/api/backtesting` | GET/POST | Run backtesting strategies |
| `/api/factors` | GET | Get factor exposures for stocks |
| `/api/optimize` | GET | Portfolio optimization |
| `/api/risk` | GET | Risk metrics calculation |
| `/api/market-overview` | GET | Market summary data |
| `/api/fundamentals` | GET | Quarterly BCT/BCTT/LCTT data by symbol |
| `/api/health/data` | GET | Backend/manifest/probe/full data health checks |

### Request/Response Pattern

```
+----------------+     +-----------------+     +----------------+
|    Request     |     |   Validation    |     |   Processing   |
|  (Query Params | --> |  - Rate Limit   | --> |  - Data Load   |
|   or Body)     |     |  - Input Check  |     |  - Computation |
+----------------+     +-----------------+     +----------------+
                                                       |
                                                       v
+----------------+     +-----------------+     +----------------+
|    Client      |     |    Response     |     |    Result      |
|   Receives     | <-- |  (JSON + Status)| <-- |  Formatting    |
|     JSON       |     |                 |     |                |
+----------------+     +-----------------+     +----------------+
```

### Example API Handler (Backtesting)

```typescript
export async function GET(request: Request) {
  // 1. Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, RATE_LIMIT_MAX, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  // 2. Input validation
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol || !VALID_SYMBOL_REGEX.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  // 3. Data loading
  const data = await loadOHLCVForSymbol(symbol);
  if (data.length === 0) {
    return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
  }

  // 4. Computation
  const result = runBacktest(data, strategy, initialCapital);

  // 5. Response
  return NextResponse.json({ symbol, ...result });
}
```

### Error Handling

Standardized error responses across all endpoints:

| Status Code | Meaning | Example |
|-------------|---------|---------|
| 200 | Success | Data returned successfully |
| 400 | Bad Request | Invalid input parameters |
| 404 | Not Found | Symbol not in database |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal processing failure |

---

## Security Considerations

### 1. Input Validation

All user inputs are validated at multiple levels:

```typescript
// Symbol validation (1-10 uppercase letters)
const VALID_SYMBOL_REGEX = /^[A-Z]{1,10}$/;

// Numeric range validation
const MIN_CAPITAL = 1;
const MAX_CAPITAL = 1e12;

// Strategy whitelist
const VALID_STRATEGIES = ['sma_crossover', 'ema_crossover', ...];
```

### 2. Rate Limiting

In-memory rate limiting prevents abuse:

```typescript
// Rate limit configuration per endpoint
const RATE_LIMITS = {
  stocks: 100,        // 100 requests/minute
  backtesting: 30,    // 30 requests/minute (computationally expensive)
  factors: 60,
  optimize: 30,
};
```

Rate limiting features:
- IP-based identification with header fallback
- Automatic cleanup of expired entries
- Retry-After headers for client guidance

### 3. Data Sanitization

- CSV parsing validates all numeric fields
- Date parsing handles multiple formats with validation
- Empty/malformed rows are silently skipped

### 4. No External Data Sources

- All data loaded from static CSV files
- No database connections or external API calls
- No user authentication required (reduces attack surface)

### 5. Content Security

- Next.js handles XSS prevention by default
- No `dangerouslySetInnerHTML` usage
- All dynamic content rendered through React

---

## Performance Optimization

### 1. Data Caching

Server-side in-memory caching eliminates repeated file I/O:

```typescript
// Cache loaded once, reused across requests
let ohlcvCache: Map<string, OHLCV[]> | null = null;

export async function loadOHLCVData(): Promise<Map<string, OHLCV[]>> {
  if (ohlcvCache) return ohlcvCache;  // Return cached data
  // ... load and cache
}
```

### 2. Algorithmic Optimizations

Technical indicators use O(n) algorithms where possible:

```typescript
// SMA with sliding window - O(n) instead of O(n*k)
export function calculateSMA(prices: number[], period: number) {
  let sum = 0;
  for (let i = 0; i < period; i++) sum += prices[i];
  result[period - 1] = sum / period;

  // Slide window - O(1) per iteration
  for (let i = period; i < prices.length; i++) {
    sum = sum - prices[i - period] + prices[i];
    result[i] = sum / period;
  }
}
```

### 3. React Optimizations

- `useMemo` for expensive chart calculations
- Component-level code splitting via App Router
- Barrel exports for tree shaking

### 4. Next.js Optimizations

- Static file serving from `/public`
- Automatic image optimization (if images added)
- Server-side rendering for initial page load
- API routes run on demand (no always-on server)

### 5. Bundle Size Management

| Dependency | Purpose | Size Impact |
|------------|---------|-------------|
| Recharts | Charts | Tree-shakeable |
| Lucide React | Icons | Tree-shakeable |
| technicalindicators | Analysis | Moderate |

---

## Future Scalability

### Horizontal Scaling Considerations

#### Current Architecture (Single Server)
```
                    +-----------------+
                    |  Next.js Server |
                    |  (Single Node)  |
                    +-----------------+
                           |
                    +-----------------+
                    |   Static Files  |
                    +-----------------+
```

#### Future: Multi-Server Architecture
```
          +-----------------+
          |  Load Balancer  |
          +-----------------+
                 |
    +------------+------------+
    |            |            |
    v            v            v
+--------+  +--------+  +--------+
| Server |  | Server |  | Server |
|   1    |  |   2    |  |   3    |
+--------+  +--------+  +--------+
    |            |            |
    +------------+------------+
                 |
          +-------------+
          |    Redis    |
          | (Rate Limit)|
          +-------------+
```

### Recommended Enhancements

#### 1. Database Integration
- Replace CSV files with PostgreSQL or TimescaleDB
- Enable real-time data updates
- Support user portfolios and watchlists

#### 2. Redis for Rate Limiting
```typescript
// Current: In-memory rate limiting
// Future: Redis-based distributed rate limiting
import { Redis } from '@upstash/redis';

const redis = new Redis({ url: process.env.REDIS_URL });
await redis.incr(`ratelimit:${clientId}`);
```

#### 3. Background Job Processing
- Offload backtesting to worker processes
- Queue system for long-running computations
- WebSocket updates for job progress

#### 4. Caching Layer
- Add Redis or Vercel KV for response caching
- Cache computed backtest results
- Implement stale-while-revalidate pattern

#### 5. Data Pipeline
```
External Data Source --> ETL Pipeline --> Database --> API
                              |
                              v
                        S3/Cloud Storage
                        (Historical Archive)
```

### Modular Extension Points

| Area | Current | Extension |
|------|---------|-----------|
| Data Source | CSV files | Database, API feeds |
| Rate Limiting | In-memory | Redis |
| Authentication | None | NextAuth.js |
| Real-time | None | WebSockets |
| Notifications | None | Email/Push |

### Performance Targets (Future)

| Metric | Current | Target |
|--------|---------|--------|
| Page Load | < 3s | < 1s |
| API Response | < 500ms | < 200ms |
| Backtesting | < 2s | < 500ms |
| Concurrent Users | ~100 | ~10,000 |

---

## Appendix: Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/data.ts` | ~700 | Data loading, quality gates, caching |
| `src/lib/dataBackend.ts` | ~150 | Backend selection (`auto/csv/duckdb`) |
| `src/lib/dataManifest.ts` | ~140 | Runtime manifest loading/validation |
| `src/lib/quant/backtest.ts` | ~350 | Backtesting engine |
| `src/lib/quant/indicators.ts` | ~300 | Technical indicators |
| `src/lib/quant/risk.ts` | ~250 | Risk calculations |
| `src/lib/quant/portfolio.ts` | ~185 | Portfolio optimization |
| `src/lib/quant/factors.ts` | ~110 | Factor analysis |
| `src/lib/rateLimit.ts` | ~140 | Rate limiting utility |
| `src/app/api/backtesting/route.ts` | ~180 | Backtesting API |
| `src/app/api/health/data/route.ts` | ~320 | Runtime data health API |

---

*Document Version: 1.1*
*Last Updated: February 2026*
*Author: QuantVN Documentation Team*
