# Assistant Real-World Testing Playbook

## Goal
- Make test results closer to real user behavior.
- Catch routing mistakes early (wrong tool, wrong endpoint) before they become user-facing failures.
- Reduce the gap between "eval looks good" and "production feels bad".

## Why Old Tests Usually Look Better Than Reality
- Prompts are too clean, too short, and too explicit.
- Most test cases are single-turn; real users ask follow-up questions that depend on prior context.
- Test sets over-represent ideal symbol queries and under-represent market-wide ranking/date queries.
- Routing is not scored separately, so a response can pass text quality while still using wrong data source.

## Real-World Assumptions For This Project
- Users often ask in mixed style: Vietnamese + finance English terms.
- Users may omit symbol and ask by date/ranking first.
- Users may include typo, slang, and short angry messages.
- Users frequently ask "top N" with no metric detail, then refine later.
- Users expect exact day values; if unavailable, assistant must state as-of fallback clearly.
- Current runtime market-price dataset scope is HOSE only; non-HOSE requests must be answered as unsupported with explicit scope notice.

## Test Layers
1. `L1 - Realistic Single-Turn`
- Messy prompts, typo, incomplete filters, ranking/date-heavy requests.
- Purpose: stress intent detection and tool routing.

2. `L2 - Multi-Turn Context`
- Follow-up prompts that reuse prior context:
  - "same date", "same group", "show top 5 now".
- Purpose: catch context-loss and stale-routing issues.

3. `L3 - Adversarial/Frustration`
- Hostile tone, prompt injection, coercion to output numbers without evidence.
- Purpose: verify policy behavior and grounded abstention.

4. `L4 - Shadow Replay`
- Replay anonymized production-style prompts (or synthetic equivalent) before release.
- Purpose: detect regressions not visible in curated benchmark prompts.

## Must-Track Metrics
- `intentRoutingAccuracy`: expected tool family selected (`stockSnapshot`, `fundamentalSnapshot`, etc.).
- `endpointMatchRate`: response citations include expected endpoint family.
- `groundedNumericPrecision`: numeric claims that are actually grounded.
- `abstentionQuality`: missing-data cases return clear `INSUFFICIENT_DATA` behavior, no fabricated numbers.
- `clarificationRate`: when query is ambiguous, assistant asks or states assumptions explicitly.
- `contextCarryRate`: multi-turn follow-ups keep the correct date/scope unless user changes it.
- `userRecoveryRate`: after one failed/ambiguous turn, next turn recovers with correct routing.

## Release Gates (Recommended)
- `intentRoutingAccuracy >= 0.92`
- `endpointMatchRate >= 0.95`
- `groundedNumericPrecision >= 0.90`
- `abstentionQuality >= 0.98`
- `contextCarryRate >= 0.90`
- No severity-1 failure in top intents:
  - market-wide top N by date
  - symbol as-of date
  - fundamentals by period
  - risk/backtest symbol requests

## Failure Severity
- `S1` Wrong source used for numeric answer (for example using market overview for top stock close ranking).
- `S2` Correct source family but wrong scope (wrong date/exchange/symbol).
- `S3` Missing clarification; answer partially useful but risky.
- `S4` Cosmetic/wording issue only.

## Execution Cadence
1. Per PR (assistant logic touched):
- Run L1 + small L2 sample.

2. Nightly:
- Run full L1/L2/L3 set.

3. Pre-release:
- Run full set + L4 shadow replay.
- Block release on any S1 failure.

## Fast Routing Matrix Command (No Dataset Scan)
- Local: `pnpm run eval:assistant:routing`
- Docker: `pnpm run docker:eval:assistant:routing`
- This suite validates query complexity and tool-path routing only.
- It does not run full CSV scan/backtest-universe sweep.

## Report Template (Use In Every Run)
- Build/commit hash.
- Config snapshot:
  - `ASSISTANT_POLICY_MODE`
  - `ASSISTANT_QUERY_PLAN_STRICT`
  - `ASSISTANT_BASELINE_ONLY`
- Metrics summary.
- Top S1/S2 failures with:
  - prompt
  - selected tools
  - citations
  - expected route
  - root cause
  - fix status

## Implementation Notes
- Use the scenario catalog in `docs/ASSISTANT_REAL_WORLD_SCENARIO_CATALOG.md` as default test corpus.
- Keep at least 30% of prompts in noisy Vietnamese style (typo/slang/short forms).
- Keep at least 30% of prompts as multi-turn.
- Keep at least 20% of prompts without explicit symbol.

