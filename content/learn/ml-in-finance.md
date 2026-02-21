## Overview

Machine learning can be useful in finance when relationships are nonlinear, interactions are complex, or you have many candidate predictors. The primary risk is leakage: using information that would not be available at prediction time. Without strict controls, models can appear strong in backtests and fail immediately in live trading.

### Learning objectives

- Define targets and features in a time-consistent way.
- Use validation methods appropriate for time-series data.
- Evaluate models with economic metrics, not only prediction accuracy.

### Targets and features

A target must match the trading horizon (for example, next-day return, next-week return). Features must be available at the time the decision is made, and should be lagged appropriately.

### Time-aware validation

Avoid random shuffles. Prefer:

- Walk-forward validation (rolling or expanding windows).
- A true out-of-sample period that is not used for tuning.

### Model hierarchy

Start with baselines:

- Linear models as a benchmark.
- Tree-based models for nonlinear effects.

Complexity should be earned, not assumed.

### Economic evaluation

A model that improves prediction metrics may still lose money after costs. Evaluate:

- P&L and drawdown under a trading rule.
- Turnover and transaction costs.
- Capacity and liquidity constraints.

### Checklist

- Is the dataset free of look-ahead and label leakage?
- Is validation time-aware and out-of-sample?
- Are results robust across regimes?
- Are costs, turnover, and constraints included in evaluation?