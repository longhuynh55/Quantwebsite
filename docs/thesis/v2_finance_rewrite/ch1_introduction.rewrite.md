# 1. Introduction

## 1.1 Background and Motivation
The Vietnamese securities market has grown rapidly over the past decade. By 2024, trading accounts reached 9.2 million — surpassing the government's 2025 target — with retail investors accounting for over 80 per cent of daily trading volume on the Ho Chi Minh Stock Exchange (HOSE) (FiinPro, 2024). Vietnam's fintech market, valued at approximately USD 16.9 billion in 2024, is projected to reach USD 62.7 billion by 2033, supported by high smartphone penetration (84 per cent) and a digitally engaged population (IMARC Group, 2024).

Despite this growth, Vietnamese retail investors still lack access to proper quantitative analysis tools. International platforms like TradingView offer advanced charting but do not fully support HOSE-specific data or Vietnamese market conventions (TradingView, n.d.). None of the major international algorithmic trading platforms support HOSE at all. On the domestic side, brokerage platforms from TCBS, SSI iBoard, and VNDirect provide charting and order execution, but none of them offer strategy backtesting, portfolio optimisation, factor analysis, or risk measurement at the retail level (TCBS, n.d.; SSI, n.d.).

In practice, this means that quantitative finance methods — now standard in developed markets — remain out of reach for most Vietnamese investors. They trade actively, but without systematic tools to rigorously test investment ideas before putting capital at risk.

At the same time, large language models (LLMs) offer an opportunity to make quantitative analysis more approachable through conversational AI. The catch is that LLMs tend to hallucinate — they can produce fluent but factually wrong outputs (Lin et al., 2022). In finance, this is dangerous: a user might act on fabricated statistics. Retrieval-augmented generation (RAG) reduces this risk by anchoring model responses in retrieved evidence (Lewis et al., 2020), though this only works well when the underlying data is structured and validated.

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
The platform targets daily-frequency Vietnamese equity analysis on HOSE, covering 412 listed stocks with historical data from 2018 to 2025. The scope is decision support and financial education — the system does not implement brokerage integration, automated order routing, or real-time execution. The AI assistant requires an external LLM provider; the thesis evaluates the effectiveness of tool-grounding and policy enforcement rather than model training.

## 1.5 Contributions
This thesis makes three contributions:
1. An **integrated quantitative analysis platform** for Vietnamese equities — covering stock screening, strategy backtesting, portfolio optimisation, risk management, and factor analysis — that fills a gap in the Vietnamese fintech landscape
2. An **AI assistant with tool-grounding** that generates explanations based on the platform's own computations, and can decline to answer when supporting evidence is not available
3. An **educational hub** connecting quantitative finance theory to the practical tools available on the platform, aimed at Vietnamese retail investors

## 1.6 Thesis Structure
**Chapter 2** reviews the theoretical foundations in quantitative finance, backtesting methodology, and AI-assisted financial analysis, and formulates the research hypotheses. **Chapter 3** presents the research methodology, including data collection and the quantitative methods employed. **Chapter 4** describes the system design, demonstrates the implemented features, and discusses results. **Chapter 5** concludes with limitations and future directions.
