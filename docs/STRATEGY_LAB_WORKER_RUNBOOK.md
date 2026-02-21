# Strategy Lab Worker Runbook

## Purpose

Run Strategy Lab DB worker ticks continuously in local/dev/staging without relying on in-process scheduler.

## Commands

Run continuous loop:

```bash
pnpm run strategy-lab:worker
```

Run one step (smoke):

```bash
pnpm run strategy-lab:worker:once
```

## Required environment

- `STRATEGY_LAB_REPOSITORY_BACKEND=postgres`
- `STRATEGY_LAB_DATABASE_URL` (or fallback `DATABASE_URL`)

Optional:

- `STRATEGY_LAB_ADMIN_TOKEN`: if set, worker script sends header `x-strategy-lab-admin-token`.
- `STRATEGY_LAB_WORKER_BASE_URL` (default `http://localhost:3000`)
- `STRATEGY_LAB_WORKER_ID`
- `STRATEGY_LAB_WORKER_QUEUE` (default `strategy_lab_default`)
- `STRATEGY_LAB_WORKER_LEASE_MS`
- `STRATEGY_LAB_WORKER_HEARTBEAT_MS`
- `STRATEGY_LAB_WORKER_STEP_DELAY_MS`
- `STRATEGY_LAB_WORKER_IDLE_DELAY_MS`
- `STRATEGY_LAB_WORKER_ERROR_DELAY_MS`

## Notes

- Worker loop calls `POST /api/strategy-lab/worker/tick` repeatedly.
- If backend is not `postgres`, endpoint returns `409 UNSUPPORTED_MODE`.
- If `STRATEGY_LAB_ADMIN_TOKEN` is configured in app, request must provide matching header token.
