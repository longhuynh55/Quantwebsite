# 3. Research Methodology

This chapter presents the research methodology used to design, implement, and evaluate QuantVN Strategy Forge.

## 3.1 Research Approach
The thesis follows an applied research approach: identifying a practical problem (the lack of accessible quantitative analysis tools for Vietnamese retail investors), designing and implementing a solution (a web-based platform), and evaluating its effectiveness through demonstration and comparison with existing tools.

The research questions from Chapter 1 are addressed through three complementary methods:

Table 3.1: Research questions and evaluation methods.

| Research Question | Evaluation Method |
|------------------|-------------------|
| RQ1 (Platform design for accessibility) | System design and implementation, feature comparison with existing platforms |
| RQ2 (Strategy design and backtesting effectiveness) | Demonstration of backtesting workflows with realistic assumptions on HOSE data |
| RQ3 (AI assistant reliability) | Evaluation of assistant responses for evidence grounding and abstention behaviour |

## 3.2 Data Collection and Description
The research uses daily-frequency equity data from the Ho Chi Minh Stock Exchange (HOSE), collected via the vnstock open-source Python library (Thinh Vu, 2023). Table 3.2 describes the dataset categories.

Table 3.2: Dataset description.

| Dataset | Coverage | Frequency | Description | Records |
|---------|----------|-----------|-------------|---------|
| OHLCV price series | 2018–2025 | Daily | Open, High, Low, Close, Volume per symbol | ~1.5M rows |
| Stock metadata | Current | Static | Symbol, company name, industry, listing status | ~500 symbols |
| Market index (VN-Index) | 2018–2025 | Daily | Index close price and volume | ~1,700 rows |
| Quarterly fundamentals | 2020–2025 | Quarterly | EPS, P/E, P/B, ROE, market capitalisation | ~8,000 rows |

Raw data is processed through an offline preparation pipeline that validates records, removes invalid entries (e.g., rows where High < Low or Close ≤ 0), and produces runtime-ready datasets with a manifest recording coverage and quality statistics.

Key characteristics of HOSE data that affect quantitative analysis include:
- **Daily price limits (±7%)**: Truncate return distributions and affect volatility and tail-risk estimation
- **T+2 settlement cycle** (Vietnam Securities Depository, n.d.): Influences volume interpretation and position management
- **Trading halts and suspensions**: Create non-trivial gaps in time series that require explicit handling
- **Corporate actions**: Stock dividends and splits require adjusted-price treatment to avoid spurious return calculations

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

**Factor analysis.** Cross-sectional factor exposures are computed for momentum, value, volatility, and size factors following the framework of Fama and French (1993, 2015).

## 3.4 AI Assistant Design
The AI assistant follows a retrieval-augmented generation (RAG) approach (Lewis et al., 2020) adapted for internal tool-grounding. Rather than retrieving documents from the web, the assistant retrieves structured evidence by calling the platform's own quantitative services (backtesting, risk analysis, factor analysis, market data).

The assistant enforces a policy gate that checks evidence sufficiency before generating narrative responses. For questions involving specific numeric claims (e.g., "What is the Sharpe ratio of this strategy?"), the policy requires that relevant computation tools have been called and returned valid results. When evidence is insufficient, the assistant abstains with an explanation rather than generating potentially incorrect numbers — consistent with the principle that knowing when not to answer is as important as answering correctly (Rajpurkar et al., 2018).

## 3.5 Evaluation Approach
The platform is evaluated through three methods:
1. **Feature completeness**: Comparison of implemented features against the gap identified in the literature review (Table 2.1)
2. **Demonstration**: Worked examples showing end-to-end workflows (screening → backtesting → portfolio → risk) on real HOSE data
3. **AI assistant evaluation**: Assessment of response grounding, including unsupported claim rate and abstention behaviour under insufficient evidence
