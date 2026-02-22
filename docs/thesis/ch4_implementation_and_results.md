# Chapter 4: Implementation and Experimental Results

## 4.1 Implementation Overview
This chapter maps the implemented QuantVN system to concrete engineering artifacts in the repository. The implementation is split across:
- UI pages (`src/app/*`) for stock screening, charting, backtesting, portfolio optimization, risk, factor analysis, and learning content.
- API routes (`src/app/api/*/route.ts`) that validate requests, apply rate limits, and orchestrate data loading and quant computation.
- Core libraries (`src/lib/*`) that implement data reliability gates, quant methods, and assistant grounding/policy logic.
- Scripts (`scripts/*.mjs`) that prepare runtime data, run smoke/QA checks, and evaluate assistant reliability.

The primary robustness goal is to ensure numeric outputs are either (a) backed by validated internal data/tools, or (b) blocked with an explicit fallback when evidence is missing. This applies both to quant endpoints (data quality and timeline policies) and to the assistant (grounding, citations, policy gating).

Figure 4.1 summarizes the docker-compose topology used for reproducible dev/smoke/QA workflows.

```mermaid
flowchart LR
  subgraph Compose[docker-compose.yml]
    APP[app (Next.js dev)]
    SMOKE[smoke (scripts/smoke.mjs)]
    QA[qa (scripts/qa.mjs)]
    APPP[app-prod (prod profile)]
    SMOKEP[smoke-prod]
    QAP[qa-prod]
  end

  SMOKE -->|depends_on healthy| APP
  QA -->|depends_on healthy| APP
  SMOKEP -->|depends_on healthy| APPP
  QAP -->|depends_on healthy| APPP
```

Figure 4.1: Docker topology (dev + smoke + QA).

## 4.2 Key Engineering Artifacts
Key files and responsibilities:
- App layout and global composition: `src/app/layout.tsx` (theme provider, layout chrome, toasts, command palette, assistant panel).
- Core data loading and quality gates: `src/lib/data.ts`, `src/lib/dataBackend.ts`, `src/lib/dataManifest.ts`, `src/lib/csvLoader.ts`.
- Quant computation core: `src/lib/quant/backtest.ts`, `src/lib/quant/indicators.ts`, `src/lib/quant/risk.ts`, `src/lib/quant/portfolio.ts`, `src/lib/quant/factors.ts`.
- Rate limiting and client identification: `src/lib/rateLimit.ts`.
- Assistant orchestration endpoint: `src/app/api/assistant/route.ts` (planner, grounding tools, policy gating, provider fallback).
- Assistant tool execution proxy (human-in-loop): `src/app/api/assistant/execute/route.ts` and `src/lib/assistant/executeTools.ts`.
- Assistant core modules: `src/lib/assistant/planner.ts`, `src/lib/assistant/tools.ts`, `src/lib/assistant/policy.ts`, `src/lib/assistant/providers.ts`.
- Evaluation and regression scripts:
  - Data preparation: `scripts/prepare_data_2018_2025.mjs`
  - Smoke and QA: `scripts/smoke.mjs`, `scripts/qa.mjs`
  - Assistant evaluation suites: `scripts/eval-assistant*.mjs`

## 4.3 Experimental Setup
Experiments are designed to be reproducible under both local and Docker workflows.

Evaluation criteria and acceptance gates (with rationale and citations) are defined in `docs/thesis/EVALUATION_GATES.md`.

Figure 4.2 shows the high-level evaluation pipeline used during development and thesis reporting.

```mermaid
flowchart TB
  PREP[Prepare runtime data] --> HEALTH[Health probe (/api/health/data?probe=true)]
  HEALTH --> STATIC[Lint + Typecheck]
  STATIC --> SMOKE[Docker smoke]
  SMOKE --> QA[Docker QA]
  QA --> AEVAL[Assistant eval suites]
  AEVAL --> REPORT[Artifacts + report]
  REPORT --> DECIDE{Meets acceptance gates?}
  DECIDE -->|yes| PASS[Thesis demo ready]
  DECIDE -->|no| FIX[Fix + rerun]
  FIX --> PREP
```

Figure 4.2: Evaluation pipeline (gates).

Data preparation prerequisites:
- Prepare runtime datasets: `pnpm run data:prepare:2018_2025`
- Optional fundamentals validation: `pnpm run data:validate:fundamentals`

Build and static checks:
- Lint: `pnpm run lint`
- Typecheck: `pnpm exec tsc --noEmit`

System-level checks:
- Smoke checks: `pnpm run docker:smoke` (or local `node scripts/smoke.mjs` if the app is already running)
- QA checks: `pnpm run docker:qa`

Assistant evaluation:
- Core eval: `pnpm run eval:assistant`
- Comprehensive suite: `pnpm run eval:assistant:full`
- Stability-gated suites: `pnpm run eval:assistant:stable:all` (or per-suite stable gates)

Expected report artifacts are written under `artifacts/` by the scripts (for example JSON reports plus markdown summaries).

## 4.4 Result Template (to be filled after full run)
Use this table in the final thesis draft:

| Metric | Baseline | Improved | Threshold | Pass/Fail |
|---|---:|---:|---:|---|
| unsupportedClaimRate | TBD | TBD | <= 0.15 | TBD |
| supportedClaimPrecision | TBD | TBD | >= 0.85 | TBD |
| overallClaimAccuracy | TBD | TBD | >= 0.70 | TBD |
| abstentionAccuracy | TBD | TBD | >= 0.85 | TBD |
| groundingPassRate | TBD | TBD | >= 0.70 | TBD |

In addition to the primary five-metric gate, report system diagnostics that explain *why* a run passes or fails:
- Tool failure rate by endpoint (timeouts, HTTP 4xx/5xx, missing base URL).
- Citation coverage and numeric evidence counts in grounded responses.
- Distribution of fallback reasons (missing symbol grounding, insufficient evidence, future date requests, ambiguous ticker prompts).

## 4.5 Error Analysis Template
Categorize failures by:
- tool transport failure (timeout/network),
- endpoint failure (HTTP 4xx/5xx),
- insufficient citation coverage,
- policy fallback false-positive/false-negative.

For each category, provide:
- count and ratio,
- representative prompts,
- root cause,
- mitigation in next iteration.

## 4.6 Discussion
The discussion should connect measured outcomes to engineering decisions:
- Policy strictness vs coverage: quantify how stricter evidence gating changes answer coverage and user experience.
- Data quality vs universe size: explain how validation and timeline overlap rules improve numeric correctness while potentially excluding symbols.
- Operational readiness: summarize what the smoke/QA pipelines catch reliably and which failures still require manual investigation.

## 4.7 Chapter Summary
This chapter documents implementation and measured impact. Chapter 5 consolidates conclusions, limitations, and future work.
