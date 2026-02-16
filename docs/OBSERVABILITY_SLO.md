# Observability & SLO Baseline

This document defines minimum service-level objectives (SLOs) for data reliability and assistant grounding.

## 1) Scope

Covered components:
- Data backend readiness (`/api/health/data`)
- Core API reliability (`/api/stocks`, `/api/backtesting`, `/api/fundamentals`, `/api/market-overview`)
- Assistant grounding quality (`eval:assistant`, `eval:assistant:full`)

## 2) SLIs (What We Measure)

### SLI-A: Probe Availability
- Definition: successful responses from `/api/health/data?probe=true&includeFundamentals=false`
- Success condition: HTTP `200` and `"ok": true`

### SLI-B: Full Data Health
- Definition: full checks from `/api/health/data?refresh=true`
- Success condition: HTTP `200`, `"ok": true`, and all core datasets `ok=true`

### SLI-C: Core API Reliability
- Definition: smoke/QA API checks pass rate
- Success condition: `npm run docker:smoke:api` and `npm run docker:qa:api` exit code `0`

### SLI-D: Assistant Grounding
- Definition: assistant evaluation quality metrics from evaluation report
- Success condition: no threshold breach from configured env gates (unsupported claim rate, grounding pass rate, deception resistance, coverage)

## 3) SLO Targets (Initial Baseline)

Track on rolling 30-day window:

| SLI | Target | Frequency |
|-----|--------|-----------|
| SLI-A Probe Availability | >= 99.5% | Every 1-5 minutes (or Docker health cadence) |
| SLI-B Full Data Health | 100% daily pass | At least once per day |
| SLI-C Core API Reliability | >= 99% runs pass | Per release + daily smoke |
| SLI-D Assistant Grounding | 100% threshold compliance on scheduled runs | Balanced daily, full weekly |

## 4) Alert Policy

### Severity
- `SEV-1`: probe/full health returns `503` for >10 minutes, or assistant eval critical threshold breach in production release.
- `SEV-2`: repeated smoke/QA failures, partial endpoint degradation, or fundamentals unavailable.
- `SEV-3`: transient fallback mode (`duckdb` -> `csv`) without user-facing error.

### Response Objectives
- `SEV-1`: acknowledge within 10 minutes, mitigation within 60 minutes.
- `SEV-2`: acknowledge within 30 minutes, mitigation within 4 hours.
- `SEV-3`: acknowledge within 1 business day.

## 5) Minimum Monitoring Commands

Run from `quant-website/`:

```bash
curl "http://localhost:3010/api/health/data?probe=true&includeFundamentals=false"
curl "http://localhost:3010/api/health/data?refresh=true"
npm run docker:smoke:api
npm run docker:qa:api
npm run docker:eval:assistant
```

Production profile:

```bash
curl "http://localhost:3011/api/health/data?probe=true&includeFundamentals=false"
npm run docker:smoke:prod:api
npm run docker:qa:prod:api
npm run docker:eval:assistant:prod
```

## 6) Reporting Cadence

- Daily: probe health, full health, smoke results.
- Weekly: full assistant eval + trend review.
- Per release: attach SLI snapshot to release checklist.

## 7) Evidence Artifacts

Store and retain:
- `artifacts/assistant-eval-report.json`
- `artifacts/assistant-eval-comprehensive-report.json`
- Any data audit outputs under `quant-website/artifacts/`

## 8) Related Docs

- `docs/DATA_RELEASE_CHECKLIST.md`
- `docs/DATA_RELIABILITY_OPERATIONS.md`
- `docs/ASSISTANT_EVAL_CRITERIA.md`
- `docs/INCIDENT_RESPONSE.md`
