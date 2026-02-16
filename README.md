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
- **Realistic Execution Model** - Default `signal t -> fill t+1 open` to reduce look-ahead bias, with optional `same_close` mode
- **Cost Modeling** - Configurable fee, sell tax, slippage, and lot size for more realistic net performance
- **Comprehensive Metrics** - Net/Gross return, CAGR, Sharpe ratio, Sortino ratio, max drawdown, win rate, profit factor, turnover, exposure
- **Data Diagnostics** - Coverage ratio, largest timeline gap, dropped rows, and warnings when symbol history is sparse
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
   - This command also writes `public/data/data_manifest_2018_2025.json` (and `data_manifest.json`) for runtime integrity checks.

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
| `npm run eval:assistant` | Evaluate assistant hallucination risk on backtesting responses |
| `npm run eval:assistant:full` | Run comprehensive assistant evaluation (full-data scan + grounding + numeric fidelity) |
| `npm run data:prepare:2018_2025` | Generate prepared runtime CSVs + manifest for 2018-2025 into `public/data/` |
| `npm run data:export:duckdb` | Export runtime CSVs in `public/data/` to `public/data/quant_data.duckdb` (Node `duckdb` binding or Docker fallback) |
| `npm run data:generate:ci` | Generate synthetic runtime CSVs for CI integration tests |
| `npm run qa:docker` | Run deep QA checks against `SMOKE_BASE_URL` (default: `http://localhost:3010`) |
| `npm run docker:up` | Start app container on `http://localhost:3010` |
| `npm run docker:logs` | Tail app container logs (dev profile) |
| `npm run docker:smoke` | Run smoke checks from isolated container |
| `npm run docker:eval:assistant` | Run assistant hallucination eval from isolated container (dev profile) |
| `npm run docker:eval:assistant:full` | Run comprehensive assistant evaluation from isolated container (dev profile) |
| `npm run docker:qa` | Run deep QA checks from isolated container (dev profile) |
| `npm run docker:up:prod` | Build/start production container on `http://localhost:3011` |
| `npm run docker:logs:prod` | Tail production container logs |
| `npm run docker:smoke:prod` | Run smoke checks against production container |
| `npm run docker:eval:assistant:prod` | Run assistant hallucination eval against production container |
| `npm run docker:eval:assistant:full:prod` | Run comprehensive assistant evaluation against production container |
| `npm run docker:qa:prod` | Run deep QA checks against production container |
| `npm run docker:down` | Stop/remove docker services |

## CI Workflow

GitHub Actions workflow: `.github/workflows/qa-integration.yml`

It runs:
1. Static checks (`lint`, `tsc --noEmit`, `build`)
2. Docker dev integration (`smoke` + `qa` + `assistant eval`)
3. Docker prod integration (`smoke-prod` + `qa-prod` + `assistant eval`)

For CI only, synthetic CSV data is generated via `npm run data:generate:ci` so large local datasets are not required in the repository.
Set `ASSISTANT_EVAL_STRICT=true` to fail the pipeline when AI provider is unavailable instead of skipping eval.
See `docs/ASSISTANT_EVAL_CRITERIA.md` for full evaluation criteria and thresholds.
For faster local runs with real API key, use `ASSISTANT_EVAL_PROFILE=balanced` (stratified top/mid/low symbols, fewer prompts).

### Assistant Provider Priority

Provider order is controlled by `ASSISTANT_PROVIDER_PRIORITY` (default: `openrouter,glm,fallback`).
`docker-compose.yml` sets this value for both `app` and `app-prod`, so OpenRouter is the primary provider by default.
Grounding tool calls use `ASSISTANT_TOOL_BASE_URL` (set in `docker-compose.yml` to `http://127.0.0.1:3000`) to avoid untrusted host/origin routing.
If `ASSISTANT_TOOL_BASE_URL` is not set, `/api/assistant` falls back to request origin before using development fallback.

### Assistant Guardrail Modes

Use `ASSISTANT_POLICY_MODE` to control anti-hallucination enforcement in `/api/assistant`:
- `shadow` (default): evaluate policy, log shadow blocks, do not hard-block LLM output
- `enforce_high_risk`: hard-block numeric claims on high-risk pages (`backtesting`, `risk`, `factors`, `charts`, `portfolio`) when grounding requirements fail
- `enforce_all`: hard-block numeric claims for all intents when grounding requirements fail
- `ASSISTANT_BASELINE_ONLY` defaults to `false`, enabling valuation/peer/health/sensitivity tools by default.
- `ASSISTANT_EVAL_AUTH_TOKEN` and `ASSISTANT_EVAL_RATE_LIMIT_MAX` configure a dedicated eval traffic bucket (`x-assistant-eval`) for assistant evaluation scripts.

### Data Runtime Integrity

- `DATA_MANIFEST_STRICT` (default: `true`): enforce row-count checks against `public/data/data_manifest*.json` when manifest is available.
- `DATA_MANIFEST_ROW_TOLERANCE` (default: `0`): allowed row-count delta for manifest gate.
- `DATA_BACKEND=auto|csv|duckdb` (default: `auto`): runtime uses DuckDB when `quant_data.duckdb` exists **and** Node binding is available; otherwise it falls back to CSV.
- `DATA_BACKEND_STRICT=true`: if `DATA_BACKEND=duckdb` but artifact/binding is missing, fail fast instead of fallback.
- `DATA_DUCKDB_PATH`: override DuckDB artifact path (default: `public/data/quant_data.duckdb`).
- `DATA_EXPORT_DUCKDB=true`: when running `npm run data:prepare:2018_2025`, auto-export DuckDB artifact after CSV preparation.
- `INSTALL_DUCKDB_BINDING=true` (Docker compose default): installs Node `duckdb` binding in `app` / `app-prod` containers during build/startup for strict DuckDB mode.
- `GET /api/health/data`: returns backend mode, manifest info, dataset quality, and fundamentals readiness (`?refresh=true` to clear caches before check).
- Docker healthcheck uses probe mode: `/api/health/data?probe=true&includeFundamentals=false`.

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
4. Check data health (optional):
   ```bash
   curl http://localhost:3010/api/health/data
   ```
5. Restart app safely (no host-wide node kill):
   ```bash
   docker compose restart app
   ```
6. Stop services:
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
- Data reliability contract: `docs/DATA_RELIABILITY_OPERATIONS.md`
- Data release checklist: `docs/DATA_RELEASE_CHECKLIST.md`
- Observability + SLO baseline: `docs/OBSERVABILITY_SLO.md`
- Incident response runbook: `docs/INCIDENT_RESPONSE.md`

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
