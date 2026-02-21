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
