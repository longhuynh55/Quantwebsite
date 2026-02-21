# UI/UX Backlog Execution V1 (HOSE-Only)

## 1) Team and Scope

Team roles used for this backlog:
- PM
- Finance analyst
- Quant researcher
- Market research
- Full-stack dev
- QA

Scope principles:
- Data domain: HOSE only.
- Prioritize robust/accurate behavior before adding complexity.
- Roll out in small slices with smoke/qa gates between slices.

## 2) Product Goals

- Increase practical value of existing pages: `screener`, `charts`, `backtesting`, `portfolio`, `risk`, `assistant`.
- Improve retention loops via saved states, watchlist, alerts, and report outputs.
- Keep current successful flows stable while adding upgrades.

## 3) Horizon Backlog

### H1 (2-4 weeks): High impact + high feasibility

| ID | Epic | Owner | Acceptance Criteria | KPI |
|---|---|---|---|---|
| H1-1 | Screener saved filters + quick re-apply | FE + QA | Save/delete/apply presets works and does not break URL filter state | Saved preset reuse rate >= 30% weekly |
| H1-2 | Watchlist base integration (screener -> charts) | FE | User can add symbol to watchlist and open watchlist in charts flow | Watchlist interaction >= 25% sessions on screener |
| H1-3 | Reusable export hooks for report outputs | FE + BE | Export context is shared and available for screener/backtesting/portfolio | Export success rate >= 98% |
| H1-4 | Assistant contextual quick actions | FE + BE | Assistant receives page/symbol/filter context and suggests relevant actions | Contextual action click-through >= 20% |
| H1-5 | Data/grounding status visibility in assistant | BE + QA | Policy/grounding meta is exposed and rendered consistently | Unsupported-claim rate <= gate threshold |

### H2 (1-2 months): Financial + quant depth

| ID | Epic | Owner | Acceptance Criteria | KPI |
|---|---|---|---|---|
| H2-1 | Finance quality flags (coverage, one-off, accrual, CCC) | Finance + BE | Flags and metrics available in API and rendered in analysis UI | Financial analysis completion rate +20% |
| H2-2 | Peer percentile and HOSE bucket compare | Finance + FE | Peer compare page/report includes percentile and bucket labels | Peer compare usage +25% |
| H2-3 | Backtest multi-symbol + parameter sweep | Quant + BE | Multi-symbol runs complete with diagnostics and no lookahead regressions | Backtest scenario coverage +40% |
| H2-4 | Risk scenario/stress analytics | Quant + BE | Stress outputs available and linked from portfolio | Risk page interaction +30% |
| H2-5 | Factor depth (quality, correlation, contribution) | Quant + FE | Factor outputs include added metrics and portfolio link | Factor analysis adoption +20% |

### H3 (1 quarter): Workflow automation

| ID | Epic | Owner | Acceptance Criteria | KPI |
|---|---|---|---|---|
| H3-1 | Assistant cross-page automation flow | PM + FE/BE | Assistant can orchestrate screener -> chart -> backtest -> summary | End-to-end automation completion >= 60% |
| H3-2 | Data health dashboard for users | FE + BE + QA | Health summary visible and tied to manifest/backend status | Data incident detection time reduced |

## 4) Safe Rollout Order (UI/UX)

1. `screener`
2. `charts`
3. `backtesting`
4. `portfolio`
5. `risk`
6. `assistant`

Reason:
- Starts at primary entry point, then extends to analysis paths.
- Leaves assistant orchestration after base page contracts are stable.

## 5) Integration Checklist (Do Not Break Existing Behavior)

For each upgraded page:
- Preserve current primary controls and keyboard behavior.
- Preserve deep-link URL behavior (`search params` still restore state).
- Preserve existing response/loading/error states.
- Keep old API fields backward compatible when adding new fields.
- Add feature toggles where risk is medium/high.
- Add migration note if state shape changes (store/localStorage).
- Validate desktop + mobile layout for key interaction blocks.

Assistant-specific:
- New context fields must be sanitized and size-limited.
- Fallback behavior must remain deterministic when context is absent.

## 6) Minimal API/Contract Upgrades for H1

- Saved filters/watchlist:
  - Add preference contract (`savedFilterName`, `filters`, `watchlistSymbols`) in a dedicated preference endpoint or equivalent contract layer.
- Chart compare/events:
  - Add optional compare/event params (`compareWith`, `events`) without changing default response shape.
- Export context:
  - Add optional `contextLabel` and `contextFilters`, enforce payload limit.
- Assistant context snapshot:
  - Add optional nav grouping and export context fields.
  - Truncate and sanitize before prompt composition.

## 7) QA Gate and Oracle Strategy

Mandatory gates per release slice:
- `pnpm run lint`
- `pnpm exec tsc --noEmit`
- `pnpm run build`
- `pnpm run docker:smoke:api`
- `pnpm run docker:qa:api`

Oracle checks:
- Numeric and timeline correctness for HOSE symbols (no non-HOSE contamination).
- Context routing correctness (assistant receives and uses relevant page context).
- Export metadata correctness (context and filters included as expected).
- Regression checks for existing top flows (screener filter, chart open, backtest run).

## 8) Sprint-1 Execution Board (Ready Now)

| Task ID | Task | Owner | Status |
|---|---|---|---|
| S1-T1 | Define H1 feature flags and response meta contract | BE | DONE |
| S1-T2 | Implement screener preset state model and UI entry points | FE | DONE |
| S1-T3 | Implement watchlist shared store contract | FE | DONE |
| S1-T4 | Wire assistant contextual quick action mapping | FE/BE | DONE |
| S1-T5 | Add smoke/qa scenarios for new flows | QA | DONE |
| S1-T6 | Validate KPI instrumentation fields | PM/QA | DONE |

Execution note (updated):
- Date: 2026-02-20
- Completed gates for current slice:
  - `pnpm run docker:smoke:api` PASS
  - `pnpm run docker:qa:api` PASS
  - `pnpm run docker:qa:prod` BLOCKED by pre-existing prod build errors in unrelated files (`factors`, `ml-lab`, `portfolio`, `risk`, and missing `next-themes`).
- New assertions now in smoke/qa:
  - Watchlist persistence/query contract
  - Screener preset apply equivalence (manual vs preset query)
  - Assistant context payload contract (rich + legacy)
- Feature flags (rollout control):
  - `NEXT_PUBLIC_FF_SCREENER_PRESETS`
  - `NEXT_PUBLIC_FF_WATCHLIST_BRIDGE`
  - `NEXT_PUBLIC_FF_ASSISTANT_CONTEXTUAL_ACTIONS`
  - `NEXT_PUBLIC_FF_UI_KPI_TELEMETRY`
- KPI instrumentation events (server accepted at `/api/telemetry/ui-kpi`):
  - `preset_reuse`: `preset_saved`, `preset_applied`, `preset_deleted`
  - `watchlist_interaction`: `watchlist_toggled`, `watchlist_opened_in_charts`, `watchlist_cleared`, `watchlist_selected_symbol`
  - `assistant_contextual_action_ctr`: `assistant_contextual_action_clicked`

## 9) Definition of Done (Per Epic)

An epic is done only if:
- Functional acceptance criteria are met.
- Required gates pass.
- No HOSE contract regression is detected.
- Rollback plan is documented.
- KPI metric is measurable in logs/reports.
