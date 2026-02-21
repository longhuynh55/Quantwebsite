# Evaluation Criteria and Acceptance Gates (QuantVN Strategy Forge)

This document defines a thesis-aligned evaluation framework for QuantVN Strategy Forge. It specifies what is being evaluated, why each criterion exists, how each metric is measured, and what acceptance gates must pass before the system is considered reliable enough for demonstration and thesis claims.

The system is treated as reliability-critical because it produces numeric financial outputs. The evaluation framework therefore emphasizes evidence, reproducibility, and conservative failure behavior (abstention) over broad coverage.

## 1. Design Goals and Evaluation Philosophy

QuantVN Strategy Forge combines deterministic quantitative analytics (screening, charting, backtesting, optimization, risk, factors) with an AI assistant that can help users generate and evaluate trading strategies. The thesis claims are not limited to "the system runs"; they assert that outputs are meaningfully reliable under realistic constraints.

In traditional quantitative finance, portfolio construction and risk reporting depend on aligned return series, stable estimators, and coherent objective functions. Mean-variance selection and risk-adjusted comparison are meaningful only when inputs are valid and comparable (Markowitz, 1952; Sharpe, 1964). Tail-risk measures such as CVaR explicitly target adverse outcomes, increasing sensitivity to data sampling and integrity (Rockafellar & Uryasev, 2000). In modern workflows, the research process itself can produce false confidence via overfitting to historical noise; evaluation therefore must resist selection bias and backtest overfitting (Bailey et al., 2016).

For AI assistants, the reliability problem becomes more acute: fluent language is not evidence. Truthfulness evaluation shows that models can produce confident but unsupported claims (Lin et al., 2022). Claim-level evaluation motivates scoring atomic assertions rather than "overall answer quality" (Min et al., 2023). When evidence is missing, abstention is a first-class requirement rather than a weakness (Rajpurkar et al., 2018). Retrieval-augmented generation provides an established framing for grounding generation in external context (Lewis et al., 2020); in this thesis, the assistant grounds to deterministic internal endpoints and validated datasets.

The evaluation framework follows these principles:
- **Evidence-first**: numeric claims require tool-grounded evidence; otherwise the system must abstain.
- **Reproducibility**: evaluation must be runnable from scripts, producing versioned artifacts.
- **Pre-registered thresholds**: "pass/fail" gates must be defined before reporting results to avoid cherry-picking (Bailey et al., 2016).
- **Separation of concerns**: data readiness, quant correctness, and assistant truthfulness are evaluated as distinct layers.

## 2. Mapping Criteria to Research Questions

The thesis research questions (Chapter 1) are operationalized as evaluation categories:

- **RQ1 (Data pipeline and validation reduce instability)**: Gate A (Data readiness and integrity), Gate B (Time-series alignment diagnostics).
- **RQ2 (Diagnostics and exclusion policies)**: Gate A (Quality reports), Gate C (Quant diagnostics completeness).
- **RQ3 (Grounded assistant reduces unsupported numeric claims)**: Gate E (Assistant reliability metrics).
- **RQ4 (Abstention vs coverage trade-off)**: Gate E (abstention accuracy + coverage), plus reporting of blocked/abstained cases.
- **RQ5 (Actionable reliability definition)**: all gates combined; acceptance is based on a small number of measurable, repeatable metrics.

## 3. Gate 0: Build and Static Correctness (Engineering Baseline)

These checks establish basic engineering health. They are not "research results," but they prevent accidental regressions from contaminating evaluation.

- **Lint passes**: `pnpm run lint`
- **Typecheck passes**: `pnpm exec tsc --noEmit`
- **Build is reproducible**: `pnpm run build` (or Docker production profile when host FS constraints exist)

Artifacts:
- Lint/typecheck logs captured in CI or local logs.

## 4. Gate A: Data Readiness and Integrity (Reliability Foundation)

### A1. Dataset availability and manifest consistency
**Purpose.** Ensure the system is operating on known runtime datasets with explicit lineage and row-count expectations. Quant outputs depend on valid aligned time series; invalid inputs undermine mean-variance statistics and risk-adjusted comparisons (Markowitz, 1952; Sharpe, 1964).

**Why this metric.** If datasets are missing or malformed, a system might still return numbers, but they would be meaningless. Manifest-based contracts make dataset readiness explicit.

**How to measure.**
- Call `/api/health/data?probe=true&includeFundamentals=false` for readiness.
- Call `/api/health/data` for deep diagnostics.
- Confirm manifest is loadable and matches expected schema/version.

**Suggested acceptance thresholds.**
- Probe mode: `ok=true`, backend resolved, manifest available (or explicitly explained).
- Full mode: all required datasets `ok=true` with non-zero accepted rows.

### A2. Row-level validation and accepted ratio
**Purpose.** Ensure record-level constraints (dates, numeric parsing, OHLC bounds) are enforced so derived indicators and returns are meaningful.

**Why this metric.** Tail-risk and covariance estimation can be distorted by a small number of corrupted rows; strict validation reduces downstream instability (Rockafellar & Uryasev, 2000).

**How to measure.**
- Use data quality reports produced by the loader: accepted rows, rejected rows, parse error count, rejection reasons.

**Suggested acceptance thresholds.**
- Accepted ratio per dataset: `>= 0.95` (or a documented, justified value for the dataset).
- Parse error count: `0` in prepared runtime files (preferred).
- OHLC integrity: zero tolerance for invalid bounds in accepted rows.

### A3. Coverage and timeline diagnostics
**Purpose.** Make explicit how much history exists for each symbol and whether gaps exist.

**Why this metric.** Portfolio covariance and beta estimation are unstable when overlap windows are short; missing blocks can create misleading volatility/drawdown estimates (Markowitz, 1952; Sharpe, 1964).

**How to measure.**
- Report coverage ratios, largest gap metrics, and dropped rows in backtesting and analytics responses.
- Summarize exclusion reasons for symbols not meeting minimum history requirements.

**Suggested acceptance thresholds.**
- Minimum history for backtesting/analytics: documented per endpoint.
- Minimum overlap window for optimization and beta/TE: documented and enforced.

## 5. Gate B: Quant Engine Correctness and Realism

### B1. Look-ahead bias prevention
**Purpose.** Ensure strategies cannot "see the future."

**Why this metric.** Backtests that leak future data inflate performance and invalidate conclusions; evaluation must enforce temporal causality (Bailey et al., 2016).

**How to measure.**
- Confirm execution model uses a causal fill assumption (e.g., signal at *t* executes at *t+1* open).
- Add regression probes: ensure features/indicators at *t* only depend on `<= t`.

**Suggested acceptance thresholds.**
- Default execution model is causal.
- No detected look-ahead in regression probes.

### B2. Transaction cost and slippage monotonicity
**Purpose.** Ensure the engine responds plausibly to cost settings.

**Why this metric.** If increasing costs improves performance, the engine is likely incorrect or unstable.

**How to measure.**
- Run the same backtest with increasing `fee`, `tax`, `slippage` parameters.
- Compare net return and Sharpe-like metrics.

**Suggested acceptance thresholds.**
- Net return should be non-increasing as costs increase (allow tiny numerical tolerance).

### B3. Risk metric sanity and alignment
**Purpose.** Ensure reported risk metrics behave consistently and are computed on aligned series.

**Why this metric.** Risk-adjusted comparisons (Sharpe, beta) are only meaningful if return series alignment and benchmark handling are correct (Sharpe, 1964).

**How to measure.**
- Beta and tracking error must be computed on overlapping dates with the benchmark.
- Volatility and drawdown should reflect return series behavior without numeric anomalies.

**Suggested acceptance thresholds.**
- Beta computation rejects/flags insufficient overlap instead of producing arbitrary output.
- No NaN/Infinity in risk outputs for valid inputs.

### B4. Tail risk (VaR/CVaR) configuration integrity
**Purpose.** Ensure tail metrics are computed under explicit assumptions and return plausible outputs.

**Why this metric.** CVaR is a coherent tail-risk measure and supports convex optimization, but it is sensitive to sample quality and horizon (Rockafellar & Uryasev, 2000).

**How to measure.**
- Fix horizon and confidence level; verify stable behavior across repeated runs.
- Validate that CVaR is at least as conservative as VaR at the same confidence (in expectation, for empirical estimates this may require tolerance).

**Suggested acceptance thresholds.**
- Metric outputs are finite and consistent under repeated runs.
- Configuration and horizon are clearly reported in responses.

## 6. Gate C: Evaluation Discipline (Backtesting Overfitting Control)

### C1. Pre-registered experiment protocol
**Purpose.** Reduce the risk that results are tuned to the evaluation dataset.

**Why this metric.** Strategy search can inflate apparent performance; overfitting risk must be controlled and reported (Bailey et al., 2016).

**How to measure.**
- Define experiment profiles (baseline vs improved) with fixed prompt/strategy sets.
- Lock thresholds and do not revise them after observing results unless explicitly documented as a new experiment version.

**Suggested acceptance thresholds.**
- An experiment run is accepted only if it follows the published protocol and produces artifacts.

### C2. Out-of-sample and walk-forward validation (recommended)
**Purpose.** Ensure the system's claims generalize beyond a single window.

**How to measure.**
- Evaluate strategies on a training window and a held-out window.
- Optionally apply walk-forward splits for robustness.

**Suggested acceptance thresholds.**
- Report both in-sample and out-of-sample results; avoid claims based only on a single window.

## 7. Gate D: Modern Finance and ML-in-Finance (Optional Extension)

This gate is required only if the system uses learned models for predictions or strategy suggestions beyond deterministic rules.

**Purpose.** Ensure ML components are evaluated against strong baselines and do not overpromise under nonstationarity.

**Why this metric.** ML can improve empirical asset pricing and ranking, but requires disciplined validation and regularization (Gu et al., 2020). Factor baselines provide interpretable comparison points (Fama & French, 1993). Efficiency arguments remind that persistent predictive structure is hard to obtain without risk/constraint explanations (Fama, 1970).

**How to measure.**
- Compare learned outputs to simple baselines (factor proxies, equal-weight, simple momentum rules).
- Report out-of-sample performance and stability across time.

**Suggested acceptance thresholds.**
- ML improvements must be consistent across splits and not limited to a single cherry-picked period.
- If ML is used only for ranking or suggestions, the assistant must still ground claims to evidence and diagnostics.

## 8. Gate E: AI Assistant Reliability Gate (Core Thesis Contribution)

### E1. Grounding pass rate
**Purpose.** Ensure the assistant uses deterministic tools for numeric claims.

**Why this metric.** Grounded generation reduces hallucination risk by conditioning on retrieved evidence (Lewis et al., 2020).

**Definition.**
- `groundingPassRate = groundedResponses / responsesRequiringGrounding`

**How to measure.**
- Use scripted evaluation suites that label prompts requiring grounding and record tool usage outcomes.

### E2. Unsupported numeric claim rate
**Purpose.** Measure hallucination-like failures for numeric outputs.

**Why this metric.** Truthfulness failures are common even in fluent responses; numeric claims must be evidence-backed (Lin et al., 2022).

**Definition.**
- `unsupportedClaimRate = unsupportedNumericClaims / totalNumericClaims`

**How to measure.**
- Decompose assistant outputs into atomic numeric claims and check whether each claim is supported by tool evidence (Min et al., 2023).

### E3. Supported claim precision and overall accuracy
**Purpose.** Ensure that when the assistant does answer with numbers, it does so correctly.

**Definitions.**
- `supportedClaimPrecision = supportedClaimsCorrect / supportedClaimsTotal`
- `overallClaimAccuracy = correctClaimsTotal / claimsTotal`

**Why these metrics.** Claim-level evaluation provides finer-grained correctness assessment than holistic scoring (Min et al., 2023).

### E4. Abstention accuracy
**Purpose.** Ensure the assistant correctly refuses when evidence is missing.

**Why this metric.** Unanswerable question handling is essential for reliability; refusing is better than guessing (Rajpurkar et al., 2018).

**Definition.**
- `abstentionAccuracy = correctAbstentions / promptsRequiringAbstention`

### E5. Citation coverage (tool-to-claim traceability)
**Purpose.** Ensure evidence is not only retrieved but also attached to outputs in a traceable form.

**Definition.**
- `citationCoverage = claimsWithCitations / claimsRequiringCitations`

**Why this metric.** The system must behave like an evidence system, not only a language system; traceability makes results auditable and debuggable.

### E6. Consistency and self-check signals (optional)
**Purpose.** Detect likely hallucination when the model is inconsistent.

**Why this metric.** Consistency-based signals can flag hallucination risk even without labels (Manakul et al., 2023).

**How to measure.**
- Sample multiple completions for the same prompt; measure disagreement rate on key claims.

**Suggested acceptance thresholds (starter).**
- `unsupportedClaimRate <= 0.15`
- `supportedClaimPrecision >= 0.85`
- `overallClaimAccuracy >= 0.70`
- `abstentionAccuracy >= 0.85`
- `groundingPassRate >= 0.70`

These are thesis starter thresholds; they must be revised only via explicit experiment versioning (Bailey et al., 2016).

## 9. Gate F: Non-Functional Requirements and Reproducibility

### F1. Latency budgets and stability
**Purpose.** Ensure the system is usable during demos and does not time out under typical use.

**How to measure.**
- Record p50/p95 latencies for key endpoints and assistant flows during smoke/QA runs.

**Suggested acceptance thresholds.**
- Establish a project-specific budget (e.g., `p95 < 2s` for light endpoints, `p95 < 10s` for backtesting on a single symbol), and document it in the evaluation report.

### F2. Reproducible runs and artifact generation
**Purpose.** Ensure every evaluation produces traceable outputs.

**How to measure.**
- Runs must generate structured artifacts (JSON + markdown summaries) for later inspection.
- Docker smoke/QA workflows should be the canonical reproduction path.

**Suggested acceptance thresholds.**
- A run is not "valid" without artifacts and a recorded configuration snapshot (datasets, backend selection, policy mode).

## 10. Reporting Template (Recommended)

Each evaluation run should publish:
- Environment summary (backend mode, manifest version, policy mode, model/provider selection).
- Data readiness report (Gate A).
- Quant engine checks summary (Gate B).
- Assistant reliability summary (Gate E) with the five primary metrics.
- Failure taxonomy (tool failures, missing data, policy blocks, numeric evidence missing).

## References

Bailey, D. H., Borwein, J. M., Lopez de Prado, M., & Zhu, Q. J. (2016). The probability of backtest overfitting. *Quantitative Finance, 16*(6), 813-825. https://doi.org/10.1080/14697688.2015.1061509

Fama, E. F. (1970). Efficient capital markets: A review of theory and empirical work. *The Journal of Finance, 25*(2), 383-417. https://doi.org/10.1111/j.1540-6261.1970.tb00518.x

Fama, E. F., & French, K. R. (1993). Common risk factors in the returns on stocks and bonds. *Journal of Financial Economics, 33*(1), 3-56. https://doi.org/10.1016/0304-405X(93)90023-5

Gu, S., Kelly, B., & Xiu, D. (2020). Empirical asset pricing via machine learning. *The Review of Financial Studies, 33*(5), 2223-2273. https://doi.org/10.1093/rfs/hhaa009

Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Kuttler, H., Lewis, M., Yih, W.-t., Rocktaschel, T., Riedel, S., & Kiela, D. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. *Advances in Neural Information Processing Systems, 33*, 9459-9474.

Lin, S., Hilton, J., & Evans, O. (2022). TruthfulQA: Measuring how models mimic human falsehoods. In *Proceedings of the 60th Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)* (pp. 3214-3252). Association for Computational Linguistics. https://doi.org/10.18653/v1/2022.acl-long.229

Manakul, P., Liusie, A., & Gales, M. (2023). SelfCheckGPT: Zero-resource black-box hallucination detection for generative large language models. In *Proceedings of the 2023 Conference on Empirical Methods in Natural Language Processing* (pp. 9004-9017). Association for Computational Linguistics. https://doi.org/10.18653/v1/2023.emnlp-main.557

Markowitz, H. (1952). Portfolio selection. *The Journal of Finance, 7*(1), 77-91. https://doi.org/10.1111/j.1540-6261.1952.tb01525.x

Min, S., Krishna, K., Lyu, X., Lewis, M., Yih, W.-t., Koh, P. W., Iyyer, M., Callison-Burch, C., Hajishirzi, H., & Zettlemoyer, L. (2023). FActScore: Fine-grained atomic evaluation of factual precision in long form text generation. In *Proceedings of the 2023 Conference on Empirical Methods in Natural Language Processing* (pp. 12076-12100). Association for Computational Linguistics. https://doi.org/10.18653/v1/2023.emnlp-main.741

Rajpurkar, P., Jia, R., & Liang, P. (2018). Know what you do not know: Unanswerable questions for SQuAD. In *Proceedings of the 56th Annual Meeting of the Association for Computational Linguistics (Volume 2: Short Papers)* (pp. 784-789). Association for Computational Linguistics. https://doi.org/10.18653/v1/P18-2124

Rockafellar, R. T., & Uryasev, S. (2000). Optimization of conditional value-at-risk. *The Journal of Risk, 2*(3), 21-41. https://doi.org/10.21314/JOR.2000.038

Sharpe, W. F. (1964). Capital asset prices: A theory of market equilibrium under conditions of risk. *The Journal of Finance, 19*(3), 425-442. https://doi.org/10.1111/j.1540-6261.1964.tb02865.x


