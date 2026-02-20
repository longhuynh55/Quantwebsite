# Assistant Backtesting KPI Matrix

This runbook defines the HOSE-only backtesting KPI gate using `scripts/eval-backtesting-kpi-matrix.mjs`.

## KPI Thresholds (Default)

| KPI | Gate |
| --- | --- |
| `apiSuccessRate` | `>= 0.90` |
| `assistantGroundingRate` | `>= 0.90` |
| `coverageAcrossBuckets` | `>= 1.00` |
| `coverageAcrossProfiles` | `>= 1.00` |
| `latencyP95` | `<= 30000ms` |
| `s1Failures` | `<= 0` |

Assistant grounding for each case passes only when all conditions are true:
- `/api/assistant` response is successful.
- `usedTools` contains `backtestSummary:success`.
- citations include `/api/backtesting`.
- `policyStatus` is allowed (`ok`, `fallback`, `shadow_blocked` by default).
- if `BACKTEST_KPI_EXPECT_PROVIDER` is set, `meta.providerUsed` must match expected provider/model.

## Scope and Diversity

- Universe: `public/data/stock_metadata_2018_2025.csv`, `exchange=HOSE` only.
- Liquidity buckets: `small`, `mid`, `large` by `avg_volume` quantiles (P33/P66).
- Default sample: `2` symbols per bucket (`BACKTEST_KPI_SYMBOLS_PER_BUCKET=2`).
- API matrix:
  - 5 strategies x 3 profiles (`short`, `medium`, `long`) + symbol-coverage cases.
- Assistant matrix:
  - one grounded backtesting prompt per selected symbol.

## Run Commands

- Local dry-run (no network call):
  - `pnpm run eval:assistant:backtesting:kpi-matrix -- --dry-run`
- Local live run:
  - `pnpm run eval:assistant:backtesting:kpi-matrix`
- Docker live run:
  - `pnpm run docker:eval:assistant:backtesting:kpi-matrix`

Default artifact:
- `artifacts/backtesting-kpi-matrix-report.json`

## Environment Variables

Core:
- `BACKTEST_KPI_BASE_URL` (default: `http://localhost:3010`)
- `BACKTEST_KPI_REPORT_PATH`
- `BACKTEST_KPI_DRY_RUN`
- `BACKTEST_KPI_SYMBOLS_PER_BUCKET`
- `BACKTEST_KPI_REQUIRE_ACTIVE_METADATA`
- `ASSISTANT_EVAL_AUTH_TOKEN`

Runtime:
- `BACKTEST_KPI_TIMEOUT_MS`
- `BACKTEST_KPI_RETRY_BACKOFF_MS`
- `BACKTEST_KPI_API_MAX_RETRIES`
- `BACKTEST_KPI_ASSISTANT_MAX_RETRIES`

Policy:
- `BACKTEST_KPI_ALLOWED_POLICY_STATUSES`
- `BACKTEST_KPI_EXPECT_PROVIDER` (comma-separated, example: `openrouter-gpt-oss-120b`)
- `BACKTEST_KPI_MIN_EXPECTED_PROVIDER_RATE` (default `1` when expected provider is configured)

Gate overrides:
- `BACKTEST_KPI_MIN_API_SUCCESS_RATE`
- `BACKTEST_KPI_MIN_ASSISTANT_GROUNDING_RATE`
- `BACKTEST_KPI_MIN_COVERAGE_ACROSS_BUCKETS`
- `BACKTEST_KPI_MIN_COVERAGE_ACROSS_PROFILES`
- `BACKTEST_KPI_MAX_LATENCY_P95_MS`
- `BACKTEST_KPI_MAX_S1_FAILURES`
