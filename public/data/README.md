# Runtime Data Directory

This app reads its runtime CSV datasets from `public/data/` by default (or `DATA_DIR` if set).

Recommended workflow (2018-2025 prepared dataset):
1. Put the raw files under `../data/` (relative to `quant-website/`).
2. Run:

```bash
pnpm run data:prepare:2018_2025
```

This generates the preferred runtime files:
- `stock_metadata_2018_2025.csv`
- `ohlcv_2018_2025.csv`

And (if present) copies quarterly fundamentals into this directory:
- `HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv`
- `HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv`
- `HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv`

Notes:
- CSV files are ignored by git via `.gitignore` to avoid committing large datasets.
- Docker mounts this directory read-only into the container.


