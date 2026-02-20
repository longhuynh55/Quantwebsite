# Final Audit Synthesis Template

Date: `YYYY-MM-DD`  
Audit window: `YYYY-MM-DD -> YYYY-MM-DD`  
Repository snapshot: `branch=<name>, commit=<sha>`  
Decision owner: `Tech Lead`  
Inputs received from: `assistant-quality`, `architecture`, `reliability`, `security`, `performance`, `DX`

## 1) Top Risks (P0/P1/P2)

Use one row per risk. Keep each risk atomic.

| Pri | Risk ID | Risk statement | User/business impact | Likelihood | Domains | Evidence (file refs) | Detection signal | Owner | Target |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0 | R-001 | `<what can fail and how>` | `<release/data/security/customer impact>` | High/Med/Low | `<AI, BE, FE, CI, Data>` | `src/...`, `docs/...`, `.github/...` | `<metric/log/test proving risk>` | `<team>` | `<date>` |
| P1 | R-0xx |  |  |  |  |  |  |  |  |
| P2 | R-0xx |  |  |  |  |  |  |  |  |

Priority rubric:
- `P0`: release-blocking, security/compliance exposure, data correctness failure, or high-probability production outage.
- `P1`: serious quality/reliability/perf gap; can ship only with explicit mitigation and dated follow-up.
- `P2`: hardening and optimization; does not block release.

## 2) Cross-Cutting Root Causes

Map shared causes across multiple risks so remediation removes classes of failures, not single symptoms.

| Root cause ID | Root cause | Risks linked | Structural evidence (file refs) | Why this is systemic | Remediation theme |
| --- | --- | --- | --- | --- | --- |
| RC-01 | `<example: missing enforceable gates>` | `R-001, R-004, R-009` | `.github/workflows/qa-integration.yml`, `scripts/eval-assistant-pr-gate.mjs` | `<same gap appears in multiple domains>` | `<governance/contract-testing/telemetry>` |
| RC-0x |  |  |  |  |  |

Root-cause quality checks:
- Each root cause must link to at least 2 risks.
- Each root cause must cite at least 2 concrete file refs.
- Prefer causes in architecture/process/contracts over implementation details.

## 3) Phased Remediation Plan

### Phase 0: Stabilize and Block Regressions (0-7 days)

| Item | Risks addressed | Actions | Acceptance criteria | Evidence produced | Owner |
| --- | --- | --- | --- | --- | --- |
| P0-01 | `R-...` | `<minimal safe change>` | `<binary gate>` | `<CI run, report, test artifact>` | `<team>` |

### Phase 1: Quality Recovery (8-30 days)

| Item | Risks addressed | Actions | Acceptance criteria | Evidence produced | Owner |
| --- | --- | --- | --- | --- | --- |
| P1-01 | `R-...` | `<reliability/perf/security upgrades>` | `<SLO, pass-rate, latency>` | `<dashboard/report/log>` | `<team>` |

### Phase 2: Hardening and Scale (31-90 days)

| Item | Risks addressed | Actions | Acceptance criteria | Evidence produced | Owner |
| --- | --- | --- | --- | --- | --- |
| P2-01 | `R-...` | `<structural improvements>` | `<trend over time>` | `<benchmark/regression suite>` | `<team>` |

## 4) Decision and Gate

Release decision: `No-Go | Conditional Go | Go`  
Decision date: `YYYY-MM-DD`

Mandatory conditions for `Go`:
- All `P0` items have implemented controls and passing evidence.
- No open security issue with exploitability rated High/Critical.
- Assistant reliability and data correctness gates are green on current commit.
- Rollback and on-call ownership are explicit.

## 5) Auditor Intake Appendix

Paste one compact summary per domain auditor before synthesis.

| Domain | Top findings (3 max) | Proposed priority | Evidence refs | Conflicts/open questions |
| --- | --- | --- | --- | --- |
| Assistant quality |  |  |  |  |
| Architecture |  |  |  |  |
| Reliability |  |  |  |  |
| Security |  |  |  |  |
| Performance |  |  |  |  |
| DX |  |  |  |  |

## 6) Evidence Hotspots (Starter File Map)

Use these as first-stop anchors when validating auditor claims.

- Assistant orchestration and policy:
  - `src/app/api/assistant/route.ts`
  - `src/app/api/assistant/execute/route.ts`
  - `src/lib/assistant/planner.ts`
  - `src/lib/assistant/providers.ts`
  - `src/lib/assistant/policy.ts`
  - `src/lib/assistant/tools.ts`
  - `src/lib/stores/assistantStore.ts`
- Reliability, rate limiting, telemetry, data:
  - `src/lib/rateLimit.ts`
  - `src/lib/logger.ts`
  - `src/lib/frontendTelemetry.ts`
  - `src/lib/dataBackend.ts`
  - `src/lib/dataManifest.ts`
  - `src/lib/dataPolicy.ts`
  - `src/app/api/health/data/route.ts`
- API contracts and quantitative endpoints:
  - `src/app/api/stocks/route.ts`
  - `src/app/api/fundamentals/route.ts`
  - `src/app/api/backtesting/route.ts`
  - `src/app/api/risk/route.ts`
  - `src/app/api/factors/route.ts`
  - `src/app/api/finance-analysis/route.ts`
- CI/QA/perf governance:
  - `.github/workflows/qa-integration.yml`
  - `.github/workflows/nightly-assistant-gates.yml`
  - `scripts/eval-assistant-pr-gate.mjs`
  - `scripts/eval-assistant-stability-gate.mjs`
  - `scripts/eval-assistant-perf-reliability.mjs`
  - `scripts/qa.mjs`
  - `scripts/smoke.mjs`
- Existing audit context:
  - `docs/POST_AUDIT_2ROUND_DECISION_2026-02-19.md`
  - `docs/ASSISTANT_5ROUND_REVIEW_2026-02-18.md`
  - `docs/PERF_RELIABILITY_SOP_V2_PLAN.md`
  - `docs/ARCHITECTURE.md`
