# Module: Stock Screener

## Purpose
The Stock Screener module operationalises the first stage of the quantitative research cycle: defining and refining a candidate universe. It supports systematic discovery by allowing users to filter and rank symbols using liquidity and classification metadata, producing a shortlist that can be validated in Charts and stress-tested in Backtesting.

## User Stories
- As a user, I want to filter the universe by symbol query, status, sector, and liquidity bounds to generate a candidate list.
- As a user, I want sortable results and pagination to explore a large universe efficiently.
- As a user, I want to export the screened universe to a portable artifact (CSV) for reporting and reproducibility.

## Inputs And Controls
- Symbol query: normalised to uppercase tokens.
- Sort controls: `sortBy` and `sortDir`.
- Filters: status, sector, minimum/maximum liquidity bounds.
- Pagination: page index and fixed page size.
- Export control: request the same filters in CSV mode.

## Outputs And Evidence Artifacts
- Screened universe table:
  symbol, company name, industry, average volume proxy, and trading days coverage.
- Page label (from/to counts) and total pages.
- CSV export artifact representing the filtered universe.

## Business Rules And Guardrails
See `docs/thesis/_internal/business_rules.yml`:
- `ui_limits_and_defaults.screener.page_size = 25`
- Symbol normalisation and format constraints (`symbol_normalization`)
- Abortable requests pattern (prevents stale UI updates) (`reliability_patterns.abortable_requests`)
- Explicit no-results and error states (`reliability_patterns.explicit_states`)

## Failure Modes
- No-results state: shown when filters match no symbols.
- Error state: shown when the data service is unavailable; supports retry.
- Request cancellation: in-flight requests are aborted when filters change rapidly (prevents inconsistent UI).

## Dependencies (Conceptual)
- Universe metadata service (symbol list, status, sector classification, liquidity proxy).

## UI Evidence (Chapter 4)
- Screenshot: Screener filters (query/sort/status/sector/liquidity) and the results table.
- Screenshot: No-results state (optional, if you want to demonstrate robustness).
- Screenshot: Export control (optional, if visible in the UI).

## Internal Evidence Pointers (Do Not Cite In Thesis Body)
See `docs/thesis/_internal/evidence_map.yml` -> `modules.screener`.

