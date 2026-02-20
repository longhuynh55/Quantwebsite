# Execution Board — SOP V2 Turn (Feb 19 – Mar 4 2026)

**Context.** SOP v2 asks for a 2-week workflow to be executed in one turnaround. This board keeps the condensed slot focused on the grounding/policy/perf reliability backlog, QA/PM signoff gates, and thesis artifacts outlined in `docs/TEAM_RESEARCH_UNITTEST_SOP_V2.md` and `docs/IMPLEMENTATION_PLAN_2_WEEKS.md`.

## P0 Backlog (Day 1–5 focus)
| Task | Owner | Acceptance Criteria | Ready-to-run Gate Command |
| --- | --- | --- | --- |
| Harden numeric stock grounding + policy metadata | AI Engineering #2 (Grounding/Policy) | Every numeric/HOSE query routes through the grounding tool, responses carry `groundingRequired`, `groundingSatisfied`, and `policyReasonCode`, and any tool failure surfaces a structured error code for telemetry. | n/a |
| Improve fallback + diagnostics transparency | AI Engineering #1 (Routing/Planner) | Fallback messages cite the routing/grounding status, include diagnostics when tool calls fail or base URLs are missing, and the assistant footer exposes grounding/policy pass/fail states. | n/a |
| Execute PR gate verification | QA Lead | `pnpm run lint`, `pnpm exec tsc --noEmit`, `pnpm run build`, and `node scripts/eval-assistant-comprehensive.mjs --profile quick` all pass with zero new high/critical findings and the required assistant gate scenarios marked green. | `pnpm run lint && pnpm exec tsc --noEmit && pnpm run build && node scripts/eval-assistant-comprehensive.mjs --profile quick` |

## P1 Backlog (Day 6–14 focus)
| Task | Owner | Acceptance Criteria | Ready-to-run Gate Command |
| --- | --- | --- | --- |
| Integrate comprehensive eval gate + artifacts | AI Engineering #3 (Performance/Reliability) | Eval gate script enforces the five KPIs from the two-week plan, emits JSON + markdown summaries, and uploads artifacts for the nightly QA workflow. | `node scripts/eval-assistant-comprehensive.mjs --profile full` |
| Targeted fixes for high-frequency failure modes | AI Engineering #1 + #3 | Failures categorized by tool timeout, HTTP error, or unsupported query shrink by >25% vs. the last baseline run, and regression checks (lint/typecheck/build) remain clean. | n/a |
| Thesis/release packaging & rehearsal | PM + QA Lead | Five-chapter thesis outline locked, each reported metric mapped to methodology, demo script covering supported, abstention, fallback, and diagnostics scenarios rehearsed, and artifacts frozen for defense. | n/a |

## Gates & Metrics
- **PR Gate:** lint, typecheck, build, quick eval (see row above) before merge; coverage drop ≤2%; required assistant scenarios green. Refer to SOP Section 5.
- **Nightly Gate:** integration + eval suites, data regression <0.5%/1%, perf threshold (TTFMP ≤1.2s), no new high/critical security findings. Use `node scripts/eval-assistant-comprehensive.mjs --profile nightly` and `pnpm run docker:qa`.
- **Release Gate:** clean nightly report, QA checklist, PM + QA signoff, 0 unresolved high severity issues.

All commands listed in the ready-to-run column can be executed immediately to capture the current state and satisfy go/no-go checks.
