## Overview

Statistics provides the minimum toolkit for evaluating uncertainty. In systematic trading, the goal is rarely to find a perfect predictor. The goal is to estimate whether a signal is likely to be real, how unstable it is, and how much risk is required to harvest it.

### Learning objectives

- Define returns and understand basic distributional properties.
- Interpret volatility, correlation, and drawdowns.
- Learn simple diagnostics to avoid being misled by averages.

### Returns: the primitive quantity

The most common definition is simple return:

```
r_t = (P_t / P_{t-1}) - 1
```

For small moves, simple and log returns are similar, but you should be explicit about which one you use.

### Mean, median, and dispersion

- Mean return summarizes the average outcome.
- Median return summarizes the typical outcome and is less sensitive to outliers.
- Standard deviation measures dispersion and is often used as a volatility proxy.

A high mean is not meaningful if it is produced by a small number of extreme days.

### Correlation and diversification

Correlation describes co-movement. Low correlation between positions or strategies is a primary driver of diversification. Importantly, correlation is not stable: it often increases during stress.

### Drawdowns and tail risk

Drawdown is the peak-to-trough decline of an equity curve. It captures path risk that mean and volatility can hide. Two strategies can have the same average return and volatility but very different drawdown behavior.

### Practical diagnostics

- Compare in-sample vs out-of-sample performance.
- Compute rolling statistics (rolling mean and rolling volatility).
- Inspect the contribution of the worst and best days.
- Check exposure concentration: one sector or a few names can dominate results.

### Checklist

- Are return definitions consistent with your use case?
- Are outliers investigated before feature computation?
- Are correlations and drawdowns monitored over time?
- Is performance robust outside the calibration window?