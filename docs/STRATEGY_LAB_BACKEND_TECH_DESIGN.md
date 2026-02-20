# Strategy Lab Backend Technical Design (MVP -> Scale)

## 1) Scope And Goals

This document defines backend architecture ownership for Strategy Lab in `quant-website` with four core deliverables:

1. API contracts for Strategy Lab workflows.
2. Execution engine design for deterministic backtest runs.
3. Storage schema for runs, artifacts, and audit trail.
4. Job orchestration model for async execution and recovery.

Primary goal: ship an MVP quickly without breaking existing `/api/backtesting`, while keeping a clean upgrade path to distributed workers.

## 2) Current Baseline In This Repository

- Existing backtest endpoint is synchronous (`src/app/api/backtesting/route.ts`) and calls `runBacktest` from `src/lib/quant/backtest.ts`.
- No persistent database for run history; current APIs are stateless.
- Rate limiting, tracing, and structured logs already exist (`src/lib/rateLimit.ts`, `src/lib/logger.ts`).
- Runtime data source is CSV/DuckDB switchable (`src/lib/dataBackend.ts`).

Implication: MVP should reuse `runBacktest` and current validation style, while adding persistence and async orchestration as new modules.

## 3) Target Architecture

### 3.1 MVP Runtime Topology

- `Next.js API` handles request validation + read/write metadata + enqueue jobs.
- `Strategy Worker` (separate Node process in same repo) polls queue rows from Postgres, executes runs, persists results.
- `Postgres` is source of truth for runs, jobs, events, and artifacts metadata.
- `Object/File storage` (local volume in MVP, S3-compatible later) stores heavy artifacts (`equityCurve`, `trades`, exports).

### 3.2 Scale Topology (No API Break)

- Keep same API contracts.
- Replace DB-polling worker with Redis/BullMQ or Temporal workers.
- Scale workers horizontally by queue partition (`cpu`, `io`, `export`).
- Move artifact storage to S3 + CDN.

## 4) Domain Model

### 4.1 Core Entities

- `StrategyTemplate`: predefined strategy + parameter spec.
- `LabRun`: one executable run request from user.
- `LabJob`: orchestrated execution job for a run.
- `LabRunArtifact`: references to heavy outputs (JSON, CSV, XLSX).
- `LabRunEvent`: immutable event stream for progress timeline.

### 4.2 Run Status State Machine

`draft -> queued -> running -> succeeded | failed | cancelled`

Job states are tracked separately:

`queued -> leased -> running -> retry_wait -> succeeded | dead_letter | cancelled`

## 5) API Contracts

All Strategy Lab APIs are namespaced under `/api/strategy-lab`.

### 5.1 Common Response Envelope

Success:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "requestId": "sl-req-...",
    "traceId": "sl-..."
  }
}
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "symbol is required",
    "details": []
  },
  "meta": {
    "requestId": "sl-req-..."
  }
}
```

### 5.2 Endpoints

1. `POST /api/strategy-lab/runs`
- Create a run, validate request, enqueue job, return `202`.
- Supports `Idempotency-Key` header.

Request:

```json
{
  "name": "SMA 10/20 on VNM",
  "strategyType": "sma_crossover",
  "symbol": "VNM",
  "dateRange": { "from": "2020-01-01", "to": "2025-12-31" },
  "capital": 100000,
  "params": { "shortPeriod": 10, "longPeriod": 20 },
  "config": {
    "executionModel": "next_open",
    "feeBps": 15,
    "sellTaxBps": 10,
    "slippageBps": 5,
    "lotSize": 1
  },
  "priority": "normal"
}
```

Response (`202`):

```json
{
  "ok": true,
  "data": {
    "runId": "run_01...",
    "jobId": "job_01...",
    "status": "queued",
    "pollUrl": "/api/strategy-lab/runs/run_01...",
    "eventsUrl": "/api/strategy-lab/runs/run_01.../events"
  }
}
```

2. `GET /api/strategy-lab/runs/{runId}`
- Fetch run metadata + summary + status.

3. `GET /api/strategy-lab/runs/{runId}/result`
- Fetch full result payload or paginated slices.
- Query: `include=summary|equity|trades|all`, `cursor`, `limit`.

4. `GET /api/strategy-lab/runs/{runId}/events`
- SSE or paginated polling feed for progress timeline.

5. `POST /api/strategy-lab/runs/{runId}/cancel`
- Best-effort cancellation; returns current status.

6. `GET /api/strategy-lab/strategies`
- Return allowed strategy types + parameter schemas derived from `src/lib/quant/backtest.ts`.

### 5.3 Error Codes

- `INVALID_INPUT` (`400`)
- `UNSUPPORTED_STRATEGY` (`400`)
- `RUN_NOT_FOUND` (`404`)
- `RUN_NOT_CANCELLABLE` (`409`)
- `RATE_LIMITED` (`429`)
- `DATASET_UNAVAILABLE` (`503`)
- `INTERNAL_ERROR` (`500`)

## 6) Execution Engine Design

### 6.1 Engine Layers

- `Input Validator`: hard checks for symbol, date range, params, config.
- `Data Resolver`: load OHLCV by symbol/date; applies data quality gates.
- `Strategy Runner`: delegates to existing `runBacktest`.
- `Result Assembler`: summary metrics + diagnostics + artifacts.
- `Persistence Adapter`: commit run state transitions and artifacts metadata.

### 6.2 Determinism And Reproducibility

Each run stores:

- `engineVersion` (example: `backtest-engine@1.0.0`)
- `dataSnapshotId` (manifest version + backend mode + dataset hash)
- `inputHash` (stable hash of request payload)

If same `inputHash + dataSnapshotId + engineVersion` is requested with same idempotency key, API returns existing run reference.

### 6.3 Execution Contract (Internal)

```ts
type ExecuteRunInput = {
  runId: string;
  requestId: string;
};

type ExecuteRunOutput = {
  status: "succeeded" | "failed" | "cancelled";
  summary: Record<string, unknown>;
  artifactRefs: Array<{ kind: "equity_curve" | "trades" | "report"; uri: string }>;
};
```

## 7) Storage Schema (Postgres)

### 7.1 Tables

1. `strategy_lab_runs`
- `id uuid pk`
- `name text`
- `symbol text not null`
- `strategy_type text not null`
- `request_payload jsonb not null`
- `status text not null`
- `priority smallint not null default 5`
- `engine_version text not null`
- `data_snapshot_id text not null`
- `input_hash text not null`
- `metrics_summary jsonb null`
- `error_code text null`
- `error_message text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `started_at timestamptz null`
- `finished_at timestamptz null`

Indexes:
- `(status, priority, created_at)`
- `(symbol, created_at desc)`
- unique `(input_hash, data_snapshot_id, engine_version, coalesce(idempotency_key, ''))`

2. `strategy_lab_jobs`
- `id uuid pk`
- `run_id uuid fk -> strategy_lab_runs(id)`
- `queue_name text not null`
- `status text not null`
- `attempt int not null default 0`
- `max_attempts int not null default 3`
- `lease_owner text null`
- `lease_expires_at timestamptz null`
- `next_run_at timestamptz not null`
- `last_heartbeat_at timestamptz null`
- `last_error text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Indexes:
- `(status, next_run_at, priority)`
- `(lease_expires_at)`
- `(run_id)`

3. `strategy_lab_run_events`
- `id bigserial pk`
- `run_id uuid fk`
- `job_id uuid fk null`
- `event_type text not null`
- `payload jsonb not null`
- `created_at timestamptz not null`

Indexes:
- `(run_id, id asc)`
- `(created_at desc)`

4. `strategy_lab_run_artifacts`
- `id uuid pk`
- `run_id uuid fk`
- `artifact_kind text not null` (`summary_json`, `equity_curve_json`, `trades_json`, `report_xlsx`)
- `storage_uri text not null`
- `content_type text not null`
- `byte_size bigint not null`
- `checksum_sha256 text not null`
- `created_at timestamptz not null`

Indexes:
- `(run_id, artifact_kind)`

### 7.2 Retention

- Keep run metadata/events 180 days in MVP.
- Keep heavy artifacts 30 days by default, configurable by env.

## 8) Job Orchestration

### 8.1 Queue Pattern (MVP)

DB-backed queue with optimistic leasing:

1. Worker selects a `queued/retry_wait` job with `next_run_at <= now`.
2. Atomic lease claim (`status=leased`, `lease_owner`, `lease_expires_at`).
3. Worker sets `running` and emits progress events.
4. On success: update run/job status and attach artifacts.
5. On failure: increment attempt; if `attempt < max_attempts`, schedule retry with exponential backoff; else `dead_letter`.

### 8.2 Retry Policy

- Backoff: `min(2^attempt * 15s, 15m)` with jitter.
- Retryable: transient data backend errors, worker timeout, temporary IO errors.
- Non-retryable: invalid input, unsupported strategy, deterministic validation errors.

### 8.3 Cancellation

- API sets `cancel_requested=true` on run.
- Worker checks cancellation between pipeline stages and before artifact write.
- If cancelled: run status `cancelled`, job status `cancelled`.

### 8.4 Timeouts

- Soft timeout per run (default 30s for single-symbol backtest MVP).
- Hard timeout per job lease (default 2x soft timeout).
- Stale `leased/running` jobs are re-queued when lease expires.

## 9) Observability And SLO For Strategy Lab

### 9.1 Logs

Use existing `createLogger` with `scope`:

- `api.strategy-lab.runs`
- `worker.strategy-lab.executor`
- `worker.strategy-lab.queue`

Required fields:
- `requestId`, `runId`, `jobId`, `symbol`, `strategyType`, `durationMs`, `status`.

### 9.2 Metrics

- `strategy_lab_run_duration_ms` (p50/p95)
- `strategy_lab_queue_depth`
- `strategy_lab_job_retry_count`
- `strategy_lab_failure_rate`
- `strategy_lab_cancel_rate`

### 9.3 Health Endpoints

Add:
- `GET /api/health/strategy-lab` (queue connectivity + worker heartbeat + stale jobs count)

## 10) Security And Guardrails

- Reuse `getClientIdentifier` + scoped rate limit keys.
- Enforce strict payload validation and strategy param bounds from existing quant module.
- Store only hashed idempotency keys (do not persist raw user tokens).
- Redact sensitive headers/tokens in logs (already supported by logger sanitizer).

## 11) Rollout Plan

### Phase 1 (MVP Fast, 1-2 weeks)

- Add Postgres tables + repositories.
- Add `/api/strategy-lab/runs` create/get/cancel + `/events`.
- Add worker process with DB polling.
- Reuse `runBacktest` engine directly.
- Persist summary + artifacts to local volume/object path.

### Phase 2 (Hardening, 1 week)

- Add retries, dead-letter handling, lease recovery, retention jobs.
- Add strategy-lab health endpoint and queue SLO dashboards.
- Add API contract smoke tests for all status transitions.

### Phase 3 (Scale)

- Move artifacts to S3.
- Introduce Redis/BullMQ or Temporal for distributed orchestration.
- Add batch experiments (grid search/walk-forward) using same run/job primitives.

## 12) File/Module Plan In This Repository

Proposed new modules:

- `src/app/api/strategy-lab/runs/route.ts`
- `src/app/api/strategy-lab/runs/[runId]/route.ts`
- `src/app/api/strategy-lab/runs/[runId]/events/route.ts`
- `src/app/api/strategy-lab/runs/[runId]/cancel/route.ts`
- `src/app/api/strategy-lab/strategies/route.ts`
- `src/lib/strategyLab/contracts.ts`
- `src/lib/strategyLab/repository.ts`
- `src/lib/strategyLab/executionEngine.ts`
- `src/lib/strategyLab/worker.ts`
- `src/lib/strategyLab/orchestrator.ts`
- `scripts/strategy-lab-worker.mjs`

This keeps existing API surface intact and isolates Strategy Lab backend as a dedicated vertical slice.

