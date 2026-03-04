# 5. Conclusion and Recommendation

## 5.1 Conclusion

This thesis set out to design, build, and evaluate QuantVN Strategy Forge — a web-based quantitative analysis platform for Vietnamese equities on HOSE. The motivation is simple: retail investors make up over 80% of daily HOSE trading volume, yet they have had no access to integrated quantitative tools of the kind that institutional investors take for granted.

The platform brings together stock screening, interactive charting, strategy backtesting, portfolio optimisation, risk assessment, and AI-assisted analysis in a single browser-based interface. The backtesting engine is built around Vietnamese market realities: HOSE's 100-share lot size, applicable transaction costs, and next-open execution modelling — details that generic international tools do not account for.

Four of the five research hypotheses (H1–H4) are supported by the evidence presented in Chapter 4: the platform is accessible without programming knowledge (H1), local market parameters are integrated into backtesting (H2), the visual Strategy Builder works without code (H3), and the data validation pipeline maintains analytical reliability for open-source data (H4). H5 is partially supported — the AI assistant's abstention mechanism functions as designed, but its effect on user trust has not been formally evaluated. Detailed evidence and limitations for each hypothesis are provided in Section 4.7.5 and Appendix A.

The main limitation across all hypotheses is the absence of formal user studies. The claims are grounded in design implementation and functional demonstration rather than controlled experiments with end users. This is an acknowledged trade-off: building a working platform was prioritised over running user evaluations within the scope of this thesis.

## 5.2 Recommendation

Several directions follow from this work:

**For platform development:**

1. Expand data coverage to include HNX and UPCoM exchanges, giving users a more complete picture of the Vietnamese equity market.

2. Add corporate action adjustments (splits, dividends, rights issues) to historical price data. Without these, long-term backtests can produce misleading return calculations.

3. Move beyond purely technical strategies. Fundamental screening strategies (based on P/E, P/B, ROE) and multi-factor strategies that combine price and fundamental signals would significantly broaden the platform's usefulness.

4. Build a strategy-sharing community where users can publish, compare, and discuss backtested strategies — turning the platform into a collaborative learning environment.

**For academic research:**

5. Run comparative studies between the platform's backtesting outputs and actual trading records of Vietnamese retail investors. This would provide concrete evidence of whether systematic tools improve decision-making quality.

6. Test which portfolio optimisation methods actually work best in the Vietnamese market, where liquidity constraints and market microstructure are different from the developed-market settings where most optimisation methods were originally tested.

7. Study how users respond to the AI assistant's abstention behaviour. The right balance between "reliable but conservative" and "comprehensive but risky" is an open question in financial technology design.
