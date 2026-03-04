# Assistant Tools (Deterministic Grounding)

This project keeps the finance assistant **numeric answers tool-grounded** (local APIs + datasets) and surfaces citations in responses.

Tool names are defined in `src/types/assistant.ts` (`AssistantToolName`) and implemented in `src/lib/assistant/tools.ts`.

Planning is implemented in `src/lib/assistant/planner.ts`. Every request now carries a deterministic query-plan summary into assistant metadata (`meta.queryIntent`, `meta.queryPlanSummary`, `meta.plannedTools`) so numeric claims can be audited against planned tools.

## Tool Inventory

| Tool | Primary API | Purpose / Notes |
| --- | --- | --- |
| `dataHealth` | `GET /api/health/data?probe=true&includeFundamentals=true` | Debug/grounding tool for â€œkhÃ´ng cÃ³ dá»¯ liá»‡uâ€ reports. Confirms active backend (CSV vs DuckDB), manifest readiness, and fundamentals file readability. |
| `stockSnapshot` | `GET /api/stocks` | OHLCV slice or exact-date probe for a symbol. Used for â€œgiÃ¡â€, â€œchartâ€, â€œreturnâ€, â€œas-of dateâ€ grounding. |
| `marketSnapshot` | `GET /api/market-overview` | HOSE market snapshot (gainers/losers/eligible/stale). Used for â€œthá»‹ trÆ°á»ng hÃ´m nayâ€, breadth/overview grounding. |
| `icbSnapshot` | `GET /api/analytics/icb-snapshot` | Groups HOSE snapshot by ICB level and returns coverage + warnings for non-trading days (fallback-to-prior-session). |
| `fundamentalSnapshot` | `GET /api/fundamentals?period=latest&statement=all` | Latest period fundamentals (bs/is/cf) per symbol with coverage metadata. |
| `fundamentalAnalysis` | `GET /api/finance-analysis?symbol=...&type=fundamental` | Deterministic ratio/analysis summary built from fundamentals. |
| `financialHealthScore` | `GET /api/finance-analysis?symbol=...&type=health` | Deterministic â€œhealthâ€ scoring. Disabled when `ASSISTANT_BASELINE_ONLY=true`. |
| `valuationDcf` | `GET /api/finance-analysis?symbol=...&type=valuation` | Deterministic DCF valuation (assumptions + sensitivity). Disabled when `ASSISTANT_BASELINE_ONLY=true`. |
| `peerMultiples` | `GET /api/finance-analysis?symbol=...&type=peer` | Comparable multiples view. Disabled when `ASSISTANT_BASELINE_ONLY=true`. |
| `scenarioSensitivity` | `GET /api/finance-analysis?symbol=...&type=sensitivity` | Scenario / sensitivity runs. Disabled when `ASSISTANT_BASELINE_ONLY=true`. |
| `riskSnapshot` | `GET /api/risk` | Risk metrics (beta, volatility, etc) vs benchmark. |
| `backtestSummary` | `GET /api/backtesting` | Deterministic backtest summary for a symbol/strategy. |
| `factorSnapshot` | `GET /api/factors` | Factor ranking snapshots (momentum/value/quality/low-vol, â€¦). |
| `valuationRanking` | `GET /api/analytics/valuation-rankings` | Cross-sectional valuation ranking (metric + date + optional ICB filter) with explicit warnings when inputs are missing. Disabled when `ASSISTANT_BASELINE_ONLY=true`. |

## Financial modelling Excel export

- Endpoint: `GET /api/finance-analysis/export?symbol=...&type=fundamental|health|valuation|peer|sensitivity[&period=YYYYQn|Qn/YYYY|latest][&lookback=8]`
- Output: native `.xlsx` workbook (multiple sheets for summary + model tables; valuation sheet includes formulas).
- UI: assistant table blocks for financial modelling now expose an **Export Excel** action that calls this endpoint with the same symbol/type context.

## Debugging â€œmissing dataâ€ in production

When users report the assistant â€œkhÃ´ng truy cáº­p Ä‘Æ°á»£c dá»¯ liá»‡uâ€, triage in this order:

1) `GET /api/health/data?probe=true&includeFundamentals=true` (fast readiness).
2) If `backend.active !== "duckdb"` in prod, ensure:
   - `DATA_BACKEND=duckdb`, `DATA_BACKEND_STRICT=true`
   - `public/data/quant_data.duckdb` exists and the Node `duckdb` binding is installed.
3) Re-run smoke/QA/eval in Docker:
   - `pnpm run docker:smoke:prod`
   - `pnpm run docker:qa:prod`
   - `pnpm run docker:eval:assistant:full:prod`

## Timeouts (model vs tools)

- Model request timeouts:
  - `OPENROUTER_TIMEOUT_MS` (primary OpenRouter)
  - `GLM_REQUEST_TIMEOUT_MS` (GLM primary)
  - `GLM_FALLBACK_TIMEOUT_MS` (fallback provider)
- OpenRouter default fallback chain:
  - `OPENROUTER_MODEL=openai/gpt-oss-120b:free`
  - `OPENROUTER_SECONDARY_MODEL=openai/gpt-oss-20b:free`
  - `OPENROUTER_TERTIARY_MODEL=stepfun/step-3.5-flash:free`
- Tool/API grounding timeouts:
  - `ASSISTANT_TOOL_TIMEOUT_MS`
- Structured output:
  - `ASSISTANT_ENABLE_JSON_SCHEMA_MODE=true` to enable provider `response_format` payloads.
  - `ASSISTANT_STRATEGY_SCHEMA_REQUIRED=true` to enforce schema-applied responses for strategy generation endpoints.

