# QuantVN Pro Features Progress

<!-- AGENT_PROGRESS_AUTO_START -->
## Composer Agent Auto Sync
- Generated: 2026-02-25T08:16:52.156Z
- Tracker Updated At: 2026-02-25
- Status: todo=0, in_progress=1, done=14, blocked=0
- Next Actions:
  - Close PERF-01: DuckDB deployments do not load full OHLCV into memory for health checks or other summary endpoints.
<!-- AGENT_PROGRESS_AUTO_END -->







## Strategy Lab Track (2026-02-21)
### Completed
- [x] Added reproducibility metadata in Strategy Lab run result (`engineVersion`, `dataSnapshotId`, `inputHash`).
- [x] Added anti-bias signals into Strategy Lab summary/result payloads (`coverageRatio`, `largestGapDays`, warning signals, trade density proxy).
- [x] Added Strategy Lab runtime/store health snapshot and new endpoint: `GET /api/strategy-lab/health`.
- [x] Added health route tests: `src/app/api/strategy-lab/health/route.test.ts`.
- [x] Added Strategy Lab store persistence adapter contract + snapshot serialization/hydration in store layer.
- [x] Added file-based persistence adapter and env bootstrap (`STRATEGY_LAB_STORE_FILE`).
- [x] Added persistence tests: `src/lib/strategy-lab/store.persistence.test.ts`.
- [x] Added retry/backoff policy for transient execution failures in run lifecycle (`run_retry_scheduled`).
- [x] Added transient retry coverage test in orchestrator suite.
- [x] Added cancel-safe execution signal for in-flight runs (`AbortSignal` propagation + `RUN_ABORTED` handling).
- [x] Added lifecycle event payload enrichment (attempt/retry metadata and cancel reason).
- [x] Added Strategy Lab repository abstraction (`memory|postgres`) with in-memory fallback.
- [x] Added Postgres schema/types/repository skeleton for Strategy Lab persistence track.
- [x] Refactored orchestrator to depend on repository layer instead of direct store calls.
- [x] Added QA gate checklist for Strategy Lab reliability/testing flow.
- [x] Implemented `Idempotency-Key` support for `POST /api/strategy-lab/runs` with conflict detection.
- [x] Added Postgres queue primitives for worker leasing/heartbeat/recovery (`postgres-queue.ts`).
- [x] Added cursor/limit pagination for Strategy Lab result slices (`include=equity|trades`).
- [x] Added Strategy Lab worker step loop (`lease -> run -> heartbeat -> success/retry/fail/cancel`) in DB mode module.
- [x] Added worker unit tests for idle/retry/success paths.
- [x] Refactored Strategy Lab repository/orchestrator flow to async-capable interface (enables DB repository).
- [x] Added runtime Postgres bootstrap with env-driven fallback to memory (`STRATEGY_LAB_REPOSITORY_BACKEND`).
- [x] Added internal worker tick API for DB-mode ops testing (`POST /api/strategy-lab/worker/tick`).
- [x] Added worker daemon scripts (`strategy-lab:worker`, `strategy-lab:worker:once`) and runbook.
- [x] Re-ran Strategy Lab unit/API/UI tests: `8 suites, 25 tests passed`.
- [x] Re-ran targeted Strategy Lab regression suite: `5 suites, 19 tests passed`.
- [x] Re-ran expanded Strategy Lab regression suite: `6 suites, 26 tests passed`.
- [x] Re-ran expanded Strategy Lab regression suite v2: `7 suites, 30 tests passed`.
- [x] Re-ran project typecheck: `pnpm exec tsc --noEmit` passed.

### In Progress
- [ ] Replace in-memory run store with durable persistence (DB).

## Composer Agent Track (2026-02-21)
### Completed
- [x] AGT-03 skeleton UI: `prompt -> plan preview -> approval token -> execute -> result` in assistant panel
- [x] Added composer planner helper + unit tests: `src/lib/assistant/composerPlan.ts`, `src/lib/assistant/composerPlan.test.ts`
- [x] Added route-level + contract-level agent verification scripts in CI path (`verify:agent:advanced` and Docker eval gate)

### Plan (Sprint-based)
- Sprint 1 focus: AGT-00/01/02/03 (registry single source of truth, resilient execute dispatcher, executionMode metadata, composer UX polish).
- Sprint 2 focus: AGT-04/05 (reliability budgets + stable/automated eval & release gates; expand numeric fidelity beyond backtest).

## Composer Agent Track (2026-02-20)
### Planning and Tracking
- [x] Created roadmap: `docs/COMPOSER_AGENT_FUNCTION_CALLING_ROADMAP_V1.md`
- [x] Created execution tracker: `docs/COMPOSER_AGENT_FUNCTION_CALLING_TRACKER_V1.json`
- [x] Created weekly status template: `docs/COMPOSER_AGENT_WEEKLY_STATUS_TEMPLATE.md`

### In Progress
- [ ] Phase 0/1 backend foundation (strict tool registry + secure execute dispatcher)
- [ ] Assistant orchestration mode metadata (`chat` vs `agent`)

## Week 1 (2026-02-20)
### Completed
- [x] Dependencies installed (react-grid-layout, @xyflow/react, @dnd-kit)
- [x] Documentation structure created
- [x] Roadmap defined
- [x] Dashboard store (Zustand with persistence)
- [x] DashboardLayout component
- [x] WidgetWrapper component
- [x] WidgetPalette component
- [x] 6 widget types (Portfolio, Watchlist, Performance, TopMovers, MarketOverview, News)
- [x] Strategy Builder store
- [x] Strategy Canvas (React Flow)
- [x] 5 strategy node types
- [x] Node Palette
- [x] Property Panel
- [x] WebSocket Manager
- [x] Subscription Manager
- [x] Real-time hooks
- [x] Advanced Price Chart
- [x] Drawing Toolbar
- [x] Indicator Overlay
- [x] TypeScript error fixes
- [x] Documentation files
- [x] Accessibility fixes (aria-labels)

### Completed (Phase 2)
- [x] AI Strategy Assistant (OpenRouter/GPT-120B-OSS)
- [x] Community Strategy Sharing
- [x] Multi-Chart Sync & Optimization
- [x] All TypeScript errors fixed
- [x] All pages tested (200 OK)

### Blocked
- None

---

## Metrics
| Metric | Target | Current |
|--------|--------|---------|
| Dashboard Widgets | 6 | 6 ✅ |
| Strategy Nodes | 5 | 5 ✅ |
| Drawing Tools | 5 | 5 ✅ |
| Test Coverage | 80% | 0% |

---

## Daily Log

### 2026-02-20
- Started Phase 1 implementation
- Created team structure for parallel development
- Installed dependencies
- Created Dashboard components (6 widgets, layout, palette)
- Created Strategy Builder components (canvas, nodes, palette, panel)
- Created WebSocket infrastructure (manager, subscription, hooks)
- Created Advanced Charts (price chart, drawing toolbar, indicators)
- Fixing TypeScript errors
