# Module: Portfolio Optimisation

## Purpose
The Portfolio Optimisation module supports portfolio construction as a decision-support activity rather than a purely exploratory charting task. Given a user-provided basket of symbols, it returns allocation weights alongside diversification and correlation diagnostics. This allows the user to evaluate not only expected return proxies but also the structural risk implied by correlations and exclusions.

## User Stories
- As a user, I want to enter a basket of symbols and select an optimisation method.
- As a user, I want allocation weights and summary metrics (expected return, volatility, Sharpe) as a compact evidence object.
- As a user, I want correlation and exclusion diagnostics so I understand why the solution looks the way it does.

## Inputs And Controls
- Symbol basket input (add/remove symbols).
- Solver selection (e.g., mean-variance, risk parity).
- Optimise action (with abortable request behaviour).

## Outputs And Evidence Artifacts
- Allocation weights table.
- Portfolio summary metrics (expected return, volatility, Sharpe; plus optional diversification diagnostics).
- Correlation matrix visualisation and per-asset return/volatility stats.
- Excluded symbols list with reasons (when applicable).

## Business Rules And Guardrails
See `docs/thesis/_internal/business_rules.yml`:
- UI basket constraints (`ui_limits_and_defaults.portfolio.min_symbols_in_ui`, `ui_limits_and_defaults.portfolio.max_symbols_in_ui`)
- Abortable requests (`reliability_patterns.abortable_requests`)
- Exclusion diagnostics (surfaced as explicit UI evidence rather than hidden failure)

## Failure Modes
- Validation error when fewer than the minimum required symbols are provided.
- Optimisation failure surfaces as an error state with a user-facing message.
- In-flight request abort prevents stale results after rapid edits.

## Dependencies (Conceptual)
- Optimisation service computing portfolio weights from historical return estimates and constraints.
- Correlation estimation and per-asset statistics computation.

## UI Evidence (Chapter 4)
- Screenshot: Basket entry + method selection + optimised weights.
- Screenshot: Correlation matrix and exclusions (if present).

## Internal Evidence Pointers (Do Not Cite In Thesis Body)
See `docs/thesis/_internal/evidence_map.yml` -> `modules.portfolio`.

