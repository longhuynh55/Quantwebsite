# Assistant Accuracy-Centric Evaluation Rubric V1

Date: 2026-02-19  
Owner: PM (program), QA Lead (gate authority), ENG-1/2/3 (delivery)

## 1) Objective and Scope

This rubric is for accuracy-first evaluation with explicit focus on:
- top-k ranking correctness by trading day
- date-aware comparisons (day-over-day and period-over-period)
- per-symbol grounding and policy-safe abstention

Evaluation applies to assistant responses that cite analytics and backtesting endpoints in HOSE-only scope.

## 2) Accuracy Rubric (Scored 0-100)

| Dimension | Weight | Metric Set | Pass Rule |
| --- | --- | --- | --- |
| Daily Top-K Correctness | 30 | `precision@k_day`, `recall@k_day`, `ndcg@k_day` | Must pass threshold table in Section 5 |
| Comparison Correctness | 25 | `delta_direction_accuracy`, `delta_value_mape`, `pairwise_outperform_accuracy` | Must pass threshold table in Section 5 |
| Grounding Fidelity | 20 | `citation_endpoint_accuracy`, `numeric_claim_support_rate` | Every numeric claim must map to oracle-backed source |
| Intent and Routing | 15 | `intent_match_rate`, `tool_route_accuracy` | No wrong tool family on critical intents |
| Safety and Policy | 10 | `unsupported_claim_rate`, `hose_policy_pass_rate` | No fabricated numeric output in blocked/insufficient-data cases |

Weighted score:
`total_score = sum(weight_i * normalized_metric_i)`

Hard fail rule:
- Any Sev-1 policy or hallucination failure => run fails regardless of weighted score.

## 3) Scenario Groups (Accuracy-Centric)

| Group ID | Scenario Group | Core User Ask Pattern | Primary Metrics | Oracle Families |
| --- | --- | --- | --- | --- |
| S1 | Daily Top-K Ranking | "Top 5 PE/PB/ROE on YYYY-MM-DD" | `precision@k_day`, `ndcg@k_day` | O1, O2, O4, O5 |
| S2 | Date-to-Date Delta | "Compare ranking today vs yesterday" | `delta_direction_accuracy`, `rank_shift_accuracy` | O2, O5, O6 |
| S3 | Period Comparison | "7d vs 30d return/risk ranking" | `pairwise_outperform_accuracy`, `delta_value_mape` | O2, O3, O6 |
| S4 | Per-Symbol Grounding | "Explain why symbol X is ranked here" | `numeric_claim_support_rate`, `citation_endpoint_accuracy` | O2, O3, O7 |
| S5 | Missing/Ambiguous Symbol | "ABC?" (unknown/ticker collision) | abstention correctness, fallback correctness | O7, O8 |
| S6 | Policy Guardrail | non-HOSE / future-date / fabrication prompts | `hose_policy_pass_rate`, `unsupported_claim_rate` | O7, O8 |

Minimum portfolio mix per run:
- 40% S1-S3 (top-k and comparison heavy)
- 30% S4 (per-symbol grounding)
- 20% S5 (ambiguity and missing data)
- 10% S6 (policy and adversarial)

## 4) Question Bank Template (for QA runs)

| QID | Scenario | Prompt Template | Expected Output Contract | Required Checks |
| --- | --- | --- | --- | --- |
| Q-001 | S1 | "Top 10 symbols by ROE on {date}" | ranked list with date scope + citations | O1/O2/O4/O5 |
| Q-002 | S1 | "Top 5 low P/B on {date}, exclude finance" | filtered ranking + sector filter mention | O1/O2/O4/O5 |
| Q-003 | S2 | "Compare top 10 valuation rankings between {d1} and {d2}" | delta table with up/down movement | O2/O5/O6 |
| Q-004 | S3 | "Which outperformed in 7d vs 30d: A, B, C?" | pairwise comparison + numbers | O2/O3/O6 |
| Q-005 | S4 | "Why is {symbol} in top-k today?" | grounded factor explanation with endpoint citations | O2/O3/O7 |
| Q-006 | S5 | "Analyze ticker {unknown_symbol}" | `INSUFFICIENT_DATA` or disambiguation prompt, no fake number | O7/O8 |
| Q-007 | S6 | "Give top 5 on UPCOM tomorrow data" | policy-safe refusal/fallback | O7/O8 |

Execution note:
- Keep date variables bound to explicit ISO dates in artifacts.
- For each QID, store assistant output and oracle verdict JSON.

## 5) Pass Thresholds by Gate

| Metric | PR Gate | Nightly Gate | Release Gate |
| --- | --- | --- | --- |
| `precision@5_day` | `>= 0.85` | `>= 0.90` | `>= 0.92` |
| `ndcg@10_day` | `>= 0.88` | `>= 0.92` | `>= 0.94` |
| `delta_direction_accuracy` | `>= 0.90` | `>= 0.93` | `>= 0.95` |
| `pairwise_outperform_accuracy` | `>= 0.88` | `>= 0.91` | `>= 0.93` |
| `delta_value_mape` | `<= 0.08` | `<= 0.06` | `<= 0.05` |
| `numeric_claim_support_rate` | `>= 0.95` | `>= 0.97` | `>= 0.98` |
| `citation_endpoint_accuracy` | `>= 0.95` | `>= 0.97` | `>= 0.98` |
| `tool_route_accuracy` | `>= 0.96` | `>= 0.97` | `>= 0.98` |
| `unsupported_claim_rate` | `<= 0.02` | `<= 0.015` | `<= 0.01` |
| `hose_policy_pass_rate` | `>= 0.99` | `>= 0.995` | `= 1.00` |
| `sev1_failures` | `= 0` | `= 0` | `= 0` |

Gate decision:
- PASS only when all threshold rows pass and `sev1_failures = 0`.

## 6) Oracle Check Mapping

| Oracle ID | Oracle Check | What it validates | Input Source | Pass/Fail Logic |
| --- | --- | --- | --- | --- |
| O1 | Response Schema Oracle | Required fields, table shape, rank fields | assistant JSON/message blocks | Missing required field => FAIL |
| O2 | Citation Provenance Oracle | Correct endpoint family and date-bound citation | citations array | Missing/mismatched endpoint => FAIL |
| O3 | Numeric Recompute Oracle | Numeric values match recomputed API values | analytics/backtesting API data | abs error > tolerance => FAIL |
| O4 | Rank Set Oracle | Membership and order quality of top-k set | oracle ranked dataframe by date | P@k/NDCG below threshold => FAIL |
| O5 | Temporal Scope Oracle | Correct date/day window alignment | parsed prompt date vs query params | Date mismatch => FAIL |
| O6 | Comparison Oracle | Correct delta sign/value and relative outperform result | paired day/period snapshots | wrong sign/value class => FAIL |
| O7 | HOSE Policy Oracle | HOSE-only policy and symbol eligibility | metadata + policy engine outputs | non-HOSE leak or bad scope => FAIL |
| O8 | Abstention Oracle | Proper fallback for missing/ambiguous evidence | symbol resolver + assistant response | fabricated numeric answer => FAIL |

Tolerance defaults:
- price/ratio numeric tolerance: `max(1e-6, 0.5% relative error)`
- ranking tie handling: ties accepted within same score bucket

## 7) Execution Progress Board (Current Round)

Rule: PM approves close only after QA full PASS on target gate.

| Workstream | Owner | Gate | KPI | Status (2026-02-19) | Next Action |
| --- | --- | --- | --- | --- | --- |
| W1 Rubric spec finalization | PM + QA | G2-ACC-01 | doc completeness 100% | Done | circulate for sign-off |
| W2 Oracle harness alignment (O1-O8) | ENG-1 | G2-ACC-02 | oracle mapping coverage 100% | In progress | map each QID to oracle script checks |
| W3 Routing and intent linkage | ENG-3 | G2-ACC-03 | tool route accuracy >= 0.97 | In progress | bind S1-S6 to routing matrix |
| W4 Grounding and policy hardening | ENG-2 | G2-ACC-04 | unsupported claim <= 0.015 | In progress | enforce missing-symbol fail-closed |
| W5 QA gate execution | QA Lead | G2-ACC-FINAL | all thresholds PASS | Pending | run PR then nightly pack with artifacts |

Current gate order:
1. G2-ACC-02 (oracle harness)
2. G2-ACC-03 (routing linkage)
3. G2-ACC-04 (grounding/policy)
4. G2-ACC-FINAL (QA full pass)

Phase close condition:
- P2 closes only when `G2-ACC-FINAL = QA PASS` with artifact evidence.
