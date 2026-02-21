## Overview

A strategy that works in one market can fail in another if local market microstructure is ignored. For Vietnamese equities, liquidity dispersion, trading constraints, corporate actions, and benchmark concentration can materially affect both modeling and execution.

### Learning objectives

- Identify HOSE-specific constraints that impact systematic strategies.
- Translate microstructure realities into modeling assumptions.
- Build execution-aware guardrails for implementable research.

### Key considerations

- Liquidity is uneven across sectors and market caps.
- Price limits and auction mechanics can invalidate naive exit assumptions.
- Corporate actions must be handled correctly to produce clean return series.
- Benchmarks can be dominated by large-cap names, affecting interpretation.

### Modeling implications

- Apply liquidity filters before ranking signals.
- Model slippage that scales with participation and volatility.
- Limit position sizes for thinly traded names.
- Stress test during high-volatility periods and crowded sessions.

### Execution guidance

- Use staged execution for baskets in mid and small caps.
- Monitor open and close behavior separately.
- Track realized trading impact against pre-trade assumptions.

### Checklist

- Are liquidity and impact constraints encoded in the strategy?
- Are corporate actions and calendars handled correctly?
- Are backtest assumptions aligned with actual trading mechanics?
- Is performance robust under worse-than-expected slippage scenarios?