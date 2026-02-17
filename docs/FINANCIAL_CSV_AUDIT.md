# Financial CSV Audit (workspace `data/`)

This audit targets the raw quarterly financial statement CSVs in the workspace `data/` directory:
- Balance sheet
- Income statement
- Cash flow

It focuses on four integrity checks:
1) **Symbols with zero rows** (vs a symbol universe file)
2) **Duplicate keys** (`symbol + yearReport + lengthReport`)
3) **Malformed rows** (CSV column count mismatch vs header)
4) **Rows that are entirely empty besides keys**

## How to run

### Option A (Recommended): Run via Docker (no local Python)

From the workspace root (`D:\\KLTN\\Quant wwebsite`):

```powershell
docker run --rm `
  -v "${PWD}\\data:/workspace-data:ro" `
  -v "${PWD}\\quant-website:/app" `
  -w /app `
  python:3.11-slim `
  python scripts/audit_financial_csvs.py `
    --data-dir /workspace-data `
    --symbols-csv /workspace-data/HOSE_VERIFIED_2020_2025.csv `
    --artifacts-dir /app/artifacts
```

### Option B: Run via local venv (fallback)

From the workspace root (`D:\\KLTN\\Quant wwebsite`):

```powershell
& "quant-website\.venv\Scripts\python.exe" "quant-website\scripts\audit_financial_csvs.py" `
  --data-dir "data" `
  --artifacts-dir "quant-website\artifacts"
```

By default, the symbol universe is read from `data/HOSE_VERIFIED_2020_2025.csv` (column `symbol`).

## Outputs

Each run writes timestamped artifacts under `quant-website/artifacts/`:
- `financial_csv_audit_<ts>.json`: high-level summary per file (counts + most-common malformed column lengths)
- `financial_csv_audit_<ts>.zero_rows.csv`: symbols in the universe with **no rows** in a given statement file
- `financial_csv_audit_<ts>.duplicate_keys.csv`: duplicate key occurrences
- `financial_csv_audit_<ts>.malformed_rows.csv`: line numbers where `actual_cols != expected_cols`
- `financial_csv_audit_<ts>.malformed_cols_distribution.csv`: histogram of malformed row widths
- `financial_csv_audit_<ts>.empty_rows.csv`: rows where all non-key cells are empty (based on cells present on the line)

## Notes on interpretation

- A high count of **malformed rows** often indicates rows that omit trailing empty columns (common when different issuer types have different field sets). The distribution file helps distinguish this from true delimiter/quoting problems.
- Duplicate keys are evaluated on the first three columns (`ticker/yearReport/lengthReport`) because these files include both `ticker` and `symbol`, and malformed rows can shift later columns.
