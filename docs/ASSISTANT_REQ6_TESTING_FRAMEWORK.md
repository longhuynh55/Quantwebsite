# Assistant Req6 Testing Framework

## Goal
This framework is a new testing mechanism dedicated to 6 production requirements:

1. Timeline/lifecycle handling (IPO during period, delisted/non-active as-of behavior).
2. Balance sheet / income statement / cashflow correctness and period alignment.
3. Multi-symbol recognition and comparison in one prompt.
4. Anti-hallucination behavior when data is unavailable or out of scope.
5. Small/junk stock query capability.
6. Robustness across OHLCV and fundamentals timeline on HOSE.

It is intentionally independent from legacy routing/realworld/pr-gate suites.

## Script
- `scripts/eval-assistant-requirements6.mjs`

## Commands
- Local:
`pnpm run eval:assistant:req6`
- Docker:
`pnpm run docker:eval:assistant:req6`

## Output
- Report path (default):
`artifacts/assistant-requirements6-report.json`

## Key Notes
- HOSE-only scope is enforced in requirements and validations.
- Includes both API-level and assistant-level checks.
- Includes stability rounds (`ASSISTANT_REQ6_STABILITY_ROUNDS`, default `2`) for robust behavior checks.

## Config (optional env)
- `ASSISTANT_REQ6_BASE_URL` (default: `http://localhost:3010`)
- `ASSISTANT_REQ6_REPORT_PATH` (default: `artifacts/assistant-requirements6-report.json`)
- `ASSISTANT_REQ6_TIMEOUT_MS` (default: `30000`)
- `ASSISTANT_REQ6_MAX_RETRIES` (default: `2`)
- `ASSISTANT_REQ6_RETRY_BACKOFF_MS` (default: `350`)
- `ASSISTANT_REQ6_STABILITY_ROUNDS` (default: `2`)
