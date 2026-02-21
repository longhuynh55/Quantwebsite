## Overview

OHLCV stands for Open, High, Low, Close, and Volume. These fields summarize the trading activity of a security over a fixed interval (day, hour, minute) and form the foundation of most technical indicators and systematic trading signals.

Interpreting OHLCV correctly is not only about reading candlesticks. It is about understanding what the data represents, how it is produced, and which preprocessing steps are required before you compute features.

### Learning objectives

- Understand each OHLCV field and what it implies.
- Connect price movement and volume to participation and liquidity.
- Recognize data-quality issues that can invalidate backtests.

### The five fields

- Open: first traded price in the interval.
- High: maximum traded price in the interval.
- Low: minimum traded price in the interval.
- Close: last traded price in the interval.
- Volume: number of shares traded in the interval.

### Candlestick interpretation (with caveats)

A candlestick compresses a distribution of intraday trades into four prices. As a result, multiple intraday paths can produce identical OHLC values. Treat candlesticks as a summary, not a full record.

Common interpretations:

- Wide range with high volume may indicate strong participation.
- Narrow range with low volume may indicate weak conviction.
- Long upper shadow can indicate selling pressure near highs.

### Volume is context, not a standalone signal

Volume is most informative relative to a baseline (for example, a rolling average). A volume spike during a breakout is not inherently bullish or bearish; it is evidence that the market paid attention.

### Data-quality checks before modeling

- Corporate actions: adjust historical prices when splits and dividends apply.
- Calendar alignment: ensure you have the correct trading days and no duplicates.
- Outliers: investigate extreme prices and volumes before computing indicators.
- Missing data: decide whether to forward-fill, drop, or mark intervals.

### A minimal example row

```
Symbol: FPT
Date: 2025-06-03
Open: 118.2
High: 120.1
Low: 117.8
Close: 119.6
Volume: 3,482,100
```

### Practical checklist

- Are prices adjusted consistently across the dataset?
- Are time zones and session boundaries correct?
- Do extreme values reflect real trades or data errors?
- Is volume interpreted relative to a meaningful baseline?