# Composer Agent Function-Calling Roadmap V1

## Scope
- Goal: upgrade existing chatbot flow into a Composer-capable agent workflow with strict tool calling, human approval gates, and measurable reliability.
- Boundaries: HOSE-only data scope, existing Next.js API routes, existing assistant planner/policy/grounding modules.
- Delivery mode: keep chat UI, migrate backend orchestration incrementally.

## Principles
- Deterministic first: numeric claims must come from validated tool output.
- Human in loop for side effects: execution paths require `approvalToken`.
- Observable by default: every tool call emits status, latency, and error code.
- Backward compatible: existing chatbot behavior remains available.

## Milestones
| ID | Phase | Owner | Objective | Definition of Done | Risks | Status |
| --- | --- | --- | --- | --- | --- | --- |
| AGT-00 | Sprint 1 | Backend | Tool registry: contracts + strict schemas | Single tool registry metadata is source of truth; strict validation per tool; response envelope consistent | Contract drift across routes | done |
| AGT-01 | Sprint 1 | Backend | Execute dispatcher: secure + resilient | Harden `/api/assistant/execute` fetch/JSON failures; enforce approvalToken; include requestId/tool trace | Invalid args or unsafe endpoint access | done |
| AGT-02 | Sprint 1 | Backend + Frontend | Orchestration mode metadata | Assistant request supports executionMode; response meta includes orchestrationMode; visible in logs/reports | Mixed mode metrics ambiguity | in_progress |
| AGT-03 | Sprint 1 | Frontend + Backend | Composer workflow integration | Prompt -> plan preview -> approve -> execute -> result; tool trace + error UX | UX complexity and failure handling | in_progress |
| AGT-04 | Sprint 2 | Backend + QA | Reliability hardening | Budgets/timeouts/retries enforced; distributed rate-limit strategy + alerts; circuit behavior for transient failures | Multi-instance inconsistency | todo |
| AGT-05 | Sprint 2 | QA + Product | Eval + release gates (stable and automated) | CI/PR gate runs stability suites + artifacts; composer E2E smoke runnable in Docker | Docker/env instability | in_progress |
| AGT-06 | Sprint 2 | QA + Product | Numeric fidelity expansion (beyond backtest) | Tolerance-based numeric checks for risk/valuation/fundamentals + citation sanity + baseline metrics | Provider variance | todo |

## Workstreams
### WS-A Backend Orchestration
- Introduce agent-tool registry with strict argument validators.
- Route execution through a hardened dispatcher endpoint.
- Keep legacy execute payload compatibility for current clients.

### WS-B Product and UX
- Keep existing chat panel.
- Add Composer-specific workflow UI progressively.
- Surface tool trace and approval context to users.

### WS-C Reliability and Governance
- Track tool call success/failure ratio.
- Track policy fallbacks and grounding satisfaction.
- Add release gate checklist and weekly status review.

## KPI Tracking
- Tool call success rate >= 98% (excluding validation rejects).
- Policy fallback ratio trend (weekly).
- End-to-end composer completion rate.
- Backtest + risk run latency p95.

## Weekly Update Format
1. What shipped this week.
2. What moved status (with milestone IDs).
3. Blockers and owner.
4. Next week commitments.
