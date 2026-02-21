# Docker Runbook: Testing, Debug, Production

Tai lieu nay mo ta quy trinh chuan de chay ung dung bang Docker cho 3 nhu cau:
- Testing (smoke test)
- Debug (theo doi log, kiem tra API, tai hien loi)
- Production profile (build + verify runtime production)

Muc tieu la giu moi truong on dinh va tranh thao tac giet process `node` tren host.

## 1. Pham vi va nguyen tac

- Dung `docker compose` lam entrypoint chinh.
- Khong dung `Stop-Process node -Force` tren host.
- Chi restart/stop bang service trong compose.
- Docker compose can co file `.env.glm` (chua API keys). Tao nhanh tu file mau `env.glm.example`:

```powershell
Copy-Item .\\env.glm.example .\\.env.glm
```

- Dien `OPENROUTER_API_KEY=...` (khuyen nghi) trong `.env.glm`. Khong commit file `.env.glm`.
- Data CSV duoc mount tu `./public/data` vao container.
- Neu ban cap nhat raw data (2018-2025) o thu muc `../data`, hay chay prepare de tao file runtime truoc khi run Docker:

```bash
pnpm run data:prepare:2018_2025
```

De dam bao fundamentals (BCT/BCTT/LCTT) doc duoc chinh xac (CSV khong bi lech dong/cot), nen chay them validator:

```bash
pnpm run data:validate:fundamentals
```

Neu ban can checklist day du cho data backend + health + assistant grounding, xem them:
- `docs/DATA_RELIABILITY_OPERATIONS.md`
- `docs/DATA_RELEASE_CHECKLIST.md`
- `docs/OBSERVABILITY_SLO.md`
- `docs/INCIDENT_RESPONSE.md`

Luu y tren Windows:
- Compose mount `../data:/workspace-data:ro`. Neu Docker Desktop chua share drive/folder chua workspace, ban can enable File Sharing (Settings -> Resources -> File Sharing) de bind mount hoat dong.
- Khong copy/tai su dung `node_modules` giua Windows host va Linux container/WSL.
- `smoke` / `qa` services da duoc cau hinh dung volume Linux rieng cho `/app/node_modules` de tranh xung dot native binary.

## 2. Thanh phan Docker hien co

- `app`: Next.js dev server, map ra `http://localhost:3010`
- `smoke`: container chay `scripts/smoke.mjs` vao `app`
- `app-prod` (profile `prod`): production server, map ra `http://localhost:3011`
- `smoke-prod` (profile `prod`): smoke test vao `app-prod`

File cau hinh:
- `Dockerfile.dev`
- `Dockerfile`
- `docker-compose.yml`
- `scripts/smoke.mjs`

## 3. Quy trinh Testing (Dev Profile)

### 3.1 Startup dev

```bash
pnpm run docker:up
```

Kiem tra trang thai:

```bash
docker compose ps
```

Ky vong:
- Service `app` o trang thai `healthy`.

### 3.2 Chay smoke test

```bash
pnpm run docker:smoke
```

Lenh nay tu dong goi them `pnpm run agent:track` sau khi smoke pass de cap nhat `docs/PROGRESS.md` va artifacts tracking.

Neu frontend dang duoc cap nhat va ban chi muon verify backend API:

```bash
pnpm run docker:smoke:api
```

Smoke se kiem tra:
- `GET /api/stocks?limit=1`
- `GET /api/stocks?symbol=VNM&limit=all`
- `GET /api/fundamentals?symbol=AAA&period=latest&statement=all`
- `POST /api/optimize` (baseline)
- `POST /api/optimize` (exclusion policy)
- `GET /api/market-overview`
- `GET /api/risk?symbol=VNM&benchmark=VNINDEX`
- `GET /api/backtesting?symbol=VNM&strategy=sma_crossover&capital=100000`
- `GET /api/factors?factor=momentum&limit=50`
- `GET /charts?symbol=VNM`

Ky vong:
- Toan bo check tra `PASS`
- Exit code = 0

### 3.3 Chay QA test (deep)

QA se chay nhieu check hon smoke (validate data invariants, test nhieu strategy/method, va verify cac page quan trong).

```bash
pnpm run docker:qa
```

Lenh nay cung tu dong goi `pnpm run agent:track` sau khi QA pass.

Neu chi muon verify backend API:

```bash
pnpm run docker:qa:api
```

### 3.4 Dung moi truong

```bash
pnpm run docker:down
```

## 4. Quy trinh Debug

### 4.1 Theo doi log runtime

```bash
pnpm run docker:logs
```

Tap trung kiem tra:
- loi compile
- loi API 4xx/5xx
- data-quality warnings

### 4.2 Debug loi endpoint nhanh

Khoi dong dev truoc, sau do test endpoint tu host:

```bash
curl "http://localhost:3010/api/stocks?limit=1"
curl "http://localhost:3010/api/market-overview"
```

Hoac goi lai smoke de tai hien loi:

```bash
pnpm run docker:smoke
```

### 4.3 Restart an toan khi app treo

```bash
docker compose restart app
```

Khong dung kill process node toan cuc tren may host.

## 5. Quy trinh Production Profile

### 5.1 Build + run production container

```bash
pnpm run docker:up:prod
```

Lenh script nay da include `docker compose --profile prod up -d --build app-prod` de dam bao image prod dong bo voi codebase moi nhat.

Ky vong:
- Build thanh cong tu `Dockerfile`
- `app-prod` len `healthy` o port `3011`

### 5.2 Smoke test production runtime

```bash
pnpm run docker:smoke:prod
```

Neu chi muon verify backend API trong production profile:

```bash
pnpm run docker:smoke:prod:api
```

Ky vong:
- Toan bo check `PASS`
- Exit code = 0

### 5.3 QA test production runtime (deep)

```bash
pnpm run docker:qa:prod
```

Neu chi muon verify backend API:

```bash
pnpm run docker:qa:prod:api
```

### 5.4 Theo doi log production

```bash
pnpm run docker:logs:prod
```

### 5.5 Dung toan bo service

```bash
pnpm run docker:down
```

## 6. Checklist release de xuat

Truoc khi chot release:
1. `pnpm run docker:up`
2. `pnpm run docker:smoke`
3. `pnpm run docker:qa`
4. `pnpm run docker:up:prod`
5. `pnpm run docker:smoke:prod`
6. `pnpm run docker:qa:prod`
7. `pnpm run docker:down`

Chi release khi ca `dev smoke/qa` va `prod smoke/qa` deu pass.

## 7. Troubleshooting nhanh

### 7.1 `Access is denied` voi Docker engine

- Chay terminal voi quyen phu hop.
- Dam bao Docker Desktop dang chay.
- Neu dang dung Windows, dam bao user nam trong group `docker-users` (sau do logout/login hoac restart may).
- Kiem tra context:

```bash
docker context ls
```

### 7.2 Port conflict

- Dev dung `3010`, prod dung `3011`.
- Neu trung port, doi mapping trong `docker-compose.yml`.

### 7.3 Data khong load

Kiem tra thu muc:
- `public/data/stock_metadata_2018_2025.csv` (uu tien) hoac `public/data/HOSE_VERIFIED_2020_2025.csv` (fallback)
- `public/data/ohlcv_2018_2025.csv` (uu tien) hoac `public/data/ohlcv_enriched.csv` (fallback)
- `public/data/Market_Indices_Daily_2020_2025.csv`
- (Optional, fundamentals) `public/data/HOSE_VERIFIED_BalanceSheet_Quarterly_2018_2025.csv`
- (Optional, fundamentals) `public/data/HOSE_VERIFIED_IncomeStatement_Quarterly_2018_2025.csv`
- (Optional, fundamentals) `public/data/HOSE_VERIFIED_CashFlow_Quarterly_2018_2025.csv`

Neu muon data loader fail-fast khi parse/quality co van de:
- Mac dinh `DATA_STRICT_READ=true`, `DATA_STRICT_PARSE=true`.
- Co the dat nguong accepted ratio bang env:
  - `DATA_MIN_ACCEPTED_RATIO` (global)
  - `DATA_MIN_ACCEPTED_RATIO_STOCK_METADATA`
  - `DATA_MIN_ACCEPTED_RATIO_OHLCV`
  - `DATA_MIN_ACCEPTED_RATIO_INDEX`
- Loader cung doi chieu voi manifest (`data_manifest_2018_2025.json` / `data_manifest.json`) neu co:
  - `DATA_MANIFEST_STRICT=true` (mac dinh)
  - `DATA_MANIFEST_ROW_TOLERANCE=0`
- Backend config (phase migration):
  - `DATA_BACKEND=auto|csv|duckdb` (`auto` se dung DuckDB neu co `quant_data.duckdb` va binding hop le, neu khong fallback CSV)
  - `DATA_DUCKDB_PATH` de override duong dan file DuckDB
  - `DATA_BACKEND_STRICT=true` de fail-fast neu chon `duckdb` nhung thieu artifact/binding
  - Luu y: profile `prod` trong `docker-compose.yml` hien default `DATA_BACKEND=duckdb` + `DATA_BACKEND_STRICT=true` (can co `public/data/quant_data.duckdb` + Node `duckdb` binding)
  - `DATA_EXPORT_DUCKDB=true` de auto-export DuckDB artifact khi chay `pnpm run data:prepare:2018_2025`
  - `pnpm run data:export:duckdb` uu tien Node `duckdb` binding, neu khong co se fallback sang Docker image `duckdb/duckdb`
  - `INSTALL_DUCKDB_BINDING=true` (default trong `docker-compose.yml`) de tu dong cai Node `duckdb` binding trong `app` / `app-prod`; dat `false` neu muon bo qua cai binding
  - API check nhanh:
    - `curl http://localhost:3010/api/health/data`
    - `curl "http://localhost:3010/api/health/data?refresh=true"` de clear cache truoc khi check
  - Docker healthcheck mac dinh dung probe mode (nhanh, khong parse full dataset): `/api/health/data?probe=true&includeFundamentals=false`

Neu can fallback ve raw `../data` (khong khuyen nghi cho runtime):
- Dat `DATA_ALLOW_RAW_FALLBACK=true`.

### 7.4 Assistant grounding / eval fail

- Mac dinh trong `docker-compose.yml`: `ASSISTANT_BASELINE_ONLY=false` de bat valuation/peer/health/sensitivity tools.
- App uu tien `ASSISTANT_TOOL_BASE_URL`; neu khong co se fallback theo request origin (vi du `http://localhost:3010`) roi moi toi dev fallback.
- Cau hinh model OpenRouter mac dinh:
  - `OPENROUTER_MODEL=openai/gpt-oss-120b:free` (primary)
  - `OPENROUTER_SECONDARY_MODEL=openai/gpt-oss-120b` (secondary)
  - `OPENROUTER_TERTIARY_MODEL=openai/gpt-oss-20b:free` (tertiary)
  - `ASSISTANT_OPENROUTER_ONLY=true` (dang bat mac dinh trong compose) de chi dung chain OpenRouter.
- Neu model bi timeout som, tang timeout request:
  - `GLM_REQUEST_TIMEOUT_MS` (GLM primary)
  - `OPENROUTER_TIMEOUT_MS` (OpenRouter)
  - `GLM_FALLBACK_TIMEOUT_MS` (fallback provider)
  - (Tool grounding) `ASSISTANT_TOOL_TIMEOUT_MS` (timeout khi goi cac API local nhu `/api/analytics/*`, `/api/fundamentals`, ...)
  - Gia tri compose mac dinh hien tai: `90000` ms.
- Eval scripts gui header `x-assistant-eval=true`; de an toan nen dat cung mot token cho app + smoke:
  - `ASSISTANT_EVAL_AUTH_TOKEN`
- Routing stability trong Docker da duoc chay voi nguong `ASSISTANT_EVAL_MAX_LATENCY_P95_MS=30000` trong script `pnpm run docker:eval:assistant:routing:stable` de giam false-fail do tai nguyen container.
- Neu eval hay cham `429`, tang bucket rieng cho eval:
  - `ASSISTANT_EVAL_RATE_LIMIT_MAX` (mac dinh de xuat: `240` req/phut)

### 7.5 Build prod fail do TypeScript

- Day la loi code that, can fix trong source.
- Sua xong build lai:

```bash
pnpm run docker:up:prod
```

### 7.6 Loi `@lydell/node-pty` thieu `conpty.node` (Windows local)

Day la loi optional native binary bi bo qua khi install tren host Windows.

Khac phuc nhanh:

```bash
pnpm config set optional true
```

```powershell
if (Test-Path node_modules) { Remove-Item node_modules -Recurse -Force }
pnpm install
```

Neu van loi:

```bash
pnpm rebuild @lydell/node-pty
```

## 8. Lenh tat bang Makefile (tuy chon)

Neu dung GNU Make:

```bash
make dev-up
make dev-smoke
make prod-up
make prod-smoke
make down
```

