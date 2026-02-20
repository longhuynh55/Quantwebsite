# TEAM RESEARCH + UNIT TEST SOP V2

## 1) Team Composition

- PM (coordinator, final gate owner)
- AI Engineering #1 (routing/planner)
- AI Engineering #2 (grounding/policy)
- AI Engineering #3 (performance/reliability)
- QA Lead (test owner, signoff owner)

Scope constraint:
- HOSE-only for grounded stock data and ranking.

## 2) 5-Round Cross-Discussion Process (Mandatory)

Round 1 - Independent proposals
- Each role submits a short proposal with risks + required outputs.
- Output: initial process draft + initial unit-test ideas.

Round 2 - Cross-critique
- PM collects conflicts/ambiguity.
- Roles critique each other on feasibility and missing controls.
- Output: conflict log + PM decisions to remove ambiguity.

Round 3 - Test design
- AI roles define concrete test cases (ID, input, expected route/policy/result).
- QA maps all cases to test pyramid and measurable thresholds.
- Output: executable unit/integration/eval matrix.

Round 4 - Red-team review
- PM produces Process v1.
- All non-PM roles red-team v1 and list blocking gaps.
- Output: prioritized fix list before finalization.

Round 5 - Final convergence
- PM publishes SOP v2.
- AI + QA provide signoff conditions and must-implement items.
- Output: approved SOP + go/no-go conditions.

## 3) SOP V2 Workflow (2 Weeks)

Week 1
1. Day 1-2: Research + HOSE scope confirmation.
2. Day 3-4: Cross-discussion + query design + sanity signoff.
3. Day 5: Review gate for design completeness.

Week 2
1. Day 6-7: Implement unit tests and safeguards.
2. Day 8: Internal QA run + triage.
3. Day 9-10: PR gate + nightly gate + release readiness review.

## 4) Unit-Test Framework

Test pyramid:
1. Unit layer
- intent parsing
- tool selection and routing
- HOSE scope guard
- multi-symbol handling
- citation/abstain policy logic
- timeout/retry/rate-limit helper logic

2. Integration layer
- build + API contract checks
- docker smoke/qa flows
- health probe and fallback behavior

3. Evaluation layer
- real-world scenario matrix
- hallucination and unsupported-claim checks
- latency/tool-budget checks

Minimum matrix requirements:
- Routing/planner suite: >= 12 cases.
- Grounding/policy suite: >= 10 cases.
- Perf/reliability suite: >= 10 cases.

Each test case must include:
- test_id
- precondition
- input/query
- expected_tool_route
- expected_policy_status
- expected_citation_or_abstain_behavior
- severity

## 5) Decision Gates

PR gate (block merge on fail):
1. `pnpm run lint` pass
2. `pnpm exec tsc --noEmit` pass
3. unit suite pass
4. core coverage drop <= 2% from approved baseline
5. required assistant PR gate scenarios pass

Nightly gate:
1. integration + eval suites pass
2. data regression diff < 0.5% aggregate and < 1% on key metrics
3. performance threshold pass (TTFMP <= 1.2s baseline target)
4. no new high/critical security findings

Release gate:
1. clean nightly report for release candidate
2. QA manual sanity checklist complete
3. QA signoff + PM signoff
4. unresolved high severity issue count = 0

## 6) Rollback and Escalation

Immediate escalation:
- any high severity logic failure
- unsupported-claim regression above threshold
- HOSE scope guard failure

Rollback rule:
- if high severity issue is not fixed by release decision window, rollback deployment candidate.

Escalation path:
1. QA lead opens blocking report with repro.
2. AI owner fixes + reruns affected suites.
3. PM decides release hold or rollback.

## 7) Must-Implement Backlog (From Round 5 Signoff)

Routing/planner:
1. pre-routing HOSE symbol validation for every symbol
2. per-request routing budget guard (latency/tool call budget)
3. abstain when tool provenance/confidence contract is missing

Grounding/policy:
1. freshness validation for cited data
2. provenance-aware citation diversity checks
3. inference gating with explicit abstain/uncertainty when unsupported

Performance/reliability:
1. deterministic timeout + capped retry with backoff
2. tenant-aware rate-limit and tool budget enforcement
3. health probe extension to critical dependency checks

QA signoff minimum:
1. PR gate fully green
2. release gate fully green
3. all required artifacts attached (reports, matrix, signoff log)

