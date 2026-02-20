# Assistant Stability Gate Runbook (PM/QA)

## Muc tieu
- Giam false negative do `fetch failed`/latency spike.
- Danh gia on dinh theo nhieu vong (flake rate), khong chi 1 lan pass/fail.
- Luu artifact report day du tren host khi chay Docker smoke.

## Lenh chay
- Local:
  - `pnpm run eval:assistant:routing:stable`
  - `pnpm run eval:assistant:realworld:stable`
  - `pnpm run eval:assistant:pr-gate:stable`
  - `pnpm run eval:assistant:policy-matrix:stable`
  - `pnpm run eval:assistant:perf-reliability:stable`
  - `pnpm run eval:assistant:stable:all`
- Docker:
  - `pnpm run docker:eval:assistant:routing:stable`
  - `pnpm run docker:eval:assistant:realworld:stable`
  - `pnpm run docker:eval:assistant:pr-gate:stable`
  - `pnpm run docker:eval:assistant:policy-matrix:stable`
  - `pnpm run docker:eval:assistant:perf-reliability:stable`
  - `pnpm run docker:eval:assistant:stable:all`

## Stability config
- Global:
  - `ASSISTANT_EVAL_STABILITY_ROUNDS` (default `3`)
  - `ASSISTANT_EVAL_STABILITY_MIN_PASS_RATE` (default `1`)
  - `ASSISTANT_EVAL_STABILITY_MAX_FLAKE_RATE` (default `0`)
  - `ASSISTANT_EVAL_STABILITY_MIN_SUCCESSFUL_ROUNDS` (default = rounds)
- Per-suite (suffix):
  - `ASSISTANT_EVAL_STABILITY_ROUNDS_ROUTING`
  - `ASSISTANT_EVAL_STABILITY_MIN_PASS_RATE_ROUTING`
  - `ASSISTANT_EVAL_STABILITY_MAX_FLAKE_RATE_ROUTING`
  - `ASSISTANT_EVAL_STABILITY_MIN_SUCCESSFUL_ROUNDS_ROUTING`
- Suite token:
  - `routing`, `realworld`, `pr-gate`, `policy-matrix`, `perf-reliability`, `full`.

## Artifact output
- Round report: `artifacts/stability/<suite>/<suite>-round-<n>.json`
- Stability aggregate:
  - `artifacts/assistant-<suite>-stability-report.json`
  - `artifacts/assistant-stability-report.json` (khi chay multi-suite)
- Canonical suite report duoc copy tu round pass gan nhat ve:
  - `artifacts/assistant-routing-matrix-report.json`
  - `artifacts/assistant-realworld-report.json`
  - ...

## PM operating cadence
- Moi PR: bat buoc `routing:stable` + `pr-gate:stable`.
- Nightly: `stable:all`.
- Release gate: `realworld:stable` + `policy-matrix:stable` + `perf-reliability:stable`.

## RACI
- PM: quyet dinh threshold, duyet go/no-go, theo doi flake trend.
- QA: van hanh suite, phan loai fail (logic vs infra), cap nhat test matrix.
- AI Engineering: fix retry/routing/tool-call issues.
- Backend: fix API latency/timeout/data health.
- Frontend: fix format/citation/trace display regressions.
