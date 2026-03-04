# Module: Charts & Analysis

## Purpose
The Charts & Analysis module supports single-symbol validation by combining historical price visualisation, multi-symbol comparison, and fundamentals browsing. It is intended to bridge the gap between universe-level discovery (Screener) and hypothesis testing (Backtesting) by providing interpretable evidence about market behaviour and company fundamentals.

## User Stories
- As a user, I want to inspect a symbol's price history across standard time horizons.
- As a user, I want to compare a small set of symbols to contextualise relative performance.
- As a user, I want to browse quarterly fundamentals snapshots (income statement, balance sheet, cash flow) and filter fields.

## Inputs And Controls
- Symbol input: normalised to uppercase and validated format.
- Time range selector: fixed options (days or "all").
- Comparison symbols: free text list subject to a maximum comparison limit.
- Fundamentals period selector and field filter.

## Outputs And Evidence Artifacts
- Candlestick chart for the selected symbol.
- Multi-line series for comparison symbols.
- Fundamentals tables grouped by statement type (IS/BS/CF) with user-selectable periods.

## Business Rules And Guardrails
See `docs/thesis/_internal/business_rules.yml`:
- Symbol normalisation (`symbol_normalization`)
- Comparison limit (`ui_limits_and_defaults.charts.compare_symbol_limit = 5`)
- Time range options (`ui_limits_and_defaults.charts.time_range_options_days`)
- Error boundary for fundamentals rendering (`reliability_patterns.error_boundaries`)

## Failure Modes
- If symbol data is unavailable, the module should surface a clear error/no-results presentation rather than a silent failure.
- If fundamentals cannot be loaded or rendered, an error boundary fallback is displayed to preserve page usability.

## Dependencies (Conceptual)
- Price history service (OHLCV series).
- Fundamentals service returning quarterly snapshots with labels and fields.

## UI Evidence (Chapter 4)
- Screenshot: Candlestick + time range selector.
- Screenshot: Comparison series input/output (optional).
- Screenshot: Fundamentals card with period selector and statement tabs.

## Internal Evidence Pointers (Do Not Cite In Thesis Body)
See `docs/thesis/_internal/evidence_map.yml` -> `modules.charts`.

