# SOP V2 Execution Log (2026-02-19)

## Team Setup

- PM
- AI Engineering #1 (routing/planner)
- AI Engineering #2 (grounding/policy)
- AI Engineering #3 (performance/reliability)
- QA Lead

Reference:
- `docs/TEAM_RESEARCH_UNITTEST_SOP_V2.md`
- `docs/EXECUTION_BOARD_2WEEK_TURN.md`
- `docs/PERF_RELIABILITY_SOP_V2_PLAN.md`

## Executed Items

1. Routing/planner matrix expanded to meet minimum suite size requirement.
- File: `scripts/eval-assistant-routing-matrix.mjs`
- Change: scenarios increased from 9 to 12.

2. Grounding/policy matrix introduced.
- File: `scripts/eval-assistant-policy-matrix.mjs`
- Scope: 10 policy-focused scenarios with pass/fail gates.

3. Performance/reliability matrix introduced.
- File: `scripts/eval-assistant-perf-reliability.mjs`
- Scope: 10 mixed API/assistant reliability and latency checks.

4. CLI wiring for SOP suites.
- File: `package.json`
- Added:
  - `eval:assistant:policy-matrix`
  - `eval:assistant:perf-reliability`
  - `docker:eval:assistant:policy-matrix`
  - `docker:eval:assistant:perf-reliability`

5. CI gate wiring.
- File: `.github/workflows/qa-integration.yml`
- Added gates:
  - Dev routing matrix
  - Dev policy matrix
  - Dev perf reliability
  - Prod policy/perf gates (push on main/master)

6. Nightly automation.
- File: `.github/workflows/nightly-assistant-gates.yml`
- Added daily scheduled workflow with artifact upload.
- Gate mode: core suites are hard-fail, `eval:assistant:full` is soft-gate with job summary note.

## Execution Commands

Run from `quant-website/`:

1. `pnpm run eval:assistant:routing`
2. `pnpm run eval:assistant:policy-matrix`
3. `pnpm run eval:assistant:perf-reliability`
4. `pnpm run eval:assistant:realworld`
5. `pnpm run eval:assistant:backtesting:kpi-matrix`

## Artifacts

- `artifacts/assistant-routing-matrix-report.json`
- `artifacts/assistant-policy-matrix-report.json`
- `artifacts/assistant-perf-reliability-report.json`
- `artifacts/assistant-realworld-report.json`
- `artifacts/backtesting-kpi-matrix-report.json`
