# Strategy Lab Frontend/UX Architecture

## Scope
- Ownership: frontend and UX architecture for Strategy Lab in `quant-website`.
- Core surfaces:
  - Strategy Builder
  - Parameter Panel
  - Result Dashboard
  - Compare Runs
- Constraint: do not rewrite unrelated existing features; integrate incrementally into current `/backtesting` page.

## Product Goal
Enable users to create, test, iterate, and compare trading strategies with low friction and high confidence.

## UX Principles
- Progressive disclosure: basic path first, advanced controls when needed.
- Guardrails first: prevent invalid runs before API call.
- Fast feedback: users should always know run state and next action.
- Compare-first iteration: make it easy to evaluate "run N vs run N-1".
- Evidence over intuition: show diagnostics and assumptions with every result.

## Current Constraints From Existing Backend
- Endpoint: `POST /api/backtesting`
- Rate limit: 30 requests / minute (must throttle compare batch).
- Supported strategies:
  - `sma_crossover`
  - `ema_crossover`
  - `rsi_mean_reversion`
  - `bollinger_bands`
  - `momentum`
- Validation ranges are strict (params, costs, lot size, capital).
- Result includes:
  - metrics (net/gross return, CAGR, Sharpe, Sortino, drawdown, etc.)
  - `equityCurve`
  - diagnostics (`coverageRatio`, `largestGapDays`, warnings)

## UX Modules

### 1) Strategy Builder Module
Purpose:
- Define the run identity quickly: symbol, strategy type, capital, mode.

UX behaviors:
- "Quick Start" defaults loaded immediately.
- Strategy switch auto-resets parameter defaults.
- Input hints for valid formats and ranges.

Primary outputs:
- `StrategyDraft` (minimal valid run draft)

### 2) Parameter Panel Module
Purpose:
- Configure strategy params + execution/cost model safely.

UX behaviors:
- Simple mode: essential fields only.
- Advanced mode: full params, execution model, fee/tax/slippage/lot size presets.
- Inline validation before submit (mirrors backend rules).
- "Preset chips" for Low Cost / Realistic / Stress.

Primary outputs:
- `RunConfig` (validated payload candidate)

### 3) Result Dashboard Module
Purpose:
- Explain run outcome and confidence at a glance.

UX behaviors:
- KPI strip (top metrics).
- Equity curve + drawdown + monthly heatmap.
- Execution summary and data diagnostics block.
- Warning badges from diagnostics always visible near top.

Primary outputs:
- `RunSnapshot` (result + metadata for history and compare)

### 4) Compare Runs Module
Purpose:
- Compare multiple snapshots side-by-side for decision making.

UX behaviors:
- Select 2-4 runs to compare.
- Fixed baseline option ("compare all against selected baseline").
- Delta view (absolute + percent changes).
- Highlight best/worst by selected metric.

Primary outputs:
- `CompareMatrix` (rows = metrics, cols = selected runs)

## Component Map (Target)

### Page Composition
- `src/app/backtesting/page.tsx`
  - keeps route ownership
  - composes Strategy Lab feature shell

### Feature Folder
- `src/components/strategy-lab/StrategyLabShell.tsx`
  - top-level orchestration and layout
- `src/components/strategy-lab/builder/StrategyBuilder.tsx`
  - symbol/strategy/capital quick setup
- `src/components/strategy-lab/parameters/ParameterPanel.tsx`
  - simple/advanced tabs and validation
- `src/components/strategy-lab/parameters/ExecutionCostPresetBar.tsx`
  - preset shortcuts
- `src/components/strategy-lab/runs/RunActionBar.tsx`
  - run button, cancel, save snapshot
- `src/components/strategy-lab/runs/RunStatusBanner.tsx`
  - loading/error/retry/status messages
- `src/components/strategy-lab/results/ResultDashboard.tsx`
  - KPI + charts + diagnostics wrapper
- `src/components/strategy-lab/results/KpiGrid.tsx`
  - net return, CAGR, Sharpe, drawdown, etc.
- `src/components/strategy-lab/results/DiagnosticsPanel.tsx`
  - coverage, gaps, dropped rows, warnings
- `src/components/strategy-lab/compare/CompareRunsPanel.tsx`
  - run selection and comparison controls
- `src/components/strategy-lab/compare/CompareMetricsTable.tsx`
  - metric deltas and ranking
- `src/components/strategy-lab/history/RunHistoryRail.tsx`
  - recent snapshots, duplicate, pin baseline

### Supporting Hooks/Types
- `src/lib/strategy-lab/types.ts`
  - `StrategyDraft`, `RunConfig`, `RunSnapshot`, `CompareSelection`
- `src/lib/strategy-lab/validation.ts`
  - frontend validation mirrored from backend rules
- `src/lib/strategy-lab/mappers.ts`
  - API response -> UI model mapping
- `src/lib/strategy-lab/useStrategyLabStore.ts`
  - local feature store (draft, running state, snapshots, compare selection)

## State Model

### State Slices
- `draftState`
  - symbol, strategy, capital, mode
- `parameterState`
  - strategy params + execution/cost config
- `runState`
  - loading, request id, error, latest result
- `historyState`
  - snapshot list (recent first)
- `compareState`
  - selected snapshot ids, baseline id, sort metric

### Key Rules
- Never discard latest successful result while next run is pending.
- Compare selection survives failed runs.
- Snapshot IDs deterministic: hash(symbol + strategy + params + config + timestamp).
- Guard against stale responses using request sequence id (already present in current page logic).

## User Flow

### Flow A: Quick Run (first-time user)
1. User opens `/backtesting`.
2. Strategy Builder shows default symbol/strategy/capital.
3. User edits symbol and strategy only.
4. Click "Run".
5. RunStatusBanner shows progress.
6. Result Dashboard displays KPI + charts + diagnostics.
7. User can "Save snapshot" for later compare.

### Flow B: Iterative Tuning (power user)
1. User opens Advanced in Parameter Panel.
2. Adjusts params and execution/cost settings.
3. Inline validation catches invalid ranges immediately.
4. Run and inspect KPI + diagnostics warnings.
5. Duplicate previous run settings, tweak one variable.
6. Save multiple snapshots to compare.

### Flow C: Compare Runs Decision
1. User selects 2-4 snapshots from RunHistoryRail.
2. Sets baseline run.
3. CompareRunsPanel builds metric table and deltas.
4. User sorts by selected metric (for example net return, Sharpe, max drawdown).
5. User chooses winning config and applies it back to Builder in 1 click.

## Compare Runs Interaction Contract
- Max selected runs in compare: 4.
- If user tries to compare more, require deselection first.
- For each run card show:
  - strategy label
  - symbol
  - timestamp
  - key params summary
  - net return + Sharpe + max drawdown
- Delta coloring:
  - green for better metric
  - red for worse metric
  - neutral for equivalent
- Metric direction map:
  - higher is better: `netReturn`, `cagr`, `sharpeRatio`, `sortinoRatio`, `profitFactor`, `winRate`
  - lower is better: `maxDrawdown`, `maxDrawdownDuration`

## API and Concurrency Strategy
- Use existing `POST /api/backtesting` for every run.
- Compare "batch run" behavior on frontend:
  - queue requests sequentially with short spacing to avoid rate-limit spikes
  - stop queue on first fatal validation error
  - keep partial successful results
- Retry strategy:
  - 429: exponential backoff with visible countdown
  - 5xx: immediate retry action in status banner

## Validation and Guardrails
- Frontend rules mirror backend ranges to reduce failed round trips.
- Show exact field-level message (example `params.shortPeriod must be less than params.longPeriod`).
- Hard block run on invalid inputs.
- Soft warning on risky but valid setup (example very high costs).

## Layout Blueprint
- Desktop:
  - Left: Builder + Parameter Panel
  - Right: Result Dashboard
  - Bottom: Compare Runs + Run History
- Mobile:
  - Stepper-like sections:
    1. Setup
    2. Parameters
    3. Results
    4. Compare
  - Sticky RunActionBar at bottom

## Telemetry Events (Recommended)
- `strategy_lab_run_started`
- `strategy_lab_run_succeeded`
- `strategy_lab_run_failed`
- `strategy_lab_snapshot_saved`
- `strategy_lab_compare_opened`
- `strategy_lab_compare_metric_changed`
- `strategy_lab_apply_snapshot_to_builder`

Each event should include:
- symbol
- strategy
- config mode
- timing (ms)
- run id / snapshot id when available

## Implementation Phases

### Phase 1: Modularization Without Behavior Change
- Extract current monolithic page into StrategyLabShell + Builder + ParameterPanel + ResultDashboard.
- Keep current API and metrics unchanged.

### Phase 2: Snapshot and Compare
- Add RunHistoryRail and CompareRunsPanel.
- Enable save/select/baseline/delta workflow.

### Phase 3: UX Hardening
- Add full field-level validation mapping.
- Add queued compare execution and 429 backoff UX.
- Add telemetry events.

## Definition of Done (UX)
- User can run first backtest in under 60 seconds on first visit.
- User can create and compare at least 3 runs without page refresh.
- Invalid params are caught before API call with clear field-level message.
- Diagnostics warnings are visible without scrolling.
- Mobile flow supports full run + compare journey.

