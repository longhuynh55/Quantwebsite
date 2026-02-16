# Fundamentals Coverage Report

## Scope
This report summarizes fundamentals-statement coverage for the active symbol universe, based on prepared coverage artifacts.

## Artifact References
- `artifacts/fundamentals_coverage_summary.json`
- `artifacts/fundamentals_missing_by_symbol.csv`

## Data Sources
- Active symbol universe from coverage summary artifact (`total_active_symbols`).
- Statement-level availability from coverage summary artifact:
  - Balance Sheet (`has_bs`)
  - Income Statement (`has_is`)
  - Cash Flow (`has_cf`)
- Symbol-level missing detail from:
  - `artifacts/fundamentals_missing_by_symbol.csv`

## Method
1. Use `total_active_symbols` as denominator (`n = 403`).
2. Read statement availability counts from `fundamentals_coverage_summary.json`.
3. Compute percentages against `n = 403`.
4. Interpret `missing_any` as symbols missing at least one of the three statements (equivalent to `total_active_symbols - has_all_three`).
5. Use `fundamentals_missing_by_symbol.csv` for per-symbol evidence and follow-up analysis.

## Headline Counts
- `total_active_symbols`: **403**
- `has_bs`: **100** (**24.81%**)
- `has_is`: **159** (**39.45%**)
- `has_cf`: **103** (**25.56%**)
- `has_any`: **183** (**45.41%**)
- `has_all_three`: **49** (**12.16%**)
- `missing_any`: **354** (**87.84%**)

## Interpretation
Coverage is partial across active symbols, with full three-statement availability for a minority of the universe (`49/403`). Therefore, `404` responses from `GET /api/fundamentals` are expected for some symbols when no fundamentals statement data is available in the source coverage artifacts. This behavior should be treated as a data-coverage limitation, not necessarily an API defect.
