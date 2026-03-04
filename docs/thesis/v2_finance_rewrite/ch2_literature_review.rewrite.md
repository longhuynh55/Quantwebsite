# 2. Literature Review

This chapter reviews the theoretical and empirical foundations that inform the design of QuantVN Strategy Forge. The review covers quantitative finance theory, trading strategy evaluation, risk management, AI-assisted financial analysis, and the current landscape of retail investor tools.

## 2.1 Portfolio Theory and Market Efficiency
Modern Portfolio Theory (MPT), introduced by Markowitz (1952), established that investors should evaluate portfolios based on their expected return and risk (measured by variance) rather than analysing individual securities in isolation. The efficient frontier represents the set of portfolios offering maximum expected return for each level of risk. The Capital Asset Pricing Model (CAPM) extended this framework by relating expected returns to systematic risk through market beta (Sharpe, 1964; Lintner, 1965).

The Efficient Market Hypothesis (EMH) formalised three forms of market efficiency — weak, semi-strong, and strong — based on the degree to which prices reflect available information (Fama, 1970). While the EMH has been challenged by extensive evidence of market anomalies, it remains foundational for understanding why quantitative analysis tools should present results as conditional on assumptions rather than as guaranteed predictions.

For the Vietnamese market, studies on HOSE market efficiency suggest that the market exhibits characteristics of weak-form efficiency with periodic inefficiencies, particularly around information disclosure events and policy changes (Truong et al., 2010). Given these dynamics, tools that help investors evaluate strategies systematically — rather than relying on informal judgment — have clear value.

## 2.2 Factor Models and Empirical Anomalies
Beyond market beta, empirical research has identified systematic factors that explain cross-sectional return variation. The Fama-French three-factor model added size (SMB) and value (HML) as explanatory factors (Fama & French, 1993), later extended to five factors including profitability and investment (Fama & French, 2015). Momentum — the tendency of recent winners to continue outperforming — has been documented as one of the most robust anomalies (Jegadeesh & Titman, 1993).

Harvey, Liu, and Zhu (2016), however, warned that a large portion of published factors do not survive proper multiple-testing corrections. Their work is a reminder of how easily data mining can produce spurious results in quantitative finance — and why any tool that presents factor analysis should do so with appropriate caveats.

## 2.3 Trading Strategy Design and Backtesting
Technical indicators — such as moving averages (SMA, EMA), the Relative Strength Index (RSI), Moving Average Convergence Divergence (MACD), and Bollinger Bands — transform price data into signals used for systematic trading strategies. While individual indicators have limited predictive power, they provide a structured framework for strategy design that can be evaluated through backtesting (Murphy, 1999).

Backtesting — the historical simulation of trading strategies — is the primary tool for evaluating strategy ideas but is also the primary source of misleading evidence. Bailey, Borwein, López de Prado, and Zhu (2016) identified multiple sources of backtest overfitting, including look-ahead bias, survivorship bias, unrealistic cost assumptions, and selection bias from reporting only the best result among many trials. Lo (2002) argued that quantitative performance metrics can be misleading without proper context about the evaluation methodology.

These well-documented pitfalls are the reason why the backtesting engine in this thesis makes execution timing, transaction costs, and data quality assumptions visible to users by default rather than hiding them.

## 2.4 Risk Measurement
Portfolio risk assessment uses complementary measures across different dimensions. Variance-based measures (volatility, beta) capture return dispersion, while tail-risk measures — Value at Risk (VaR) and Conditional VaR (CVaR, also called Expected Shortfall) — quantify potential losses in adverse scenarios (Artzner et al., 1999; Rockafellar & Uryasev, 2000). Drawdown analysis measures peak-to-trough capital decline, providing an intuitive measure of investment risk.

All risk metrics depend on data quality: covariance estimation requires properly aligned return series, and tail-risk measures are sensitive to outliers and missing data. For Vietnamese equities, the ±7% daily price limit imposed by HOSE regulations (HOSE, n.d.) creates truncated return distributions that affect volatility and tail-risk estimation.

## 2.5 AI Assistants and Retrieval-Augmented Generation
Large language models (LLMs) have shown strong natural language capabilities, which makes them interesting as conversational interfaces for financial tools. But they hallucinate — they generate text that sounds correct but isn't (Lin et al., 2022). In finance, hallucinated numbers about stock returns or risk metrics could directly mislead an investor's decisions.

Retrieval-Augmented Generation (RAG) addresses this by conditioning model outputs on retrieved evidence rather than relying solely on parametric knowledge (Lewis et al., 2020). The key insight is that grounding LLM responses in structured, verifiable data sources significantly reduces unsupported claims. Domain-specific models such as BloombergGPT (Wu et al., 2023) and FinGPT (Yang et al., 2023) show that financial domain training improves NLP tasks, but does not eliminate hallucination for specific numeric claims.

Evaluating whether a response is actually reliable requires going beyond surface-level checks. Min et al. (2023) proposed breaking responses into atomic claims and verifying each one individually. Rajpurkar et al. (2018) made the case that a system should know when it cannot answer — that abstention is better than fabrication.

## 2.6 Fintech Platforms for Retail Investors in Vietnam
The Vietnamese fintech landscape for equity investors is growing but fragmented. The primary digital tools are brokerage-integrated platforms from major securities companies — TCBS (TCBS, n.d.), SSI iBoard (SSI, n.d.), and VNDirect (VNDirect, n.d.) — which provide charting, order execution, and basic screening but lack quantitative analysis capabilities such as strategy backtesting, portfolio optimisation, or risk measurement.

Several specialised Vietnamese platforms have emerged. Algotrade offers fully automated algorithmic trading with tick-by-tick data and API integration via SSI, targeting professional and institutional investors (Algotrade, n.d.). Miquant provides AI-powered quantitative analysis including automated stock valuation, AI chatbot, sentiment analysis, and AI-driven stock ranking (Miquant, n.d.). However, neither platform offers user-driven strategy backtesting with transparent cost assumptions, nor do they provide portfolio optimisation or factor analysis tools accessible to retail investors.

Internationally, TradingView is the most widely used charting platform among Vietnamese retail investors, offering advanced technical analysis with partial HOSE data support but no backtesting with Vietnamese market conventions such as transaction costs, price limits, and settlement cycle (TradingView, n.d.).

Table 2.1 summarises the feature gap that motivates QuantVN Strategy Forge.

Table 2.1: Feature comparison of platforms available to Vietnamese investors.

| Feature | TCBS / SSI | Algotrade | Miquant | TradingView | **QuantVN** |
|---------|:----------:|:---------:|:-------:|:-----------:|:-----------:|
| HOSE data | Yes | Yes | Yes | Partial | Yes |
| Charting + indicators | Yes | No | No | Yes | Yes |
| Stock screening | Basic filters | No | AI-ranked | Yes | Multi-criteria |
| Strategy backtesting | No | Automated only | No | Limited | Yes (5 types) |
| No-code strategy builder | No | No | No | No | Yes (visual) |
| Portfolio optimisation | No | No | No | No | Yes (4 methods) |
| Risk analytics (VaR/CVaR) | No | No | No | No | Yes |
| Factor analysis | No | No | No | No | Yes |
| AI assistant | No | No | Chatbot | No | Yes (tool-grounded) |
| Educational content | — | No | — | Community | Planned |
| Pricing | Free | Paid | Freemium | Freemium | Free |
| Target user | Retail | Institutional | Intermediate+ | All | Retail + students |

*Source: Author's compilation based on platform surveys (accessed February 2026).*

## 2.7 Synthesis
The literature points to a common theme: Vietnamese retail investors need accessible quantitative tools, but those tools must be careful about how they present results. A backtesting engine that ignores transaction costs will produce misleading numbers. Risk metrics computed on raw HOSE data without accounting for price limits will underestimate tail risk. And an AI assistant that generates numbers from parametric knowledge rather than actual computation is a liability, not a feature.

QuantVN Strategy Forge is designed around these constraints. It brings stock screening, strategy backtesting, portfolio optimisation, risk management, and factor analysis into a single platform, with an AI assistant that grounds its explanations in the platform's own quantitative computations rather than generating answers from general knowledge.

## 2.8 Research Hypotheses

Based on the literature gap identified in Table 2.1 and the limitations of existing approaches reviewed in Sections 2.3–2.6, this thesis proposes the following testable hypotheses:

**H1:** A web-based integrated quantitative analysis platform can make institutional-grade quantitative tools accessible to Vietnamese retail investors on HOSE without requiring programming knowledge or specialised software installation.

**H2:** Incorporating Vietnamese market-specific parameters — including HOSE's 100-share lot size, domestic transaction costs (brokerage fee, sell-side tax), and next-open execution model — into a backtesting engine produces more realistic performance estimates than generic international tools that omit these parameters.

**H3:** A no-code visual strategy builder based on a node-and-edge composition model can enable non-technical retail investors on HOSE to design, backtest, and iterate on quantitative trading strategies — addressing the barrier created by existing no-code algorithmic trading platforms (such as Zerodha Streak, uTrade Algos, and AlgoBulls) that offer visual strategy design but do not support Vietnamese equities or HOSE market conventions.

**H4:** A multi-stage data validation pipeline that explicitly handles issues arising from raw open-source data access via vnstock — including price record inconsistencies, corporate action gaps, trading halts, and coverage variations across symbols — can ensure that analytical outputs remain reliable despite the inherent limitations of freely-accessible, exchange-sourced data.

**H5:** An AI assistant with tool-grounding and an abstention policy can provide reliable financial analysis explanations without generating unsupported numerical claims.

These hypotheses are evaluated against empirical evidence in Chapter 4 and summarised in Appendix A.
