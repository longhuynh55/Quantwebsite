# Function Improvement Team Audit (2026-02-19)

## Scope
- Review current website functions end-to-end: assistant, core APIs, frontend experience, test/eval coverage, and release governance.
- Goal: identify highest-impact improvements to increase accuracy, stability, and user-perceived quality.

## Team
- PM coordinator
- AI engineering reviewer
- Backend reviewer
- Frontend reviewer
- QA/BA reviewer

## Current-State Summary
- Core modules are present and integrated: Home, Screener, Charts, Risk, Backtesting, Portfolio, Factors, Assistant.
- Typecheck/lint are stable; local build can still hit Windows `.next` `EPERM` lock in some flows.
- Assistant routing reports are mostly green, but accuracy governance is not fully green:
  - `unsupportedClaimRate` is still high in comprehensive eval (`16.67%`).
- Test suites validate many endpoints and assistant tool routing, but real-user behavior coverage is still narrow for some critical flows.

## Findings By Domain

### AI Assistant
- Planner fallback can over-prefer `stockSnapshot` for ambiguous metric prompts, which hurts ranking-style intents.
- Symbol fanout is capped and can under-ground multi-symbol prompts.
- Output formatting is guided by prompt text, but not structurally validated post-generation.

### Backend/API
- `risk` and `backtesting` quality gating can fail on DuckDB symbol-specific paths because shared quality report/status may be missing in that route.
- Valuation ranking path performs repeated per-symbol fundamental lookups and can be CPU-heavy at universe scale.
- Runtime data freshness fingerprint checks can add request-path jitter due to repeated filesystem checks.

### Frontend
- Some pages show weak recovery UX on API error (blank/partial sections with no direct retry affordance in-place).
- Screener has risk of duplicate/racing fetches across filter/page updates.
- Sorting accessibility can be improved (`aria-sort`/live announcements).
- Assistant error state can be more recoverable (retry last query, clearer action).

### QA/BA
- Existing smoke/QA/eval scripts are useful, but still under-cover:
  - Finance-analysis and analytics endpoints in richer scenario combinations.
  - Portfolio/ML-lab-adjacent assistant scenarios.
  - Negative/error-path and high-load/rate-limit behavior across more functions.

## Prioritized Backlog

## P0 (Immediate)
1. Stabilize assistant factual accuracy gate.
- Target: lower unsupported numeric claims to governance threshold.
- Scope: planner disambiguation, tighter evidence-to-claim controls, format post-check.

2. Fix DuckDB quality-gate mismatch for risk/backtesting symbol routes.
- Target: prevent false 503 on valid symbol requests.
- Scope: align data quality status/report updates across DuckDB symbol and full-dataset paths.

3. Remove noisy eval false-fail vectors.
- Target: ensure PR gates fail only on real regressions.
- Scope: auth/config consistency for eval pipelines and report integrity checks.

## P1 (High)
1. Optimize valuation ranking compute path.
- Target: reduce tail latency and improve consistency under larger universes.
- Scope: cache/memoize symbol-period snapshots and avoid redundant repeated lookups.

2. Improve frontend fetch control and recovery UX.
- Target: avoid stale/racing data and improve error recovery without forcing users to re-enter input.
- Scope: request cancellation/sequence guards, in-place retry controls, stable loading states.

3. Expand realworld QA matrix by function complexity.
- Target: close gap between test-pass and production behavior.
- Scope: function-level L1-L4 matrix for stocks/fundamentals/valuation/risk/backtesting/assistant.

## P2 (Medium)
1. Harden output format compliance.
- Target: predictable assistant response structure and easier downstream rendering.
- Scope: response schema validation and controlled retry when format is invalid.

2. Improve accessibility consistency across data-heavy pages.
- Target: stronger keyboard/screen-reader parity for sorting/status/updates.
- Scope: `aria-sort`, `aria-live`, status announcements for async updates.

3. Product completeness alignment.
- Target: avoid user dead-ends in partial modules.
- Scope: finalize MVP paths or hide unfinished sections from release navigation.

## Suggested Execution Order
1. P0 assistant accuracy + DuckDB gate fix.
2. P0 eval reliability normalization.
3. P1 performance optimization (valuation ranking + request-path freshness overhead).
4. P1 frontend resiliency/accessibility improvements.
5. P1/P2 expanded QA matrix and governance tracking.

## Success Metrics
- Assistant unsupported claim rate at or below governance threshold.
- No false 503 for valid DuckDB-backed risk/backtesting symbol calls.
- Lower p95/p99 on heavy assistant valuation/ranking scenarios.
- Increased pass rate on expanded realworld matrix with stricter format checks.
- Reduced user-facing error-retry friction on core pages.

