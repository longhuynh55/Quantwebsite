# Assistant Req6 Testing Framework V2

## Scope
Version 2 is a fully independent testing matrix for the 6 production requirements, expanded with edge cases and complex query patterns.

## What is new vs V1
- Increased coverage from 18 cases to 36 cases (6 groups x 6 cases).
- Stronger edge-case focus:
  - Future-date variants (`ngay mai`, explicit far-future date).
  - Non-HOSE scope guards (`HNX`, `UPCOM`) without numeric leakage.
  - Lowercase and noisy multi-symbol prompts (`fpt vs vnm`).
  - Follow-up context carry checks.
  - Low-liquidity/small-cap batch stress checks.
  - Mixed robust-route checks (stock/fundamentals/risk/policy in one suite).
- Stability rounds default increased to `3`.

## Script
- `scripts/eval-assistant-requirements6-v2.mjs`

## Commands
- Local:
`pnpm run eval:assistant:req6:v2`
- Docker:
`pnpm run docker:eval:assistant:req6:v2`

## Output
- Default report:
`artifacts/assistant-requirements6-v2-report.json`

## Environment variables
- `ASSISTANT_REQ6_V2_BASE_URL` (default `http://localhost:3010`)
- `ASSISTANT_REQ6_V2_REPORT_PATH` (default `artifacts/assistant-requirements6-v2-report.json`)
- `ASSISTANT_REQ6_V2_TIMEOUT_MS` (default `30000`)
- `ASSISTANT_REQ6_V2_MAX_RETRIES` (default `2`)
- `ASSISTANT_REQ6_V2_RETRY_BACKOFF_MS` (default `350`)
- `ASSISTANT_REQ6_V2_STABILITY_ROUNDS` (default `3`)
