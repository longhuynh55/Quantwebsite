# Strategy Lab Template Tuner Backlog (V1)

## P0 - Ship MVP Without Mismatch
- TT-000 Positioning lock: Template Tuner only.
- TT-001 Remove/disable non-semantic nodes (Signal/Output) or show explicit “ignored inputs”.
- TT-002 Connections policy: decorative-only or disabled.
- TT-003 Restrict indicator/filter options to engine-supported set.
- TT-004 Execution Preview panel: resolved template + params + config + dateRange + capital.
- TT-005 Strict mapping: no silent fallback; deterministic errors.
- TT-006 Bias guard: Strategy Lab forces `next_open` by default; `same_close` gated or removed.
- TT-007 Backtest invariants tests (no-lookahead, cost monotonicity, accounting).
- TT-011 E2E smoke: build -> preview -> run -> summary.

## P1 - Iteration Loop
- TT-008 Run history + compare 2-4 runs (with deltas).
- TT-009 Baseline buy-and-hold (same symbol/dateRange/cost model).
- TT-010 Export report schema (JSON + optional CSV).

## Cut List (V1)
- Graph compiler semantics (edges define execution).
- Multi-asset strategies.
- Optimization search (grid/random) beyond manual tuning.

