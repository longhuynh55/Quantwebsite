# Composer + Koyfin Inspired Implementation Backlog (HOSE-only)

## 1) Team and Ownership

- PM/Tech Lead: roadmap, sequencing, release decisions.
- Frontend Lead: workspace UX, compare charts, screener UX, alerts UI, report UX.
- Backend Lead: API contracts, async jobs, caching, observability, export pipelines.
- Quant/BA: product requirements, formulas/metrics, domain validation.
- QA Lead: test matrix, release gates, drift/performance governance.

## 2) Scope Guardrails

- Universe is HOSE-only; no HNX/UPCOM expansion in this plan.
- Reuse current app surfaces (`/charts`, `/screener`, `/backtesting`, `/portfolio`, `/risk`, `/factors`, `/dashboard`).
- Prefer extending existing APIs and quant modules before adding new stacks.

## 3) Prioritized Backlog

### P0 (Must ship first)

#### EPIC A - Research Workspace

- A-01 Multi-symbol compare workspace
  - Owner: Frontend + Quant/BA
  - Deliverables:
    - Symbol-set builder (up to 5 symbols).
    - Synced multi-chart canvas with normalized comparison.
    - Compare metrics panel (return, vol, drawdown, beta).
  - Key files:
    - `src/app/charts/page.tsx`
    - `src/components/charts/CandlestickChart.tsx`
    - `src/components/charts/sync/*`
  - Acceptance:
    - URL/state persists symbol set.
    - Sync on/off works for time-range and crosshair.
    - Compare panel loads <= 4s for 3 entities.

- A-02 Advanced screener UX + criteria API bridge
  - Owner: Frontend + Backend
  - Deliverables:
    - Filter drawer (sector, liquidity range, valuation/factor criteria).
    - Active filter chips + saved presets.
    - Results export (CSV) from current filtered query.
  - Key files:
    - `src/app/screener/ScreenerClient.tsx`
    - `src/app/api/stocks/route.ts`
    - `src/app/api/screener/criteria/route.ts` (new)
    - `src/app/api/screener/query/route.ts` (new)
    - `src/lib/screener/criteria-engine.ts` (new)
  - Acceptance:
    - Full query state shareable by URL.
    - Filter runtime <= 3s on HOSE universe.
    - Export contains current filter/sort scope.

- A-03 Alert center (rules + delivery hooks)
  - Owner: Frontend + Backend
  - Deliverables:
    - Header bell opens alert center panel.
    - Rule CRUD (price/volume/factor/signal threshold).
    - Acknowledge/snooze states and alert timeline.
  - Key files:
    - `src/components/layout/Header.tsx`
    - `src/components/alerts/AlertCenter.tsx` (new)
    - `src/app/api/alerts/*` (new)
    - `src/lib/alerts/*` (new)
  - Acceptance:
    - Alert feed refreshes on interval.
    - New alerts show toast + center entry.
    - Rule evaluation produces deterministic events in QA fixtures.

#### EPIC B - Strategy Lab E2E

- B-01 Strategy builder -> backtest execution pipeline
  - Owner: Backend + Quant/BA
  - Deliverables:
    - Replace "coming soon" action with async run creation.
    - Run status timeline (`queued/running/succeeded/failed`).
    - Persist run versions and compare previous runs.
  - Key files:
    - `src/app/strategy-builder/page.tsx`
    - `src/app/api/strategy-lab/runs/route.ts` (new)
    - `src/app/api/strategy-lab/runs/[runId]/*` (new)
    - `src/lib/strategy-lab/*` (new)
    - `src/lib/jobs/queue.ts` (new)
  - Acceptance:
    - Backtest run returns `202` with `runId`.
    - Trade log completeness is 100% in QA scenario bank.
    - 5-year HOSE run target <= 90s p95 (baseline target).

- B-02 Portfolio risk constraints templates
  - Owner: Quant/BA + Backend + Frontend
  - Deliverables:
    - Max position, sector cap, liquidity, beta/vol limits.
    - Violation panel and override audit log.
  - Key files:
    - `src/app/portfolio/page.tsx`
    - `src/app/risk/page.tsx`
    - `src/app/api/optimize/route.ts`
    - `src/app/api/risk/route.ts`
  - Acceptance:
    - Constraint check runtime <= 2s per refresh.
    - Override records store user/time/reason and old/new value.

### P1 (After P0 stabilization)

#### EPIC C - Workspace and Reporting Depth

- C-01 Watchlist/workspace pro UX (multi-list, tags, quick actions).
- C-02 Report/export center (CSV/PDF) for backtesting, portfolio, charts.
- C-03 Dashboard widget-level configuration profiles.
- C-04 Factor + valuation combined screening templates.

### P2 (Scale and product moat)

#### EPIC D - Platform Scale

- D-01 Distributed cache abstraction for heavy analytics responses.
- D-02 Async job resiliency (retry, dead-letter, lease recovery).
- D-03 Observability dashboards for job queues and eval drift.
- D-04 Collaboration/RBAC for shared workspaces and reports.

## 4) Phase Rollout (4/8/12 weeks)

- Phase 1 (Weeks 1-4): A-01, A-02 foundation, B-01 API skeleton.
- Phase 2 (Weeks 5-8): A-03, B-01 completion, B-02, initial C-02.
- Phase 3 (Weeks 9-12): C-series hardening + D-series platform upgrades.

## 5) Dependencies

- Data layer: `src/lib/data.ts` dataset freshness and manifest integrity.
- Quant engine: `src/lib/quant/*` as single source of calculation truth.
- Assistant/eval governance scripts for drift and release gate readiness.
- Docker QA/smoke pipeline for end-to-end regression confidence.

## 6) QA and Release Gates

- Mandatory per merge:
  - `pnpm run lint`
  - `pnpm exec tsc --noEmit`
  - `pnpm run build`
- Mandatory integration gate:
  - `pnpm run docker:smoke`
  - `pnpm run docker:qa`
- Assistant stability/quality gate:
  - `pnpm run eval:assistant:pr-gate`
  - `pnpm run eval:assistant:perf-reliability`
  - `pnpm run eval:assistant:drift:monitor:skip-run`
- Exit criteria for each phase:
  - No P0 open defects.
  - Regression suites green.
  - Drift monitor status PASS.

## 7) Execution Notes

- Implement P0 in thin vertical slices (UI + API + domain checks + tests together).
- Keep HOSE guardrails explicit at API boundary and UI copy.
- Do not introduce new infrastructure before proving P0 workflows in current stack.
