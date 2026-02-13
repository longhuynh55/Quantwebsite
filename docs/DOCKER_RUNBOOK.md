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
- Data CSV duoc mount tu `./public/data` vao container.
- Neu ban cap nhat raw data (2018-2025) o thu muc `../data`, hay chay prepare de tao file runtime truoc khi run Docker:

```bash
npm run data:prepare:2018_2025
```

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
npm run docker:up
```

Kiem tra trang thai:

```bash
docker compose ps
```

Ky vong:
- Service `app` o trang thai `healthy`.

### 3.2 Chay smoke test

```bash
npm run docker:smoke
```

Neu frontend dang duoc cap nhat va ban chi muon verify backend API:

```bash
npm run docker:smoke:api
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
npm run docker:qa
```

Neu chi muon verify backend API:

```bash
npm run docker:qa:api
```

### 3.4 Dung moi truong

```bash
npm run docker:down
```

## 4. Quy trinh Debug

### 4.1 Theo doi log runtime

```bash
npm run docker:logs
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
npm run docker:smoke
```

### 4.3 Restart an toan khi app treo

```bash
docker compose restart app
```

Khong dung kill process node toan cuc tren may host.

## 5. Quy trinh Production Profile

### 5.1 Build + run production container

```bash
npm run docker:up:prod
```

Ky vong:
- Build thanh cong tu `Dockerfile`
- `app-prod` len `healthy` o port `3011`

### 5.2 Smoke test production runtime

```bash
npm run docker:smoke:prod
```

Neu chi muon verify backend API trong production profile:

```bash
npm run docker:smoke:prod:api
```

Ky vong:
- Toan bo check `PASS`
- Exit code = 0

### 5.3 QA test production runtime (deep)

```bash
npm run docker:qa:prod
```

Neu chi muon verify backend API:

```bash
npm run docker:qa:prod:api
```

### 5.4 Theo doi log production

```bash
npm run docker:logs:prod
```

### 5.5 Dung toan bo service

```bash
npm run docker:down
```

## 6. Checklist release de xuat

Truoc khi chot release:
1. `npm run docker:up`
2. `npm run docker:smoke`
3. `npm run docker:qa`
4. `npm run docker:up:prod`
5. `npm run docker:smoke:prod`
6. `npm run docker:qa:prod`
7. `npm run docker:down`

Chi release khi ca `dev smoke/qa` va `prod smoke/qa` deu pass.

## 7. Troubleshooting nhanh

### 7.1 `Access is denied` voi Docker engine

- Chay terminal voi quyen phu hop.
- Dam bao Docker Desktop dang chay.
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

### 7.4 Build prod fail do TypeScript

- Day la loi code that, can fix trong source.
- Sua xong build lai:

```bash
npm run docker:up:prod
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
