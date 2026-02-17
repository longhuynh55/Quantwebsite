# Assistant Tools (Deterministic Grounding)

This project keeps the finance assistant **numeric answers tool-grounded** (local APIs + datasets) and surfaces citations in responses.

Tool names are defined in `src/types/assistant.ts` (`AssistantToolName`) and implemented in `src/lib/assistant/tools.ts`.

## Tool Inventory

| Tool | Primary API | Purpose / Notes |
| --- | --- | --- |
| `dataHealth` | `GET /api/health/data?probe=true&includeFundamentals=true` | Debug/grounding tool for “không có dữ liệu” reports. Confirms active backend (CSV vs DuckDB), manifest readiness, and fundamentals file readability. |
| `stockSnapshot` | `GET /api/stocks` | OHLCV slice or exact-date probe for a symbol. Used for “giá”, “chart”, “return”, “as-of date” grounding. |
| `marketSnapshot` | `GET /api/market-overview` | HOSE market snapshot (gainers/losers/eligible/stale). Used for “thị trường hôm nay”, breadth/overview grounding. |
| `icbSnapshot` | `GET /api/analytics/icb-snapshot` | Groups HOSE snapshot by ICB level and returns coverage + warnings for non-trading days (fallback-to-prior-session). |
| `fundamentalSnapshot` | `GET /api/fundamentals?period=latest&statement=all` | Latest period fundamentals (bs/is/cf) per symbol with coverage metadata. |
| `fundamentalAnalysis` | `GET /api/finance-analysis?symbol=...&type=fundamental` | Deterministic ratio/analysis summary built from fundamentals. |
| `financialHealthScore` | `GET /api/finance-analysis?symbol=...&type=health` | Deterministic “health” scoring. Disabled when `ASSISTANT_BASELINE_ONLY=true`. |
| `valuationDcf` | `GET /api/finance-analysis?symbol=...&type=valuation` | Deterministic DCF valuation (assumptions + sensitivity). Disabled when `ASSISTANT_BASELINE_ONLY=true`. |
| `peerMultiples` | `GET /api/finance-analysis?symbol=...&type=peer` | Comparable multiples view. Disabled when `ASSISTANT_BASELINE_ONLY=true`. |
| `scenarioSensitivity` | `GET /api/finance-analysis?symbol=...&type=sensitivity` | Scenario / sensitivity runs. Disabled when `ASSISTANT_BASELINE_ONLY=true`. |
| `riskSnapshot` | `GET /api/risk` | Risk metrics (beta, volatility, etc) vs benchmark. |
| `backtestSummary` | `GET /api/backtesting` | Deterministic backtest summary for a symbol/strategy. |
| `factorSnapshot` | `GET /api/factors` | Factor ranking snapshots (momentum/value/quality/low-vol, …). |
| `valuationRanking` | `GET /api/analytics/valuation-rankings` | Cross-sectional valuation ranking (metric + date + optional ICB filter) with explicit warnings when inputs are missing. Disabled when `ASSISTANT_BASELINE_ONLY=true`. |

## Debugging “missing data” in production

When users report the assistant “không truy cập được dữ liệu”, triage in this order:

1) `GET /api/health/data?probe=true&includeFundamentals=true` (fast readiness).
2) If `backend.active !== "duckdb"` in prod, ensure:
   - `DATA_BACKEND=duckdb`, `DATA_BACKEND_STRICT=true`
   - `public/data/quant_data.duckdb` exists and the Node `duckdb` binding is installed.
3) Re-run smoke/QA/eval in Docker:
   - `npm run docker:smoke:prod`
   - `npm run docker:qa:prod`
   - `npm run docker:eval:assistant:full:prod`

## Timeouts (model vs tools)

- Model request timeouts:
  - `OPENROUTER_TIMEOUT_MS` (primary OpenRouter)
  - `GLM_REQUEST_TIMEOUT_MS` (GLM primary)
  - `GLM_FALLBACK_TIMEOUT_MS` (fallback provider)
- Tool/API grounding timeouts:
  - `ASSISTANT_TOOL_TIMEOUT_MS`
