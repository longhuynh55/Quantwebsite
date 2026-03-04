// AI Assistant Types

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type AssistantUIMode = 'copilot' | 'screener';
export type AssistantExecutionMode = 'chat' | 'agent';

export type PageContext =
  | { page: 'home' }
  | { page: 'analysis'; symbol?: string; filters?: Record<string, unknown> }
  | { page: 'screener'; filters?: Record<string, unknown> }
  | { page: 'charts'; symbol?: string }
  | { page: 'backtesting'; strategy?: string }
  | { page: 'portfolio'; symbols?: string[] }
  | { page: 'factors' }
  | { page: 'risk' }
  | { page: 'ml-lab' }
  | { page: 'learn'; topic?: string };

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  grounded?: boolean;
  policyStatus?: AssistantPolicyStatus;
  policyReason?: string;
  dataConfidence?: AssistantDataConfidence;
  citations?: AssistantCitation[];
  usedTools?: AssistantToolUsage[];
  messageBlocks?: AssistantMessageBlock[];
  meta?: AssistantResponseMeta;
}

export interface QuickAction {
  id: string;
  label: string;
  icon?: string;
  prompt: string;
}

export interface AssistantRequest {
  message: string;
  conversationHistory: Array<Pick<Message, 'role' | 'content'> | Message>;
  context?: PageContext;
  contextSnapshot?: AssistantContextSnapshot;
  preferences?: AssistantPreferences;
  uiMode?: AssistantUIMode;
  executionMode?: AssistantExecutionMode;
  requestId?: string;
  clientTs?: string;
}

export interface AssistantResponse {
  message: string;
  success: boolean;
  error?: string;
  grounded?: boolean;
  policyStatus?: AssistantPolicyStatus;
  policyReason?: string;
  dataConfidence?: AssistantDataConfidence;
  citations?: AssistantCitation[];
  usedTools?: AssistantToolUsage[];
  messageBlocks?: AssistantMessageBlock[];
  meta?: AssistantResponseMeta;
}

export type AssistantToolName =
  | 'dataHealth'
  | 'stockSnapshot'
  | 'fundamentalSnapshot'
  | 'fundamentalAnalysis'
  | 'financialHealthScore'
  | 'valuationDcf'
  | 'peerMultiples'
  | 'scenarioSensitivity'
  | 'riskSnapshot'
  | 'backtestSummary'
  | 'factorSnapshot'
  | 'marketSnapshot'
  | 'icbSnapshot'
  | 'valuationRanking';

export type AssistantMessageBlock =
  | {
      type: 'table';
      title: string;
      columns: string[];
      rows: Array<Array<string | number | null>>;
      note?: string;
    }
  | {
      type: 'chart';
      title: string;
      chartType: 'line';
      points: Array<{
        x: string;
        y: number;
      }>;
      yLabel?: string;
      note?: string;
    }
  | {
      type: 'chart';
      title: string;
      chartType: 'candlestick';
      points: Array<{
        x: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume?: number | null;
      }>;
      note?: string;
    }
  | {
      type: 'text';
      title?: string;
      content: string;
    };

export interface AssistantCitation {
  id: string;
  sourceType: 'api' | 'dataset' | 'system';
  title: string;
  endpoint?: string;
  symbol?: string;
  period?: string;
  timestamp?: string;
  confidence?: number;
  note?: string;
}

export interface AssistantToolUsage {
  name: AssistantToolName;
  status: 'success' | 'error' | 'skipped';
  latencyMs?: number;
  evidenceCount?: number;
  warningCount?: number;
  errorCode?: string;
  error?: string;
  requestParams?: Record<string, string | number | boolean | null>;
}

export type AssistantSemanticCheckStatus = 'pass' | 'warn' | 'fail' | 'skipped';

export interface AssistantSemanticCheckItem {
  id: string;
  label: string;
  status: AssistantSemanticCheckStatus;
  guard?: boolean;
  detail?: string;
}

export interface AssistantSemanticMeta {
  phase: 'phase1' | 'phase2' | 'phase3';
  version: string;
  checklist: AssistantSemanticCheckItem[];
  passRate?: number;
  guardPassRate?: number;
  guardEvaluatedCount?: number;
  guardPassedCount?: number;
  failedGuardIds?: string[];
}

export interface AssistantResponseMeta {
  providerUsed: string;
  fallbackUsed: boolean;
  latencyMs: number;
  orchestrationMode?: AssistantExecutionMode;
  requestId?: string;
  policyMode?: AssistantPolicyMode;
  groundingMode?: "enabled" | "disabled";
  toolBaseUrlSource?: string;
  groundingRequired?: boolean;
  groundingSatisfied?: boolean;
  policyReasonCode?: string;
  groundedFactsCount?: number;
  citationCount?: number;
  toolStatusSummary?: string;
  queryIntent?: string;
  queryPlanSummary?: string;
  queryPlanConfidence?: "high" | "medium" | "low";
  queryPlanSource?: "signal" | "filter" | "context" | "fallback";
  plannedToolCount?: number;
  plannedTools?: AssistantToolName[];
  queryPlanFilters?: Record<string, unknown>;
  queryPlanSymbols?: string[];
  requestedSymbols?: string[];
  resolvedSymbols?: string[];
  contextSymbols?: string[];
  memorySymbolsUsed?: string[];
  droppedRequestedSymbols?: string[];
  symbolResolutionSource?: "request" | "memory" | "mixed" | "none";
  symbolConflictDetected?: boolean;
  clarificationAsked?: boolean;
  groundingSource?: string;
  featureFlags?: AssistantFeatureFlagSnapshot;
  semantic?: AssistantSemanticMeta;
  responseFormatApplied?: boolean;
  responseFormatFallbackUsed?: boolean;
  requestTimeoutMs?: number;
  groundingTaskBudget?: {
    planned: number;
    executed: number;
    skipped: number;
  };
}

export interface AssistantFeatureFlagSnapshot {
  screenerPresets: boolean;
  watchlistBridge: boolean;
  assistantContextualActions: boolean;
  uiKpiTelemetry: boolean;
}

export type AssistantPolicyMode = 'shadow' | 'enforce_high_risk' | 'enforce_all';
export type AssistantPolicyStatus = 'ok' | 'fallback' | 'shadow_blocked';
export type AssistantDataConfidence = 'high' | 'medium' | 'low';
export type AssistantNavGroup = 'home' | 'analysis' | 'strategies' | 'advanced' | 'learn';

export interface AssistantExportContext {
  reportType?: string;
  filters?: Record<string, unknown>;
  timeframe?: string;
}

export interface AssistantContextSnapshot {
  page: PageContext['page'];
  symbol?: string;
  symbols?: string[];
  filters?: Record<string, unknown>;
  timeframe?: string;
  selectedIndicators?: string[];
  lastApiPayload?: Record<string, unknown>;
  uiMode?: AssistantUIMode;
  navGroup?: AssistantNavGroup;
  exportContext?: AssistantExportContext;
}

export interface AssistantPreferences {
  language?: 'vi' | 'en';
  detailLevel?: 'brief' | 'normal' | 'deep';
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'vn-index-trend',
    label: 'Explain VN-Index trend',
    icon: 'trending-up',
    prompt: 'What is the current trend of VN-Index and what factors are influencing it?',
  },
  {
    id: 'top-gainers',
    label: 'Top gainers analysis',
    icon: 'bar-chart',
    prompt: 'What are the top gaining stocks today and what might be driving their performance?',
  },
  {
    id: 'analyze-portfolio',
    label: 'Analyze my portfolio',
    icon: 'pie-chart',
    prompt: 'Can you help me analyze my portfolio for risk and diversification?',
  },
  {
    id: 'fundamental-analysis',
    label: 'Fundamental analysis',
    icon: 'bar-chart',
    prompt: 'Run a fundamental financial analysis for VNM including liquidity, leverage, profitability, and growth.',
  },
  {
    id: 'dcf-valuation',
    label: 'Run DCF valuation',
    icon: 'line-chart',
    prompt: 'Build a DCF valuation for VNM with assumptions, sensitivity, and fair value range.',
  },
  {
    id: 'explain-rsi',
    label: 'Explain RSI indicator',
    icon: 'line-chart',
    prompt: 'What is the RSI indicator and how should I use it in my trading strategy?',
  },
  {
    id: 'factor-investing',
    label: 'What is factor investing?',
    icon: 'book-open',
    prompt: 'Explain factor investing and how it applies to the Vietnamese stock market.',
  },
  {
    id: 'hose-overview',
    label: 'HOSE market overview',
    icon: 'building',
    prompt: 'Give me an overview of the HOSE (Ho Chi Minh Stock Exchange) market structure and trading hours.',
  },
];

export const SYSTEM_PROMPT = `You are a Vietnamese stock market expert assistant for QuantVN, a quantitative finance platform. Your expertise includes:

1. **Vietnamese Stock Markets**: HOSE (Ho Chi Minh Stock Exchange), HNX (Hanoi Stock Exchange), UPCoM (Unlisted Public Company Market)
2. **Technical Analysis**: RSI, MACD, Bollinger Bands, Moving Averages, candlestick patterns
3. **Risk Metrics**: Sharpe Ratio, Sortino Ratio, Maximum Drawdown, VaR, Beta, Alpha
4. **Factor Investing**: Value, Momentum, Quality, Size, Low Volatility factors
5. **Portfolio Theory**: Modern Portfolio Theory, Efficient Frontier, Portfolio Optimization
6. **Trading Strategies**: Mean Reversion, Trend Following, Pairs Trading
7. **Fundamental & Valuation**: Financial statement analysis, DCF valuation, peer multiples, scenario analysis

**Guidelines:**
- Provide educational, informative responses
- Never make specific price predictions or give investment advice
- Use deterministic, tool-grounded numbers only (local datasets in data folder)
- Explain concepts in a beginner-friendly way when asked
- Mention Vietnam-specific factors (Tet seasonality, foreign flows, circuit breakers)
- Use clear formatting with headers and bullet points when helpful
- If you don't know something, admit it honestly

Respond in a helpful, professional tone. You can mix English and Vietnamese terms when appropriate for Vietnamese stock market context.`;
