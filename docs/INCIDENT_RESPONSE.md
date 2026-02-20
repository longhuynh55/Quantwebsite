# Incident Response Runbook

Use this runbook when data APIs, fundamentals, or assistant grounding show reliability issues.

## 1) Incident Types

- Data readiness failures (`/api/health/data` returns `503`)
- Backend mode degradation (unexpected DuckDB -> CSV fallback)
- Fundamentals availability loss (BCT/BCTT/LCTT missing or unreadable)
- Assistant grounding/eval regressions

## 2) Severity Levels

| Severity | Definition | Initial Response |
|----------|------------|------------------|
| SEV-1 | User-visible outage or incorrect critical financial output | Start triage immediately |
| SEV-2 | Partial degradation, limited scope, temporary workarounds exist | Triage within 30 minutes |
| SEV-3 | Low impact, no immediate user-visible error | Triage in normal work queue |

## 3) Roles

| Role | Responsibility |
|------|----------------|
| Incident Commander | Owns decisions, scope, and priority |
| Operator | Executes commands and mitigations |
| Recorder | Tracks timeline and evidence |

For small teams, one person may hold multiple roles.

## 4) First 15 Minutes (Mandatory)

Run from `quant-website/`:

```bash
curl "http://localhost:3010/api/health/data?probe=true&includeFundamentals=false"
curl "http://localhost:3010/api/health/data?refresh=true"
docker compose ps
docker compose logs --tail=200 app
```

If production profile is active:

```bash
curl "http://localhost:3011/api/health/data?probe=true&includeFundamentals=false"
docker compose --profile prod logs --tail=200 app-prod
```

Record:
- Incident start time (UTC)
- Current backend status (`requested`, `active`, `reason`)
- Failing checks/endpoints

## 5) Triage Decision Tree

### Case A: `backend.ok=false` or strict backend failure
1. Check `DATA_BACKEND`, `DATA_BACKEND_STRICT`, `DATA_DUCKDB_PATH`.
2. Verify `public/data/quant_data.duckdb` existence/readability.
3. If DuckDB is required, run `pnpm run data:export:duckdb`.
4. Restart service: `docker compose restart app`.

### Case B: Core dataset health failed
1. Verify runtime CSV files exist in `public/data/`.
2. Regenerate runtime artifacts: `pnpm run data:prepare:2018_2025`.
3. Recheck: `curl "http://localhost:3010/api/health/data?refresh=true"`.

### Case C: Fundamentals unavailable
1. Confirm 3 quarterly files exist/readable in `public/data/`.
2. Run `pnpm run data:validate:fundamentals`.
3. Recheck `/api/fundamentals` and `/api/health/data`.

### Case D: Assistant eval regression
1. Run `pnpm run docker:eval:assistant`.
2. If still failing, run `pnpm run docker:eval:assistant:full`.
3. Compare latest report against previous baseline and isolate failing metric.

## 6) Mitigation and Recovery

Primary mitigation options:
- Roll back to previous known-good data artifacts.
- Temporarily force CSV backend (`DATA_BACKEND=csv`) if DuckDB artifact/binding is unstable.
- Disable risky release and redeploy previous image.

Recovery validation (required):
- `pnpm run docker:smoke:api`
- `pnpm run docker:qa:api`
- `/api/health/data?refresh=true` returns HTTP `200` and `"ok": true`

## 7) Communication Template

```text
[INCIDENT]
id:
severity:
start_time_utc:
impact:
current_status:
mitigation_in_progress:
next_update_utc:
owner:
```

## 8) Post-Incident Review (within 48h)

Required fields:

```text
incident_id:
root_cause:
detection_gap:
what_worked:
what_failed:
corrective_actions:
owner:
target_date:
```

Corrective actions must link to one of:
- Code fix
- Data pipeline fix
- Alert/SLO adjustment
- Runbook improvement

## 9) Related Docs

- `docs/OBSERVABILITY_SLO.md`
- `docs/DATA_RELEASE_CHECKLIST.md`
- `docs/DATA_RELIABILITY_OPERATIONS.md`
- `docs/DOCKER_RUNBOOK.md`

