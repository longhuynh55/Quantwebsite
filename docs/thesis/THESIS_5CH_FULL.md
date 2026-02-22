# Graduation Thesis Draft (5 Chapters)

Working title:
QuantVN Strategy Forge: A Reliability-Gated AI Assistant for Trading Strategy Design and Backtesting on Vietnamese Equities (HOSE)

Author: <Student Name>
Advisor: <Advisor Name>
Institution: <University / Faculty>
Date: 2026-02-21

## Abstract
Quantitative analysis for Vietnamese equities typically requires combining market prices, company fundamentals, and risk analytics across fragmented sources. This thesis presents QuantVN, a web-based quantitative finance platform for HOSE-focused analysis, and a reliability-critical assistant layer that helps users query the system conversationally without sacrificing numeric correctness. The system relies on prepared local datasets (CSV with optional DuckDB acceleration) and enforces runtime integrity using schema validation, OHLC bound checks, quality reports, and manifest-based gating. On top of deterministic internal financial endpoints, the assistant implements a tool-grounded pipeline (planner, grounding tools, policy, provider routing) that produces numeric claims only when backed by evidence and otherwise abstains with diagnostics. We define a five-metric reliability gate and evaluate the assistant with reproducible script-based suites and smoke/QA workflows. The result is an engineering approach that links design decisions to measurable reliability outcomes and supports a graduation-project scale while remaining extensible toward production-grade deployments.

Keywords: AI assistant, trading strategy generation, quantitative equity research, Vietnamese stock market, HOSE, backtesting, portfolio optimization, risk management, data validation, tool grounding, retrieval-augmented generation, LLM reliability

## Abbreviations
- API: Application Programming Interface
- CI: Continuous Integration
- CVaR: Conditional Value at Risk
- HOSE: Ho Chi Minh City Stock Exchange
- KPI: Key Performance Indicator
- LLM: Large Language Model
- OHLCV: Open, High, Low, Close, Volume
- RAG: Retrieval-Augmented Generation
- VaR: Value at Risk

## List of Figures
- Figure 3.1: System context for QuantVN Strategy Forge (`docs/thesis/figures/fig_3_1_system_context.md`)
- Figure 3.2: Module architecture (code map) (`docs/thesis/figures/fig_3_2_module_architecture.md`)
- Figure 3.3: Data pipeline and runtime contract (`docs/thesis/figures/fig_3_3_data_pipeline.md`)
- Figure 3.4: Backtesting request workflow (`docs/thesis/figures/fig_3_4_backtesting_sequence.md`)
- Figure 3.5: Grounded assistant pipeline (`docs/thesis/figures/fig_3_5_assistant_pipeline.md`)
- Figure 3.6: QuantVN Strategy Forge workflow (Canvas + AI -> Run -> Diagnose) (`docs/thesis/figures/fig_3_6_strategy_forge_workflow.md`)
- Figure 4.1: Docker topology (dev + smoke + QA) (`docs/thesis/figures/fig_4_1_docker_topology.md`)
- Figure 4.2: Evaluation pipeline (gates) (`docs/thesis/figures/fig_4_2_evaluation_pipeline.md`)

## Chapter 1: Introduction
This chapter's editable source is `docs/thesis/ch1_introduction.md`.

## Chapter 2: Literature Review and Theoretical Background
This chapter's editable source is `docs/thesis/ch2_literature_review.md`.

## Chapter 3: System Design and Methodology
This chapter's editable source is `docs/thesis/ch3_system_design_and_methodology.md`.

## Chapter 4: Implementation and Experimental Results
This chapter's editable source is `docs/thesis/ch4_implementation_and_results.md`.

## Chapter 5: Conclusion and Future Work
This chapter's editable source is `docs/thesis/ch5_conclusion_and_future_work.md`.

## References
Maintain the reference list in `docs/thesis/references_apa.md`.

## Appendices (Suggested)
- Appendix A: Runtime dataset schemas and manifests (`public/data/README.md`, `src/lib/dataManifest.ts`)
- Appendix B: API contracts and examples (`docs/API.md`)
- Appendix C: System architecture diagrams (`docs/ARCHITECTURE.md`, `docs/CODEBASE_OVERVIEW.md`)
- Appendix D: Docker workflows and release checks (`docs/DOCKER_RUNBOOK.md`, `docs/DATA_RELEASE_CHECKLIST.md`)


