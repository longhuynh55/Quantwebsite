# Appendix A: Research Hypothesis Evaluation

This appendix evaluates the research hypotheses formulated in Chapter 2 against the evidence gathered from the platform development and demonstrated results.

## A.1 Hypothesis Summary

Table A.1: Research hypothesis evaluation summary.

| # | Hypothesis | Status | Evidence |
|---|-----------|--------|----------|
| H1 | A web-based platform can provide integrated quantitative analysis tools for HOSE equities accessible to retail investors without programming knowledge | Supported | Platform deployed with 8 functional modules covering screening, backtesting, portfolio optimisation, risk assessment, and AI assistant — all accessible via browser without installation |
| H2 | Incorporating Vietnamese market-specific parameters (lot size, transaction costs, execution model) into backtesting improves the realism of simulated strategy performance | Supported | Backtesting engine integrates HOSE's 100-share lot size, 0.15% brokerage fee, 0.1% sell tax, and next-open execution — parameters absent from generic international tools |
| H3 | A no-code visual strategy builder can enable non-technical retail investors on HOSE to design, backtest, and iterate on quantitative strategies — addressing the gap left by existing no-code platforms (Zerodha Streak, AlgoBulls) that do not support HOSE | Supported | Strategy Builder provides drag-and-drop node-based interface; users construct and backtest strategies without writing code (demonstrated with RSI Reversal strategy in Figure 4.4) |
| H4 | A multi-stage data validation pipeline that handles issues from raw open-source data access via vnstock (corporate action gaps, trading halts, price inconsistencies, coverage variations) can ensure analytical reliability | Supported | Pipeline validates 768,718 OHLCV records with logical consistency checks, rejection categorisation, and minimum acceptance ratio thresholds (95% for price data) |
| H5 | An AI assistant with evidence-grounded abstention can provide reliable financial analysis while avoiding misleading outputs | Partially Supported | Assistant grounds answers in internal computation and declines unsupported queries; however, no user study has been conducted to measure perceived reliability or decision quality |

## A.2 Detailed Evaluation

### H1: Accessibility of Quantitative Tools

**Supporting evidence:**

- The platform provides 8 integrated modules (Stock Screener, Charts & Analysis, Backtesting, Portfolio Optimisation, Risk Management, Factor Analysis, Strategy Builder, AI Assistant) accessible through a web browser.
- No installation, programming knowledge, or specialised software is required.
- The user interface is designed with Vietnamese language support and contextual guidance.
- The stock screener covers 412 actively traded HOSE symbols with multi-criteria filtering (industry sector, liquidity range, listing status).
- A unified sidebar navigation structure allows access to all modules from a single workspace.

**Limitation:** No formal usability study has been conducted with actual retail investors to measure ease of use or learning curve. The accessibility claim is based on design principles and feature availability rather than empirical user research.

### H2: Vietnamese Market Parameter Integration

**Supporting evidence:**

- The backtesting engine applies HOSE's 100-share lot size by default, which affects position sizing and prevents fractional-lot trades that would be impossible in practice.
- Transaction costs (brokerage fee, sell tax, slippage) are applied at trade execution, reducing simulated returns to realistic net-of-cost levels.
- Next-open execution model avoids the common backtest pitfall of assuming execution at the signal-generating close price.

**Implication:** Strategies that appear profitable on platforms without these parameters may show reduced or negative returns when local costs are applied — directly affecting retail investors' capital allocation decisions.

**Limitation:** A systematic comparison of backtest results with and without local parameters across a defined strategy set has not been conducted as a formal experiment. The hypothesis is supported by design implementation rather than empirical comparison.

### H3: No-Code Strategy Design for Vietnamese Retail Investors

**Context:** Existing no-code algorithmic trading platforms — such as Zerodha Streak (India), uTrade Algos, and AlgoBulls — offer visual, code-free strategy design and backtesting. However, none of these platforms support Vietnamese equities, HOSE market data, or local trading conventions (lot sizes, transaction taxes, T+2 settlement). Vietnamese investors who cannot code are therefore excluded from this category of tools entirely.

**Supporting evidence:**

- The Strategy Builder canvas supports drag-and-drop composition with node types: Data Source, Indicator, Filter, Signal, and Output.
- Strategies can be saved, exported, and directly executed against historical HOSE data.
- The demonstrated RSI Reversal strategy (Figure 4.4) shows a complete workflow from data loading through condition filtering to performance evaluation — all without code.
- The visual node graph provides an explicit representation of data flow that non-technical users can read and modify.

**Limitation:** No user study has been conducted to formally measure whether non-technical investors can successfully build strategies independently. The hypothesis is supported by the existence of the feature and its design principles, with implicit comparison to the absence of HOSE-compatible no-code alternatives.

### H4: Data Validation Pipeline for HOSE Data Quality

**Context:** Vietnam's equity data ecosystem includes both commercial providers (FiinPro, CafeF, VietstockFinance) that offer curated, subscription-based data feeds, and free open-source alternatives. The platform deliberately uses vnstock as a freely accessible data source to maintain accessibility for retail investors. Raw data accessed via vnstock — sourced directly from exchange APIs — may contain price record inconsistencies, corporate action gaps, and symbol-level coverage variations that require explicit validation before quantitative use.

**Supporting evidence:**

- The pipeline processes 768,718 OHLCV records with validation rules including: non-null fields, positive prices, logical price relationships (High ≥ Low, High ≥ Close, Low ≤ Open), and finite numeric values.
- Rejected records are categorised by failure reason, enabling root cause analysis.
- Runtime quality gates prevent computation on datasets below the acceptance threshold (default 95%).
- Data manifest records coverage statistics for each dataset, providing transparency on how much data was available and used.
- Portfolio optimisation automatically excludes assets with fewer than 60 days of history or insufficient pairwise data overlap (< 30 days).

**Limitation:** The validation rules were designed to handle the most common expected issues; whether they capture all real-world HOSE data anomalies (e.g., stock splits, rights issues, post-suspension price adjustments) has not been exhaustively tested against the full historical record.

### H5: AI Assistant Reliability

**Supporting evidence:**

- The assistant retrieves computed results from internal modules before generating responses.
- Policy gating ensures numeric claims are backed by internal computation.
- When the assistant cannot ground a response, it explicitly declines with an explanation rather than generating a plausible but potentially false answer.
- No hallucinated statistics were observed during development testing.

**Limitation:** The abstention behaviour has not been validated through a controlled user study. Whether users perceive the conservative responses as trustworthy (building confidence) or restrictive (reducing utility) remains an open question for future research. The formal evaluation of H5 requires a user study with domain experts assessing response reliability.

## A.3 Additional Platform Screenshots

The following screenshots demonstrate additional platform modules referenced in the thesis.

![Figure A.1: Stock Screener interface with multi-criteria filtering across 412 HOSE-listed symbols.](figures/fig_screener.png)

![Figure A.2: Interactive Charts module showing stock analysis with price data, returns, volatility, and comparison workspace.](figures/fig_charts.png)

![Figure A.3: Portfolio Optimisation module with asset universe selection and Mean-Variance solver configuration.](figures/fig_portfolio.png)

![Figure A.4: Risk Management dashboard displaying VaR, Volatility, Beta, Maximum Drawdown, Sortino Ratio, drawdown history, and rolling volatility charts.](figures/fig_risk.png)
