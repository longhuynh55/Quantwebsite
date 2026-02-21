# Thesis Outline (5 Chapters) - QuantVN Strategy Forge

## Working Title
**QuantVN Strategy Forge: A Reliability-Gated AI Assistant for Trading Strategy Design and Backtesting on Vietnamese Equities (HOSE)**

## Chapter 1 - Introduction
- Problem context: analysts and students need fast and trustworthy insights for HOSE-listed symbols.
- Research gap: large language models improve usability but can hallucinate numeric financial facts.
- Objectives:
  - Build a grounded AI assistant over local market datasets.
  - Improve robustness under missing data, tool failure, and ambiguous prompts.
  - Evaluate reliability with quantitative metrics.
- Scope:
  - Data comes from local CSV and DuckDB pipelines.
  - System is for decision support and learning, not investment advice automation.
- Expected contributions:
  - Tool-grounded response pipeline.
  - Policy-based fallback for insufficient evidence.
  - Reproducible evaluation gate for accuracy and hallucination risk.

## Chapter 2 - Literature Review and Theoretical Background
- Quantitative finance foundations:
  - Mean-variance portfolio theory and risk-return tradeoff (Markowitz, 1952).
  - Asset pricing and risk factor interpretation (Sharpe, 1964).
  - Tail-risk control with CVaR (Rockafellar & Uryasev, 2000).
- LLM reliability foundations:
  - Truthfulness under adversarial prompts (Lin et al., 2022).
  - Claim-level factual precision (Min et al., 2023).
  - Reference-free hallucination detection (Manakul et al., 2023).
  - Abstention on unanswerable requests (Rajpurkar et al., 2018).
  - Retrieval-augmented generation for factual grounding (Lewis et al., 2020).
- Outcome:
  - Define thesis metrics and design constraints for robust assistant behavior.

## Chapter 3 - System Design and Methodology
- Architecture:
  - Next.js UI and API orchestration.
  - Grounding tool layer for financial endpoints.
  - Policy layer for evidence sufficiency and fallback.
  - Provider layer for language generation.
- Robustness design:
  - Signal extraction for required evidence.
  - Numeric claim gating with citation requirements.
  - Diagnostic blocks when tools fail.
- Evaluation methodology:
  - Curated prompt suites (supported, unsupported, deceptive, abstention cases).
  - Quantitative thresholds and pass/fail gates.
  - Reproducible script-based evaluation in CI smoke jobs.

## Chapter 4 - Implementation and Experimental Results
- Implementation scope:
  - Assistant routing and policy in `src/app/api/assistant/route.ts`.
  - Grounding, signals, and policy in `src/lib/assistant/*`.
  - Quantitative evaluation in `scripts/eval-assistant-comprehensive.mjs`.
- Experiment protocol:
  - Baseline vs improved runs.
  - Metrics tracked per profile (`quick`, `standard`, `full`).
- Result analysis:
  - Hallucination reduction and abstention behavior.
  - Error taxonomy (tool HTTP errors, timeout, missing base URL).
  - Trade-off between strict robustness and response coverage.

## Chapter 5 - Conclusion and Future Work
- **Summary**
- The sequential remediation tracker (`quant-website/docs/SEQUENTIAL_REMEDIATION_TRACKER_2026-02-19.md`) keeps the multi-stage rollout honest: CI/data gates (Stage 1) now hook into workflow artifacts, assistant trust/policy metadata surfaced end-to-end, and the API/health story has clear non-OK semantics backed by documented health probe contracts. Together with the architecture notes on rate limiting and assistant signals (see `quant-website/docs/ARCHITECTURE.md`), the effort shows that the assistant and API can expose grounded diagnostics while staying interoperable with the data plane coverage described in `quant-website/docs/api-period-date-test-matrix.md`.
- **Limitations**
- Fairness and scalability of rate limiting remain incomplete: the current limiter is still single-process/in-memory (`src/lib/rateLimit.ts`), and the Sequential Remediation Tracker marks Stage 2 incomplete because tenant-aware quotas and probe throttling have not yet landed. Probe traffic bypasses rate limits today (`quant-website/docs/SEQUENTIAL_REMEDIATION_TRACKER_2026-02-19.md` Stage 3 status), so bursty clients can still upset the readiness budget. Dataset freshness, provider drift, and assistant prompt sensitivity also persist despite the specs in `quant-website/docs/ASSISTANT_EVAL_CRITERIA.md`, which highlights the adversarial/evidence requirements we need to keep validating.
- **Future roadmap**
1. **Redis-backed rate limiting** – migrate the limiter described in `quant-website/docs/ARCHITECTURE.md#Redis-for-Rate-Limiting` out of the in-memory counter so that distributed deployments share quotas, can honor tenant fingerprints, and issue `Retry-After` budgets for the health probe (`quant-website/docs/SEQUENTIAL_REMEDIATION_TRACKER_2026-02-19.md` Stage 3). Redis also unlocks centralized audit trails for `x-assistant-eval` and API clients that now use the expanded rate-limit headers in `quant-website/docs/API.md`.
2. **Strategy Lab persistence (DB backend)** – implement the Postgres schema and job workflow outlined in `quant-website/docs/STRATEGY_LAB_BACKEND_TECH_DESIGN.md`, reuse the `Strategy Lab Frontend UX Architecture` insights for pagination/UX state, and surface the same run/event metadata back through `/api/strategy-lab` so that experiments survive worker restarts and can be replayed in audit-friendly ways.
3. **Richer evaluation suites** – extend the API period/date test matrix (`quant-website/docs/api-period-date-test-matrix.md`) with nightly runs that sweep new symbols/dates, and couple those numeric benchmarks with the assistant evaluation rubric (`quant-website/docs/ASSISTANT_EVAL_CRITERIA.md`) so future regressions capture unsupported claims, grounding failures, and adversarial prompts. These suites will feed new CI gates and smoke reports, matching the QA/observability plans in `quant-website/docs/PERF_RELIABILITY_SOP_V2_PLAN.md` and `quant-website/docs/OBSERVABILITY_SLO.md`.

## Core Metrics (Primary Thesis Gate)
1. `unsupportedClaimRate` (lower is better)
2. `supportedClaimPrecision` (higher is better)
3. `overallClaimAccuracy` (higher is better)
4. `abstentionAccuracy` (higher is better)
5. `groundingPassRate` (higher is better)

## APA References (Starter Set)
- Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., ... Riedel, S. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. *Advances in Neural Information Processing Systems, 33*, 9459-9474.
- Lin, S., Hilton, J., & Evans, O. (2022). TruthfulQA: Measuring how models mimic human falsehoods. *Proceedings of the 60th Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)*, 3214-3252. https://doi.org/10.18653/v1/2022.acl-long.229
- Manakul, P., Liusie, A., & Gales, M. (2023). SelfCheckGPT: Zero-resource black-box hallucination detection for generative large language models. *Proceedings of the 2023 Conference on Empirical Methods in Natural Language Processing*, 9004-9017. https://doi.org/10.18653/v1/2023.emnlp-main.557
- Markowitz, H. (1952). Portfolio selection. *The Journal of Finance, 7*(1), 77-91. https://doi.org/10.1111/j.1540-6261.1952.tb01525.x
- Min, S., Krishna, K., Lyu, X., Lewis, M., Yih, W.-t., Koh, P. W., ... Hajishirzi, H. (2023). FActScore: Fine-grained atomic evaluation of factual precision in long form text generation. *Proceedings of the 2023 Conference on Empirical Methods in Natural Language Processing*, 12076-12100. https://doi.org/10.18653/v1/2023.emnlp-main.741
- Rajpurkar, P., Jia, R., & Liang, P. (2018). Know what you do not know: Unanswerable questions for SQuAD. *Proceedings of the 56th Annual Meeting of the Association for Computational Linguistics (Volume 2: Short Papers)*, 784-789. https://doi.org/10.18653/v1/P18-2124
- Rockafellar, R. T., & Uryasev, S. (2000). Optimization of conditional value-at-risk. *The Journal of Risk, 2*(3), 21-41. https://doi.org/10.21314/JOR.2000.038
- Sharpe, W. F. (1964). Capital asset prices: A theory of market equilibrium under conditions of risk. *The Journal of Finance, 19*(3), 425-442. https://doi.org/10.1111/j.1540-6261.1964.tb02865.x
