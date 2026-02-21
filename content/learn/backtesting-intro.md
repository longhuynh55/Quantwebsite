## Overview

A backtest is a controlled historical experiment used to estimate how a strategy might have behaved under explicit assumptions. It is essential for research, but it is also a common source of false confidence: small data or implementation errors can create performance that cannot exist in live trading.

### Learning objectives

- Understand what a backtest can and cannot tell you.
- Recognize major biases (look-ahead, survivorship, selection, and overfitting).
- Learn a minimal robustness framework for time-series strategies.

### What a backtest is (and is not)

A backtest is not proof. It is evidence under assumptions. The correct question is not "does it work?" but "under which conditions does it fail, and how sensitive is it to costs and modeling choices?"

### Core ingredients

- Data: prices, corporate actions, calendars, and any predictors.
- Rules: signals, rebalancing frequency, constraints, and sizing.
- Execution model: fills, slippage, fees, and delays.
- Evaluation: metrics and diagnostics.

A minimal pipeline:

```
Load data -> Compute signals -> Simulate trades -> Apply costs -> Compute metrics
```

### Biases and failure modes

- Look-ahead bias: using information not available at the decision time.
- Survivorship bias: excluding delisted or failed stocks.
- Data snooping: repeated tuning until noise becomes "signal".
- Regime dependence: performance concentrated in one period.

Each bias has a mitigation: point-in-time alignment, survivorship-aware universes, strict out-of-sample evaluation, and regime-level analysis.

### Evaluation metrics (minimum set)

- Return and volatility.
- Max drawdown and recovery time.
- Turnover (trading frequency) and concentration.
- Benchmark-relative performance (excess return).

### Robustness framework

- Out-of-sample evaluation: reserve a period that is not used for tuning.
- Walk-forward testing: refit periodically and test forward.
- Sensitivity analysis: vary parameters, costs, and rebalancing frequency.

### Checklist

- Are signals computed using only information available at the time?
- Are corporate actions and delistings handled?
- Are costs and delays modeled plausibly?
- Does performance remain acceptable out-of-sample and across regimes?