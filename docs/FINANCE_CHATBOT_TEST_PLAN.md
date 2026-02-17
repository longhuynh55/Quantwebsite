# Finance Chatbot Core Backend QA Plan

## Objectives

- Validate the finance chatbot backend (contract, computation, and dataset logic) before each merge to `main`.
- Protect numeric determinism in advice/metrics while keeping deployments resilient under load and partial failures.
- Define measurable KPIs/SLOs plus a CI gate that exercises contract, regression, load, and chaos scenarios.

## Data Readiness Gates (must pass before chatbot eval)

- Always validate runtime data readiness first:
  - `GET /api/health/data?probe=true&includeFundamentals=true`
  - Confirm `backend.active` is expected (`duckdb` in prod) and `manifest_available=true`.
- Production deployment should be strict/fail-fast:
  - `DATA_BACKEND=duckdb`, `DATA_BACKEND_STRICT=true`, `DATA_ALLOW_RAW_FALLBACK=false`
- Assistant grounding safety net:
  - The assistant can call `dataHealth` (maps to `/api/health/data`) when users report “không có dữ liệu” / “missing data”.
  - This prevents incorrect refusal when datasets are actually present but a backend/config is miswired.
- Timeouts for slow upstream models (OpenRouter free tier can be bursty):
  - `OPENROUTER_TIMEOUT_MS`, `OPENROUTER_SECONDARY_TIMEOUT_MS`, `OPENROUTER_TERTIARY_TIMEOUT_MS`
  - Tool timeouts: `ASSISTANT_TOOL_TIMEOUT_MS`

## Financial Statement Query Checklist (4 Groups)

### Scope confirmation

- Group 1: `BCTC` (full package) -> `statement=all`
- Group 2: `BCTN` (normalize as KQKD/Income Statement) -> `statement=is`
- Group 3: `LCTT` (Cash Flow) -> `statement=cf`
- Group 4: `BCDKT` (Balance Sheet) -> `statement=bs`

### Shared input contract (all 4 groups)

- Required: `symbol`
- Optional: `period` (`latest` or `YYYYQn`)
- Endpoint baseline: `/api/fundamentals`
- Mandatory response fields to validate: `symbol`, `period`, `coverage`, `confidence`, `warnings`, statement payload(s)

### Group-specific checklist

- `BCTC` (`statement=all`)
  - Returns all blocks: `balanceSheet`, `incomeStatement`, `cashFlow`
  - `coverage.requestedStatements` must include `bs,is,cf`
  - Missing any block must appear in `coverage.missingRequestedStatements`
- `BCTN` (`statement=is`)
  - Returns `incomeStatement`; `balanceSheet` and `cashFlow` are `null`
  - Validate key line-items for `is` snapshot extraction and numeric parsing
  - Alias normalization: queries mentioning `BCTN` or `KQKD` resolve to `is`
- `LCTT` (`statement=cf`)
  - Returns `cashFlow`; other statement blocks are `null`
  - Validate operating/investing/financing cash-flow fields parse deterministically
  - If requested quarter missing, must return data-gap warning (not fabricated values)
- `BCDKT` (`statement=bs`)
  - Returns `balanceSheet`; other statement blocks are `null`
  - Validate asset/liability/equity fields parse deterministically
  - Peer/valuation downstream joins must use same `period` semantics

### Negative and edge-case checklist

- Invalid symbol format -> `400`
- Unknown symbol / no periods -> `404`
- Invalid period format -> `400`
- Invalid statement code -> `400`
- Source file unavailable -> `503`
- Partial data per period:
  - Must expose missing segments via `coverage.missingRequestedStatements`
  - Must downgrade confidence and include explicit `warnings`
  - Assistant must return `INSUFFICIENT_DATA` for numeric claims requiring missing fields

### Acceptance criteria for chatbot layer

- Query classifier maps statement intents correctly to one of: `all/is/cf/bs`
- Every numeric claim derived from statements is traceable to:
  - endpoint + `symbol` + `period` + statement group
- If evidence is incomplete:
  - no fabricated number
  - explicit fallback message + citation/context on missing fields

## HOSE Price Query Checklist

- Symbol day query:
  - `GET /api/stocks?symbol=AAA&date=YYYY-MM-DD`
  - Must return `asOfDate` and `exactDateMatch`
- Symbol range query:
  - `GET /api/stocks?symbol=AAA&from=YYYY-MM-DD&to=YYYY-MM-DD`
  - Must return only real trading sessions, no interpolation
- HOSE market snapshot by date:
  - `GET /api/stocks?exchange=HOSE&date=YYYY-MM-DD`
  - Must return one latest row per symbol on/before date
- ICB group snapshot:
  - `GET /api/stocks?groupBy=icb&exchange=HOSE&date=YYYY-MM-DD&icbLevel=2|3|4`
  - Must report exact-date coverage and warnings for prior-session fallbacks
- Analytics consistency:
  - `/api/stocks` snapshot values must reconcile with `/api/analytics/icb-snapshot`
- Failure behavior:
  - invalid date/symbol/group params -> `400`
  - no data on/before date -> `404` or `INSUFFICIENT_DATA` at assistant layer

## Testing Matrix

### 1. Contract Tests

- Scope: every public API contract (assistant queries, embeddings, metrics, routing) documented via OpenAPI/TypeScript types.
- Strategy: use fixtures (JSON Schema or Zod) to validate request/response shapes; run against both dev and prod builds.
- Execution: run as part of fast `ci-contract-tests` step using `node` + `zod` or `openapi-validator` harness; include:
  - schema validation for required fields and security headers (API key, auth).
  - mock upstream responses (vector search, pricing data) via recorded interceptors; ensure retries only when spec allows.
- Failure criteria: any schema drift, missing field, or unauthorized status breaks the build.
 
### 2. Deterministic Numeric Tests

- Scope: core financial calculations (risk scores, probabilities, returns, scenario charts) that must remain deterministic across date-stamped releases.
- Strategy:
  - Bundle golden inputs + expected outputs (CSV/JSON) per calculation module.
  - Use snapshot testing with tolerance thresholds (e.g., ±0.01%) for floating operations; convert to decimal if possible.
  - Include multi-step flows (e.g., normalized sector exposure → aggregate portfolio signal) to ensure pipelines preserve intermediate metadata.
- Execution: run with `npm run test:math` (custom script) before merge; integrate into `ci-deterministic-tests`.
- Guardrails: log deviations beyond tolerance with contextual inputs for triage and store outputs in `artifacts/deterministic-violations/`.

### 3. Regression Dataset Tests

- Scope: stored regression dataset (a canonical set of user prompts, historical filings, and expected response fingerprints) captured in `public/data/regression/finance-chatbot`.
- Strategy:
  - Run a lightweight headless assistant invocation against dataset entries (100–200 prompts) and compare key benchmarks: response categories, primary numeric citations, and hallucination flags.
  - Capture normalized embeddings + token-level alignments to catch drift in retrieval or scoring pipelines.
  - Automate dataset refresh: store new version indicator (`regression_dataset_vX.json`), update coverage when retraining retrieval models.
- Execution: nightly regression job plus PR-level `ci-regression-dataset` job using `node scripts/regression-runner.mjs`.
- Failure criteria: >2% drop in matching metrics or triggered hallucination counts compared to baseline.

### 4. Load & Latency Tests

- Scope: quant-backend endpoints behind `api/assistant`, `api/metrics` when hit by 1k concurrent users (simulated).
- Strategy:
  - Use `k6` or `artillery` to simulate concurrency and track 50/95/99th percentile latencies, throughput, and error rates.
  - Instrument environment variables for target TPS (e.g., 120 req/s) and warm caches (mock vector DB).
  - Include service mesh-level metrics (e.g., Postgres/Redis connection queues).
- Execution: schedule `ci-load-latency` (weekly or pre-release) running against staging or synthetic env; use shorter `smoke-load` subset in PR to catch regressions.
- KPIs: 95th percentile ≤ 600 ms, success rate ≥ 99.5%, CPU < 70% across backend nodes; fail if latency or errors exceed thresholds.

### 5. Chaos & Failure Mode Tests

- Scope: resilience to downstream failures (vector store, pricing provider, signal aggregator) and infrastructure issues.
- Strategy:
  - Use `chaos-lib` (or scripted toggles) to inject failure modes: DNS drops, latency spikes, partial timeouts.
  - Validate retry policies (backoff, circuit break); confirm fallbacks (cached documents, stale metrics) deliver `graceful` status codes.
  - Include data integrity checks (DB transactional rollback, schema migrations, event deduplication).
- Execution:
  - Nightly pipeline runs `ci-chaos` with one failure vector at a time, capturing logs/traces.
  - Maintain `chaos-playbooks.md` describing manual verification steps for confirmed incidents.
- Success criteria: service remains healthy (chatbot still responds with fallback message) and metrics return to baseline within pre-defined windows.

## Test Plan Cadence

- **PR gates (per merge):** contract validation + deterministic numeric tests + small regression subset.
- **Nightly/weekly:** full regression dataset, load/latency tests (staging), chaos run.
- **Release candidate:** re-run full suite within pipeline, ensure dataset version pinned.
- **Alerting:** on failure, auto-open Jira/issue, include reproducible inputs, attach ddtrace logs.

## KPI/SLO Framework

| Metric | Target | Measurement |
| --- | --- | --- |
| Assistant Response Success Rate | ≥ 99.5% across API requests | Request counters from nginx/edge |
| End-to-end Latency (95th percentile) | ≤ 600 ms on staging | k6 reports stored in `artifacts/k6` |
| Numeric Determinism | <2% tolerance deviation vs baseline | Deterministic test runners with artifact diff |
| Contract Compliance | 100% schema match | `npm run contract-check` exit code |
| Regression Match Score | ≥ 97% prompts match expected fingerprint | Dataset runner scoring per version |
| Chaos Recovery Time | < 2 min to restore fallback mode | Traces/alerts from incident window |

- **SLO Enforcement:** tie to monitoring (Prometheus + Grafana) and on-call escalations; degrade to `QA freeze` on repeated violations.
- **SLO Budget:** allocate 0.5% budget for unexplained error rate while still meeting latency and regression thresholds.

## CI Pipeline Proposal

1. **`ci-contract-deterministic` job** (runs on PR):
   - Checkout, install deps, run `npm run lint`, `npx tsc --noEmit`.
   - Run `npm run contract-check` (Zod/OpenAPI).
   - Execute deterministic numeric suite; store diff artifacts on failure.
   - Short regression subset using `scripts/regression-runner`.

2. **`ci-regression-suite` job** (merge to main; optional on PR if backend touched):
   - Setup staging dataset by copying `public/data/regression/latest`.
   - Run full regression harness with `node scripts/regression-runner.mjs --full`.
   - Compare dataset scores to baseline saved in `artifacts/regression/baseline.json`.

3. **`ci-performance` job** (nightly or release):
   - Launch staging backend via Docker Compose.
   - Execute `k6` load/latency scripts; capture metrics + Grafana snapshots.
   - Store results so failures trigger rollback gates in pipeline tooling (GitHub Deploy Environments or custom CLI).

4. **`ci-chaos` job** (nightly):
   - Spin up staging services (including vector DB).
   - Inject one failure at a time (timeout, connection drop, corrupted payload).
   - Validate fallback messaging and alert the on-call channel if recovery extends beyond 2m.

5. **Pipeline orchestration:** extend existing `.github/workflows/qa-integration.yml` to include new jobs and gating. Use cached datasets and artifacts for determinism. Provide explicit failure messaging for QA.

## Next Steps

- Implement `scripts/regression-runner.mjs` if not present; ensure dataset stored under `public/data/regression`.
- Wire telemetry (Prometheus counters, SLO dashboards) and update `docs/OBSERVABILITY_SLO.md`.
- Automate artifact retention and funnel CI outputs into on-call Slack/GitHub Issues for tracer attachments.
