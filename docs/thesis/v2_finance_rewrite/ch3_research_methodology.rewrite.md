# 3. Research Methodology

This chapter presents the research methodology used to design, implement, and evaluate QuantVN Strategy Forge.

## 3.1 Research Approach
This thesis takes an applied research approach. It starts from a practical problem — the absence of accessible quantitative tools for Vietnamese retail investors — then designs and builds a platform to address it, and finally evaluates whether the platform works as intended.

Three evaluation methods are used to address the research questions from Chapter 1:

Table 3.1: Research questions, hypotheses, and evaluation methods.

| Research Question | Related Hypotheses | Evaluation Method |
|------------------|-------------------|-------------------|
| RQ1 (Platform design for accessibility) | H1, H3 | System design and implementation, feature comparison with existing platforms (Table 2.1) |
| RQ2 (Strategy design and backtesting effectiveness) | H2, H3 | Demonstration of backtesting workflows with realistic assumptions on HOSE data |
| RQ3 (AI assistant reliability) | H5 | Evaluation of assistant responses for evidence grounding and abstention behaviour |
| — | H4 *(enabling infrastructure)* | H4 (data validation pipeline) is not tied to a single RQ but underpins both RQ1 and RQ2: without validated data, the platform cannot produce reliable screening or backtesting results. Evaluated through pipeline coverage statistics and quality gate demonstrations. |

## 3.2 Data Collection and Description
The research uses daily-frequency equity data from the Ho Chi Minh Stock Exchange (HOSE), collected via the vnstock open-source Python library (Thinh Vu, 2023). Table 3.2 describes the dataset categories.

Table 3.2: Dataset description.

| Dataset | Coverage | Frequency | Description | Records |
|---------|----------|-----------|-------------|---------|
| OHLCV price series | 2018–2025 | Daily | Open, High, Low, Close, Volume per symbol | 768,718 rows |
| Stock metadata | Current | Static | Symbol, company name, industry (ICB), listing status | 412 symbols |
| Market index (VN-Index) | 2020–2025 | Daily | Index OHLCV for benchmark comparisons | ~1,500 rows |
| Balance sheet | 2018–2025 | Quarterly | Assets, liabilities, equity per symbol per quarter | ~20,000 rows |
| Income statement | 2018–2025 | Quarterly | Revenue, net income, EPS per symbol per quarter | ~18,000 rows |
| Cash flow statement | 2018–2025 | Quarterly | Operating, investing, financing cash flows | ~16,000 rows |
| Industry classification | Current | Static | ICB sector and sub-sector codes per symbol | 412 symbols |

Raw data is processed through an offline preparation pipeline that validates records, removes invalid entries (e.g., rows where High < Low or Close ≤ 0), and produces runtime-ready datasets with a manifest recording coverage and quality statistics. Unlike commercial data providers such as FiinPro or CafeF — which offer curated, subscription-based financial data feeds — the platform deliberately uses vnstock as a freely accessible, open-source data source to remain accessible to retail investors. This design choice requires an explicit validation layer to ensure analytical reliability.

Key characteristics of raw data accessed via vnstock that require explicit handling include:
- **Corporate actions (splits, dividends):** Require adjusted-price treatment to avoid spurious return calculations in long-term backtests
- **Trading halts and suspensions:** Create gaps in time series for specific symbols that must be handled to prevent data leakage
- **T+2 settlement cycle** (Vietnam Securities Depository, n.d.): Influences volume interpretation and position management assumptions
- **Daily price limits (±7%):** Truncate return distributions and affect volatility and tail-risk estimation, distinct from international markets

Table 3.3 presents descriptive statistics for the OHLCV price series dataset collected from vnstock (Thinh Vu, 2023), characterising the data distribution prior to strategy analysis. Prices are expressed in Vietnamese Dong (VND); daily return is computed as $(P_t - P_{t-1})/P_{t-1}$; volume is measured in shares.

Table 3.3: Descriptive statistics of the OHLCV dataset (HOSE, 2018–2025, sourced via vnstock).

| Variable | Obs | Mean | Std Dev | Min | Max |
|----------|-----|------|---------|-----|-----|
| Open (thousand VND) | 768,718 | 20.28 | 21.39 | 0.40 | 358.22 |
| High (thousand VND) | 768,718 | 20.54 | 21.62 | 0.40 | 358.22 |
| Low (thousand VND) | 768,718 | 20.00 | 21.14 | 0.30 | 334.98 |
| Close (thousand VND) | 768,718 | 20.29 | 21.40 | 0.30 | 334.98 |
| Volume (shares) | 768,718 | 1,307,326 | 4,290,816 | 0 | 249,760,712 |
| Daily return (%) | 768,306 | 0.066 | 2.704 | −40.08 | 66.67 |

*Note: Prices are stored by vnstock in thousands of Vietnamese Dong (VND). The extreme daily return values (−40% and +66%) occur in early-period data before the ±7% daily price limit was uniformly enforced on HOSE, and for stocks returning to trading after suspension.*

## 3.3 Quantitative Methods
The platform implements established quantitative finance methods adapted for the Vietnamese market context.

**Technical analysis.** Standard indicators including Simple and Exponential Moving Averages (SMA, EMA), Relative Strength Index (RSI), Moving Average Convergence Divergence (MACD), Average True Range (ATR), and Bollinger Bands are computed deterministically from OHLCV data and used as signal generators for trading strategies (Murphy, 1999).

**Backtesting.** Strategy evaluation uses a next-bar execution model by default — signals generated at bar *t* are executed at the open of bar *t+1* — to reduce look-ahead bias (Bailey et al., 2016). Transaction costs (brokerage fee, sell tax, slippage) are modelled explicitly, and performance is reported as both gross (before costs) and net (after costs) to enable attribution.

Key performance metrics are computed as follows. The daily return of an asset is:

$$r_t = \frac{P_t - P_{t-1}}{P_{t-1}}$$

where $P_t$ is the adjusted closing price at time $t$. The annualised Sharpe Ratio measures risk-adjusted return:

$$SR = \frac{\bar{r}_p - r_f}{\sigma_p} \times \sqrt{252}$$

where $\bar{r}_p$ is the mean daily portfolio return, $r_f$ is the risk-free rate, and $\sigma_p$ is the standard deviation of daily returns. Maximum drawdown captures the largest peak-to-trough decline:

$$MDD = \max_{t \in [0,T]} \left( \frac{\max_{s \in [0,t]} V_s - V_t}{\max_{s \in [0,t]} V_s} \right)$$

where $V_t$ is the portfolio value at time $t$.

**Portfolio optimisation.** Four methods are implemented. The Mean-Variance approach (Markowitz, 1952) solves:

$$\min_w \; w^\top \Sigma w \quad \text{subject to} \quad w^\top \mu \geq \mu^*, \quad \sum_i w_i = 1, \quad w_i \geq 0$$

where $w$ is the vector of portfolio weights, $\Sigma$ is the covariance matrix of asset returns, $\mu$ is the vector of expected returns, and $\mu^*$ is the target return. The Maximum Sharpe Ratio portfolio maximises $\frac{w^\top \mu - r_f}{\sqrt{w^\top \Sigma w}}$ (Sharpe, 1964). The Minimum Variance portfolio minimises $w^\top \Sigma w$ without a return target. Risk Parity (Maillard, Roncalli, & Teïletche, 2010) equalises the marginal risk contribution of each asset:

$$RC_i = w_i \cdot \frac{(\Sigma w)_i}{w^\top \Sigma w} = \frac{1}{n} \quad \forall \, i$$

where $RC_i$ is the risk contribution of asset $i$ and $n$ is the number of assets.

**Risk measurement.** Value at Risk (VaR) at confidence level $\alpha$ represents the maximum loss not exceeded with probability $\alpha$ (Artzner et al., 1999):

$$\text{VaR}_\alpha = -\inf \{ x : P(L \leq x) \geq 1 - \alpha \}$$

Conditional VaR (CVaR), also termed Expected Shortfall, measures the expected loss beyond VaR (Rockafellar & Uryasev, 2000):

$$\text{CVaR}_\alpha = E[L \mid L > \text{VaR}_\alpha]$$

The platform computes VaR and CVaR at 95% and 99% confidence levels using historical simulation. Additional metrics include annualised volatility, maximum and average drawdown, beta relative to VN-Index ($\beta = \frac{\text{Cov}(r_p, r_m)}{\text{Var}(r_m)}$), and tracking error.

**Factor analysis.** Cross-sectional factor exposures are computed for momentum, value, profitability, and size factors following the framework of Fama and French (1993, 2015).

## 3.4 AI Assistant Design
The AI assistant uses a retrieval-augmented generation (RAG) approach (Lewis et al., 2020), but adapted for internal tool-grounding. Instead of retrieving documents from the web, it calls the platform’s own quantitative services — backtesting, risk analysis, factor computation, market data — and uses the returned values as evidence for its answers.

Before generating any response that involves numbers, the assistant runs through a policy gate: are the relevant tools actually called? Did they return valid results? If not, the assistant will say so and decline rather than guessing. The reasoning is straightforward — in finance, a confidently wrong number is worse than no answer at all. This is consistent with Rajpurkar et al. (2018), who argued that recognising when a system cannot answer is just as important as answering correctly.

## 3.5 Evaluation Approach
The platform is evaluated through three methods:
1. **Feature completeness**: Comparison of implemented features against the gap identified in the literature review (Table 2.1)
2. **Demonstration**: Worked examples showing end-to-end workflows (screening → backtesting → portfolio → risk) on real HOSE data
3. **AI assistant evaluation**: Assessment of response grounding, including unsupported claim rate and abstention behaviour under insufficient evidence

The five research hypotheses (H1–H5) formulated in Chapter 2 are evaluated against the evidence gathered from platform development and demonstration. Results are discussed in Chapter 4 (Section 4.7.5) and summarised in Appendix A.
