# Assistant Agent Function Postcheck V2

## Scope
- Validate `LLM -> function-calling -> execute route -> internal API` flow.
- Keep this separate from chat-assistant quality eval scripts.

## Gate Commands
1. `pnpm run test:agent:contract`
2. `pnpm run verify:agent:advanced`
3. `pnpm run docker:eval:assistant`

## Critical Assertions
1. Approval gate:
   - Missing `ASSISTANT_EXECUTE_APPROVAL_TOKEN` -> `503`
   - Wrong `approvalToken` -> `403`
2. Trusted base URL gate:
   - Production mode without trusted base URL -> `503`
3. Tool schema contract:
   - Reject unknown `toolName`
   - Reject invalid `arguments` by tool
   - `backtest_run.executionModel` accepts only `next_open|same_close`
4. Request plan integrity:
   - GET tools build correct query params
   - POST tools build correct JSON body
   - Downstream non-2xx is proxied with original status/payload

## Fast Triage
1. If `403` spikes: check token rotation mismatch between client and `ASSISTANT_EXECUTE_APPROVAL_TOKEN`.
2. If `503` spikes: check trusted base URL env (`ASSISTANT_TOOL_BASE_URL` first).
3. If `400 Invalid arguments`: inspect schema drift in `src/lib/assistant/executeTools.ts`.

