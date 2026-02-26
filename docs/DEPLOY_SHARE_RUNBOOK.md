# Deploy and Share (Docker-first)

This project is easiest to share publicly with a Docker-native host.
Recommended order: `Railway` first, `Render` as backup.

## 1) Railway (recommended)

1. Create a new Railway project from GitHub repo `longhuynh55/Quantwebsite`.
2. Keep root as `quant-website/`.
3. Railway will detect `railway.toml` and build with `Dockerfile`.
4. Add env vars:
   - `NODE_ENV=production`
   - `NEXT_TELEMETRY_DISABLED=1`
   - `DATA_DIR=/app/public/data`
   - `DATA_BACKEND=csv`
   - `DATA_BACKEND_STRICT=false`
   - `DATA_DUCKDB_PATH=/app/public/data/quant_data.duckdb`
   - `ASSISTANT_TOOL_BASE_URL=https://<your-railway-domain>`
   - `ASSISTANT_PROVIDER_PRIORITY=openrouter,glm,fallback`
   - `ASSISTANT_OPENROUTER_ONLY=true`
   - `OPENROUTER_API_KEY=<secret>`
   - `GLM_API_KEY=<secret>`
   - `ASSISTANT_EXECUTE_APPROVAL_TOKEN=<long-random-secret>` (required if you use `/api/assistant/execute`)
5. Deploy and open:
   - `/api/health/data?probe=true&includeFundamentals=false`
   - `/api/health/assistant`

If `ok=true`, share the Railway URL.

## 2) Render (backup)

1. In Render, create service from Blueprint (`render.yaml`).
2. Confirm Docker runtime and env vars generated from `render.yaml`.
3. Fill secrets: `OPENROUTER_API_KEY`, `GLM_API_KEY`.
4. Deploy and verify:
   - `/api/health/data?probe=true&includeFundamentals=false`

## 3) CSV stable mode vs DuckDB primary mode

- `CSV stable mode` (default for cloud sharing):
  - `Dockerfile`
  - `DATA_BACKEND=csv`
  - Works without native DuckDB binding.

- `DuckDB primary mode`:
  - Use `Dockerfile.duckdb` on host settings.
  - Set `DATA_BACKEND=auto` (or `duckdb` if you want strict behavior).
  - Keep `DATA_DUCKDB_PATH=/app/public/data/quant_data.duckdb`.
  - Verify backend in health response: `backend.active` should be `duckdb`.

## 4) Production check before sharing link

Run these endpoints once:

1. `/api/health/data?probe=true`
2. `/api/health/assistant`
3. `/api/market-overview`
4. `/api/fundamentals?symbol=HPG&statement=bs&period=latest`
5. `POST /api/assistant` with body `{"message":"Top 3 VN30 stocks by close today","contextSnapshot":{"page":"assistant"}}`

If all return `200`, share link for team testing.
