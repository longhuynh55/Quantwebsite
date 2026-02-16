# Data Reliability Operations

This runbook defines a practical reliability contract so API functions and the AI assistant read consistent, correct data in both self-hosted Node runtime and Docker deployments.

## 1) Runtime Source of Truth

Primary runtime directory: `quant-website/public/data/`

Required runtime artifacts:
- `stock_metadata_2018_2025.csv` (preferred), fallback: `HOSE_VERIFIED_2020_2025.csv`
- `ohlcv_2018_2025.csv` (preferred), fallback: `HOSE_VERIFIED_OHLCV_INDUSTRY_2018_2025.csv` or `ohlcv_enriched.csv`
- `Market_Indices_Daily_2020_2025.csv`
- `data_manifest_2018_2025.json` (or `data_manifest.json`)

Fundamentals artifacts (recommended for assistant grounding):
- `HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv`
- `HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv`
- `HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv`

Optional performance artifact:
- `quant_data.duckdb`

Operational rule:
- Do not serve production directly from raw workspace `../data`.
- Keep `DATA_ALLOW_RAW_FALLBACK=false` in staging/production.

## 2) Backend Policy

Supported backends:
- `DATA_BACKEND=auto`: use DuckDB when both binding + artifact are available, otherwise fallback CSV.
- `DATA_BACKEND=csv`: force CSV runtime.
- `DATA_BACKEND=duckdb`: force DuckDB runtime.

Strictness:
- `DATA_BACKEND_STRICT=true`: fail fast if requested DuckDB backend is not fully available.
- `DATA_MANIFEST_STRICT=true`: enforce row-level manifest contract.
- `DATA_STRICT_READ=true`, `DATA_STRICT_PARSE=true`: fail on unreadable files or parse quality issues.

Recommended profile:
- Local dev: `DATA_BACKEND=auto`, `DATA_BACKEND_STRICT=false`
- Staging/prod: `DATA_BACKEND=duckdb`, `DATA_BACKEND_STRICT=true`

## 3) Pre-Deploy Reliability Gate

Run from `quant-website/`:

```bash
npm run data:prepare:2018_2025
npm run data:validate:fundamentals
npm run build
npm run docker:smoke:api
npm run docker:qa:api
npm run docker:eval:assistant
```

For release-sensitive changes, also run:

```bash
npm run docker:eval:assistant:full
npm run docker:qa:prod:api
```

Exit criteria:
- All commands exit code `0`
- No persistent `data-manifest` or `data-backend` errors in logs

## 4) Runtime Health Contract

Use `GET /api/health/data`:

- Fast readiness probe (for Docker healthcheck):
  - `/api/health/data?probe=true&includeFundamentals=false`
- Full check with cache reset:
  - `/api/health/data?refresh=true`

Expected response:
- HTTP `200`
- `"ok": true`
- `backend` block present with `requested`, `active`, `reason`
- `manifest` block present (if manifest artifacts exist)

Alert immediately when:
- HTTP `503`
- `backend.ok = false`
- Any core dataset (`stockMetadata`, `ohlcv`, `index`) has `ok = false`

## 5) Assistant + Function Query Contract

To keep AI assistant answers deterministic and auditable:

- Normalize ticker input (`trim + uppercase`) before data fetch.
- Return explicit structured no-data status (not silent empty success).
- Keep symbol universe aligned with runtime metadata file.
- Prefer runtime-prepared datasets over ad-hoc raw CSV reads.
- Run assistant eval (`eval:assistant`) after any data-pipeline change.

For fundamentals-specific prompts:
- Validate coverage by statement type (BCT/BCTT/LCTT).
- Surface missing statements as explicit availability errors.

## 6) Incident Playbook (Quick Triage)

When `/api/health/data` fails:

1. Check `backend.reason` in health response.
2. Verify runtime files in `public/data`.
3. Rebuild runtime artifacts:
   - `npm run data:prepare:2018_2025`
   - `npm run data:validate:fundamentals`
   - `npm run data:export:duckdb` (if DuckDB mode)
4. Restart services:
   - `docker compose restart app`
5. Re-run:
   - `npm run docker:smoke:api`
   - `npm run docker:qa:api`

## 7) Related Docs

- `docs/GETTING_STARTED.md`
- `docs/DOCKER_RUNBOOK.md`
- `docs/API.md`
- `docs/FINANCIAL_CSV_AUDIT.md`
- `docs/DATA_RELEASE_CHECKLIST.md`
- `docs/OBSERVABILITY_SLO.md`
- `docs/INCIDENT_RESPONSE.md`
