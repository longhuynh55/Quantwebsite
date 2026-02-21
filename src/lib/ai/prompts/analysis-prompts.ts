/**
 * Analysis Prompts for AI Strategy Assistant
 * These prompts are used for analyzing strategies and providing recommendations
 */

export const STRATEGY_ANALYSIS_SYSTEM_PROMPT = `You are an expert quantitative analyst for the Vietnamese stock market. Your task is to analyze trading strategies and provide insightful feedback.

## Analysis Areas

1. **Risk Assessment**
   - Maximum drawdown potential
   - Position sizing adequacy
   - Stop loss effectiveness
   - Market condition sensitivity

2. **Performance Expectations**
   - Expected returns range
   - Win rate estimates
   - Risk-reward ratio
   - Sharpe ratio expectations

3. **Market Suitability**
   - Vietnamese market fit
   - Liquidity considerations
   - Trading hours impact
   - Circuit breaker effects

4. **Improvement Suggestions**
   - Parameter optimization
   - Additional filters
   - Risk management enhancements
   - Alternative indicators

## Response Format

Provide your analysis in Vietnamese with the following sections:
- **Danh gia chung**: Overall assessment
- **Diem manh**: Strategy strengths
- **Diem yeu**: Potential weaknesses
- **Khuyen nghi**: Specific recommendations
- **Luu y**: Important warnings or considerations`;

export const STRATEGY_RECOMMENDATION_PROMPT = `Based on the following strategy, provide a detailed analysis:

Strategy: {STRATEGY_NAME}
Description: {STRATEGY_DESCRIPTION}
Nodes: {NODE_COUNT}
Parameters: {PARAMETERS}

Provide your analysis in Vietnamese following the format specified.`;

export const INDICATOR_EXPLANATION_PROMPTS: Record<string, string> = {
  rsi: `RSI (Relative Strength Index) la chi bao dao dong theo dong.
- RSI > 70: Khuyen nghi ban (mua qua)
- RSI < 30: Khuyen nghi mua (ban qua)
- Phu hop cho thi truong Viet Nam vi nhay cam voi bien dong gia.`,

  macd: `MACD (Moving Average Convergence Divergence) la chi bao theo xu huong.
- MACD cat len signal line: Tinh hieu mua
- MACD cat xuong signal line: Tinh hieu ban
- Phu hop cho xu huong trung hanh tren HOSE.`,

  bollinger: `Bollinger Bands do bien dong gia.
- Gia cham upper band: Co the ban
- Gia cham lower band: Co the mua
- Band co gian: Bien dong tang
- Band hep lai: Sap co dot bien.`,

  ma: `Moving Average (MA) la chi bao xu huong co ban.
- Gia tren MA(50): Xu huong tang
- Gia duoi MA(50): Xu huong giam
- Golden cross: MA ngan han cat len MA dai han`,

  atr: `ATR (Average True Range) do bien dong thuc te.
- ATR cao: Bien dong lon, rong rui cao
- ATR thap: Thi truong yen on
- Dung de dieu chinh stop loss theo bien dong`
};

export function buildAnalysisPrompt(
  strategyName: string,
  strategyDescription: string,
  nodeCount: number,
  parameters: Record<string, unknown>
): string {
  return STRATEGY_ANALYSIS_SYSTEM_PROMPT + "\n\n" +
    STRATEGY_RECOMMENDATION_PROMPT
      .replace("{STRATEGY_NAME}", strategyName)
      .replace("{STRATEGY_DESCRIPTION}", strategyDescription)
      .replace("{NODE_COUNT}", String(nodeCount))
      .replace("{PARAMETERS}", JSON.stringify(parameters, null, 2));
}

export function getIndicatorExplanation(indicatorType: string): string {
  return INDICATOR_EXPLANATION_PROMPTS[indicatorType.toLowerCase()] ||
    `Khong co thong tin chi tiet cho chi bao ${indicatorType}.`;
}

export const STRATEGY_TEMPLATES = {
  meanReversion: {
    name: "Mean Reversion",
    descriptionVi: "Chien luoc phuc hoi gia trung binh",
    typicalIndicators: ["rsi", "bollinger"],
    riskLevel: "medium",
    timeHorizon: "short"
  },
  trendFollowing: {
    name: "Trend Following",
    descriptionVi: "Chien luoc theo xu huong",
    typicalIndicators: ["macd", "ma"],
    riskLevel: "medium",
    timeHorizon: "medium"
  },
  breakout: {
    name: "Breakout",
    descriptionVi: "Chien luoc dot bien gia",
    typicalIndicators: ["bollinger", "volume"],
    riskLevel: "high",
    timeHorizon: "short"
  },
  momentum: {
    name: "Momentum",
    descriptionVi: "Chien luoc dong luc gia",
    typicalIndicators: ["rsi", "macd"],
    riskLevel: "high",
    timeHorizon: "short"
  }
};
