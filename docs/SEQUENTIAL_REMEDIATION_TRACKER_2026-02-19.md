# Sequential Remediation Tracker (2026-02-19)

Source governance: `docs/POST_AUDIT_2ROUND_DECISION_2026-02-19.md:47`, `docs/POST_AUDIT_2ROUND_DECISION_2026-02-19.md:49`.

## Enforcement Rule

Execution is strictly sequential:
1. CI gate integrity
2. Assistant trust boundary and rate-limit fairness
3. API outage semantics and probe throttling
4. Frontend race fixes

No stage can be marked Accepted until all acceptance criteria in the current stage are satisfied.

## Latest Status Update (2026-02-19)

- Phase 1 (P0 CI gate integrity): completed by worker.
- Phase 2 (backend trust/semantics): completed with 4 fixes:
  - eval auth fail-closed
  - rate-limit fallback hardening
  - backtesting 503 semantics
  - probe throttling
- Phase 3 (frontend race fixes): completed by worker `019c748c-4340-7031-9519-0c3459fbd3d0`.

## Stage Board

| Stage | Scope | Status | Gate Decision |
| --- | --- | --- | --- |
| 1 | CI gate integrity | Completed | Accepted |
| 2 | Assistant trust boundary + rate-limit fairness | Completed | Accepted |
| 3 | API outage semantics + probe throttling | Completed | Accepted |
| 4 | Frontend race fixes | Completed (worker `019c748c-4340-7031-9519-0c3459fbd3d0`) | Accepted |

## Stage 1: CI Gate Integrity

### Tasks
- Enforce live assistant gate in CI (no dry-run behavior accepted in CI).
- Run deterministic data prepare + fundamentals validation in CI.
- Persist per-run artifacts and verdict files for dev/prod jobs.

### Acceptance Criteria
- CI runs stability gate from workflow: `.github/workflows/qa-integration.yml:125`, `.github/workflows/qa-integration.yml:269`.
- Dry-run in CI is blocked by script/stability checks:
  - `scripts/eval-assistant-pr-gate.mjs:675`
  - `scripts/eval-assistant-stability-gate.mjs:278`
  - `scripts/eval-assistant-stability-gate.mjs:283`
- Deterministic data steps exist in both dev/prod jobs:
  - `.github/workflows/qa-integration.yml:67`
  - `.github/workflows/qa-integration.yml:74`
  - `.github/workflows/qa-integration.yml:211`
  - `.github/workflows/qa-integration.yml:218`
- Artifact + verdict upload exists in both dev/prod jobs:
  - `.github/workflows/qa-integration.yml:156`
  - `.github/workflows/qa-integration.yml:174`
  - `.github/workflows/qa-integration.yml:300`
  - `.github/workflows/qa-integration.yml:318`

### Status
- Accepted (worker-reported complete).

## Stage 2: Assistant Trust Boundary and Rate-Limit Fairness

### Tasks
- Keep trust boundary explicit for UI/context/tool data.
- Propagate grounding/policy metadata into responses and UI trace.
- Ensure rate limiting is scoped and fair across traffic classes.

### Acceptance Criteria
- Trust boundary for UI context and tool base URL normalization:
  - `src/app/api/assistant/route.ts:590`
  - `src/app/api/assistant/route.ts:722`
  - `src/app/api/assistant/route.ts:737`
- Policy metadata propagation:
  - `src/app/api/assistant/route.ts:183`
  - `src/app/api/assistant/route.ts:185`
  - `src/types/assistant.ts:150`
  - `src/types/assistant.ts:152`
  - `src/components/assistant/ChatMessage.tsx:66`
- Policy fallback/shadow behavior:
  - `src/lib/assistant/policy.ts:140`
  - `src/lib/assistant/policy.ts:159`
  - `src/lib/assistant/policy.ts:180`
- Rate-limit scope separation is implemented:
  - `src/app/api/assistant/route.ts:46`
  - `src/lib/rateLimit.ts:88`

### Status
- Accepted.
- Backend fix evidence:
  - Eval auth fail-closed: `src/app/api/assistant/route.ts:774`
  - Rate-limit fallback hardening: `src/lib/rateLimit.ts:21`, `src/lib/rateLimit.ts:150`

## Stage 3: API Outage Semantics and Probe Throttling

### Tasks
- Keep outage semantics deterministic for backend failures/non-ok health.
- Keep refresh semantics explicit (403/503 based on token configuration).
- Throttle probe traffic to prevent abuse while preserving readiness behavior.

### Acceptance Criteria
- Non-ok responses return explicit failure semantics:
  - Backend init failure path: `src/app/api/health/data/route.ts:313`
  - Non-ok full/probe return 503: `src/app/api/health/data/route.ts:346`, `src/app/api/health/data/route.ts:405`
- Refresh auth semantics:
  - `src/app/api/health/data/route.ts:285`
  - `src/app/api/health/data/route.ts:294`
- Probe traffic must be rate-limited with a dedicated budget and Retry-After on exceedance.

### Status
- Accepted.
- Backend fix evidence:
  - Backtesting 503 semantics: `src/app/api/backtesting/route.ts:124`, `src/app/api/backtesting/route.ts:132`
  - Probe throttling (probe no longer bypasses by default): `src/app/api/health/data/route.ts:275`, `src/app/api/health/data/route.ts:278`

## Stage 4: Frontend Race Fixes

### Tasks
- Add request sequencing so stale/aborted responses cannot clear active loading state or overwrite latest result.
- Add consistent cancellation/ignore-stale behavior across async-heavy pages.

### Acceptance Criteria
- Backtesting and portfolio flows prevent stale finalize paths from flipping loading/result state:
  - `src/app/backtesting/page.tsx:158`
  - `src/app/backtesting/page.tsx:256`
  - `src/app/portfolio/page.tsx:72`
  - `src/app/portfolio/page.tsx:110`
- Assistant panel request flow handles cancellation/unmount race windows:
  - `src/components/assistant/AiAssistantPanel.tsx:165`
  - `src/components/assistant/AiAssistantPanel.tsx:234`
- Non-ok assistant responses auto-surface diagnostics/recovery in UI:
  - `src/components/assistant/ChatMessage.tsx:184`
  - `src/components/assistant/ChatMessage.tsx:193`

### Status
- Accepted (worker `019c748c-4340-7031-9519-0c3459fbd3d0` reported complete).

## Progress Checkpoints

- Checkpoint 1 (Stage 1): CI gate integrity accepted.
- Checkpoint 2 (Stage 2): Assistant trust boundary/rate-limit fairness accepted with eval-auth and fallback hardening fixes.
- Checkpoint 3 (Stage 3): API outage/probe semantics accepted with 503 and probe-throttle fixes.
- Checkpoint 4 (Stage 4): Frontend race remediation accepted under worker `019c748c-4340-7031-9519-0c3459fbd3d0`.

## Final Acceptance Checklist

- [x] Stage 1: Live CI gate path wired and dry-run blocked in CI scripts/workflows.
- [x] Stage 1: Deterministic data prepare/validate wired in CI.
- [x] Stage 1: Artifact and verdict retention wired for dev/prod.
- [x] Stage 1: Intentional-failure PR proof captured and attached.
- [x] Stage 2: Trust boundary + policy metadata propagated end-to-end.
- [x] Stage 2: Tenant/fairness-grade rate-limit enforcement completed.
- [x] Stage 3: Non-ok outage semantics and refresh auth paths implemented.
- [x] Stage 3: Probe throttling implemented with abuse-safe budget.
- [x] Stage 4: Frontend stale-response race fixes verified on backtesting/portfolio/assistant flows.

## Final Summary (Closed)

- Closure verdict: all 4 sequential stages accepted.
- Worker delivery refs:
  - Phase 1 + 2: backend/CI worker delivery (per PM update).
  - Phase 3: worker `019c748c-4340-7031-9519-0c3459fbd3d0`.
- Final acceptance snapshot: all checklist items complete.
