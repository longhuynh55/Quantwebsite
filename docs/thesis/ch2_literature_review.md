# Chapter 2: Literature Review and Theoretical Background

## 2.1 Quantitative Finance Foundations
Mean-variance theory formalizes portfolio construction as a trade-off between expected return and variance (Markowitz, 1952). Capital Asset Pricing Model concepts then connect expected returns to systematic risk via beta (Sharpe, 1964). For downside-focused risk control, Conditional Value at Risk (CVaR) captures tail loss more effectively than variance-only measures in many settings (Rockafellar & Uryasev, 2000).

## 2.2 Hallucination and Reliability in LLM Systems
Truthfulness benchmarks show that strong language fluency does not guarantee factual correctness (Lin et al., 2022). Claim-level evaluation frameworks highlight the need to score atomic factual units instead of only overall answer quality (Min et al., 2023). Self-consistency style checks and black-box methods can detect potential hallucinations without fine-tuned labels (Manakul et al., 2023). Abstention behavior is also essential when user questions are unanswerable from available evidence (Rajpurkar et al., 2018).

## 2.3 Grounded Generation and Retrieval
Retrieval-augmented generation (RAG) connects responses to external evidence and generally improves factuality in knowledge-intensive tasks (Lewis et al., 2020). In a finance assistant context, retrieval is implemented through deterministic internal tools and APIs instead of open-web search, which improves reproducibility and auditability.

## 2.4 Research Gap
Most generic LLM applications optimize convenience first and robustness second. For financial numeric outputs, this ordering is risky. The identified gap is a practical architecture that combines:
- strict grounding requirements for numeric claims,
- explicit fallback/abstention policies,
- quantitative acceptance gates suitable for product and thesis evaluation.

## 2.5 Chapter Summary
The reviewed literature supports a design where retrieval grounding, abstention, and claim-level evaluation are mandatory. Chapter 3 translates these principles into system architecture, policy logic, and measurable metrics.
