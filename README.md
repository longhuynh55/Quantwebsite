# QuantVN - Vietnamese Stock Market Quantitative Analysis Platform

A comprehensive web-based quantitative finance platform for analyzing HOSE (Ho Chi Minh City Stock Exchange) stocks with a preferred daily dataset from 2018-2025 (fallbacks supported). Built with modern web technologies to provide professional-grade quantitative tools for investors and researchers.

## Features

### Stock Analysis
- **Stock Screener** - Filter 500+ HOSE stocks by technical indicators (RSI, MACD, Moving Averages), performance metrics, and custom criteria
- **Interactive Charts** - Candlestick and line charts with technical overlay indicators
- **Market Overview** - Real-time market statistics, top gainers/losers, and market trends

### Strategy Backtesting
- **Multiple Strategy Types**
  - SMA Crossover
  - EMA Crossover
  - RSI Mean Reversion
  - Bollinger Band Breakout
  - Momentum Strategy
- **Comprehensive Metrics** - Total return, CAGR, Sharpe ratio, Sortino ratio, max drawdown, win rate, profit factor
- **Visual Results** - Equity curves and trade history visualization

### Portfolio Optimization
- **Optimization Methods**
  - Mean-Variance Optimization (Markowitz)
  - Risk Parity
  - Minimum Variance
  - Maximum Sharpe Ratio
- **Efficient Frontier** - Visual representation of risk-return tradeoffs

### Factor Investing
- **Factor Analysis** - Momentum, Value, Volatility, Size factors
- **Factor Exposure** - Understand stock sensitivity to various factors
- **Factor Performance** - Track historical factor returns

### Risk Management
- **Risk Metrics**
  - Value at Risk (VaR) - 95% and 99% confidence
  - Conditional VaR (CVaR / Expected Shortfall)
  - Maximum Drawdown and Average Drawdown
  - Volatility (annualized)
  - Beta and Tracking Error
  - Information Ratio

### Machine Learning Lab
- **Prediction Models** - Experiment with ML models for price prediction
- **Feature Engineering** - Technical indicators as ML features

### Educational Hub
- **Beginner Topics** - Introduction to quantitative finance, OHLCV data, basic statistics
- **Intermediate Topics** - Technical indicators, trading strategies, risk basics, backtesting
- **Advanced Topics** - Factor models, modern portfolio theory, ML in finance

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| UI Components | Custom components with class-variance-authority |
| Charts | Recharts, Lightweight Charts |
| State Management | Zustand |
| Data Fetching | TanStack React Query |
| CSV Parsing | PapaParse |
| Technical Analysis | technicalindicators library |

## Prerequisites

- **Node.js** >= 18.17.0
- **npm** >= 9.0.0 (or yarn/pnpm/bun)
- **Modern browser** with JavaScript enabled

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd quant-website
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Prepare data files** (see [Getting Started Guide](./docs/GETTING_STARTED.md) for details)
   - Place CSV data files in `public/data/` directory
   - If you have raw files in `../data`, generate prepared runtime data:
     ```bash
     npm run data:prepare:2018_2025
     ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Build the application for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint for code quality checks |
| `npm run data:prepare:2018_2025` | Generate prepared runtime CSVs for 2018-2025 into `public/data/` |
| `npm run data:generate:ci` | Generate synthetic runtime CSVs for CI integration tests |
| `npm run qa:docker` | Run deep QA checks against `SMOKE_BASE_URL` (default: `http://localhost:3010`) |
| `npm run docker:up` | Start app container on `http://localhost:3010` |
| `npm run docker:logs` | Tail app container logs (dev profile) |
| `npm run docker:smoke` | Run smoke checks from isolated container |
| `npm run docker:qa` | Run deep QA checks from isolated container (dev profile) |
| `npm run docker:up:prod` | Build/start production container on `http://localhost:3011` |
| `npm run docker:logs:prod` | Tail production container logs |
| `npm run docker:smoke:prod` | Run smoke checks against production container |
| `npm run docker:qa:prod` | Run deep QA checks against production container |
| `npm run docker:down` | Stop/remove docker services |

## CI Workflow

GitHub Actions workflow: `.github/workflows/qa-integration.yml`

It runs:
1. Static checks (`lint`, `tsc --noEmit`, `build`)
2. Docker dev integration (`smoke` + `qa`)
3. Docker prod integration (`smoke-prod` + `qa-prod`)

For CI only, synthetic CSV data is generated via `npm run data:generate:ci` so large local datasets are not required in the repository.

## Docker Workflow (Recommended for stable smoke testing)

This workflow avoids killing host `node` processes (which may terminate Codex sessions).
For full step-by-step testing/debug/production procedures, see `docs/DOCKER_RUNBOOK.md`.

1. Start app container:
   ```bash
   npm run docker:up
   ```
2. Watch app logs (optional):
   ```bash
   docker compose logs -f app
   ```
3. Run smoke checks:
   ```bash
   npm run docker:smoke
   ```
4. Restart app safely (no host-wide node kill):
   ```bash
   docker compose restart app
   ```
5. Stop services:
   ```bash
   npm run docker:down
   ```

### Optional Make Shortcuts

If you use GNU Make (Git Bash/WSL), you can run the same workflow with shorter commands:

```bash
make dev-up
make dev-smoke
make prod-up
make prod-smoke
make down
```

### Production Profile

1. Start production container:
   ```bash
   npm run docker:up:prod
   ```
2. Run smoke checks against production:
   ```bash
   npm run docker:smoke:prod
   ```
3. Tail production logs:
   ```bash
   npm run docker:logs:prod
   ```

## Thesis / KLTN (Write-up Framework)

- Outline/template: `docs/KLTN_OUTLINE_QUANTVN.md`
- Docker testing/debug/prod: `docs/DOCKER_RUNBOOK.md`
- Architecture notes: `docs/ARCHITECTURE.md`
- API reference: `docs/API.md`
- Quant library notes: `docs/QUANT_LIBRARY.md`

## Project Structure

```
quant-website/
|-- public/
|   `-- data/                    # CSV data files (not included in repo)
|       |-- HOSE_VERIFIED_2020_2025.csv    # Stock metadata
|       |-- ohlcv_enriched.csv              # OHLCV price data
|       `-- Market_Indices_Daily_2020_2025.csv  # Index data
|-- src/
|   |-- app/                     # Next.js App Router pages
|   |   |-- api/                 # API routes
|   |   |   |-- stocks/          # Stock data endpoints
|   |   |   |-- factors/         # Factor analysis endpoints
|   |   |   |-- backtesting/     # Backtesting endpoints
|   |   |   |-- optimize/        # Portfolio optimization endpoints
|   |   |   |-- risk/            # Risk metrics endpoints
|   |   |   `-- market-overview/ # Market statistics
|   |   |-- backtesting/         # Backtesting page
|   |   |-- charts/              # Charts page
|   |   |-- factors/             # Factor investing page
|   |   |-- learn/               # Educational hub
|   |   |-- ml-lab/              # Machine learning lab
|   |   |-- portfolio/           # Portfolio optimization page
|   |   |-- risk/                # Risk management page
|   |   `-- screener/            # Stock screener page
|   |-- components/
|   |   |-- charts/              # Chart components
|   |   |-- layout/              # Layout components (Navbar, Footer)
|   |   `-- ui/                  # Reusable UI components
|   `-- lib/
|       |-- quant/               # Quantitative finance library
|       |   |-- indicators.ts    # Technical indicators
|       |   |-- backtest.ts      # Backtesting engine
|       |   |-- portfolio.ts     # Portfolio optimization
|       |   |-- factors.ts       # Factor analysis
|       |   `-- risk.ts          # Risk calculations
|       |-- data.ts              # Data loading utilities
|       |-- utils.ts             # Helper functions
|       `-- rateLimit.ts         # API rate limiting
|-- docs/                        # Documentation
|-- package.json
|-- tsconfig.json
|-- tailwind.config.ts
`-- next.config.ts
```

## Screenshots

<!-- Add screenshots here -->
*Screenshots coming soon*

## Data Requirements

The application requires the following CSV data files in `public/data/`:

| File | Description | Required Columns |
|------|-------------|------------------|
| `HOSE_VERIFIED_2020_2025.csv` | Stock metadata | symbol, exchange, status, dataRows, source, firstDate, lastDate, totalTradingDays, avgVolume, listingPhase |
| `ohlcv_enriched.csv` | Daily OHLCV data | symbol, date, open, high, low, close, volume |
| `Market_Indices_Daily_2020_2025.csv` | Market index data | date, open, high, low, close, volume, symbol |

See [GETTING_STARTED.md](./docs/GETTING_STARTED.md) for detailed data format specifications.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stocks` | GET | List stocks with metadata |
| `/api/factors` | POST | Calculate factor exposures |
| `/api/backtesting` | POST | Run strategy backtest |
| `/api/optimize` | POST | Optimize portfolio weights |
| `/api/risk` | POST | Calculate risk metrics |
| `/api/market-overview` | GET | Get market statistics |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Vietnamese stock market data sourced from HOSE
- Built with [Next.js](https://nextjs.org/)
- Charts powered by [Recharts](https://recharts.org/) and [Lightweight Charts](https://www.tradingview.com/lightweight-charts/)
- Technical indicators from [technicalindicators](https://github.com/anandanand84/technicalindicators)

---

**Disclaimer**: This platform is for educational and research purposes only. It is not intended as financial advice. Always do your own research before making investment decisions.
