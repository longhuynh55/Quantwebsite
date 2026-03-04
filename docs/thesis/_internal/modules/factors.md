# Module: Factor Analytics

## Purpose
The Factor Analytics module provides cross-sectional views of the market by ranking symbols according to factor proxy scores and presenting distribution summaries. It supports exploratory research and hypothesis formation by helping users identify extremes (top/bottom exposures) and understand how a selected factor differentiates symbols.

## User Stories
- As a user, I want to choose a factor proxy and view the top and bottom ranked symbols.
- As a user, I want a distribution summary chart to contextualise factor dispersion across leading constituents.
- As a user, I want quick navigation from a ranked symbol to its chart analysis.

## Inputs And Controls
- Factor selection: momentum, value, volatility, size (as proxies).
- Table exploration: sorting and navigation to charts.

## Outputs And Evidence Artifacts
- Top and bottom ranking tables with factor score badges.
- Distribution bar chart for a subset of ranked symbols.
- A theory tab that provides explanatory text (currently a placeholder-level narrative).

## Business Rules And Guardrails
See `docs/thesis/_internal/business_rules.yml`:
- Factors endpoint is rate-limited and marked computationally expensive (`api_rate_limits_and_payload_limits.factors`).
- Loading and error messaging patterns (`reliability_patterns.explicit_states`).

## Failure Modes
- If factor data cannot be loaded, the module shows a user-facing error message and encourages retry.

## Dependencies (Conceptual)
- Factor scoring service over the HOSE-oriented universe, producing cross-sectional rankings.

## UI Evidence (Chapter 4)
- Screenshot: Factor selection cards and top/bottom table.
- Screenshot: Distribution chart (optional).

## Internal Evidence Pointers (Do Not Cite In Thesis Body)
See `docs/thesis/_internal/evidence_map.yml` -> `modules.factors`.

