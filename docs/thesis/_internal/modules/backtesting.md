# Module: Backtesting Workspace

## Purpose
The Backtesting Workspace provides an empirical evaluation environment for trading hypotheses under configurable execution and cost assumptions. It is designed to produce interpretable evidence artifacts (KPIs, charts, trade logs, diagnostics) that support decision-making and iterative strategy refinement, while clearly communicating non-happy paths (validation errors, rendering failures, and retry options).

## User Stories
- As a user, I want to choose a predefined strategy template and configure its parameters.
- As a user, I want to incorporate realistic execution and transaction costs to avoid overly optimistic results.
- As a user, I want a consistent evidence package (metrics, charts, trade log, diagnostics) to compare iterations.
- As a user, I want a report export action for documenting results.

## Inputs And Controls
- Symbol, strategy template, and initial capital.
- Strategy parameters: template-specific parameter set.
- Execution & costs configuration:
  execution model, fee bps, tax bps, slippage bps, lot size, plus preset profiles.

## Outputs And Evidence Artifacts
- Summary KPIs (e.g., total return, Sharpe, max drawdown).
- Analysis charts and daily return series visualisations.
- Trade log table.
- Diagnostics tab and detailed stats panel.
- PDF report action (UI control).

## Business Rules And Guardrails
See `docs/thesis/_internal/business_rules.yml`:
- Capital and cost bounds (`backtesting_and_execution_constraints`)
- Max capital constraint (`backtesting_and_execution_constraints.backtesting.max_capital`)
- Maximum cost bps (`backtesting_and_execution_constraints.backtesting.costs.max_cost_bps`)
- Explicit states and retry paths (`reliability_patterns.explicit_states`)
- Error boundary around result rendering (`reliability_patterns.error_boundaries`)

## Failure Modes
- Validation failures: missing or invalid symbol/capital/advanced configuration are surfaced as status messages.
- Execution failures: error state is shown with a retry action.
- Rendering failures: a fallback UI prompts the user to rerun rather than failing silently.

## Dependencies (Conceptual)
- Backtesting service computing strategy results from historical data and configuration assumptions.
- Runtime dataset coverage and integrity constraints (data must be present for the requested symbol/time range).

## UI Evidence (Chapter 4)
- Screenshot: Strategy parameter and Execution & Costs tabs with presets.
- Screenshot: Summary KPIs and at least one analysis chart.
- Screenshot: Diagnostics tab (recommended, to demonstrate reliability cues).

## Internal Evidence Pointers (Do Not Cite In Thesis Body)
See `docs/thesis/_internal/evidence_map.yml` -> `modules.backtesting`.

