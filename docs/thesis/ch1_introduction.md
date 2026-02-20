# Chapter 1: Introduction

## 1.1 Background
Financial analysis workflows in Vietnam often require manual retrieval of market, fundamentals, and risk data from multiple sources. This process is slow and error-prone for students and early-career analysts. A finance copilot can reduce friction, but large language models may produce fluent yet unsupported numeric claims if not grounded by verifiable data (Lin et al., 2022; Min et al., 2023).

## 1.2 Problem Statement
The central challenge is to build a copilot that is useful in conversational analysis while maintaining strict factual reliability for financial numbers. In this thesis, reliability means the assistant either:
- returns evidence-backed values from internal tools, or
- abstains/falls back when evidence is insufficient.

## 1.3 Research Objectives
- Design a robust, tool-grounded assistant for Vietnamese equities.
- Reduce hallucination risk in numeric answers.
- Quantify reliability with reproducible evaluation metrics.
- Demonstrate engineering feasibility within a graduation project timeline.

## 1.4 Research Questions
- RQ1: Can a policy-gated grounding pipeline lower unsupported numeric claims?
- RQ2: What trade-off appears between strict robustness and response coverage?
- RQ3: Which metrics are most informative for accuracy and hallucination control?

## 1.5 Scope and Assumptions
- Scope: HOSE-focused analysis, local CSV/DuckDB datasets, conversational decision support.
- Assumptions: data pipeline is refreshed before evaluation runs; assistant output is not investment advice.
- Exclusions: real-time order execution, brokerage integration, and macroeconomic forecasting.

## 1.6 Contributions
- A practical architecture for grounded financial Q&A.
- A policy framework that enforces fallback on low-evidence scenarios.
- A five-metric reliability gate for thesis evaluation.
- A two-week implementation plan balancing product and research outcomes.

## 1.7 Chapter Summary
This chapter defines the motivation, objectives, and scope. Chapter 2 reviews prior work in quantitative finance and language-model factuality, then derives the methodological choices for this thesis.
