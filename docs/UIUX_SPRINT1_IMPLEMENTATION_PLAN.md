# UI/UX Sprint-1 Implementation Plan (Execution Ready)

## Goal

Deliver H1 foundation safely:
- Screener saved filter presets
- Shared watchlist base contract
- Assistant contextual actions contract
- Regression-safe test updates

## Current Status (2026-02-20)

- Workstream A: DONE
- Workstream B: DONE
- Workstream C: DONE
- Workstream D: DONE
- Remaining:
  - None for Sprint-1 scope.

## Workstream A: Screener Presets

Target files:
- `src/app/screener/page.tsx`
- `src/lib/hooks.ts` (reuse `useLocalStorage`)

Implementation steps:
1. Add a typed preset model for screener filters.
2. Persist preset list in local storage with capped item count.
3. Add UI controls:
   - Save current filters as preset
   - Apply preset
   - Delete preset
4. Keep existing URL state behavior unchanged.

Acceptance:
- Applying preset updates URL params exactly as manual filter input.
- Existing `clear filters` flow still works.

## Workstream B: Shared Watchlist Contract

Target files:
- `src/lib/stores` (new watchlist store)
- `src/app/screener/page.tsx`
- `src/app/charts/page.tsx` (consume watchlist)

Implementation steps:
1. Create store contract for watchlist symbols (HOSE ticker format).
2. Add add/remove actions in screener row actions.
3. Expose watchlist quick-open entry in charts page.

Acceptance:
- Symbol add/remove is idempotent and persisted.
- Watchlist can be reused across page reloads.

## Workstream C: Assistant Context Upgrade

Target files:
- `src/types/assistant.ts`
- `src/components/assistant/AiAssistantPanel.tsx`
- `src/components/assistant/QuickActions.tsx`

Implementation steps:
1. Add optional context fields for navigation grouping and export intent.
2. Populate context from current page/search params.
3. Add contextual quick actions by page mode (screener/charts/backtesting).
4. Keep fallback quick actions if context is missing.

Acceptance:
- Assistant request payload includes extra fields when available.
- No request failure when new fields are absent.

## Workstream D: QA and Gate

Target files:
- `scripts/qa.mjs`
- `scripts/smoke.mjs`
- eval scripts if needed for context checks

Implementation steps:
1. Add smoke assertions for:
   - Screener preset apply behavior (API query equivalence)
   - Watchlist persistence contract
   - Assistant context payload shape
2. Add QA checks for regression on baseline flows.

Acceptance:
- `docker:smoke:api` and `docker:qa:api` pass.
- No false-positive spikes in assistant routing checks.

## Risk Controls

- Wrap new UI controls behind local feature flags during first rollout.
- Keep API additions optional and backward compatible.
- Enforce symbol validation to HOSE universe in watchlist path.

## Exit Criteria

Sprint-1 is complete when:
- All four workstreams pass acceptance.
- Required gates pass in docker flow.
- KPI fields are available for monitoring.

Verification snapshot (latest run):
- `pnpm run docker:smoke:api` PASS
- `pnpm run docker:qa:api` PASS
- `pnpm run docker:qa:prod` BLOCKED by pre-existing prod build errors outside Sprint-1 scope.

Rollout and observability snapshot:
- Feature flags:
  - `NEXT_PUBLIC_FF_SCREENER_PRESETS`
  - `NEXT_PUBLIC_FF_WATCHLIST_BRIDGE`
  - `NEXT_PUBLIC_FF_ASSISTANT_CONTEXTUAL_ACTIONS`
  - `NEXT_PUBLIC_FF_UI_KPI_TELEMETRY`
- KPI telemetry endpoint:
  - `POST /api/telemetry/ui-kpi`
