# Finance AI Agent Roadmap

## Overview
- Translate the existing Enhanced Financial AI Agent architecture into an actionable product roadmap that hooks into the Next.js/TypeScript + GLM API-key stack already in `quant-website` (see `src/app/api/*/route.ts`, `src/lib/assistant`, and the `GLM` env-based configuration described in the docs).
- Deliverables cover jobs-to-be-done/personas, a prioritized Now/Next/Later feature rollout, UX/API flows that expose TypeScript contracts, VN-market differentiators, and measurable KPIs.
- External references used in this roadmap are listed in `docs/REFERENCE_REGISTRY.md` and must be updated whenever a new link is introduced.

## 1. Jobs-to-be-Done & Personas
| Persona | Primary Job | Key Needs | Success Signals |
| --- | --- | --- | --- |
| Institutional Equity Analyst (VN fund) | Deliver rapid, defensible valuations and health checks for Vietnamese equities to support investment decisions. | Reliable VAS-aware ratios, quick DCF and multiple analysis, exportable evidence (Excel/PDF), ability to share with portfolio managers. | Time-to-first-report < 5m, reduction in manual calculation errors, positive feedback from PM desk. |
| Retail Quant Investor (self-directed) | Evaluate new strategies and stock ideas, document reasoning, and track risk across holdings. | Intuitive chat + workflow UI, reproducible sensitivity/scenario analysis, Excel reports for documentation, API key access for automation. | Weekly active users growing, number of Excel exports per session, engagement with workflow presets. |
| Corporate FP&A / Financial Advisor | Produce audits, regulatory-compliant models, and board-ready summaries tied to Vietnamese standards. | VAS-conforming prompts, audit trails for assumption changes, ability to build multi-step workflows (portfolio health, DCF), and collaborate via shared Excel deliverables. | Audit-ready exports delivered, collaboration sessions per month, reduced time spent reconciling models. |

## 2. Prioritized Roadmap (Now / Next / Later)
**Now (0-4 weeks)**
- Stabilize the GLM-backed assistant (`src/app/api/assistant/route.ts`, `src/lib/assistantStore.ts`) with TypeScript message/context types, prompt templates, and API-key enforcement (`GLM_API_KEY` env).
- Launch core Financial Statement Analysis module: ratio calculators, red-flag detection, Vietnamese benchmarks, and quick action buttons wired to `/api/analysis/financial-health` and `/api/analysis/ratios` (TypeScript contracts in `src/lib/financial-analysis`).
- Build UX scaffolding: `AiAssistantPanel`, `ChatInput`, `QuickActions`, `AnalysisMode`, `WorkflowProgress` so analysts can trigger jobs and see progress. Ensure API responses (JSON structures defined in `financial-analysis/types.ts`) power the UI directly.

**Next (4-8 weeks)**
- Introduce Financial Modeling & Workflow primitives (`src/lib/financial-modeling/dcf-engine.ts`, `workflow-engine.ts`, `reports` APIs) with WACC, terminal value, sensitivity, and scenario analysis outputs.
- Wire Excel/Report exports (`ExcelJS` usage in `excel-reports/report-generator.ts`) to `/api/reports/stock-analysis` and `/api/reports/portfolio-summary`, ensuring TypeScript request/responses describe attachments and metadata.
- Extend multi-step workflow engine: allow users to chain data gathering ? analysis ? report generation via preset sequences (`workflows/presets.ts`) and expose progress through UI.
- Harden API key gating by checking `GLM_API_KEY` for any route touching the GLM service and log usage for quota tracking.

**Later (8-16 weeks)**
- Add real-time market/data connectors (Vietstock, SSI FastConnect) via a data ingestion layer that feeds the analysis/modeling modules; allow environment-specific keys for each feed.
- Offer advanced monetized modules (portfolio health monitoring, regulator-ready audit exports, scenario simulations) with tiered access, premium prompts, and collaborative workspace features.
- Build automation APIs for pro customers (e.g., `POST /api/workflows/run` with TypeScript request schema) so they can embed insights in their own dashboards.

## 3. UX Flows & API / Tool Contract Implications
1. **Stock Health Chat Flow**
   - UX: Analyst selects ticker ? `QuickActions` triggers `analysis-mode` prompt ? UI shows progressive ratio results + red-flag cards.
   - API: `POST /api/analysis/financial-health` expects `{ ticker: string; horizon: { from: string; to: string }; benchmarks: string[] }` and returns JSON shaped by `financial-analysis/types.ts` (liquidity, leverage, profitability, healthScore).
   - GLM contract: Route uses `GLM_API_KEY` to stream to `assistant/route.ts` or `analysis/[type]/route.ts`; responses written to `assistantStore` with caching key per ticker and horizon.

2. **DCF Modeling + Sensitivity Workflow**
   - UX: Analyst enters assumptions in `AnalysisMode`, triggers DCF workflow, and sees `WorkflowProgress` updating per step (data pull, FCF projection, WACC, terminal value).
   - API: `POST /api/analysis/dcf` accepts `{ symbol: string; historicalData: Financials[]; assumptions: DcfAssumptions }` -> service uses `financial-modeling/dcf-engine.ts` returning typed `DcfResult` (projections, wacc, risks).
   - Tool contract: `financial-modeling/prompts.ts` ensures GLM prompts reflect VAS; TypeScript types enforce assumption coverage to avoid runtime errors.

3. **Report Export Flow**
   - UX: After analysis, user taps `ReportExport` ? chooses stock/portfolio ? receives download link.
   - API: `POST /api/reports/stock-analysis` includes `{ symbol, insights: DcfResult | RatioResult, format: 'xlsx' }`; `report-generator.ts` uses ExcelJS to build workbook per template and returns signed URL.
   - API key: Ensure both GLM and Excel generation routes respect quota via `GLM_API_KEY` + optional `REPORT_API_KEY` for high-volume clients; structure responses to include `requestId` for traceability.

4. **Workflow Automation API (Premium)**
   - UX: Product lead configures preset (e.g., Portfolio Health Check) and schedules via UI.
   - API: Add `POST /api/workflows/run` that validates `WorkflowStep[]`, orchestrates `WorkflowEngine.runWorkflow`, and streams progress updates to the UI. TypeScript definition enforces step IDs, statuses, and context shapes.
   - Contract: Each premium workflow logs which data connectors and GLM prompts ran, feeding analytics for monetization.

## 4. Monetizable Differentiators for the VN Market
- **VAS-Aware Insights**: Prompts and analysis rules differentiate between IFRS and VAS (e.g., depreciation, tax treatment) so local analysts trust outputs, unlocking premium subscriptions.
- **Vietnam Data Feeds**: Bundled connectors to Vietstock, SSI FastConnect, VNDirect-coded API keys give real-time Vietnamese market data unavailable in generic tools.
- **Excel-First Deliverables**: Pre-built Excel templates (financials, risk, portfolio) match how VN banks share reports; customers pay for branded, export-ready XLSX deliveries.
- **Pro Workflows**: Sell curated workflows (e.g., DCF + sensitivity + report export) as a sequence package with deterministic pricing; ensures consistent revenue.
- **Bilingual Support**: Provide Vietnamese + English analysis with glossary references, making the platform accessible to domestic firms and local investors.

## 5. Success KPIs
1. **Adoption & Engagement**: Number of active analysts using `/api/analysis/*` plus quick-action triggers per week; monthly report exports per user.
2. **Accuracy & Trust**: Ratio result validation rate (manual QA vs AI output), time to resolve GLM prompts flagged as inaccurate (< 24h) tracked via logs.
3. **Workflow Completion**: % of initiated workflows that reach the final export step; drop-off insights show where UX needs improvement.
4. **Monetization**: Revenue from premium connectors/workflows, conversion rate from free to premium Excel/report exports, ARPU of API key customers.
5. **Operational Reliability**: API latency for `analysis` and `reports` routes (< 700ms), GLM cost per request (tracked via key logs), and error rate for `workflow-engine` steps.

## 6. References
- TruthfulQA (2022): https://arxiv.org/abs/2109.07958
- SelfCheckGPT (2023): https://arxiv.org/abs/2303.08896
- FActScore (2023): https://arxiv.org/abs/2305.14251
- SQuAD 2.0 (2018): https://arxiv.org/abs/1806.03822
- BloombergGPT (2023): https://arxiv.org/abs/2303.17564
- FinGPT (2023): https://arxiv.org/abs/2306.06031
- AlphaSense Generative Search: https://developer.alpha-sense.com/api/getting-started/embedded-widgets/generative-search
- S&P Global Visible Alpha: https://www.spglobal.com/market-intelligence/en/solutions/visible-alpha
- Bloomberg Office Tools (Excel): https://www.bloomberg.com/faq/question/i-cannot-find-my-office-tools-add-in-how-can-i-get-it-back/

---
*Document generated: February 14, 2026*
