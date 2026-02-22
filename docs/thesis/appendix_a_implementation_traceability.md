# Appendix A: Implementation Traceability (Code-to-Text Map)

This appendix is provided for auditability and reproducibility. Chapters 1-3 describe the system at the level of architecture, workflows, and methodological contracts. The system is implemented in a single codebase; the mappings below indicate where each described function is implemented.

The appendix is not required for thesis comprehension. It exists to support reviewers who want to verify that claims about implementation match the repository.

## A.1 Presentation and Routing Layer
- Global layout and shell (navigation, assistant panel): `src/app/layout.tsx`, `src/components/layout/*`, `src/components/assistant/AiAssistantPanel.tsx`
- User workflows (pages): `src/app/screener/page.tsx`, `src/app/charts/page.tsx`, `src/app/backtesting/page.tsx`, `src/app/portfolio/page.tsx`, `src/app/risk/page.tsx`, `src/app/factors/page.tsx`, `src/app/strategy-builder/page.tsx`

## A.2 API Layer (Deterministic Internal Endpoints)
- Backtesting API: `src/app/api/backtesting/route.ts`
- Risk API: `src/app/api/risk/route.ts`
- Portfolio optimisation API: `src/app/api/optimize/route.ts`
- Factors API: `src/app/api/factors/route.ts`
- Data readiness/health API: `src/app/api/health/data/route.ts`
- Strategy Lab APIs: `src/app/api/strategy-lab/*`
- Assistant API: `src/app/api/assistant/route.ts`
- Human-in-the-loop execution boundary: `src/app/api/assistant/execute/route.ts`

## A.3 Quantitative Analytics Layer (Quant Engine)
- Technical indicators: `src/lib/quant/indicators.ts`
- Backtesting engine and strategy families: `src/lib/quant/backtest.ts`
- Risk metrics: `src/lib/quant/risk.ts`
- Portfolio optimisation helpers: `src/lib/quant/portfolio.ts`
- Factor analytics: `src/lib/quant/factors.ts`

## A.4 Data Layer (Runtime Contract)
- Data loading and caching (CSV/DuckDB) + quality reports: `src/lib/data.ts`
- Backend selection and strictness policy (CSV vs DuckDB): `src/lib/dataBackend.ts`
- Runtime data manifest loading and row-count gates: `src/lib/dataManifest.ts`
- Exclusion/eligibility policies used across endpoints: `src/lib/dataPolicy.ts`

## A.5 Assistant Layer (Grounded Orchestration)
- Query planning: `src/lib/assistant/planner.ts`
- Grounding tools (internal endpoint calls) and citations: `src/lib/assistant/tools.ts`, `src/lib/assistant/toolRegistry.ts`
- Policy gating and abstention logic: `src/lib/assistant/policy.ts`
- Provider routing and fallback: `src/lib/assistant/providers.ts`

## A.6 Operational Controls and Evaluation
- Request IDs and API latency tracking: `src/middleware.ts`, `src/lib/monitoring/performance.ts`
- Rate limiting utilities: `src/lib/rateLimit.ts`
- Assistant evaluation suites and artifact outputs: `scripts/eval-assistant*.mjs`, `docs/ASSISTANT_EVAL_CRITERIA.md`
- Thesis acceptance gates overview: `docs/thesis/EVALUATION_GATES.md`

## A.7 Data Preparation (Offline -> Runtime)
- Runtime dataset preparation pipeline: `scripts/prepare_data_2018_2025.mjs`
- Optional DuckDB export: `scripts/export_duckdb_from_runtime.mjs`
- Runtime datasets and manifest: `public/data/*`

