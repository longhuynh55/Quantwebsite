# Strategy Lab Template Tuner Tracker (V1)

## Scope
- Workstream: Strategy Builder -> Template Tuner (drag/drop UX, template-driven execution)
- Status: `todo | in_progress | blocked | done`

## Backlog
| ID | Priority | Area | Item | Status | Acceptance |
|---|---|---|---|---|---|
| TT-000 | P0 | Product | Lock positioning: "Template Tuner", not graph compiler | in_progress | UI + docs never imply arbitrary graph execution |
| TT-001 | P0 | UI | Remove/disable non-semantic nodes (Signal/Output) or label them clearly | done | Users cannot create nodes that don't affect execution (or sees explicit "ignored") |
| TT-002 | P0 | UI | Edges policy: decorative-only or disable connect | done | Connections never imply logic; preview states "connections ignored" if enabled |
| TT-003 | P0 | UI | Restrict indicator/filter options to engine-supported set | done | No unsupported options (MACD/ATR/Volume etc.) available in Template Tuner mode |
| TT-004 | P0 | UI | Execution Preview panel (resolved template + params + config) | done | Preview equals submitted payload; shows "ignored inputs" list |
| TT-005 | P0 | Mapping | Strict mapping rules (no silent fallback) | done | Unsupported graph -> deterministic error; supported -> deterministic payload |
| TT-006 | P0 | Engine | Bias-safe execution defaults: force `next_open` for Strategy Lab | todo | `same_close` not available or requires explicit opt-in warning |
| TT-007 | P0 | Engine | Backtest invariants tests (no-lookahead, monotonic costs, accounting) | todo | Jest suite enforces invariants |
| TT-008 | P1 | UX | Run history + compare 2-4 runs | todo | Users can compare metrics + diagnostics + assumptions |
| TT-009 | P1 | Quant | Baseline: buy-and-hold benchmark per run | todo | Every run report contains baseline and delta |
| TT-010 | P1 | Export | Export report (JSON + CSV trades/equity optional) | todo | Export uses stable schema; reproducibility metadata included |
| TT-011 | P0 | QA | E2E smoke: build -> preview -> run -> summary | todo | Runs in docker and produces artifacts |

## Notes
- Engine supports only `StrategyType` templates today (`src/lib/quant/backtest.ts`).
- If we later do graph compiler, it becomes V2 (new plan/tracker).

