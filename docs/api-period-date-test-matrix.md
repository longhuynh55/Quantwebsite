# API Period / Date Test Matrix

## Scope
- Covers the HOSE market-facing APIs that accept `date`, `from`, `to`, or derived snapshot inputs and rely on the 2018-2025 OHLCV/fundamentals dataset in `public/data/ohlcv_2018_2025.csv` and `public/data/stock_metadata_2018_2025.csv`.
- Exercises both symbol-centric responses (`/api/stocks`) and derived snapshots (`/api/analytics/icb-snapshot`, `/api/analytics/valuation-rankings`) over the full span from 2018-01-02 through 2025-12-31.
- Differentiates between higher-liquidity symbols (e.g., `VIC`, `VCB`, `VNM`) and lower-liquidity or late-listed names (e.g., `AAT`, `ADG`, `ACG`) to surface padding or edge-case responses caused by sparse periods.

## Data anchors
- Earliest trading row: 2018-01-02 (confirmed via `stock_metadata_2018_2025.csv` and the OHLCV dataset).
- Latest trading row: 2025-12-31 (same files).
- Popular symbol sample: `VIC` (avg volume ~2.5M, full 2018-2025 span).
- Dormant/late-sized sample: `AAT` (IPO 2021, trimmed range) or similar low-volume ticker from metadata (avg volume < ~50k).

## `/api/stocks` (symbol-level data)
| Test ID | Scenario | Endpoint & Query | Expected Behavior | Pass Criteria | Fail Criteria |
| --- | --- | --- | --- | --- | --- |
| STK-01 | Popular symbol exact-as-of earliest date | `GET /api/stocks?symbol=VIC&date=2018-01-02` | Returns single row dated `2018-01-02`, `exactDateMatch=true`, metadata `firstDate=2018-01-02`, `lastDate>=2025-12-31`. | HTTP 200, `data.length===1`, `asOfDate===2018-01-02`, anchored metadata, no `error` key. | Non-200 status, empty `data`, mismatched `asOfDate`, missing metadata, or `error` key present. |
| STK-02 | Popular symbol cross-period range | `GET /api/stocks?symbol=VIC&from=2018-01-02&to=2025-12-31&limit=250` | Returns up to 250 rows covering start-to-end range, `total` equals filtered count, dates monotonic, latest row equals `2025-12-31`. | HTTP 200, `data` sorted ascending, `total>=250`, `firstDateKey=20180102`, `lastDateKey=20251231`, `limit` honored. | Missing boundary rows, wrong `total`, unsorted data, or HTTP errors. |
| STK-03 | Popular symbol open-ended (latest) view | `GET /api/stocks?symbol=VIC&limit=5` | Returns most recent five rows ending at `2025-12-31`. | HTTP 200, highest `data` date equals dataset latest, exactly five rows returned. | Older end-date, wrong row count, or limit ignored. |
| STK-04 | Less-popular symbol requesting pre-listing date | `GET /api/stocks?symbol=AAT&date=2019-01-02` | Symbol exists but series begins 2021; expect 404 with descriptive message. | HTTP 404, `error` contains "No OHLCV data available on or before requested date." | HTTP 200, 5xx, or data returned for unsupported date. |
| STK-05 | Less-popular range spanning missing segment | `GET /api/stocks?symbol=AAT&from=2018-01-02&to=2021-02-01` | Since series starts 2021-03-24, filtered set is empty -> 404. | HTTP 404, error text referencing no rows for the requested range. | 200 with empty `data` or inaccurate rows preceding listing. |
| STK-06 | Less-popular valid recent range | `GET /api/stocks?symbol=AAT&from=2021-03-24&to=2022-03-24&limit=all` | Returns all rows within the first 365 days, `total=data.length`. | HTTP 200, `total===data.length`, earliest row `20210324`, all dates within range. | Missing rows, `limit` applied despite `all`, `total` mismatch, or rejection. |
| STK-07 | Universe snapshot by ICB on custom date | `GET /api/stocks?groupBy=icb&exchange=HOSE&icbLevel=2&date=2024-12-15&limit=50` | Aggregated snapshot uses `date` override; `asOfDate=20241215`, `stocks` contains ≤50 entries with `exactDateMatch` flags. | HTTP 200, `asOfDate=20241215`, `stocks.length≤50`, `pricedSymbols>0`, `exactDateMatchCount` between 0 and `pricedSymbols`. | Wrong `asOfDate`, empty `stocks`, limit ignored, or missing `asOfDate`. |
| STK-08 | Snapshot fallback to latest date | `GET /api/stocks?exchange=HOSE&icbLevel=3&limit=all` | Without `date`, API resolves to dataset latest (2025-12-31). | HTTP 200, `asOfDate=20251231`, `requestedDate` absent, `pricedSymbols` equals active universe (nonzero). | `asOfDate` older than 2025-12-31, 0 priced symbols, or error. |

## `/api/analytics/icb-snapshot`
| Test ID | Scenario | Endpoint & Query | Expected Behavior | Pass Criteria | Fail Criteria |
| --- | --- | --- | --- | --- | --- |
| ICB-01 | Snapshot at dataset start | `GET /api/analytics/icb-snapshot?exchange=HOSE&icbLevel=2&date=2018-01-04&limit=20` | Snapshot uses `2018-01-04` as `asOfDate`; rows include only symbols active that date; `confidence` reflects exact-match ratio. | HTTP 200, `asOfDate=20180104`, `stocks.length≤20`, `confidence` in {low, medium, high}. | `asOfDate` mismatch, `stocks` empty despite coverage, or missing `confidence`. |
| ICB-02 | Snapshot at latest date with ICB filter | `GET /api/analytics/icb-snapshot?exchange=HOSE&icbLevel=3&icb=bank&date=2025-12-31` | Filtered view limited to banking ICB, `asOfDate=20251231`, `stocks` only contains bank codes, `pricedSymbols>0`. | HTTP 200, each `stock` includes `icbName3`/`icbCode3`, `exactDateMatchCount>=pricedSymbols-5`, `confidence` valid. | Non-bank entries, `pricedSymbols=0`, or `asOfDate` not last trading date. |
| ICB-03 | Snapshot limit enforcement | `GET /api/analytics/icb-snapshot?exchange=HOSE&icbLevel=2&limit=5` | Returns exactly five entries sorted by symbol even without `date`. | HTTP 200, `stocks.length===5`, `limit` honored. | More than five entries, `limit` ignored, or HTTP error triggered. |

## `/api/analytics/valuation-rankings`
| Test ID | Scenario | Endpoint & Query | Expected Behavior | Pass Criteria | Fail Criteria |
| --- | --- | --- | --- | --- | --- |
| VAL-01 | Ranking on early-period date | `GET /api/analytics/valuation-rankings?exchange=HOSE&icbLevel=3&metric=pe&order=asc&date=2018-02-01&limit=10` | Rankings rely on 2018 data; `asOfDate=20180201`, `metric=pe`, `order=asc`, `eligibleRanked>0`. | HTTP 200, `asOfDate=20180201`, `metric=pe`, ≤10 entries, `confidence` consistent with eligible/priced ratio. | Wrong `asOfDate`, `metric` mismatch, >10 entries, or 0 ranked entries despite coverage. |
| VAL-02 | Ranking with latest date default | `GET /api/analytics/valuation-rankings?exchange=HOSE&icbLevel=2&metric=pb&order=desc&limit=all` | Without `date`, resolves to latest; `order=desc`, results sorted by decreasing PB. | HTTP 200, `asOfDate=20251231`, `order=desc`, `data` sorted descending, `limit=all` returns entire eligible set. | `asOfDate` older than 2025-12-31, unsorted results, or truncated dataset despite `all`. |
| VAL-03 | Low-coverage filter (less-popular ICB) | `GET /api/analytics/valuation-rankings?exchange=HOSE&icbLevel=4&icb=Nong&metric=ev_ebitda&order=asc&date=2023-06-30` | Targets niche ICB with fewer members; ensures API returns subset with `pricedCandidates>=eligibleRanked`. | HTTP 200, `rankings` count>0, `confidence` label present, `icb` filter reflected in returned rows. | Empty response despite available data, `pricedCandidates=0`, or no `confidence`. |

## Execution notes
- Drive scenarios via automated API suites (Postman/Newman, Playwright API, or Jest `fetch` runs) and manual sanity checks.
- For each scenario, capture `asOfDate`, `metadata.firstDate`, `metadata.lastDate`, and the HTTP status to flag regressions.
- Log baseline values (e.g., `VIC` latest row) after each regression run so dataset drift across 2018-2025 periods is visible, especially for `limit=all` responses.
