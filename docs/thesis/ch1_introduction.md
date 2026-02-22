# Chapter 1: Introduction

Thesis title: QuantVN Strategy Forge: A Reliability-Gated AI Assistant for Trading Strategy Design and Backtesting on Vietnamese Equities (HOSE)

## 1.1 Background and Motivation
Quantitative finance provides a principled vocabulary for connecting market data to decision-making under uncertainty. In classical portfolio theory, portfolio selection is framed as an optimisation problem over risk and return, where diversification and the covariance structure determine the efficient frontier (Markowitz, 1952). Equilibrium asset pricing then motivates risk-adjusted evaluation by linking expected returns to systematic exposure, providing a benchmark for comparing assets and strategies beyond raw performance (Sharpe, 1964). Empirical finance adds a further constraint through the efficient market hypothesis, which argues that prices incorporate available information such that persistent statistical advantages should be difficult to exploit without bearing risk premia or leveraging frictions and constraints (Fama, 1970).

These foundations remain central to practice, but they become fragile when the supporting data infrastructure is weak or when evaluation discipline is informal. Quantitative workflows rely on derived statistics that amplify upstream errors: return series must be aligned across symbols and benchmarks; coverage windows must be comparable; and estimation must be stable enough to support ranking, optimisation, and risk attribution. In portfolio optimisation, small differences in estimated inputs can induce large changes in weights when the covariance matrix is ill-conditioned, motivating robust data validation and transparent diagnostics (Markowitz, 1952). In risk analysis, the interpretability of volatility- and beta-based metrics depends on consistent sampling windows and clean return construction (Sharpe, 1964). In factor and cross-sectional analysis, outputs are conditional on universe definitions, overlap windows, and survivorship considerations (Fama & French, 1993; Fama & French, 2015).

Risk measurement provides a concrete illustration of why integrity constraints should be treated as first-class requirements. Variance captures symmetric dispersion, but it can underrepresent adverse outcomes in heavy-tailed return distributions. Tail-oriented measures such as Conditional Value at Risk (CVaR, also called expected shortfall) address this limitation and admit convex formulations that are attractive in practical systems, but they also increase sensitivity to sampling windows and missingness (Rockafellar & Uryasev, 2000). A reliability-conscious platform should therefore either enforce stable preconditions for tail metrics (for example, minimum history and consistent calendars) or communicate limitations explicitly through diagnostics.

### 1.1.1 Strategy Design as a Search Problem
In applied quantitative finance, strategy development is often a search process over model families, parameter grids, assets, and time windows. This search creates a reliability risk: even if each individual backtest implementation is internally correct, repeated experimentation can produce apparently strong strategies that are in fact overfit to historical noise. The probability of backtest overfitting increases with the size of the search space and the degrees of freedom in the research process (Bailey et al., 2016). Related concerns arise under multiple testing and factor mining, where many candidate predictors are evaluated and only the winners are reported (Harvey et al., 2016).

Consequently, a quantitative platform should not treat backtest outputs as self-validating evidence. Instead, it should enforce conservative execution assumptions, incorporate transaction frictions, and provide diagnostics that highlight fragility. Classic work in empirical finance and technical analysis also shows that simple rules can appear profitable in-sample under particular choices of data and assumptions (Brock et al., 1992; Lo et al., 2000). In a product setting, these findings reinforce that backtests should be reported with explicit assumptions and with guardrails that help users distinguish evidence from artefact.

### 1.1.2 From Traditional Analytics to ML in Finance
Modern ML methods extend empirical finance by combining many features and nonlinear interactions under regularisation and careful evaluation. In asset pricing contexts, ML models can extract predictive structure from high-dimensional characteristic sets, supporting cross-sectional ranking and forecasting under disciplined validation (Gu et al., 2020). However, ML research and statistical learning theory both emphasise that high-capacity models can overfit without careful control of complexity and robust evaluation procedures (Hastie et al., 2009). For a thesis-scale product, the implication is not that an ML model must be the core novelty, but that evaluation discipline must be engineered: outputs should be produced under explicit preconditions and measured against repeatable acceptance criteria.

### 1.1.3 Conversational Interfaces and the Reliability Problem
User expectations for analytic systems are shifting toward interactive and conversational interfaces. Large language models can help users express analysis intent and interpret results, but fluency is not evidence. Truthfulness evaluations show that models can produce confident but unsupported claims, and that scale alone does not guarantee factual reliability (Lin et al., 2022). In numerically dense domains such as finance, this risk is amplified because responses frequently contain numbers, comparisons, and implied recommendations.

Claim-level evaluation frameworks therefore motivate a stricter standard: responses should be assessed and produced as collections of atomic claims, each of which should be supported by evidence (Min et al., 2023). When evidence is missing, abstention becomes a first-class requirement, as demonstrated in question answering benchmarks that explicitly test unanswerable cases (Rajpurkar et al., 2018). Hallucination detection work further motivates evaluating consistency and contradiction under sampling-based checks (Manakul et al., 2023). In a product context, these findings point toward an engineering approach: restrict numeric claims to tool-grounded evidence and treat abstention as a safety feature.

Retrieval-augmented generation (RAG) provides a general architecture for grounding generation in retrieved context (Lewis et al., 2020). In a reliability-critical finance product, retrieved context can be the platform's own deterministic tool outputs rather than open-web snippets. This tool-grounded framing improves auditability and reproducibility because numeric claims can be traced to specific internal endpoints and dataset snapshots.

## 1.2 Context and Practical Setting
This thesis targets Vietnamese equities on the Ho Chi Minh City Stock Exchange (HOSE) at daily frequency. From a product perspective, the user problem is end-to-end: analysts and retail investors need coherent workflows for screening, charting, backtesting, portfolio and risk analysis, and factor diagnostics. From a systems perspective, the reliability of these workflows depends on the interaction between data preparation, runtime validation, conservative evaluation assumptions, and user interpretation.

QuantVN Strategy Forge is implemented as a web-based platform that co-locates interactive pages with HTTP APIs, allowing UI-to-API contracts to evolve together. User-facing workflows include screening, charting, backtesting, portfolio optimisation, risk and factor analysis, and a strategy builder. Quantitative kernels are implemented as deterministic TypeScript modules, and the assistant layer is implemented as a reliability-gated orchestration flow that can abstain when evidence is insufficient.

The committee context (fintech) motivates an additional focus: data discussion is treated primarily as an operational contract rather than as a modelling contribution. Prepared datasets, integrity manifests, and loader-level quality gates define when numeric outputs may be produced. This framing aligns with the conditional nature of finance metrics: risk-return quantities are meaningful only when their input assumptions are satisfied (Markowitz, 1952; Sharpe, 1964; Rockafellar & Uryasev, 2000).

## 1.3 Problem Statement
This thesis addresses the problem of building and evaluating a reliability-critical quantitative finance platform for Vietnamese equities, where numeric outputs are produced only when their evidentiary basis is verifiable.

The platform must provide standard analytical capabilities over local datasets, including screening, charting, backtesting, portfolio optimisation, factor analysis, and risk reporting. It must surface diagnostics that explain when and why results are limited by data quality, coverage, or alignment constraints.

On top of these deterministic services, an assistant interface must enable conversational queries without introducing numeric hallucinations. The assistant should be permitted to produce numeric claims only when internal tools return sufficient evidence; otherwise it must abstain and provide actionable diagnostics. This requirement is motivated by truthfulness and claim-level evaluation work showing that fluent generation can be misleading when evidence is absent (Lin et al., 2022; Min et al., 2023), and by unanswerability principles indicating that abstention can be safer than guessing (Rajpurkar et al., 2018).

The problem is therefore end-to-end. Reliability depends on data preparation, runtime validation, time-series alignment, and conservative evaluation assumptions in backtesting and optimisation. It also depends on a grounded generation pipeline that plans evidence needs, retrieves structured facts from internal endpoints, and enforces policy constraints that block unsupported numeric statements (Lewis et al., 2020).

## 1.4 Research Gap and Rationale
The literature suggests that quantitative systems can fail in ways that are not visible in a single headline metric. Backtests can appear convincing while being overfit to historical noise due to repeated experimentation and selection, motivating disciplined evaluation and transparency (Bailey et al., 2016). Multiple-testing concerns further motivate scepticism about apparently strong patterns discovered through large-scale exploration (Harvey et al., 2016). ML systems can capture nonlinear structure in high-dimensional data but can degrade under nonstationarity without careful validation and monitoring (Gu et al., 2020; Hastie et al., 2009). Meanwhile, LLM-based assistants can improve usability but can also generate unsupported claims; reliability therefore requires grounding and evaluation at the level of atomic claims (Lin et al., 2022; Min et al., 2023).

In a fintech product setting, these observations motivate a design rationale: reliability should be operationalised as explicit gates and measurable criteria that connect system design to evaluation. In this thesis, that means:

1. Enforcing data readiness constraints before computing outputs.
2. Constraining backtesting assumptions (execution timing and frictions) to reduce optimistic bias.
3. Implementing a grounded assistant with policy gating and abstention that can be evaluated with reproducible scripts.

QuantVN Strategy Forge is presented as a response to these gaps. Instead of positioning the assistant as an unconstrained generator, the system uses deterministic tools and policy gating as a default. Instead of treating data preparation as external to the product, the system makes data readiness observable and enforces quality constraints prior to computation.

## 1.5 Research Objectives
The thesis pursues four objectives.

1. Design and implement a web-based quantitative analysis system for Vietnamese equities that consolidates core workflows into a coherent product.
2. Enforce data reliability through validation, integrity manifests, and runtime quality reporting so that analytics are stable and exclusions are transparent.
3. Implement an assistant interface that routes queries through deterministic internal tools and applies evidence-gated policies for numeric outputs, including abstention when evidence is insufficient.
4. Define and apply reproducible evaluation procedures and metrics so reliability improvements can be measured and regressions can be detected.

## 1.6 Research Questions
This thesis is organised around five research questions.

RQ1 (Data reliability). How can a local market-data pipeline and runtime validation layer reduce instability in downstream quantitative analytics that depend on aligned time series and robust estimators?

RQ2 (Diagnostics and transparency). Which diagnostics and exclusion policies best communicate data readiness and limitations to end users while preserving analytical usefulness?

RQ3 (Grounded assistant). To what extent does a tool-grounded assistant pipeline with policy gating reduce unsupported numeric claims compared to unguided generation, as motivated by truthfulness and claim-level evaluation work (Lin et al., 2022; Min et al., 2023)?

RQ4 (Abstention vs coverage). What trade-off emerges between strict abstention policies (refusing low-evidence answers) and response coverage, and how does this trade-off affect perceived trustworthiness (Rajpurkar et al., 2018)?

RQ5 (Operational evaluation). Which evaluation metrics and acceptance gates provide the most actionable operational definition of reliability for iterative engineering under model/provider variability and dataset changes, in a way that resists backtest overfitting incentives (Bailey et al., 2016; Harvey et al., 2016) and aligns with tool-grounded generation principles (Lewis et al., 2020)?

### 1.6.1 Research Hypotheses
To complement the research questions, this thesis formulates five testable hypotheses. The hypotheses are stated at the system-behaviour level, because the thesis contribution is an engineering system whose reliability properties can be measured through reproducible gates.

H1 (Data reliability). A local preparation pipeline combined with runtime manifest and quality gates will reduce data-induced instability in downstream analytics by failing fast or returning explicit diagnostics when inputs violate basic integrity constraints (Markowitz, 1952; Sharpe, 1964). Evidence will be collected through data readiness probes and dataset quality reports (Gate A/B).

H2 (Diagnostics and transparency). Diagnostics-first outputs (coverage ratios, gap diagnostics, and explicit exclusion reasons) will reduce the risk of silent failure in strategy evaluation and cross-sectional analytics by making limitations observable at the point of use, rather than as hidden logs. Evidence will be collected by verifying that key endpoints return completeness-critical diagnostics under both nominal and degraded data conditions (Gate C) and by inspecting exported artifacts.

H3 (Grounded assistant). A tool-grounded assistant pipeline with policy gating will reduce the rate of unsupported numeric claims relative to unguided generation or non-enforced modes, as measured by `unsupportedClaimRate` and claim-level precision metrics derived from grounded evidence checks (Lewis et al., 2020; Lin et al., 2022; Min et al., 2023). Evidence will be collected by running the assistant evaluation suites under comparable prompts and configurations (Gate E).

H4 (Abstention vs coverage). Stricter enforcement of evidence sufficiency (policy modes that block under-evidenced numeric outputs) will increase abstention correctness (`abstentionAccuracy`) while reducing response coverage on ambiguous or low-evidence cases, making the trade-off measurable rather than anecdotal (Rajpurkar et al., 2018; Lin et al., 2022). Evidence will be collected by comparing evaluation runs across policy modes and reporting both abstention accuracy and coverage-related diagnostics (Gate E).

H5 (Operational evaluation). Scriptable acceptance gates with machine-readable artifacts will detect regressions and instability under iterative development and provider variability more reliably than ad hoc manual testing, thereby providing an actionable operational definition of reliability for the project lifecycle (Bailey et al., 2016; Harvey et al., 2016). Evidence will be collected via multi-suite stability and drift-style evaluation runs with archived artifacts (Gate 0 and Gate F).

## 1.7 Methodological Overview
This thesis follows an engineering-research methodology in which system behaviour is made measurable through explicit evaluation criteria.

The methodology is structured to test the hypotheses in Section 1.6.1 through reproducible gates and artifacts rather than through one-off demonstrations.

The platform is implemented as a deterministic analytics surface with a validated data contract. Strategy evaluation is operationalised through backtesting under explicit execution and transaction-friction assumptions, reflecting the backtest overfitting and optimistic-bias concerns raised in the finance literature (Bailey et al., 2016). Where appropriate, the thesis adopts evaluation concepts from the econometrics and backtesting literature that explicitly address data snooping and multiple testing, such as reality-check-style thinking (White, 2000) and superior predictive ability testing (Hansen, 2005), while acknowledging that a thesis product may implement pragmatic gates rather than full statistical testing.

For the assistant layer, the methodology is grounded generation with reliability gating. The assistant plans tool usage, executes deterministic internal tools, and applies policy constraints before any model output is returned. This design follows the RAG framing of conditioning generation on retrieved context (Lewis et al., 2020) and uses claim-level reliability objectives motivated by truthfulness benchmarks (Lin et al., 2022), atomic factuality evaluation (Min et al., 2023), hallucination checking (Manakul et al., 2023), and abstention principles (Rajpurkar et al., 2018). The thesis does not claim to solve the general problem of LLM hallucination; instead, it operationalises a product-level reliability contract for numeric finance outputs using measurable gates.

## 1.8 Scope and Assumptions
The scope of the system is HOSE-focused Vietnamese equity analysis at daily frequency using local datasets prepared into runtime CSV files, with optional DuckDB acceleration for faster querying.

The platform is designed for decision support and education; it does not implement automated order execution, brokerage integration, or real-time trading. It therefore should not be interpreted as an execution system and it does not make claims about realised trading performance.

The assistant is designed to operate over the platform's internal tools and datasets, not to search the open web. The thesis assumes that the runtime dataset preparation pipeline is executed prior to evaluation runs and that health and data readiness checks pass. Because local datasets have explicit coverage and freshness constraints, limitations in universe size and history are treated as explicit boundaries of the work.

## 1.9 Contributions
This thesis makes three contributions.

First, it provides a data reliability approach for local Vietnamese equity datasets, emphasising validation of records, integrity manifests, and runtime quality reporting that can explain missing coverage and exclusion reasons.

Second, it provides a modular quantitative analytics stack exposed through APIs and UI workflows, including backtesting, portfolio optimisation, factor analysis, and risk reporting under explicit assumptions consistent with classical finance foundations (Markowitz, 1952; Sharpe, 1964; Rockafellar & Uryasev, 2000) and modern evaluation discipline (Bailey et al., 2016).

Third, it provides a grounded assistant pipeline with policy gating and abstention behaviour that ties numeric outputs to evidence and supports claim-level evaluation, reducing hallucination risk through measurable acceptance criteria (Lewis et al., 2020; Lin et al., 2022; Min et al., 2023; Manakul et al., 2023; Rajpurkar et al., 2018).

These contributions are system contributions rather than claims of new financial theory. The originality lies in integrating quantitative workflows, data integrity constraints, and assistant reliability mechanisms into a coherent product that can be evaluated using reproducible gates.

## 1.10 Evaluation Perspective (Why Reliability is Measurable)
A system that produces numeric financial outputs is reliability-critical because users tend to operationalise those outputs. In such settings, a correct response is not simply a well-phrased narrative; it is a statement supported by evidence under explicit assumptions. For quantitative analytics, the evidence is deterministic computation over validated datasets. For the assistant, the evidence is tool-grounded facts and endpoint-scoped citations produced by deterministic internal tools.

Therefore, this thesis treats evaluation as part of the design. It defines acceptance gates for data readiness and integrity, quant engine realism and diagnostic completeness, and assistant reliability metrics such as unsupported claim rate, claim precision, and abstention accuracy. The goal is not to claim perfect correctness, but to provide an operational definition of reliability that can be rerun and audited over time.

## 1.11 Practical Significance
QuantVN Strategy Forge is positioned as a thesis-grade fintech product. Its practical significance lies in consolidating a Vietnamese equity workflow (screening, backtesting, risk, factors, portfolio comparison) into a coherent interface while making reliability explicit. The grounded assistant is designed to reduce a specific and high-impact failure mode: unsupported numeric claims.

If successful, the product can serve as a template for how AI assistants may be integrated into numerically dense decision-support systems: evidence-first, policy-gated, and evaluated by reproducible metrics rather than subjective impressions.

## 1.12 Thesis Structure
Chapter 2 reviews the theoretical foundations that motivate the system design. It begins with traditional finance (portfolio theory, asset pricing, and empirical factors), transitions to evaluation discipline and machine learning in finance, and then reviews reliability and grounding for language-model assistants. Chapter 3 presents the system design and methodology, describing the architecture, data pipeline, grounding tools, policy logic, and evaluation approach. Chapter 4 documents the implementation and experimental results, mapping features to concrete engineering artifacts and summarising evaluation outcomes using the defined reliability metrics. Chapter 5 concludes by answering the research questions, discussing limitations, and proposing future work.

## References
Bailey, D. H., Borwein, J. M., Lopez de Prado, M., & Zhu, Q. J. (2016). The probability of backtest overfitting. *Quantitative Finance, 16*(6), 813-825. https://doi.org/10.1080/14697688.2015.1061509

Brock, W., Lakonishok, J., & LeBaron, B. (1992). Simple technical trading rules and the stochastic properties of stock returns. *The Journal of Finance, 47*(5), 1731-1764. https://doi.org/10.1111/j.1540-6261.1992.tb04681.x

Fama, E. F. (1970). Efficient capital markets: A review of theory and empirical work. *The Journal of Finance, 25*(2), 383-417. https://doi.org/10.1111/j.1540-6261.1970.tb00518.x

Fama, E. F., & French, K. R. (1993). Common risk factors in the returns on stocks and bonds. *Journal of Financial Economics, 33*(1), 3-56. https://doi.org/10.1016/0304-405X(93)90023-5

Fama, E. F., & French, K. R. (2015). A five-factor asset pricing model. *Journal of Financial Economics, 116*(1), 1-22. https://doi.org/10.1016/j.jfineco.2014.10.010

Gu, S., Kelly, B., & Xiu, D. (2020). Empirical asset pricing via machine learning. *The Review of Financial Studies, 33*(5), 2223-2273. https://doi.org/10.1093/rfs/hhaa009

Hansen, P. R. (2005). A test for superior predictive ability. *Journal of Business & Economic Statistics, 23*(4), 365-380. https://doi.org/10.1198/073500105000000063

Harvey, C. R., Liu, Y., & Zhu, H. (2016). ...and the cross-section of expected returns. *The Review of Financial Studies, 29*(1), 5-68. https://doi.org/10.1093/rfs/hhv059

Hastie, T., Tibshirani, R., & Friedman, J. (2009). *The elements of statistical learning: Data mining, inference, and prediction* (2nd ed.). Springer. https://doi.org/10.1007/978-0-387-84858-7

Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Kuttler, H., Lewis, M., Yih, W.-t., Rocktaschel, T., Riedel, S., & Kiela, D. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. *Advances in Neural Information Processing Systems, 33*, 9459-9474. https://arxiv.org/abs/2005.11401

Lin, S., Hilton, J., & Evans, O. (2022). TruthfulQA: Measuring how models mimic human falsehoods. In *Proceedings of the 60th Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)* (pp. 3214-3252). Association for Computational Linguistics. https://doi.org/10.18653/v1/2022.acl-long.229

Lo, A. W., Mamaysky, H., & Wang, J. (2000). Foundations of technical analysis: Computational algorithms, statistical inference, and empirical implementation. *The Journal of Finance, 55*(4), 1705-1765. https://doi.org/10.1111/0022-1082.00265

Manakul, P., Liusie, A., & Gales, M. (2023). SelfCheckGPT: Zero-resource black-box hallucination detection for generative large language models. In *Proceedings of the 2023 Conference on Empirical Methods in Natural Language Processing* (pp. 9004-9017). Association for Computational Linguistics. https://doi.org/10.18653/v1/2023.emnlp-main.557

Markowitz, H. (1952). Portfolio selection. *The Journal of Finance, 7*(1), 77-91. https://doi.org/10.1111/j.1540-6261.1952.tb01525.x

Min, S., Krishna, K., Lyu, X., Lewis, M., Yih, W.-t., Koh, P. W., Iyyer, M., Callison-Burch, C., Hajishirzi, H., & Zettlemoyer, L. (2023). FActScore: Fine-grained atomic evaluation of factual precision in long form text generation. In *Proceedings of the 2023 Conference on Empirical Methods in Natural Language Processing* (pp. 12076-12100). Association for Computational Linguistics. https://doi.org/10.18653/v1/2023.emnlp-main.741

Rajpurkar, P., Jia, R., & Liang, P. (2018). Know what you do not know: Unanswerable questions for SQuAD. In *Proceedings of the 56th Annual Meeting of the Association for Computational Linguistics (Volume 2: Short Papers)* (pp. 784-789). Association for Computational Linguistics. https://doi.org/10.18653/v1/P18-2124

Rockafellar, R. T., & Uryasev, S. (2000). Optimization of conditional value-at-risk. *The Journal of Risk, 2*(3), 21-41. https://doi.org/10.21314/JOR.2000.038

Sharpe, W. F. (1964). Capital asset prices: A theory of market equilibrium under conditions of risk. *The Journal of Finance, 19*(3), 425-442. https://doi.org/10.1111/j.1540-6261.1964.tb02865.x

White, H. (2000). A reality check for data snooping. *Econometrica, 68*(5), 1097-1126. https://doi.org/10.1111/1468-0262.00152
