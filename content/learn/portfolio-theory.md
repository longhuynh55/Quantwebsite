## Overview

Modern Portfolio Theory (MPT) formalizes diversification by balancing expected return and risk under constraints. In practice, portfolio optimization is less about solving an elegant equation and more about managing estimation error: expected returns are noisy, and covariance estimates can be unstable.

### Learning objectives

- Understand mean-variance optimization and the efficient frontier.
- Recognize the practical failure modes of optimization.
- Apply constraints and robust techniques for implementable portfolios.

### The mean-variance problem

A canonical formulation trades off expected return and variance:

```
Maximize: expected_return - lambda * portfolio_variance
```

lambda represents risk aversion. The solution depends on estimates of expected returns and the covariance matrix.

### The efficient frontier

The efficient frontier is the set of portfolios that maximize expected return for a given risk level. It is conceptually useful, but in real markets it can be fragile because small changes in inputs can lead to large changes in weights.

### Practical enhancements

- Constraints: long-only, max weight per name, sector caps.
- Shrinkage: stabilize covariance estimates.
- Turnover penalties: discourage excessive trading.
- Robust optimization: reduce sensitivity to estimation error.

### Implementation checklist

- Are weights stable when inputs vary slightly?
- Are constraints aligned with liquidity and risk limits?
- Is turnover controlled and costs included?
- Are exposures (sector, factor, beta) monitored over time?