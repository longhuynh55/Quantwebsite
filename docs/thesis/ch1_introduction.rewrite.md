# 1. Introduction

## 1.1 Background and Motivation
The Vietnamese securities market has experienced remarkable growth over the past decade. By 2024, the number of trading accounts reached 9.2 million, surpassing the government's 2025 target, with retail investors accounting for over 80 per cent of daily trading volume on the Ho Chi Minh Stock Exchange (HOSE) (FiinPro, 2024). Vietnam's fintech market, valued at approximately USD 16.9 billion in 2024, is projected to reach USD 62.7 billion by 2033, driven by a young, tech-savvy population and 84 per cent smartphone penetration (TechSci Research, 2024).

Despite this growth, Vietnamese retail investors face a significant gap in accessible quantitative analysis tools. International platforms such as TradingView offer advanced charting capabilities but lack comprehensive support for HOSE-specific data and Vietnamese market conventions (TradingView, n.d.). Major international algorithmic trading platforms do not support HOSE. Domestic brokerage platforms — TCBS, SSI iBoard, VNDirect — provide charting and order execution but do not offer strategy backtesting, portfolio optimisation, factor analysis, or risk measurement tools accessible to individual investors (TCBS, n.d.; SSI, n.d.).

This gap implies that quantitative finance methods — which have become standard practice in developed markets — remain largely inaccessible to the majority of Vietnamese investors. Retail investors participate actively in the market; however, they generally lack systematic tools for rigorous quantitative evaluation of investment hypotheses prior to capital allocation.

Meanwhile, the emergence of large language models (LLMs) presents an opportunity to make quantitative analysis more accessible through conversational AI assistance. However, LLMs are prone to hallucination — generating plausible but factually incorrect statements (Lin et al., 2022) — which is particularly dangerous in financial contexts where users may act on fabricated statistics. Retrieval-augmented generation (RAG) mitigates this risk by grounding model outputs in retrieved evidence (Lewis et al., 2020), but effective grounding requires structured, validated data sources.

## 1.2 Objectives
This thesis designs, implements, and evaluates **QuantVN Strategy Forge**, a web-based quantitative analysis platform for Vietnamese equities that enables retail investors and finance students to:
- Screen stocks using technical indicators and fundamental metrics
- Design, backtest, and compare trading strategies with realistic assumptions
- Optimise portfolios and analyse risk using established quantitative methods
- Receive AI-assisted explanations of quantitative results grounded in actual computed evidence
- Learn quantitative finance concepts through an integrated educational hub

## 1.3 Research Questions

| # | Research Question |
|---|------------------|
| RQ1 | How can a web platform be designed to provide accessible quantitative analysis tools for Vietnamese retail investors on HOSE? |
| RQ2 | How effective is the platform at enabling users to design, backtest, and evaluate trading strategies with transparent assumptions? |
| RQ3 | Can an AI assistant provide reliable, evidence-grounded explanations of quantitative results without fabricating unsupported claims? |

## 1.4 Scope and Assumptions
The platform targets daily-frequency Vietnamese equity analysis on HOSE, covering approximately 500 listed stocks with historical data from 2018 to 2025. The scope is decision support and financial education — the system does not implement brokerage integration, automated order routing, or real-time execution. The AI assistant requires an external LLM provider; the thesis evaluates the effectiveness of tool-grounding and policy enforcement rather than model training.

## 1.5 Contributions
This thesis makes three contributions:
1. An **integrated quantitative analysis platform** for Vietnamese equities covering stock screening, strategy backtesting, portfolio optimisation, risk management, and factor analysis — filling a gap in the Vietnamese fintech landscape
2. An **AI assistant with tool-grounding** that explains quantitative results using evidence from the platform's own computations, with mechanisms to decline answering when supporting evidence is insufficient
3. An **educational hub** that bridges theoretical quantitative finance knowledge to practical tool usage for Vietnamese retail investors

## 1.6 Thesis Structure
**Chapter 2** reviews the theoretical foundations in quantitative finance, backtesting methodology, and AI-assisted financial analysis. **Chapter 3** presents the research methodology, including data collection and the quantitative methods employed. **Chapter 4** describes the system design, demonstrates the implemented features, and discusses results. **Chapter 5** concludes with limitations and future directions.
