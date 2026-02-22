# Reference Registry

## Purpose
Central log for all external references (papers, products, docs, standards) used in product design, evaluation, and implementation decisions.

## Rule (Mandatory)
- Any new external reference link used in docs, PRs, or feature proposals must be added here.
- Each entry must include: `date`, `type`, `title`, `url`, `used_in`, and `reason`.

## Entries

### 2026-02-14

1. `type`: paper  
   `title`: TruthfulQA: Measuring How Models Mimic Human Falsehoods  
   `url`: https://arxiv.org/abs/2109.07958  
   `used_in`: `docs/ASSISTANT_EVAL_CRITERIA.md`, `docs/finance-ai-agent-roadmap.md`  
   `reason`: Truthfulness-oriented hallucination benchmark.

2. `type`: paper  
   `title`: SelfCheckGPT: Zero-Resource Black-Box Hallucination Detection for Generative LLMs  
   `url`: https://arxiv.org/abs/2303.08896  
   `used_in`: `docs/ASSISTANT_EVAL_CRITERIA.md`, `docs/finance-ai-agent-roadmap.md`  
   `reason`: Consistency-based hallucination detection principle.

3. `type`: paper  
   `title`: FActScore: Fine-grained Atomic Evaluation of Factual Precision in Long Form Text Generation  
   `url`: https://arxiv.org/abs/2305.14251  
   `used_in`: `docs/ASSISTANT_EVAL_CRITERIA.md`, `docs/finance-ai-agent-roadmap.md`  
   `reason`: Atomic claim grounding metrics.

4. `type`: paper  
   `title`: SQuAD 2.0 (unanswerable question / abstention principle)  
   `url`: https://arxiv.org/abs/1806.03822  
   `used_in`: `docs/ASSISTANT_EVAL_CRITERIA.md`, `docs/finance-ai-agent-roadmap.md`  
   `reason`: Abstention quality when evidence is insufficient.

5. `type`: paper  
   `title`: BloombergGPT: A Large Language Model for Finance  
   `url`: https://arxiv.org/abs/2303.17564  
   `used_in`: `docs/finance-ai-agent-roadmap.md`  
   `reason`: Domain-specialized finance LLM reference for capability direction.

6. `type`: paper  
   `title`: FinGPT: Open-Source Financial LLM  
   `url`: https://arxiv.org/abs/2306.06031  
   `used_in`: `docs/finance-ai-agent-roadmap.md`  
   `reason`: Practical finance-agent architecture and tasks.

7. `type`: product  
   `title`: AlphaSense Generative Search (API/assistant with citations)  
   `url`: https://developer.alpha-sense.com/api/getting-started/embedded-widgets/generative-search  
   `used_in`: `docs/finance-ai-agent-roadmap.md`  
   `reason`: Product benchmark for grounded answer UX with source links.

8. `type`: product  
   `title`: S&P Global - Visible Alpha  
   `url`: https://www.spglobal.com/market-intelligence/en/solutions/visible-alpha  
   `used_in`: `docs/finance-ai-agent-roadmap.md`  
   `reason`: Financial modeling and analyst workflow benchmark.

9. `type`: product  
   `title`: Bloomberg Office Tools (Excel integration)  
   `url`: https://www.bloomberg.com/faq/question/i-cannot-find-my-office-tools-add-in-how-can-i-get-it-back/  
   `used_in`: `docs/finance-ai-agent-roadmap.md`  
   `reason`: Excel-first delivery benchmark for institutional users.

### 2026-02-21

1. `type`: paper  
   `title`: Efficient capital markets: A review of theory and empirical work  
   `url`: https://doi.org/10.1111/j.1540-6261.1970.tb00518.x  
   `used_in`: `docs/thesis/ch1_introduction.md`, `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Traditional finance baseline (market efficiency) used to motivate evaluation and reliability assumptions.

2. `type`: paper  
   `title`: Common risk factors in the returns on stocks and bonds  
   `url`: https://doi.org/10.1016/0304-405X(93)90023-5  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Empirical factor model baseline used to bridge traditional and modern quantitative finance.

3. `type`: paper  
   `title`: The probability of backtest overfitting  
   `url`: https://doi.org/10.1080/14697688.2015.1061509  
   `used_in`: `docs/thesis/ch1_introduction.md`, `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Backtesting reliability reference used to motivate evaluation gates and disciplined validation.

4. `type`: paper  
   `title`: Empirical asset pricing via machine learning  
   `url`: https://doi.org/10.1093/rfs/hhaa009  
   `used_in`: `docs/thesis/ch1_introduction.md`, `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Modern ML-in-finance reference used to motivate high-dimensional modeling under strict validation.
### 2026-02-22

1. `type`: paper  
   `title`: A five-factor asset pricing model  
   `url`: https://doi.org/10.1016/j.jfineco.2014.10.010  
   `used_in`: `docs/thesis/ch1_introduction.md`, `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Empirical factor model extension used to motivate factor-aware analytics and sample-conditional interpretation.

2. `type`: book  
   `title`: The Elements of Statistical Learning (2nd ed.)  
   `url`: https://doi.org/10.1007/978-0-387-84858-7  
   `used_in`: `docs/thesis/ch1_introduction.md`, `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Generalization and validation principles used to justify evaluation discipline for high-capacity models and pipelines.

3. `type`: paper  
   `title`: Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks  
   `url`: https://arxiv.org/abs/2005.11401  
   `used_in`: `docs/thesis/ch1_introduction.md`, `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Grounding architecture framing (RAG) used to motivate tool-grounded assistant design.

4. `type`: paper  
   `title`: BloombergGPT: A large language model for finance  
   `url`: https://arxiv.org/abs/2303.17564  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Domain-specialized finance LLM reference for capability context.

5. `type`: paper  
   `title`: FinGPT: Open-source financial large language models  
   `url`: https://arxiv.org/abs/2306.06031  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Open-source finance LLM reference for assistant capability context.
6. `type`: paper  
   `title`: Simple technical trading rules and the stochastic properties of stock returns  
   `url`: https://doi.org/10.1111/j.1540-6261.1992.tb04681.x  
   `used_in`: `docs/thesis/ch1_introduction.md`, `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Technical-analysis evidence baseline used to justify conservative backtesting assumptions and diagnostics.

7. `type`: paper  
   `title`: Foundations of technical analysis: Computational algorithms, statistical inference, and empirical implementation  
   `url`: https://doi.org/10.1111/0022-1082.00265  
   `used_in`: `docs/thesis/ch1_introduction.md`, `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Technical-analysis inference framing used to position indicator-based strategies as hypotheses requiring evaluation.

8. `type`: paper  
   `title`: Returns to buying winners and selling losers: Implications for stock market efficiency  
   `url`: https://doi.org/10.1111/j.1540-6261.1993.tb04702.x  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Momentum anomaly reference used to motivate momentum-style strategies and cautious interpretation.

9. `type`: paper  
   `title`: On persistence in mutual fund performance  
   `url`: https://doi.org/10.1111/j.1540-6261.1997.tb03808.x  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Performance persistence/factor adjustment reference used to connect anomalies to evaluation.

10. `type`: paper  
   `title`: A reality check for data snooping  
   `url`: https://doi.org/10.1111/1468-0262.00152  
   `used_in`: `docs/thesis/ch1_introduction.md`, `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Data-snooping framing used to justify multiple-testing awareness and gate-based evaluation.

11. `type`: paper  
   `title`: A test for superior predictive ability  
   `url`: https://doi.org/10.1198/073500105000000063  
   `used_in`: `docs/thesis/ch1_introduction.md`, `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Comparative predictive ability testing reference used to motivate robust evaluation under selection.

12. `type`: paper  
   `title`: ...and the cross-section of expected returns  
   `url`: https://doi.org/10.1093/rfs/hhv059  
   `used_in`: `docs/thesis/ch1_introduction.md`, `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Multiple-testing / factor-mining reference used to motivate sceptical interpretation of discovered patterns.

13. `type`: paper  
   `title`: Characteristics are covariances: A unified model of risk and return  
   `url`: https://doi.org/10.1016/j.jfineco.2019.05.001  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Modern ML-adjacent factor-structure reference used to motivate high-dimensional modelling discipline.

14. `type`: paper  
   `title`: ReAct: Synergizing reasoning and acting in language models  
   `url`: https://doi.org/10.48550/arXiv.2210.03629  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Tool-using agent framing used to justify planner-and-tools assistant architecture.

15. `type`: paper  
   `title`: Toolformer: Language models can teach themselves to use tools  
   `url`: https://doi.org/10.48550/arXiv.2302.04761  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Tool-use learning framing used to motivate tool invocation as a reliability-critical interface.

16. `type`: paper  
   `title`: RAGAS: Automated evaluation of retrieval augmented generation  
   `url`: https://doi.org/10.48550/arXiv.2309.15217  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: RAG evaluation reference used to motivate measuring grounding pipelines rather than assuming quality.

17. `type`: paper  
   `title`: Survivorship bias in performance studies  
   `url`: https://doi.org/10.1093/rfs/5.4.553  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Data integrity baseline; motivates explicit universe definitions and survivorship-aware interpretation.

18. `type`: paper  
   `title`: Data-snooping, technical trading rule performance, and the bootstrap  
   `url`: https://doi.org/10.1111/0022-1082.00163  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Technical-rule data-snooping reference; motivates cautious interpretation under repeated search.

19. `type`: paper  
   `title`: Coherent measures of risk  
   `url`: https://doi.org/10.1111/1467-9965.00068  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Risk-measure axioms baseline; motivates coherent tail-risk reporting and interpretability constraints.

20. `type`: paper  
   `title`: Optimal execution of portfolio transactions  
   `url`: https://doi.org/10.21314/JOR.2001.041  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Execution and transaction-cost modelling reference; motivates making execution assumptions explicit.

21. `type`: paper  
   `title`: The statistics of Sharpe ratios  
   `url`: https://doi.org/10.2469/faj.v58.n4.2453  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Sampling-uncertainty reference; motivates avoiding overconfident performance ranking.

22. `type`: paper  
   `title`: Presidential address: Discount rates  
   `url`: https://doi.org/10.1111/j.1540-6261.2011.01671.x  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Conditional-interpretation framing; supports discount-rate variation lens for factor narratives.

23. `type`: paper  
   `title`: Does academic research destroy stock return predictability?  
   `url`: https://doi.org/10.1111/jofi.12365  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: Post-publication decay evidence; motivates monitoring and re-evaluation rather than static claims.

24. `type`: paper  
   `title`: Deep learning with long short-term memory networks for financial market predictions  
   `url`: https://doi.org/10.1016/j.ejor.2017.11.054  
   `used_in`: `docs/thesis/ch2_literature_review.md`, `docs/thesis/references_apa.md`  
   `reason`: ML-in-finance capability context; motivates stricter baselines and validation for complex models.
