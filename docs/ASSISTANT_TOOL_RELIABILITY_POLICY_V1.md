# Assistant Tool Reliability Policy V1

Date: 2026-02-21
Scope: `/api/assistant` grounding tool orchestration (HOSE-focused runtime)

## 1) Runtime Budgets (Enforced)

- `ASSISTANT_TOOL_TIMEOUT_MS`:
  - Per tool-call timeout in milliseconds.
  - Clamp: `3000..60000`.
  - Default: `15000`.
- `ASSISTANT_TOOL_FETCH_MAX_ATTEMPTS`:
  - Maximum attempts per tool fetch (initial call + retries).
  - Clamp: `1..4`.
  - Default: `2`.
- `ASSISTANT_TOOL_FETCH_RETRY_BACKOFF_MS`:
  - Base retry backoff in milliseconds.
  - Clamp: `100..5000`.
  - Default: `300`.
- `ASSISTANT_TOOL_MAX_CALLS_PER_TURN`:
  - Maximum number of tool calls allowed per assistant turn.
  - Clamp: `1..20`.
  - Default: `8`.
  - Overflow tasks are marked `status=skipped` with `errorCode=tool_budget_exceeded`.

## 2) Retry and Circuit Policy (Transient Failures)

- Retryable HTTP statuses: `429`, `502`, `503`, `504`.
- Retryable network conditions include timeout/abort/network fetch failures.
- `ASSISTANT_TOOL_TRANSIENT_FAILURE_CIRCUIT_THRESHOLD`:
  - Number of transient failures in a turn before opening circuit.
  - Clamp: `0..10` (`0` disables circuit).
  - Default: `3`.
- When circuit opens:
  - Remaining queued tool calls in the same turn are skipped.
  - Skipped calls are marked `status=skipped` with `errorCode=tool_circuit_open`.

## 3) Distributed Rate-Limit Plan

- L1 (edge/API gateway): coarse IP-based and route-based throttling.
  - Objective: absorb bursts before app workers.
- L2 (`/api/assistant` app-level): request limit by client identifier.
  - Current route-level limit remains active and separated for eval traffic.
- L3 (tool downstream endpoints): per-endpoint quotas for expensive tool routes.
  - Apply stricter budgets on high-cost operations (for example backtesting chains).

## 4) Alerts and Operational Signals

- Monitor and alert on:
  - `tool_budget_exceeded` ratio per hour.
  - `tool_circuit_open` count per hour.
  - Tool HTTP `429/5xx` rate and timeout rate.
  - p95 tool latency and p95 assistant latency.
- Governance monitor integration:
  - `scripts/eval-assistant-routing-matrix.mjs` emits `routingChecks.runtimeGuards`.
  - `scripts/assistant-governance-monitor.mjs` evaluates:
    - `toolBudgetCheckPassRate`
    - `toolBudgetExceededTurnRate`
    - `toolCircuitOpenTurnRate`
  - Thresholds are configured in `docs/assistant-realworld-drift-criteria-v1.json`.
- Suggested alert thresholds:
  - `tool_circuit_open` > 5% of assistant turns over 15m.
  - Tool timeout > 3% over 15m.
  - p95 assistant latency > SLO target for 3 consecutive windows.

## 5) Validation Gates

- Local/CI:
  - `pnpm exec tsc --noEmit`
  - `pnpm run test:agent:contract`
- Runtime stability:
  - `pnpm run eval:assistant:perf-reliability:stable`
  - `pnpm run eval:assistant:stable:all`
