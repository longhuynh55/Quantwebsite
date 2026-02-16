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
