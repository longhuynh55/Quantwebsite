# Data Release Checklist

Use this checklist whenever data files, parsing logic, backend mode, or assistant grounding rules are changed.

## 1) Release Scope

Trigger this checklist when at least one item changes:
- Runtime files in `public/data/`
- Raw source files in `../data` that will be re-prepared
- `src/lib/data.ts`, `src/lib/dataBackend.ts`, `src/lib/dataManifest.ts`, `src/lib/fundamentals.ts`
- Health endpoint `src/app/api/health/data/route.ts`
- Assistant evaluation scripts or thresholds

## 2) Ownership

| Role | Responsibility | Required |
|------|----------------|----------|
| Data Owner | Data correctness and schema compatibility | Yes |
| Runtime Owner | Docker/runtime deployment and health | Yes |
| Reviewer | Independent verification of evidence | Yes |

Minimum rule: one person can hold multiple roles, but `Reviewer` must be different from the person who prepared the data.

## 3) Pre-Deploy Checklist

Run from `quant-website/`.

### 3.1 Prepare + Validate Data

- [ ] `npm run data:prepare:2018_2025`
- [ ] `npm run data:validate:fundamentals`
- [ ] Verify `public/data/data_manifest_2018_2025.json` is regenerated
- [ ] Verify required runtime files exist in `public/data/`

### 3.2 Build + API Reliability

- [ ] `npm run build`
- [ ] `npm run docker:smoke:api`
- [ ] `npm run docker:qa:api`
- [ ] `curl "http://localhost:3010/api/health/data?refresh=true"` returns HTTP `200` and `"ok": true`

### 3.3 Assistant Reliability

- [ ] `npm run docker:eval:assistant`
- [ ] If release-sensitive: `npm run docker:eval:assistant:full`
- [ ] Confirm no regression versus previous baseline report

### 3.4 Production Profile Gate

- [ ] `npm run docker:up:prod`
- [ ] `npm run docker:smoke:prod:api`
- [ ] `npm run docker:qa:prod:api`
- [ ] `curl "http://localhost:3011/api/health/data?probe=true&includeFundamentals=false"` returns HTTP `200`

## 4) Release Approval Record

Capture this before go-live:

```text
release_id:
date_utc:
data_owner:
runtime_owner:
reviewer:
change_summary:
manifest_generated_at:
backend_target: (auto/csv/duckdb)
assistant_eval_result:
qa_result:
go_live_decision: (approved/rejected)
```

## 5) Post-Deploy Verification (T+0)

Within 30 minutes after deploy:
- [ ] Probe health: `/api/health/data?probe=true&includeFundamentals=false`
- [ ] Full health: `/api/health/data?refresh=true`
- [ ] Critical API spot checks: `/api/stocks`, `/api/fundamentals`, `/api/market-overview`
- [ ] Confirm no continuous `data-backend`/`data-manifest` errors in logs

## 6) Rollback Criteria

Rollback immediately when any of the following persists for >10 minutes:
- `/api/health/data` returns HTTP `503`
- `backend.ok = false` or any core dataset health `ok = false`
- Assistant eval fails critical thresholds

Rollback actions:
1. Revert to previous known-good data artifacts.
2. Restart runtime services (`docker compose restart app app-prod`).
3. Re-run smoke + probe checks.

## 7) Related Docs

- `docs/DATA_RELIABILITY_OPERATIONS.md`
- `docs/DOCKER_RUNBOOK.md`
- `docs/ASSISTANT_EVAL_CRITERIA.md`
- `docs/INCIDENT_RESPONSE.md`
