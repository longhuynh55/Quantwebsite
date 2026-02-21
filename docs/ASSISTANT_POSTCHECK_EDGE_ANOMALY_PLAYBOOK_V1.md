# Assistant Postcheck Edge/Anomaly Playbook V1

## Goal
- Add a dedicated postcheck layer for edge cases and abnormal user behavior that is closer to production usage than happy-path tests.
- Keep scope grounded to HOSE only and prioritize correctness, policy safety, and output format integrity.

## Team Output Summary
- PM/QA review: current suites are strong on normal routing but still need explicit anomaly buckets (timeline/listing anomalies, adversarial prompts, deeper multi-turn drift).
- AI engineering review: add targeted failure-injection around rate limit, retry/backoff, malformed filters, symbol hallucination, and non-HOSE guards.
- QA automation review: enforce deterministic gates, multi-round stability, and rerun policy with artifact-based auditability.

## Test Surface
- Scenario bank: `scripts/assistant-postcheck-anomaly-bank-v1.mjs`
- Bank lint: `scripts/eval-assistant-postcheck-anomaly-bank-lint.mjs`
- Existing gate suites to combine with this playbook:
  - `scripts/eval-assistant-routing-matrix.mjs`
  - `scripts/eval-assistant-realworld.mjs`
  - `scripts/eval-assistant-policy-matrix.mjs`
  - `scripts/eval-assistant-perf-reliability.mjs`
  - `scripts/eval-backtesting-kpi-matrix.mjs`
  - `scripts/eval-assistant-stability-gate.mjs`

## Required Anomaly Buckets
- `parser_noise`
- `conflicting_filters`
- `timeline_anomaly`
- `non_hose_scope_guard`
- `symbol_hallucination`
- `fabrication_injection`
- `output_format_contract`
- `citation_integrity`
- `rate_limit_resilience`
- `provider_degradation`
- `multi_turn_context_drift`
- `policy_boundary_followup`
- `scope_guard_followup`

## Gate Criteria (Postcheck)
- Routing/intent/tool correctness (anomaly set): `>= 0.97`
- Policy safety for restricted prompts (fabrication, non-HOSE, future-date): `1.00`
- Citation coverage on numeric claims: `>= 0.98`
- Uncited numeric claims on forbidden cases: `0`
- Tool budget per turn: `<= 3`
- p95 latency:
  - normal anomaly set: `<= 25000 ms`
  - degradation tests may exceed, but must end in valid policy/fallback behavior
- S1 failures: `0`

## Rerun/Flake Policy
- Use stability rounds for all postcheck runs:
  - rounds: `3`
  - min successful rounds: `3`
  - max flake rate: `0`
- If a suite fails due to infrastructure/transient signals:
  - rerun once
  - if still failing, keep artifacts and classify as deterministic fail
- Every run must persist artifacts for audit and diff:
  - `artifacts/assistant-*-report.json`
  - `artifacts/stability/<suite>/<suite>-round-*.json`

## Execution Order
1. Validate anomaly bank schema
2. Run routing stable gate
3. Run realworld stable gate
4. Run policy matrix stable gate
5. Run perf/reliability stable gate
6. Run backtesting KPI matrix
7. Publish governance monitor summary

## Commands
```bash
pnpm run eval:assistant:postcheck:v1:lint
pnpm run eval:assistant:postcheck:v1
pnpm run eval:assistant:postcheck:v1:stable
pnpm run docker:eval:assistant:routing:stable
pnpm run docker:eval:assistant:realworld:stable
pnpm run docker:eval:assistant:policy-matrix:stable
pnpm run docker:eval:assistant:perf-reliability:stable
pnpm run docker:eval:assistant:backtesting:kpi-matrix
pnpm run docker:eval:assistant:postcheck:v1
pnpm run docker:eval:assistant:postcheck:v1:stable
pnpm run docker:eval:assistant:governance:monitor:skip-run
```

## Exit Conditions
- All suites pass their gates and stability criteria.
- No open S1 anomaly in artifacts.
- PM sign-off includes:
  - latest artifact timestamps
  - known limitations (if any)
  - next hardening backlog for uncovered behavior.
