# Strategy Lab Template Tuner Test Matrix (V1)

## Purpose
Test theo hành vi user thật: kéo-thả -> preview -> chạy -> xem result/diagnostics, đồng thời bắt các lỗi “graph mismatch” và bias.

## Test Scenarios

### T1 - Minimal Happy Path
- Build: Data Source + supported Template/Indicator.
- Expect:
  - Preview shows resolved `strategyType`, params, config.
  - Run accepted (202), terminal within timeout.
  - Summary metrics render + assumptions visible.

### T2 - Unsupported Node / Option Must Fail
- Build: Add unsupported indicator type (ex: MACD/ATR) or unsupported filter.
- Expect:
  - Preview fails with explicit error.
  - No run request can be created.

### T3 - Non-Semantic Graph Warning
- Build: Add edges or optional decorative nodes (if still exposed).
- Expect:
  - Preview includes “ignored inputs” list.
  - Connections do not change payload (determinism).

### T4 - Deterministic Mapping
- Build same strategy twice (same nodes/config).
- Expect:
  - Payload stable (same `strategyType/params/config`).

### T5 - Bias Guard
- If `same_close` is present anywhere:
  - Expect explicit warning + opt-in gating.
- Otherwise:
  - Expect Strategy Lab always applies `next_open`.

### T6 - Data Range & Insufficient Data
- Set a too-short dateRange.
- Expect:
  - API returns 400/409 with code `INSUFFICIENT_DATA` (or mapped StrategyLab error).
  - UI shows actionable message.

### T7 - Cancel Flow
- Start run then cancel.
- Expect:
  - Run transitions to `cancelled` or stops.
  - UI status updates; no dangling polling.

## Automation Targets
- Unit/Jest:
  - `builder-mapper` strict mapping + determinism.
  - backtest invariants (no-lookahead, cost monotonicity).
- Integration (docker):
  - `/api/strategy-lab/*` create/poll/result/events/cancel.
  - strategy-builder page flow (Playwright).

## Gates (Proposed)
- `Gate A (fast)`: mapper unit tests + backtest invariants tests pass.
- `Gate B (integration)`: docker app healthy + strategy-lab run flow passes.
- `Gate C (e2e)`: Playwright strategy-builder smoke passes with artifacts.
