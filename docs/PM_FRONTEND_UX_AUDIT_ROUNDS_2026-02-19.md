# PM Frontend/UX Audit Rounds (2026-02-19)

## Scope
- Full-stack review for website functions and user experience.
- Focus: assistant panel behavior, query responsiveness, screener usability, output format clarity.
- Constraints: HOSE-only user scope, `pnpm` workflow, prioritize accuracy/robustness over cosmetic speed.

## Team
- PM (coordinator)
- Frontend reviewer
- UX/Accessibility reviewer
- QA reviewer
- Perf/Bug reviewer

## Round 1: Individual Findings
- FE:
  - Auto success toasts on initial auto-fetch create noisy UX.
  - Screener header markup issue affected layout consistency.
  - Assistant panel lacked modal semantics.
- UX:
  - Missing `role="dialog"`, `aria-modal`, focus trap in assistant panel.
  - Chat input lacked explicit accessible labeling.
  - Error announcement path needed `role="alert"`/assertive live region.
- QA:
  - Requested smoke matrix plus real-world scenario replay.
  - Required output format validation (not only tool invocation).
- Perf/Bug:
  - Long chat history caused high rerender/parse cost.
  - `isLoading` race condition with concurrent requests.
  - Persisted payload too heavy for frequent localStorage writes.
- PM:
  - Prioritize tasks by impact on query confidence + user-perceived latency.

## Round 2: Cross-Functional Reprioritization
- P0:
  - Assistant modal accessibility + stable request loading state.
  - Message/render/persistence bounding to reduce interaction lag.
- P1:
  - Screener accessibility and quiet initial data loading (no success toast spam).
  - Structured user feedback for retries/errors.
- P2:
  - Larger IA/navigation refinements and additional UX polishing.

## Round 3: PM Sign-off + Release Conditions
- FE sign-off:
  - Approved incremental rollout order with low-risk commits first.
- UX sign-off:
  - Release blocked unless assistant modal semantics/focus and form labeling are fixed.
- QA sign-off:
  - Require lint + typecheck + build + matrix/real-world smoke gates.
- Perf sign-off:
  - Require bounded render cost, bounded persistence cost, no premature loading toggles.

## Final Execution Plan
1. Phase 1 (Quick wins)
   - Implement assistant accessibility + loading race fix + bounded rendering/persistence.
   - Implement screener form labeling and advanced-filter aria state.
   - Remove success toast spam on auto-fetch paths.
2. Phase 2 (Robustness)
   - Expand scenario matrix for output-format correctness and tool-routing correctness.
   - Add perf thresholds and regression alerts for assistant interactions.
3. Phase 3 (Hardening)
   - Run docker smoke/qa/eval with representative real-world query sets.
   - Freeze release only when all quality gates pass.

## Quality Gates
- Mandatory:
  - `pnpm run lint`
  - `pnpm exec tsc --noEmit`
  - `pnpm run build`
- Testing:
  - Matrix scenarios (functionality, format, tool usage, error handling).
  - Real-world scenario replay (multi-step user journeys).
  - Accessibility checks for keyboard and screen-reader critical paths.

## Implementation Status (Current Session)
- Applied:
  - Assistant panel modal semantics, focus trap, in-flight request loading control, bounded message rendering, accessible error alert, non-native clear confirmation.
  - Chat input accessible label and helper association.
  - Assistant store bounded in-memory + lightweight persistence.
  - Screener a11y label bindings, advanced-filter ARIA controls, HOSE-only phase options, quiet initial fetch toast.
  - Home/charts removed success toast on auto-load.
- Validation:
  - `pnpm exec tsc --noEmit`: pass
  - `pnpm run lint`: pass
  - `pnpm run build`: blocked by Windows `.next` file lock (EPERM unlink). Requires stopping lock owner process before rerun.

## Follow-up Execution (Continuation)
- Team continuation round completed (PM/FE/UX/QA/Perf):
  - FE requested compatibility hardening for `limit=all` vs pagination guards.
  - UX requested explicit announce/focus behavior for advanced filters.
  - Perf requested extra render optimizations for chat message parsing.
- Applied follow-up fixes:
  - `/api/stocks` now bypasses pagination validation for `limit=all` and keeps pagination metadata only when paginated path is active.
  - Screener advanced filters now include screen-reader announcement + focus transfer to first advanced control.
  - Assistant panel scroll is throttled via `requestAnimationFrame`; chat rows/content parsing are memoized.
- Validation rerun:
  - `pnpm exec tsc --noEmit`: pass
  - `pnpm run lint`: pass
  - `pnpm run docker:smoke`: pass
  - `pnpm run docker:qa`: pass
  - `pnpm run build`: still blocked locally by Windows file lock (`EPERM` on `.next` unlink).
  - `pnpm run docker:smoke:prod`: pass
  - `pnpm run docker:qa:prod`: pass
- Production profile stabilization:
  - Fixed Dockerfile builder stage (`corepack enable`) to unblock `pnpm run build` inside image build.
  - Updated prod runtime backend env to `DATA_BACKEND=auto` with fallback enabled to avoid hard failure when native DuckDB binding is unavailable in the container runtime.
