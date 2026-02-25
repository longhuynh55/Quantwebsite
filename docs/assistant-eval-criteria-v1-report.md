# Assistant Criteria Evaluation v1

- generatedAt: 2026-02-25T02:42:44.747Z
- baseUrl: http://app-prod:3000
- backendActive: duckdb
- overallStatus: pass

## Criteria

| Criterion | Status | Actual | Threshold | Detail |
| --- | --- | --- | --- | --- |
| data_query_fidelity | PASS | passRate=100.00%, backend=duckdb | passRate>=99.00% && backend=duckdb | DuckDB-backed gold fidelity tests |
| tool_route_reliability | PASS | turn=100.00%, endpoint=100.00% | turn>=99.00%, endpoint>=99.00% | Routing matrix tool+endpoint checks |
| robustness_stress_ohlcv_fundamental_technical_queries | PASS | turnPassRate=100.00% (126/126) | turnPassRate>=98.00% | Combined stress matrix (ohlcv + fundamentals + metrics) |
| answer_faithfulness_numbers_not_in_data | PASS | violations=0 | violations<=0 | Guard scenarios must not output unsupported numeric claims |
| technical_workflow_backtesting_kpi | PASS | overall=pass, gatesPass=true | overall=pass and/or gatesPass=true | Backtesting KPI matrix for technical/risk handling |

## Suites

| Suite | Exit | Status | Pass rate | Total | Passed | Report |
| --- | --- | --- | --- | --- | --- | --- |
| query_fidelity_duckdb | null | PASS | 100.00% | 4 | 4 | /app/artifacts/assistant-query-fidelity-report.json |
| routing_gold | null | PASS | 100.00% | 17 | 17 | /app/artifacts/assistant-routing-matrix-report.json |
| ohlcv_stress | null | PASS | 100.00% | 17 | 17 | /app/artifacts/assistant-ohlcv-stress-report.json |
| fundamentals_stress | null | PASS | 100.00% | 30 | 30 | /app/artifacts/assistant-fundamentals-hyper-noise-matrix-report.json |
| metrics_stress | null | PASS | 100.00% | 79 | 79 | /app/artifacts/assistant-metrics-stress-matrix-report.json |
| technical_backtesting | null | PASS | n/a | n/a | n/a | /app/artifacts/backtesting-kpi-matrix-report.json |

## Notes

- numbers_not_in_data_violations counts guard-scenario numeric leakage from suite failures.
- fidelity suite uses DuckDB-oriented query fidelity tests and requires backendActive=duckdb for strict pass.
