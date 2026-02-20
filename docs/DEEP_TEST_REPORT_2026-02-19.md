# Deep Test Report - 2026-02-19

## Scope
- API reliability and correctness (HOSE-only constraints included)
- Quant route enhancements (`/api/risk`, `/api/optimize` with `min_variance`)
- Assistant stability suites and KPI matrix

## Executed Test Commands
1. `pnpm run docker:smoke:api`
2. `pnpm run docker:qa:api`
3. `pnpm run docker:eval:assistant:backtesting:kpi-matrix`
4. `pnpm run docker:eval:assistant:routing:stable`
5. `pnpm run docker:eval:assistant:realworld:stable`
6. Custom deep API matrix (10 cases) via `docker compose exec app node -e ...`

## Results Summary

### A) API Smoke/QA
- `docker:smoke:api`: PASS
- `docker:qa:api`: PASS
- Key checks covered: stocks/fundamentals/market-overview/risk/backtesting/factors and invalid inputs.

### B) Quant Route Deep Checks (Custom Matrix: 10/10 PASS)
Passed cases:
1. Risk response includes `sortinoRatio`, `downsideDeviation`, `tailLossRatio95`, `analysis.isUnderwater`.
2. Risk invalid benchmark returns `400`.
3. Risk partial-history symbol returns `400`.
4. Optimize `min_variance` returns valid allocations and diagnostics.
5. Optimize `equal_weight` sum of weights is valid.
6. Optimize invalid method returns `400`.
7. Optimize duplicate symbols returns `400`.
8. Optimize wrong content-type returns `415`.
9. Backtesting baseline valid strategy returns metrics.
10. Backtesting invalid strategy returns `400`.

### C) Backtesting KPI Matrix
Artifact: `artifacts/backtesting-kpi-matrix-report.json`
- `apiSuccessRate`: `1.00` (PASS)
- `assistantGroundingRate`: `0.00` (FAIL)
- `coverageAcrossBuckets`: `0.00` (FAIL)
- `coverageAcrossProfiles`: `1.00` (PASS)
- `latencyP95`: `527ms` (PASS)
- `s1Failures`: `6` (FAIL)
- Overall: `FAIL` (API stable, assistant grounding gate failed)

### D) Assistant Stability - Routing
Artifact: `artifacts/assistant-routing-stability-report.json`
- Suite status: `FAIL`
- Pass rate round 1: `0.941176`
- Failing scenario:
  - `L3_D01_risk_metrics`
  - Reason: `tool call count exceeds max: max=3, actual=4`
  - Tools used: `fundamentalSnapshot`, `riskSnapshot`, `marketSnapshot`, `fundamentalAnalysis`

### E) Assistant Stability - Realworld
Artifact: `artifacts/assistant-realworld-stability-report.json`
- Suite status: `FAIL`
- Pass rate round 1: `0.96`
- Failing scenario:
  - `RW_MARKET_OVERVIEW`
  - Reasons:
    - required tool mismatch (expected `marketSnapshot`)
    - missing citation endpoint `/api/market-overview`
    - intent mismatch (`expected=market`, `actual=stock_snapshot`)

## Diagnosis
1. Quant API layer is currently stable and robust for tested routes.
2. Main failures are in assistant orchestration/routing, not in core market/risk/backtesting APIs.
3. Two concrete assistant defects are reproducible:
   - Over-budget tool chaining in risk intent.
   - Market-overview query routed to stock snapshot intent.

## Immediate Fix Priorities
1. Add strict planner guard for market intent keywords (`market overview`, `VNINDEX`, `top gainer/loser`) -> force `marketSnapshot`.
2. Add tool-budget-aware pruning for risk intent (skip extra `fundamentalAnalysis` when required metrics already satisfied by `riskSnapshot`).
3. Add assertion in eval PR gate to reject `market` intent if `/api/market-overview` citation is missing.
4. Re-run:
   - `docker:eval:assistant:routing:stable`
   - `docker:eval:assistant:realworld:stable`
   - `docker:eval:assistant:backtesting:kpi-matrix`
