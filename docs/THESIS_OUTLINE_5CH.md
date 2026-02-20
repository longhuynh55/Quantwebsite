# Thesis Outline (5 Chapters) - Finance Copilot for Vietnamese Equities

## Working Title
**Design and Evaluation of a Robust Finance Copilot for Quantitative Analysis in the Vietnamese Stock Market**

## Chapter 1 - Introduction
- Problem context: analysts and students need fast and trustworthy insights for HOSE-listed symbols.
- Research gap: large language models improve usability but can hallucinate numeric financial facts.
- Objectives:
  - Build a grounded finance copilot over local market datasets.
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
- Conclusion:
  - Summarize whether the system meets reliability objectives.
  - Report practical readiness for thesis demonstration.
- Limitations:
  - Dataset freshness and coverage constraints.
  - Provider variability and prompt sensitivity.
- Future work:
  - Expand financial endpoint coverage and benchmark datasets.
  - Add stronger CI/CD gates and nightly regression suites.
  - Introduce calibration metrics and confidence auditing.

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
