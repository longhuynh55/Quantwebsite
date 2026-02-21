# Strategy Lab QA Gates Checklist

## Muc tieu

Checklist QA gate cho thay doi `Strategy Lab`, uu tien reliability va khong anh huong test infra hien tai (Jest + Next route unit tests).

## Pham vi gate

- API: `POST /api/strategy-lab/runs`, `GET /api/strategy-lab/runs/[runId]`, `GET /api/strategy-lab/runs/[runId]/events`, `POST /api/strategy-lab/runs/[runId]/cancel`, `GET /api/strategy-lab/runs/[runId]/result`, `GET /api/strategy-lab/health`.
- Internal ops API: `POST /api/strategy-lab/worker/tick` (DB mode only).
- Core orchestration: `src/lib/strategy-lab/orchestrator.ts`.
- Khong gate cac thay doi la khong lien quan Strategy Lab.

## Lenh gate de chay

```bash
pnpm exec jest --runInBand src/lib/strategy-lab/orchestrator.test.ts src/app/api/strategy-lab/runs/route.test.ts src/app/api/strategy-lab/health/route.test.ts src/lib/strategy-lab/client.test.ts
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
```

## Checklist theo nhom

## 1) Idempotency

- [x] Duplicate cancel khi run dang `running` khong tao duplicate `run_cancel_requested` event.
- [x] Cancel lai khi run da terminal tra ve `RUN_NOT_CANCELLABLE` (`409`) theo contract hien tai.
- [x] `Idempotency-Key` cho `POST /runs`: cung payload + cung key tra ve cung `runId`.
- [x] Reuse cung `Idempotency-Key` voi payload khac tra `409 IDEMPOTENCY_KEY_CONFLICT`.

## 2) Retry

- [x] Loi retryable (`INTERNAL_ERROR`) tao `run_retry_scheduled`, tang `retryCount`, va eventual success neu lan sau ok.
- [x] Loi non-retryable (`INVALID_INPUT`) fail ngay, khong retry.
- [x] Het `maxRetries` thi run fail, khong lap vo han.

## 3) Cancel

- [x] Cancel queued run truoc khi start -> `cancelled`, executor khong bi goi.
- [x] Cancel running run -> abort signal, status cuoi `cancelled`.
- [x] Co event cho cancel flow: `run_cancel_requested`, `run_cancelled`.

## 4) Pagination

- [x] `GET /events?since=&limit=` tra dung subset event theo sequence.
- [x] `since/limit` invalid fallback ve full feed (khong 500).
- [x] `GET /result?include=equity|trades&cursor=&limit=` ho tro pagination va tra metadata `page`.

## 5) Health

- [x] Data probe co du lieu -> `200` + `ok=true`.
- [x] Data probe 0 dong -> `503` + thong bao ro nguyen nhan.
- [x] Data probe throw exception -> `503` + error message trong payload.

## De xuat test tiep theo (pending)

- [ ] Add concurrent cancel stress test (2 requests cancel song song) de xac nhan event de-dup.
- [ ] Add pagination boundary test cho `limit` lon (memory safety, response time).
- [ ] Add integration smoke for worker tick with real Postgres container (`lease -> run -> retry_wait -> succeeded`).
- [ ] Add smoke check for `pnpm run strategy-lab:worker:once` against local app+postgres.
