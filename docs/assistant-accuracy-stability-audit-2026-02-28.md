# Assistant Stability + Accuracy Audit (2026-02-28)

## Scope
- Repo: `quant-website`
- Focus: AI assistant routing/grounding/policy fidelity for data queries
- Data backend target: `duckdb` (CSV chỉ nên fallback/debug)

## Stability Snapshot (latest local artifacts)

### Core suite status
- `artifacts/assistant-routing-matrix-report.json`
  - `turnPassRate=100%` (17/17 turns)
  - tool routing `100%` (15/15), endpoint routing `100%` (21/21)
  - intent/policy/citation sanity/tool budget đều `100%`
  - runtime guards: skipped/budgetExceeded/circuitOpen đều `0`
- `artifacts/assistant-ohlcv-stress-report.json`
  - `turnPassRate=100%`
- `artifacts/assistant-fundamentals-hyper-noise-matrix-report.json`
  - `turnPassRate=100%`
- `artifacts/assistant-metrics-stress-matrix-report.json`
  - `turnPassRate=100%`
- `artifacts/backtesting-kpi-matrix-report.json`
  - `overallStatus=pass`
  - gates: all pass
  - `latencyP95=8290ms` (threshold 30000ms)
  - `s1Failures=0`
- `artifacts/assistant-query-fidelity-report.json`
  - Jest fidelity tests pass: `4/4`

### Criteria v1 summary
- `artifacts/assistant-eval-criteria-v1-report.json`
  - Backend health: `duckdb` active
  - All criterion metrics are pass by value
  - But `overallStatus=fail` due orchestration reliability issue:
    - `suiteRuns[*].exitCode=1`
    - `stderrTail` shows `spawn EPERM`
  - This is a **test runner reliability issue**, not a data-accuracy regression.

## Stable Scenarios (confirmed)
1. Symbol/date OHLCV grounding with citations.
2. Multi-tool routing for fundamentals/risk/metrics under noisy prompts.
3. Backtesting KPI extraction (net return, sharpe, max drawdown, trades) with guardrails.
4. Policy guard for unsupported numeric claims (numbers-not-in-data violations currently 0).
5. Tool budget/runtime guards enforcement.

## High-Risk Scenarios (need hardening)
1. **Context-memory bleed into current request**
   - Example pattern: stale symbol in context overrides/contaminates current compare query.
   - Recent patch now prioritizes explicit prompt symbols; keep regression tests expanding.
2. **Evaluation pipeline false negatives**
   - `spawn EPERM` causes suite non-zero exits despite pass metrics.
   - This can block release gates incorrectly.
3. **Coverage fanout edge cases**
   - Multi-symbol compare under tool fanout limit can still under-cover symbols if symbol resolver is not strict.
4. **Provider observability mismatch**
   - User-visible “no OpenRouter trace” must be detectable with explicit heartbeat/trace IDs in logs.

## Research-Based Accuracy Improvements (priority order)

## P0 (do now): Accuracy before memory expansion
1. Enforce `request_truth > memory_hint` precedence in resolver.
2. Add conflict telemetry on every turn:
   - `requested_symbols`, `resolved_symbols`, `memory_symbols_used`, `dropped_symbols`, `reason`.
3. Strict numeric claim gate:
   - Numeric output only when grounded evidence exists.
4. Add clarification gate for ambiguous symbol/date intents.

## P1: Evaluation reliability hardening
1. Fix criteria orchestrator to classify pass/fail by parsed suite metrics when spawn failure is environmental.
2. Surface explicit failure class:
   - `env_orchestration_error` vs `model_accuracy_error`.
3. Add retry policy for flaky spawn errors and emit stable heartbeat logs.

## P2: Controlled memory upgrade
1. Keep memory as typed state, not free text:
   - `working_memory` (per request), `session_memory` (TTL), `long_term_preferences`.
2. Never let session memory override explicit symbols/timeframe in current prompt.
3. Add TTL + intent-boundary reset (market overview -> compare should not carry ticker automatically).

## Suggested Test Additions
1. Regression matrix: stale context symbol + explicit compare symbols (`VNM/FPT` with stale `VCB`).
2. Multi-turn ambiguity tests:
   - follow-up missing symbol/date should ask clarify instead of hallucinating.
3. Fanout boundary tests:
   - 2, 3, 4 symbol prompts with deterministic drop policy + coverage notice.
4. Orchestrator resilience tests for `spawn EPERM` simulation.

## Practical Rollout Plan
1. Week 1
   - Patch resolver telemetry + clarify gate + regression tests.
2. Week 2
   - Patch criteria orchestrator false-fail handling (`spawn EPERM` class).
3. Week 3
   - Add typed session memory with TTL and strict precedence rules.

## References (for design rationale)
- ReAct (reason+act): https://arxiv.org/abs/2210.03629
- RAG: https://arxiv.org/abs/2005.11401
- Self-RAG: https://arxiv.org/abs/2310.11511
- CRAG: https://arxiv.org/abs/2401.15884
- Reflexion: https://arxiv.org/abs/2303.11366
- MemGPT (memory management): https://arxiv.org/abs/2310.08560
- Lost in the Middle (context placement risk): https://arxiv.org/abs/2307.03172
