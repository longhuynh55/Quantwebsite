# Strategy Lab Team Decision (PM + Quant + Dev)

## Team Composition
- PM (coordination, prioritization, gates)
- Quant Research (strategy logic, market realism)
- Quant Math (validation, anti-bias guardrails)
- Backend Dev (API, execution engine, job orchestration, storage)
- Frontend Dev (builder UX, dashboard, compare runs)

## Objective
Design the Strategy Lab module for quant-website with a balanced roadmap between quant rigor and engineering feasibility, focused on internal-release readiness.

## P0 Functions (MVP Internal, Must-Have)
1. Strategy Builder + Parameter Panel with strict validation guardrails.
2. Async run lifecycle: create run, status, events, cancel.
3. Worker orchestration with retry/backoff/lease recovery.
4. Composite strategy v1 (trend + momentum + value).
5. Portfolio/risk layer v1 (risk budget, liquidity filter, position constraints).
6. Cost model integration (fee, tax, slippage, lot size).
7. Validation pack v1 (walk-forward + rolling/purged CV + anti-bias checks).
8. Statistical validity v1 (significance + reality-check output).
9. Robustness v1 (perturbation for cost/liquidity/parameter sensitivity).
10. Result dashboard (KPI, diagnostics, benchmark comparison).
11. Snapshot history + compare 2-4 runs + baseline delta.
12. Telemetry, health endpoint, audit trail, release runbook.

## P1 Functions
1. Batch experiments (grid/random search).
2. Advanced stress/regime scenario tests.
3. Export/share reports (XLSX/PDF).
4. Advanced portfolio options and constraint sets.
5. Enhanced compare UX (saved views, metric presets).

## P2 Functions
1. Distributed queue/runtime (BullMQ or Temporal).
2. S3 artifact storage + retention policies.
3. Multi-asset and multi-frequency pipeline.
4. Auto-suggest parameter tuning and ranking explainability.

## 8-Week Coordination Plan
1. W1: Freeze PRD/API/UX/metric contracts.
2. W2: Build foundation (DB schema, run/job/events/artifacts primitives).
3. W3-W4: Integrate quant core (composite, risk/liquidity, cost model).
4. W5-W6: Validation + compare UX hardening.
5. W7: QA hardening, observability, performance and resilience checks.
6. W8: Internal release pilot and KPI baseline capture.

## Release Gates
1. G0: Contracts frozen.
2. G1: Async run E2E works.
3. G2: Core quant engine stable.
4. G3: Validation and compare pass.
5. G4: QA/lint/tsc/build/smoke/qa pass.
6. G5: Internal go-live approved.

## KPI Targets (Release Gate)
1. Run success rate >= 95%.
2. API 5xx <= 1%.
3. P95 run duration: single <= 45s, composite <= 180s.
4. 100% run reproducibility metadata (`engineVersion`, `dataSnapshotId`, `inputHash`).
5. 100% run output includes anti-bias + validation artifacts.
6. >= 90% invalid configs blocked at frontend pre-submit.

## Core Risks And Mitigation
1. Data bias (lookahead/survivorship): enforce snapshot and anti-bias checks in pipeline.
2. Compute bottlenecks on validation: async job orchestration + phase gates + load checks.
3. FE/BE contract churn: freeze contracts at W1 with decision log.
4. False confidence from backtest: require significance/reality/robustness outputs for every run.

## Linked Design Artifacts
- `docs/STRATEGY_LAB_BACKEND_TECH_DESIGN.md`
- `docs/STRATEGY_LAB_FRONTEND_UX_ARCHITECTURE.md`
