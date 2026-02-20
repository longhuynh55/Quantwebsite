# Assistant 5-Round Review (PM + Architecture + 3 AI Engineering)

Date: 2026-02-18
Scope: AI Assistant pipeline for Quant Website (HOSE only)

## Team setup
- PM: program prioritization, rollout decision, KPI governance
- Lead Architecture: target architecture and migration strategy
- AI Engineer #1: routing/tooling and context/freshness control
- AI Engineer #2: eval/reliability/observability and gate policy
- AI Engineer #3: UX/trust/format quality and human review

## Round outcomes
| Round | Goal | Main output |
|---|---|---|
| R1 Baseline | Audit current state | Identified bottlenecks: heuristic drift in routing, over/under-tooling, brittle policy, weak eval coverage, UX trust inconsistency |
| R2 Cross-critique | Challenge feasibility | Reduced over-engineering risk; split into quick wins vs hardening; set realistic 30-day scope |
| R3 Evidence | Research-backed debate | Adopted ReAct-lite, eval-driven development, multi-metric evaluation; rejected full autonomous/multi-loop agent and model retraining in 90 days |
| R4 Convergence | Produce implementation specs | Locked target architecture, 30/60/90 roadmap, reliability gates, UX rubric/checklists |
| R5 Decision | Final MSC vote and rollout posture | Final Must/Should/Could package, KPI set, no-go list, conditional go/no-go rollout decision |

## Final consensus package
### Must
1. Deterministic-first for numeric answers (LLM summarizes, tools ground).
2. Metadata-driven routing + tool registry for top HOSE intents.
3. Mandatory citation + as-of date on grounded responses.
4. Risk-tiered policy guard with standardized abstain/fallback.
5. Circuit-breaker + health checks + one-level failover.

### Should
1. Tool orchestration with date-aware cache invalidation.
2. Eval-driven CI/CD gates (PR, nightly, release) with strict mode for nightly/release.
3. Chart/table schema validation plus trust signals in UI.

### Could
1. Heuristic adaptive tool ordering (non-learning) after baseline stability.
2. Controlled A/B policy/prompt experiments post-stabilization.

## No-go in next 90 days
1. No foundation model retraining/fine-tuning program.
2. No fully autonomous multi-loop ReAct agent.
3. No single-judge-only release gate.
4. No exchange expansion beyond HOSE.
5. No online learning/RL routing optimizer in production path.

## Target architecture (minimal robust form)
1. Request intake and context normalization (`/api/assistant`).
2. Metadata registry for intents, tools, policy tags, dependencies.
3. Planner with explicit intent confidence and slot carry.
4. Tool orchestrator with bounded concurrency and expensive-tool gating.
5. Grounding layer (stocks, fundamentals, risk, valuation, market, analytics).
6. Policy evaluator with graded grounding outcome and explicit reason codes.
7. Provider pool with health/circuit-breaker and latency budgeting.
8. Evaluation/telemetry layer with run IDs, artifacts, and alerting.

## 30/60/90 roadmap
### 0-30 days
- Metadata routing registry (top intents), policy hardening, provider circuit-breaker MVP.
- PR gate + routing/realworld checks integrated as mandatory for assistant changes.
- KPI gate (phase-1): accuracy >= 88%, unsupported <= 2%, p95 <= 3.2s.

### 31-60 days
- Extend intent coverage, add date-aware cache invalidation, add context-carry hardening.
- Nightly full suite with strict mode and reliability dashboards.
- KPI gate (phase-2): accuracy >= 90%, unsupported <= 1.5%, p95 <= 2.8s.

### 61-90 days
- Canary rollout expansion with automated rollback gates.
- Release gate with shadow-style prompts and S1=0 requirement.
- KPI gate (phase-3): accuracy >= 92%, unsupported <= 1.0%, p95 <= 2.5s.

## Reliability gate matrix
| Tier | Enforced checks | Notes |
|---|---|---|
| PR | Fast routing/policy/perf sanity, limited scenario set | Allow minimal flake budget, block on policy-safety breach |
| Nightly | Full suite + strict mode + broader metrics | Track retry/flakiness and drift trends |
| Release | Comprehensive + strict mode + S1=0 | No flake bypass for safety-critical gates |

## UX-quality sign-off rubric (100)
- Accuracy and trustworthiness: 30
- Clarity and format compliance: 25
- Chart/table UX and accessibility: 20
- Safety and prompt handling: 15
- Utility/safety balance: 10

Release sign-off requires:
- average >= 90
- zero critical safety hits
- chart/table audit checklist completed

## External research used
- ReAct: https://arxiv.org/abs/2210.03629
- Toolformer: https://arxiv.org/abs/2302.04761
- RAGAS: https://arxiv.org/abs/2309.15217
- MT-Bench / LLM-as-judge: https://arxiv.org/abs/2306.05685
- Reflexion: https://arxiv.org/abs/2303.11366
- Self-consistency: https://arxiv.org/abs/2203.11171
- OpenAI eval best practices: https://platform.openai.com/docs/guides/evaluation-best-practices
- OpenAI eval-driven development cookbook: https://cookbook.openai.com/examples/evaluation/use-cases/evalsapi-eval-driven-dev-prototype
- OpenAI model optimization and eval workflow: https://platform.openai.com/docs/guides/optimizing-llm-accuracy

## Final program decision
- Rollout status: GO with conditions
- Traffic progression: 10% -> 25% -> 50% only when KPI gates remain green
- Immediate rollback trigger: repeated safety breach, unsupported claim spike, or sustained SLO violation
