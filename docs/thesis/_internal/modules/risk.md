# Module: Risk Management

## Purpose
The Risk Management module translates return series into interpretable risk measures and benchmark-relative analytics. It supports the thesis narrative that research tools should not only measure performance but also quantify downside exposure and market sensitivity, thereby improving decision quality in a fintech context.

## User Stories
- As a user, I want to compute risk metrics for a symbol relative to a chosen benchmark.
- As a user, I want drawdown and rolling volatility visualisations for temporal interpretation.
- As a user, I want explicit guidance when no symbol is analysed yet (empty state).

## Inputs And Controls
- Symbol input (search box).
- Benchmark selection.
- Analyse action (with retry support).

## Outputs And Evidence Artifacts
- VaR and CVaR metrics (multiple confidence levels).
- Downside-risk metrics (downside deviation, Sortino, tail loss ratios).
- Drawdown panel and rolling volatility chart.
- Benchmark-relative measures (beta, tracking error, information ratio).

## Business Rules And Guardrails
See `docs/thesis/_internal/business_rules.yml`:
- Rate limiting for risk queries (`api_rate_limits_and_payload_limits.risk`).
- Abortable requests (`reliability_patterns.abortable_requests`).
- Explicit empty/error states (`reliability_patterns.explicit_states`).

## Failure Modes
- Aborted requests are ignored when superseded (prevents stale UI updates).
- Network/service failures surface as user-facing error messages with retry actions.
- Empty state provides a clear call-to-action to begin analysis.

## Dependencies (Conceptual)
- Risk analytics service operating on historical return data with benchmark alignment.

## UI Evidence (Chapter 4)
- Screenshot: Risk metric grid including VaR and beta/tracking error.
- Screenshot: Drawdown and rolling volatility charts.

## Internal Evidence Pointers (Do Not Cite In Thesis Body)
See `docs/thesis/_internal/evidence_map.yml` -> `modules.risk`.

