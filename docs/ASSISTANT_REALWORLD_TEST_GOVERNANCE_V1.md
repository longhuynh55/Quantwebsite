# Assistant Realworld Testing Governance V1 (HOSE-only)

## 1) Team Charter
- PM Lead
  - Owns testing roadmap, gate decisions, and release go/no-go.
  - Runs weekly review on lab-vs-production gap.
- QA Lead
  - Owns scenario quality, automation coverage, and pass/fail evidence.
  - Owns triage for flaky runs and false negatives.
- BA (HOSE domain)
  - Owns real user journeys, business intents, and acceptance rules.
  - Owns scenario refresh from user behavior and support incidents.
- AI Evaluation Engineer
  - Owns metric definitions, scoring formulas, and benchmark baselines.
  - Owns quality trend tracking (daily/weekly).
- Full-stack Telemetry Engineer
  - Owns trace/log data contract and report integrity.
  - Owns observability for tool routing, format blocks, and retries.

## 2) Objective
- Avoid "test pass in lab, fail in real usage" by testing:
  - Correct tool/endpoint routing.
  - Grounded factual responses (no fabricated metrics).
  - Response format fidelity (table/citation/trace/context).
  - Stability under repeated runs (flake and latency behavior).
  - HOSE-only policy/scope behavior.

## 3) Scenario Portfolio (must be behavior-realistic)
- Portfolio mix:
  - 60% real query patterns from logs/tickets.
  - 20% adversarial/noisy/policy edge cases.
  - 20% regression cases from past incidents.
- Complexity mix:
  - 35% simple single-turn.
  - 40% medium with filters/constraints.
  - 25% complex multi-turn with follow-up/context carry.

### Scenario categories
1. Market scan and ranking (stock snapshot oriented).
2. Criteria filtering (PE/PB/ROE/liquidity, sector/ICB).
3. Symbol drilldown (fundamentals, valuation, risk).
4. Backtesting/factor/data-health workflows.
5. Multi-turn carry (same scope, follow-up metric change).
6. Noisy/typo/slang/code-mixed prompts.
7. Policy/scope guard (non-HOSE, future data, fabrication prompts).
8. Format-sensitive requests (table/citation/trace required).

## 4) Scenario Acceptance Criteria
- Each scenario must define:
  - Expected intent (`queryIntent`).
  - Expected tool(s) and allowed chain.
  - Expected endpoint fragments in citations.
  - Expected policy status (if safety/scope case).
  - Expected output format constraints (`table`, citation minimum, trace present).
  - Rejection rules (tools that must not succeed for that scenario).
- A scenario is invalid if it lacks any of the above checks.

## 5) Evaluation Metrics (with formulas)
- Tool Routing Accuracy
  - `correct_tool_routes / total_tool_routing_checks`
- Endpoint Grounding Accuracy
  - `correct_endpoint_matches / total_endpoint_checks`
- Intent Accuracy
  - `correct_intent_matches / total_intent_checks`
- Citation Coverage
  - `turns_with_required_citation / turns_requiring_citation`
- Format Compliance
  - `turns_passing_format_checks / turns_requiring_format`
- Context Carry Accuracy
  - `followup_turns_preserving_scope / total_followup_turns`
- Policy Safety Rate
  - `policy_safe_passes / policy_safety_checks`
- Unsupported Claim Rate
  - `unsupported_numeric_claims / numeric_claim_turns`
- Turn Pass Rate
  - `passed_turns / total_turns`
- Flake Rate (stability)
  - `failed_rounds / total_rounds`
- Latency P95
  - p95 on end-to-end assistant response latency.
- S1 Failure Count
  - Number of failed severity-S1 scenarios.

## 6) Scorecard and Thresholds
- Weighted score (0-100):
  - Routing+Endpoint+Intent: 30
  - Groundedness+Citation: 20
  - Format+Context carry: 20
  - Policy safety: 20
  - Stability+Latency: 10
- Minimum thresholds:
  - Tool routing >= 0.97
  - Endpoint accuracy >= 0.97
  - Intent accuracy >= 0.95
  - Citation coverage >= 0.95
  - Format compliance >= 0.95
  - Context carry >= 0.90
  - Policy safety >= 0.99
  - Unsupported claim rate <= 0.02
  - S1 failures == 0

## 7) Stage Gates (PR / Nightly / Release)
- PR gate (fast, strict on correctness)
  - Run: `routing:stable` + `pr-gate:stable` (>=2 rounds recommended).
  - Must pass: routing/policy/format/S1.
  - Soft warning: isolated latency spike if correctness is intact.
- Nightly gate (broad coverage)
  - Run: `stable:all` with >=3 rounds.
  - Must include: routing, realworld, pr-gate, policy-matrix, perf-reliability.
  - Fail if repeated instability exceeds max flake threshold.
- Release gate (hardest)
  - Require 2 latest nightly passes.
  - No open P0/P1 incident linked to assistant quality.
  - Realworld and policy suites must have zero S1 failures.

## 8) Telemetry Contract (minimum)
- Required per turn:
  - `trace_id`, `query_intent`, `query_plan_summary`
  - `used_tools[]` with status/latency/attempts
  - `citations[]` with endpoint
  - `policy_status`
  - `message_blocks[]` summary (type/count)
  - `status_code`, `latency_ms`, `error_code`
- Report integrity rule:
  - Missing required fields marks round as invalid for stability gate.

## 9) Realworld Scenario Selection Rules
- Refresh 30% scenario pool every sprint.
- Every new production incident must create at least 1 regression scenario.
- Every major prompt pattern from logs must appear in at least 2 variants:
  - clean prompt
  - noisy/follow-up variant
- HOSE-only constraints must be tested in every run.

## 10) Continuous Improvement Loop
1. Collect failures from stability/nightly reports.
2. Classify root cause: routing, data, policy, format, latency, infra.
3. Convert top failures into permanent regression scenarios.
4. Re-baseline thresholds monthly using rolling 4-week trend.
5. PM signs off threshold updates.

## 11) Execution Commands
- Full stability sweep:
  - `pnpm run docker:eval:assistant:stable:all`
- Governance monitor (run stability + score + report):
  - `pnpm run docker:eval:assistant:governance:monitor`
- Governance monitor (reuse existing reports only):
  - `pnpm run docker:eval:assistant:governance:monitor:skip-run`
- Per suite:
  - `pnpm run docker:eval:assistant:routing:stable`
  - `pnpm run docker:eval:assistant:realworld:stable`
  - `pnpm run docker:eval:assistant:pr-gate:stable`
  - `pnpm run docker:eval:assistant:policy-matrix:stable`
  - `pnpm run docker:eval:assistant:perf-reliability:stable`
