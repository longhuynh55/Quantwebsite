# Assistant Criteria Evaluation v1

- generatedAt: 2026-02-24T12:31:08.499Z
- baseUrl: http://localhost:3011
- backendActive: csv
- overallStatus: fail

## Criteria

| Criterion | Status | Actual | Threshold | Detail |
| --- | --- | --- | --- | --- |
| data_query_fidelity | FAIL | passRate=100.00%, backend=csv | passRate>=99.00% && backend=duckdb | DuckDB-backed gold fidelity tests |
| tool_route_reliability | FAIL | turn=64.71%, endpoint=66.67% | turn>=99.00%, endpoint>=99.00% | Routing matrix tool+endpoint checks |
| robustness_stress_ohlcv_fundamental_technical_queries | FAIL | turnPassRate=76.98% (97/126) | turnPassRate>=98.00% | Combined stress matrix (ohlcv + fundamentals + metrics) |
| answer_faithfulness_numbers_not_in_data | PASS | violations=0 | violations<=0 | Guard scenarios must not output unsupported numeric claims |
| technical_workflow_backtesting_kpi | PASS | overall=pass, gatesPass=true | overall=pass and/or gatesPass=true | Backtesting KPI matrix for technical/risk handling |

## Suites

| Suite | Exit | Status | Pass rate | Total | Passed | Report |
| --- | --- | --- | --- | --- | --- | --- |
| routing_gold | 1 | FAIL | 64.71% | 17 | 11 | D:\KLTN\Quant wwebsite\quant-website\artifacts\assistant-routing-matrix-report.json |
| ohlcv_stress | 1 | FAIL | 29.41% | 17 | 5 | D:\KLTN\Quant wwebsite\quant-website\artifacts\assistant-ohlcv-stress-report.json |
| fundamentals_stress | 1 | PASS | 100.00% | 30 | 30 | D:\KLTN\Quant wwebsite\quant-website\artifacts\assistant-fundamentals-hyper-noise-matrix-report.json |
| metrics_stress | 1 | FAIL | 78.48% | 79 | 62 | D:\KLTN\Quant wwebsite\quant-website\artifacts\assistant-metrics-stress-matrix-report.json |
| technical_backtesting | 1 | PASS | n/a | n/a | n/a | D:\KLTN\Quant wwebsite\quant-website\artifacts\backtesting-kpi-matrix-report.json |
| query_fidelity_duckdb | 1 | PASS | 100.00% | 4 | 4 | D:\KLTN\Quant wwebsite\quant-website\artifacts\assistant-query-fidelity-report.json |

## Notes

- numbers_not_in_data_violations counts guard-scenario numeric leakage from suite failures.
- fidelity suite uses DuckDB-oriented query fidelity tests and requires backendActive=duckdb for strict pass.
