# Codebase Overview (QuantVN) - 2026-02-21

Muc tieu: tai lieu ky thuat "codebase map" cho repo `quant-website/` (Next.js 16 + TypeScript).
Tai lieu nay tap trung vao "code la su that": entrypoints, module boundaries, data flow, va cach mo rong he thong.

Lien quan:
- Kien truc tong quan: `docs/ARCHITECTURE.md`
- API reference: `docs/API.md`
- Data + van hanh: `docs/GETTING_STARTED.md`, `docs/DATA_RELIABILITY_OPERATIONS.md`, `docs/DATA_RELEASE_CHECKLIST.md`
- Docker workflow: `docs/DOCKER_RUNBOOK.md`

## 1. Entry Points (chuan de doc nhanh)

UI + layout toan cuc:
- `src/app/layout.tsx`: Theme provider, Sidebar/Header/Footer, Toaster, CommandPalette, AI assistant panel.
- `src/app/page.tsx`: Home page (market overview cards + chart).

API surface (App Router):
- `src/app/api/**/route.ts`: tat ca API routes (xem danh sach o muc 3).

Middleware:
- `src/middleware.ts`: gan `x-request-id`, request logging (dev), track API response time (dynamic import `src/lib/monitoring/performance`).

Core runtime data:
- `src/lib/data.ts`: loader + cache + quality gates cho `stockMetadata`, `ohlcv`, `index` (CSV / DuckDB).
- `src/lib/dataBackend.ts`: chon backend theo env (`DATA_BACKEND`, `DATA_DUCKDB_PATH`, `DATA_BACKEND_STRICT`).
- `src/lib/dataManifest.ts`: doc `data_manifest_2018_2025.json` / `data_manifest.json` va gate theo manifest.

Assistant:
- `src/app/api/assistant/route.ts`: chat endpoint (rate limit + planner + grounding tools + provider fallback + policy).
- `src/app/api/assistant/execute/route.ts`: human-in-loop execute proxy (yeu cau `ASSISTANT_EXECUTE_APPROVAL_TOKEN`).
- `src/lib/assistant/*`: planner/tools/providers/policy + unit tests.

## 2. Project Structure (thuc te trong repo)

```
quant-website/
|-- src/
|   |-- app/                      # Next.js App Router pages + api routes
|   |   |-- api/                  # /api/*
|   |   |-- backtesting/          # /backtesting
|   |   |-- charts/               # /charts
|   |   |-- community/            # /community
|   |   |-- dashboard/            # /dashboard
|   |   |-- factors/              # /factors
|   |   |-- learn/                # /learn + /learn/[topic]
|   |   |-- ml-lab/               # /ml-lab
|   |   |-- portfolio/            # /portfolio
|   |   |-- risk/                 # /risk
|   |   |-- screener/             # /screener
|   |   `-- strategy-builder/     # /strategy-builder
|   |
|   |-- components/
|   |   |-- ui/                   # primitive components (kebab-case)
|   |   |-- layout/               # Sidebar/Header/Footer, nav
|   |   |-- charts/               # recharts + lightweight-charts
|   |   |-- assistant/            # chat panel UI
|   |   |-- providers/            # Theme/ErrorBoundary wrappers
|   |   `-- ... feature folders
|   |
|   `-- lib/
|       |-- quant/                # indicators/backtest/risk/portfolio/factors
|       |-- assistant/            # planner/tools/providers/policy
|       |-- analytics/            # ICB snapshot, valuation rankings, universe builders
|       |-- finance/              # finance analysis assembly
|       |-- monitoring/           # perf tracking hooks
|       |-- stores/               # Zustand stores
|       `-- ... shared helpers
|
|-- scripts/                      # eval/smoke/qa + data pipelines
|-- public/data/                  # runtime CSV + manifest (+ optional DuckDB)
`-- docs/                         # docs + runbooks
```

## 3. Pages va API Route Map

Pages (UI):
- `src/app/page.tsx` (home)
- `src/app/screener/page.tsx`
- `src/app/charts/page.tsx`
- `src/app/backtesting/page.tsx`
- `src/app/portfolio/page.tsx`
- `src/app/risk/page.tsx`
- `src/app/factors/page.tsx`
- `src/app/ml-lab/page.tsx`
- `src/app/community/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/learn/page.tsx`, `src/app/learn/[topic]/page.tsx`
- `src/app/strategy-builder/page.tsx`

API routes (server):
- Market/universe: `src/app/api/market-overview/route.ts`, `src/app/api/stocks/route.ts`
- Quant engines: `src/app/api/backtesting/route.ts`, `src/app/api/optimize/route.ts`, `src/app/api/risk/route.ts`, `src/app/api/factors/route.ts`
- Fundamentals/finance: `src/app/api/fundamentals/route.ts`, `src/app/api/finance-analysis/route.ts`, `src/app/api/finance-analysis/export/route.ts`, `src/app/api/finance-analysis/export/route-xlsx.ts`
- Analytics: `src/app/api/analytics/icb-snapshot/route.ts`, `src/app/api/analytics/valuation-rankings/route.ts`
- Strategy lab: `src/app/api/strategy-lab/strategies/route.ts`, `src/app/api/strategy-lab/runs/route.ts`, `src/app/api/strategy-lab/runs/[runId]/route.ts`, `src/app/api/strategy-lab/runs/[runId]/events/route.ts`, `src/app/api/strategy-lab/runs/[runId]/result/route.ts`, `src/app/api/strategy-lab/runs/[runId]/cancel/route.ts`
- Community CRUD: `src/app/api/strategies/route.ts`, `src/app/api/strategies/[id]/route.ts`
- Alerts/preferences/telemetry: `src/app/api/alerts/route.ts`, `src/app/api/alerts/rules/route.ts`, `src/app/api/preferences/route.ts`, `src/app/api/telemetry/ui-kpi/route.ts`
- Health: `src/app/api/health/route.ts`, `src/app/api/health/data/route.ts`
- Assistant/AI: `src/app/api/assistant/route.ts`, `src/app/api/assistant/execute/route.ts`, `src/app/api/ai/generate-strategy/route.ts`

Goi y: neu can "source of truth" ve schema/params, uu tien doc `docs/API.md` va code route tuong ung.

## 4. Data Flow (Runtime)

### 4.1 Data dir va runtime contracts

Mac dinh app doc runtime datasets tu `public/data/` (hoac `DATA_DIR` neu set).
Xem `public/data/README.md` de biet danh sach runtime files.

### 4.2 Backend selection: CSV vs DuckDB

Logic chon backend:
- `src/lib/dataBackend.ts`:
  - `DATA_BACKEND=csv|duckdb|auto`
  - `DATA_DUCKDB_PATH` (mac dinh `public/data/quant_data.duckdb`)
  - `DATA_BACKEND_STRICT=true` se throw neu bat duckdb ma thieu file/binding
- `src/lib/duckdbClient.ts`: detect Node binding va query helpers (DuckDB path)

### 4.3 Loading + caching + quality gates

`src/lib/data.ts` la "gateway":
- Parse CSV qua `src/lib/csvLoader.ts` (row validation + rejection reasons).
- Enforce quality gate + manifest gate qua `src/lib/dataManifest.ts`.
- Cache in-memory (process-level) cho `stockMetadata`, `ohlcv`, `index` + quality reports + load status.
- Co `clearCache()` cho test/ops + refresh flows (health endpoint co the trigger refresh).

## 5. Quant Core (business logic)

Quant library:
- `src/lib/quant/backtest.ts`: `runBacktest` + signal series + execution model (fees/slippage/lot size) + metrics.
- `src/lib/quant/indicators.ts`: SMA/EMA/RSI/MACD/... (technical indicators).
- `src/lib/quant/risk.ts`: VaR/CVaR, drawdown, volatility, beta, tracking error, etc.
- `src/lib/quant/portfolio.ts`: portfolio optimization helpers.
- `src/lib/quant/factors.ts`: factor calculations.

API routes se goi cac ham nay, sau do UI render charts/tables.

## 6. Assistant Architecture (planner -> tools -> policy -> provider)

Entry route:
- `src/app/api/assistant/route.ts`:
  - rate limit scope (`assistant` vs `assistant_eval`) qua `src/lib/rateLimit.ts`
  - sanitize input + build query plan (`src/lib/assistant/planner.ts`)
  - grounding tools (`src/lib/assistant/tools.ts`) neu co base URL trusted
  - policy eval (`src/lib/assistant/policy.ts`) de block numeric claims khi thieu evidence/citation
  - LLM provider fallback (`src/lib/assistant/providers.ts`)

Grounding tools:
- `src/lib/assistant/tools.ts` goi internal endpoints (stock snapshot, fundamentals, backtest summary, ranking...) theo `AssistantQueryPlan`.
- `ASSISTANT_TOOL_BASE_URL` (hoac cac env keys tin cay khac) quy dinh "trusted tool base URL".

Human-in-loop execute:
- `src/app/api/assistant/execute/route.ts`:
  - yeu cau `ASSISTANT_EXECUTE_APPROVAL_TOKEN`
  - build plan qua `src/lib/assistant/executeTools.ts` va forward request sang internal API (trusted base URL)

Tests:
- `src/lib/assistant/executeTools.test.ts`
- `src/lib/assistant/composerPlan.test.ts`
- `src/app/api/assistant/execute/route.test.ts`

## 7. Data Pipeline (Raw -> Prepared Runtime)

Raw datasets nam o workspace-level `data/` (ngoai `quant-website/`).
Pipeline chinh:
- Prepare runtime: `scripts/prepare_data_2018_2025.mjs` (run: `pnpm run data:prepare:2018_2025`)
- Repair fundamentals CSV: `scripts/repair_fundamentals_csv.mjs`
- Validate fundamentals prepared: `scripts/validate_fundamentals_prepared.mjs`
- Export DuckDB: `scripts/export_duckdb_from_runtime.mjs` (run: `pnpm run data:export:duckdb`)

Outputs quan trong:
- `public/data/ohlcv_2018_2025.csv`
- `public/data/stock_metadata_2018_2025.csv`
- `public/data/data_manifest_2018_2025.json` (hoac `data_manifest.json`)
- (optional) `public/data/quant_data.duckdb`

## 8. UI Layer (components)

Layout + navigation:
- `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/Footer.tsx`

Design system:
- `src/components/ui/index.ts` (barrel exports)
- `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, ... (primitive building blocks)
- `src/lib/design-system/colors.ts` (palettes)
- `src/lib/utils.ts` (`cn`, formatting helpers)

Charts:
- Recharts-based: `src/components/charts/LineChart.tsx`, enhanced tooltip/toolbar (`src/components/charts/enhanced/*`)
- Lightweight-charts candlestick: `src/components/charts/CandlestickChart.tsx`
- Lazy loading wrapper: `src/components/charts/lazy.tsx`

Assistant UI:
- `src/components/assistant/AiAssistantPanel.tsx`
- State store: `src/lib/stores/assistantStore.ts`

## 9. Observability, Telemetry, Rate Limit

Rate limit:
- `src/lib/rateLimit.ts`: in-memory store + identifier fingerprinting + response headers helper.

Telemetry:
- `src/app/api/telemetry/ui-kpi/route.ts` (server ingestion)
- `src/lib/uiKpi.ts`, `src/lib/frontendTelemetry.ts` (client helpers)

Performance tracking:
- `src/lib/monitoring/performance.ts` (imported by `src/middleware.ts` for API timing)

## 10. Cach mo rong (pragmatic guide)

### Add 1 API endpoint moi
1. Tao folder: `src/app/api/<name>/route.ts`
2. Reuse shared helpers:
   - data: `src/lib/data.ts`
   - rate limit: `src/lib/rateLimit.ts`
   - logging: `src/lib/logger.ts`
3. Update doc neu endpoint public: `docs/API.md`

### Add 1 page moi
1. Tao `src/app/<page>/page.tsx`
2. Neu can client hooks: them `"use client"` o dau file va dung `@tanstack/react-query`/stores neu can.
3. Add link trong `src/components/layout/Sidebar.tsx` neu la section chinh.

### Add 1 grounding tool cho assistant
1. Define/extend tool in `src/lib/assistant/tools.ts` (task builder + response parsing).
2. Add planner mapping trong `src/lib/assistant/planner.ts` (intent -> steps).
3. Update policy expectations neu tool la "high risk": `src/lib/assistant/policy.ts`.
4. Add/extend tests trong `src/lib/assistant/*.test.ts` va (neu can) route tests.

## 11. Known Constraints (can nho khi review)

- Rate limiting la in-memory (`src/lib/rateLimit.ts`): phu hop single instance; multi-instance can Redis.
- Data caches la in-memory process-level (`src/lib/data.ts`): can can nhac memory footprint khi CSV lon.
- Middleware logging chi log `info` khi dev, nhung van attach `x-request-id` cho moi request (`src/middleware.ts`).
- Mot so docs trong `docs/ARCHITECTURE/*` co the mang tinh "design" (khong phai luon trung khop 100% voi code); uu tien doc code khi conflict.

