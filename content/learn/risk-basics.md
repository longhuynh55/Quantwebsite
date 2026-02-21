## Overview

Risk management is the discipline of limiting losses and controlling exposure so that a strategy can survive adverse outcomes. In systematic trading, most failures are risk failures: excessive concentration, unrealistic leverage, underestimated tail events, or cost blow-ups during stress.

### Learning objectives

- Understand position risk vs portfolio risk.
- Learn the role of sizing, drawdown limits, and liquidity constraints.
- Build practical guardrails that are compatible with systematic execution.

### Core risk dimensions

- Position risk: loss per trade or per position.
- Portfolio risk: aggregate exposure across holdings.
- Liquidity risk: the ability to enter and exit without large price impact.
- Tail risk: rare events that dominate long-run outcomes.

### Position sizing (a baseline formula)

Sizing converts a risk budget into a trade size. A common baseline:

```
Position Size = (Account Value * Risk Per Trade) / Stop Distance
```

The goal is not precision; it is consistency. Sizing should reduce the chance that a single trade determines the fate of the strategy.

### Portfolio guardrails

- Concentration limits: max weight per name and per sector.
- Correlation awareness: avoid stacking similar bets.
- Drawdown rules: define when to de-risk or pause trading.
- Volatility scaling: reduce exposure when volatility rises.

### Monitoring

Risk is dynamic. Monitor rolling volatility, drawdown, exposure concentration, and liquidity metrics, not only cumulative return.

### Checklist

- Is maximum loss per position bounded?
- Are concentration and liquidity constraints explicit?
- Are drawdown-based de-risk rules defined in advance?
- Are risk measures monitored on a rolling basis?