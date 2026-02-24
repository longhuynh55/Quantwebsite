# QuantVN Strategy Forge

QuantVN Strategy Forge is a web platform for Vietnamese equity quantitative research.
It helps users move from idea to testable strategy with a visual builder, backtesting engine, and supporting analytics in one workflow.

## What this product does

- Build strategies visually with node-based Strategy Builder
- Run backtests with execution assumptions and cost modeling
- Analyze stocks and market context with screener and chart tools
- Explore portfolio, factor, and risk views for deeper validation
- Use an AI assistant with grounding and reliability gates

## Why it exists

Most retail and student quant workflows are fragmented across spreadsheets, scripts, and charts.
QuantVN unifies design, validation, and iteration into a single product focused on HOSE datasets and practical strategy development.

## Core modules

- `Strategy Builder`: node graph editor to assemble strategy logic
- `Backtesting`: metrics, equity curve, trade logs, diagnostics
- `Screener + Charts`: universe filtering and technical inspection
- `Portfolio / Factor / Risk`: portfolio construction and risk checks
- `Assistant`: guided Q&A and analysis support with guardrails

## Tech stack

- Next.js 16 (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- Zustand + React Query
- Recharts + Lightweight Charts

## Quick start

Run from `quant-website/`:

```bash
pnpm install
pnpm run data:prepare:2018_2025
pnpm run dev
```

Open: `http://localhost:3000`

## Deploy and share

- `Railway` (recommended): uses `railway.toml` + `Dockerfile`
- `Render` (backup): uses `render.yaml` + `Dockerfile`
- Full runbook: `docs/DEPLOY_SHARE_RUNBOOK.md`
- For DuckDB-first cloud deploy, use `Dockerfile.duckdb`

## Essential commands

- `pnpm run dev`: start local dev server
- `pnpm run build`: production build
- `pnpm run start`: run production app
- `pnpm run lint`: lint check
- `pnpm exec tsc --noEmit`: type check
- `pnpm run docker:up`: run app in Docker (`http://localhost:3010`)
- `pnpm run docker:smoke`: smoke validation
- `pnpm run docker:qa`: deeper integration QA

## Data

- Runtime datasets: `public/data/`
- Raw datasets (workspace): `../data/`
- Prepare runtime CSVs: `pnpm run data:prepare:2018_2025`

## Project structure

```text
quant-website/
|- src/app/                # routes and API handlers
|- src/components/         # UI and feature components
|- src/lib/                # quant logic, data, assistant, utilities
|- public/data/            # runtime CSV datasets
|- scripts/                # smoke/qa/data scripts
`- docs/                   # architecture, API, runbooks
```

## Documentation

- `docs/GETTING_STARTED.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/DOCKER_RUNBOOK.md`
- `docs/DATA_RELIABILITY_OPERATIONS.md`

## Contributing

Before opening PR:

```bash
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
```

For release-sensitive changes, also run Docker smoke/QA flows.

## Disclaimer

This platform is for research and educational use only.
It is not financial advice.
