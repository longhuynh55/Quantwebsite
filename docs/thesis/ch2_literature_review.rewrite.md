# 2. Literature Review

This chapter reviews the theoretical and empirical foundations that inform the design of QuantVN Strategy Forge. The review covers quantitative finance theory, trading strategy evaluation, risk management, AI-assisted financial analysis, and the current landscape of retail investor tools.

## 2.1 Portfolio Theory and Market Efficiency
Modern Portfolio Theory (MPT), introduced by Markowitz (1952), established that investors should evaluate portfolios based on their expected return and risk (measured by variance) rather than analysing individual securities in isolation. The efficient frontier represents the set of portfolios offering maximum expected return for each level of risk. The Capital Asset Pricing Model (CAPM) extended this framework by relating expected returns to systematic risk through market beta (Sharpe, 1964; Lintner, 1965).

The Efficient Market Hypothesis (EMH) formalised three forms of market efficiency — weak, semi-strong, and strong — based on the degree to which prices reflect available information (Fama, 1970). While the EMH has been challenged by extensive evidence of market anomalies, it remains foundational for understanding why quantitative analysis tools should present results as conditional on assumptions rather than as guaranteed predictions.

For the Vietnamese market, studies on HOSE market efficiency suggest that the market exhibits characteristics of weak-form efficiency with periodic inefficiencies, particularly around information disclosure events and policy changes (Truong et al., 2020). This context supports the need for tools that help investors evaluate strategies systematically rather than relying on informal judgment.

## 2.2 Factor Models and Empirical Anomalies
Beyond market beta, empirical research has identified systematic factors that explain cross-sectional return variation. The Fama-French three-factor model added size (SMB) and value (HML) as explanatory factors (Fama & French, 1993), later extended to five factors including profitability and investment (Fama & French, 2015). Momentum — the tendency of recent winners to continue outperforming — has been documented as one of the most robust anomalies (Jegadeesh & Titman, 1993).

However, Harvey, Liu, and Zhu (2016) warned that many published factors fail to survive multiple-testing corrections, highlighting the risk of data mining in quantitative finance. This underscores the importance of tools that present factor analysis results with appropriate context and caveats.

## 2.3 Trading Strategy Design and Backtesting
Technical indicators — such as moving averages (SMA, EMA), the Relative Strength Index (RSI), Moving Average Convergence Divergence (MACD), and Bollinger Bands — transform price data into signals used for systematic trading strategies. While individual indicators have limited predictive power, they provide a structured framework for strategy design that can be evaluated through backtesting (Murphy, 1999).

Backtesting — the historical simulation of trading strategies — is the primary tool for evaluating strategy ideas but is also the primary source of misleading evidence. Bailey, Borwein, López de Prado, and Zhu (2016) identified multiple sources of backtest overfitting, including look-ahead bias, survivorship bias, unrealistic cost assumptions, and selection bias from reporting only the best result among many trials. Lo (2002) argued that quantitative performance metrics can be misleading without proper context about the evaluation methodology.

These concerns motivate a backtesting approach that makes execution timing, transaction costs, and data quality assumptions explicit and visible to users.

## 2.4 Risk Measurement
Portfolio risk assessment uses complementary measures across different dimensions. Variance-based measures (volatility, beta) capture return dispersion, while tail-risk measures — Value at Risk (VaR) and Conditional VaR (CVaR, also called Expected Shortfall) — quantify potential losses in adverse scenarios (Artzner et al., 1999; Rockafellar & Uryasev, 2000). Drawdown analysis measures peak-to-trough capital decline, providing an intuitive measure of investment risk.

All risk metrics depend on data quality: covariance estimation requires properly aligned return series, and tail-risk measures are sensitive to outliers and missing data. For Vietnamese equities, the ±7% daily price limit imposed by HOSE regulations (HOSE, n.d.) creates truncated return distributions that affect volatility and tail-risk estimation.

## 2.5 AI Assistants and Retrieval-Augmented Generation
Large language models (LLMs) have demonstrated strong capabilities for natural language understanding and generation, making them promising as conversational interfaces for financial analysis tools. However, LLMs are prone to hallucination — producing fluent but factually incorrect outputs (Lin et al., 2022). In financial contexts, hallucinated numeric claims about stock returns, risk metrics, or portfolio performance could lead investors to make uninformed decisions.

Retrieval-Augmented Generation (RAG) addresses this by conditioning model outputs on retrieved evidence rather than relying solely on parametric knowledge (Lewis et al., 2020). The key insight is that grounding LLM responses in structured, verifiable data sources significantly reduces unsupported claims. Domain-specific models such as BloombergGPT (Wu et al., 2023) and FinGPT (Yang et al., 2023) show that financial domain training improves NLP tasks, but does not eliminate hallucination for specific numeric claims.

Evaluating response reliability requires fine-grained methods. Min et al. (2023) proposed decomposing responses into atomic claims and verifying each against evidence. Rajpurkar et al. (2018) established that systems should recognise when they cannot answer reliably — abstention being preferable to fabrication.

## 2.6 Fintech Platforms for Retail Investors in Vietnam
The Vietnamese fintech landscape for equity investors is growing but fragmented. The primary digital tools are brokerage-integrated platforms from major securities companies — TCBS (TCBS, n.d.), SSI iBoard (SSI, n.d.), and VNDirect (VNDirect, n.d.) — which provide charting, order execution, and basic screening but lack quantitative analysis capabilities such as strategy backtesting, portfolio optimisation, or risk measurement.

Several specialised Vietnamese platforms have emerged. Algotrade offers fully automated algorithmic trading with tick-by-tick data and API integration via SSI, targeting professional and institutional investors (Algotrade, n.d.). Miquant provides AI-powered quantitative analysis including automated stock valuation, AI chatbot, sentiment analysis, and AI-driven stock ranking (Miquant, n.d.). However, neither platform offers user-driven strategy backtesting with transparent cost assumptions, nor do they provide portfolio optimisation or factor analysis tools accessible to retail investors.

Internationally, TradingView is the most widely used charting platform among Vietnamese retail investors, offering advanced technical analysis with partial HOSE data support but no backtesting with Vietnamese market conventions such as transaction costs, price limits, and settlement cycle (TradingView, n.d.).

Table 2.1 summarises the feature gap that motivates QuantVN Strategy Forge.

Table 2.1: Feature comparison of platforms available to Vietnamese investors.

| Feature | TCBS / SSI | Algotrade | Miquant | TradingView | **QuantVN** |
|---------|:----------:|:---------:|:-------:|:-----------:|:-----------:|
| HOSE data support | ✅ | ✅ | ✅ | Partial | ✅ |
| Technical charting | ✅ | — | — | ✅ | ✅ |
| Stock screening | Basic | ❌ | ✅ (AI) | ✅ | ✅ |
| Strategy backtesting | ❌ | Auto only | ❌ | Limited | ✅ |
| Portfolio optimisation | ❌ | ❌ | ❌ | ❌ | ✅ |
| Risk analytics (VaR/CVaR) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Factor analysis | ❌ | ❌ | ❌ | ❌ | ✅ |
| AI assistant | ❌ | ❌ | ✅ (chatbot) | ❌ | ✅ |
| Educational content | — | ❌ | — | ✅ | ✅ |
| Free / accessible | ✅ | Paid | Freemium | Freemium | ✅ |
| Target user | All investors | Professional | Intermediate+ | All investors | All investors |

*Source: Author's compilation based on platform surveys (accessed February 2026).*

## 2.7 Synthesis
The reviewed literature identifies a convergence of needs: Vietnamese retail investors require accessible quantitative tools, but such tools must present results with appropriate context to avoid misleading conclusions. Backtesting must enforce causal discipline and cost transparency. Risk metrics must account for HOSE-specific data characteristics. AI assistance must be grounded in computed evidence rather than generated from parametric knowledge alone.

QuantVN Strategy Forge addresses these needs by integrating stock screening, strategy backtesting, portfolio optimisation, risk management, and factor analysis into a single accessible platform, augmented by an AI assistant that grounds its explanations in the platform's own quantitative computations.
