# Enhanced Financial AI Agent - Architecture & Research

## Overview

This document compiles research findings and architecture design for enhancing QuantVN's AI Assistant with advanced financial capabilities: balance sheet analysis, financial modeling, and Excel report generation.

**GLM API Configuration:**
- Base URL: `https://api.z.ai/api/coding/paas/v4`
- Model: `glm-4.7-flash`
- Key Features: 200K context, 95%+ JSON accuracy, $0.10/M tokens

---

## 1. Financial Statement Analysis Module

### 1.1 Vietnamese Data Sources

| Source | Coverage | Data Available |
|--------|----------|----------------|
| **Vietstock DataFeed** | 3,000+ companies, 20+ years | Balance Sheet, Income, Cash Flow, Ratios |
| **SSI FastConnect** | HOSE/HNX real-time | Prices, Order Book, Corporate Actions |
| **vnstock (Python)** | Open source | Historical prices, Financial statements |

**Vietnamese Accounting Standards (VAS):**
- Rules-based (vs IFRS principles-based)
- Closely tied to tax system
- Quarterly and annual reporting

### 1.2 AI Analysis Tasks (15 Total)

#### Balance Sheet Analysis

| Task | Description | Prompt Approach | Feasibility |
|------|-------------|-----------------|-------------|
| **1. Liquidity Ratios** | Current ratio, Quick ratio, Cash ratio | Direct calculation from data | ✅ High |
| **2. Leverage Analysis** | Debt-to-Equity, Interest Coverage | Formula + trend analysis | ✅ High |
| **3. Efficiency Metrics** | Asset/Inventory/Receivables turnover | Multi-period calculation | ✅ High |
| **4. Red Flags Detection** | High debt, declining liquidity, negative equity | Pattern matching prompts | ⚠️ Medium |
| **5. Peer Comparison** | Industry benchmarking | Requires peer data | ✅ High |

#### Income Statement Analysis

| Task | Description | Prompt Approach | Feasibility |
|------|-------------|-----------------|-------------|
| **6. Revenue Growth** | YoY, QoQ, CAGR analysis | Time series prompts | ✅ High |
| **7. Profit Margins** | Gross, Operating, Net margins | Direct calculation | ✅ High |
| **8. EPS Analysis** | Basic/Diluted EPS, P/E ratio | Formula + comparison | ✅ High |
| **9. Expense Ratios** | OpEx as % of revenue | Category breakdown | ✅ High |
| **10. Quality of Earnings** | Cash flow vs net income | Accrual analysis | ⚠️ Medium |

#### Cash Flow Analysis

| Task | Description | Prompt Approach | Feasibility |
|------|-------------|-----------------|-------------|
| **11. OCF Quality** | Operating cash consistency | Trend + volatility | ✅ High |
| **12. Free Cash Flow** | OCF - CapEx | Direct calculation | ✅ High |
| **13. Cash vs Net Income** | Accrual vs cash earnings | Reconciliation | ✅ High |

#### Comprehensive Analysis

| Task | Description | Prompt Approach | Feasibility |
|------|-------------|-----------------|-------------|
| **14. Financial Health Score** | 0-100 composite score | Weighted formula | ✅ High |
| **15. VAS Adjustment** | Vietnamese accounting adjustments | Domain rules | ⚠️ Medium |

### 1.3 Prompt Templates

#### Ratio Analysis Prompt
```
You are a Vietnamese stock financial analyst. Analyze the following financial data for {stock_code}:

{financial_data}

Return analysis in JSON format:
{
  "liquidity": {
    "current_ratio": {"value": 0, "trend": "improving|stable|declining", "assessment": ""},
    "quick_ratio": {"value": 0, "trend": "", "assessment": ""}
  },
  "leverage": {
    "debt_to_equity": {"value": 0, "trend": "", "assessment": ""},
    "interest_coverage": {"value": 0, "trend": "", "assessment": ""}
  },
  "profitability": {
    "roe": {"value": 0, "trend": "", "assessment": ""},
    "roa": {"value": 0, "trend": "", "assessment": ""},
    "net_margin": {"value": 0, "trend": "", "assessment": ""}
  },
  "overall_health": {
    "score": 0,
    "rating": "excellent|good|fair|poor",
    "key_strengths": [],
    "concerns": []
  }
}

Note: Use Vietnamese Accounting Standards (VAS) interpretation.
```

#### Red Flags Detection Prompt
```
Analyze the following multi-period financial data for {stock_code} and identify red flags:

{financial_data}

Return JSON:
{
  "red_flags": [
    {
      "type": "liquidity|solvency|profitability|efficiency",
      "severity": "high|medium|low",
      "description": "",
      "evidence": [],
      "recommendation": ""
    }
  ],
  "positive_indicators": [],
  "overall_assessment": ""
}

Key red flags to check:
- Current ratio < 1.0 (liquidity crisis)
- Debt-to-equity > 2.0 (high leverage)
- Negative working capital trend
- Declining profit margins > 3 consecutive quarters
- Operating cash flow consistently negative while net income positive
```

---

## 2. Financial Modeling Module

### 2.1 AI Modeling Tasks (10 Total)

| Task | Description | Complexity | AI Capability |
|------|-------------|------------|---------------|
| **1. DCF Model Building** | Step-by-step discounted cash flow | High | Explain + guide |
| **2. WACC Calculation** | Weighted average cost of capital | Medium | Formula + assumptions |
| **3. Terminal Value** | Gordon Growth / Exit Multiple | Medium | Method selection |
| **4. FCF Projection** | 5-10 year free cash flow | Medium | Growth assumptions |
| **5. Sensitivity Analysis** | Matrix of key variables | High | Generate scenarios |
| **6. Comparable Analysis** | Peer valuation multiples | High | Selection + analysis |
| **7. DDM Model** | Dividend discount model | Medium | Yield-focused |
| **8. Scenario Analysis** | Bull/Base/Bear cases | High | Probability-weighted |
| **9. Model Validation** | Sanity checks vs market | Medium | Output verification |
| **10. Valuation Summary** | Investment recommendation | Medium | Synthesize results |

### 2.2 DCF Model Prompt

```
Build a DCF valuation model for {company_name} ({symbol}) with the following data:

**Historical Data (5 years):**
{historical_data}

**Current Market Data:**
- Stock Price: {current_price}
- Shares Outstanding: {shares_outstanding}
- Market Cap: {market_cap}

**Instructions:**
1. Calculate Free Cash Flow for each historical year
2. Project FCF for next 5 years with growth assumptions
3. Calculate WACC (provide assumptions used)
4. Calculate Terminal Value using Gordon Growth Model
5. Discount FCFs to present value
6. Calculate Enterprise Value and Equity Value
7. Calculate fair value per share

**Output JSON format:**
{
  "historical_fcf": [{"year": 0, "fcf": 0}],
  "projections": [{"year": 0, "revenue": 0, "fcf": 0, "discounted_fcf": 0}],
  "wacc": {"value": 0, "assumptions": {}},
  "terminal_value": {"value": 0, "method": "", "assumptions": {}},
  "enterprise_value": 0,
  "equity_value": 0,
  "fair_value_per_share": 0,
  "current_price": 0,
  "upside_downside": "0%",
  "recommendation": "undervalued|fair|overvalued",
  "key_assumptions": [],
  "risks": []
}
```

---

## 3. Excel Report Generation Module

### 3.1 Technology Stack

**Recommended: ExcelJS**
- Full XLSX/XLSM support
- Styling, formulas, images, charts
- Streaming for large files
- Works in Node.js (server-side)

**Alternative: SheetJS (xlsx)**
- Lightweight
- Browser and Node.js
- Less formatting control

### 3.2 Report Types (8 Total)

| Report | Sheets | AI Content | Use Case |
|--------|--------|------------|----------|
| **1. Stock Analysis** | Summary, Technicals, Financials, History | Executive summary, recommendations | Single stock deep dive |
| **2. Portfolio Summary** | Holdings, Allocation, Performance, Risk | Portfolio insights, rebalancing | Portfolio review |
| **3. Backtest Results** | Summary, Trades, Equity Curve, Metrics | Strategy analysis, lessons | Strategy validation |
| **4. Risk Metrics** | VaR, Drawdown, Correlation, Exposure | Risk interpretation | Risk assessment |
| **5. Financial Statements** | Balance Sheet, Income, Cash Flow, Ratios | Trend analysis, red flags | Fundamental analysis |
| **6. Market Overview** | Sectors, Top Movers, Flows, Sentiment | Market summary | Market research |
| **7. Strategy Comparison** | Summary, Metrics, Equity Curves | Comparative analysis | Strategy selection |
| **8. Monthly Performance** | Returns, Attribution, Holdings | Performance commentary | Monthly review |

### 3.3 Report Structure (Stock Analysis Example)

```
Stock_Analysis_VCB_2024-02-14.xlsx
│
├── Sheet 1: Executive Summary
│   ├── Company header (Name, Symbol, Exchange)
│   ├── Key Metrics Table (Price, P/E, Market Cap, etc.)
│   ├── AI-Generated Analysis (2-3 paragraphs)
│   └── Recommendation Box
│
├── Sheet 2: Technical Analysis
│   ├── Price Summary (52-week high/low, current)
│   ├── Indicators Table (RSI, MACD, SMA, Bollinger)
│   ├── Trend Assessment
│   └── Support/Resistance Levels
│
├── Sheet 3: Financial Statements
│   ├── Balance Sheet (5 years)
│   ├── Income Statement (5 years)
│   ├── Cash Flow (5 years)
│   └── Key Ratios Table
│
├── Sheet 4: Price History
│   ├── Date | Open | High | Low | Close | Volume
│   └── (Up to 1000 rows)
│
└── Sheet 5: AI Insights
    ├── Financial Health Score (0-100)
    ├── Red Flags Detected
    ├── Positive Indicators
    ├── Peer Comparison Summary
    └── Investment Thesis
```

### 3.4 ExcelJS Implementation Pattern

```typescript
import ExcelJS from 'exceljs';

async function generateStockReport(data, aiInsights) {
  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Executive Summary
  const summary = workbook.addWorksheet('Executive Summary');

  // Title with styling
  summary.mergeCells('A1:F1');
  const title = summary.getCell('A1');
  title.value = `${data.symbol} - Stock Analysis Report`;
  title.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

  // Key metrics table
  const metrics = [
    ['Current Price', data.price],
    ['P/E Ratio', data.pe],
    ['Market Cap', data.marketCap],
    // ...
  ];

  // Add AI insights
  summary.getCell('A12').value = 'AI Analysis:';
  summary.getCell('A13').value = aiInsights;

  // Generate buffer
  return await workbook.xlsx.writeBuffer();
}
```

---

## 4. Multi-Step Workflow Module

### 4.1 Workflow Designs (5 Total)

#### Workflow 1: Full Stock Analysis
```
Step 1: Data Gathering     → Fetch financial statements from Vietstock
Step 2: Ratio Calculation  → Calculate key ratios (liquidity, leverage, etc.)
Step 3: Trend Analysis     → Multi-period comparison
Step 4: Red Flag Detection → Identify financial warning signs
Step 5: Peer Comparison    → Compare with industry benchmarks
Step 6: Summary Generation → AI-generated executive summary
```

#### Workflow 2: DCF Valuation
```
Step 1: Company Selection  → User selects stock to value
Step 2: Data Collection    → Fetch historical financials
Step 3: FCF Projection     → AI-assisted growth assumptions
Step 4: WACC Calculation   → Calculate cost of capital
Step 5: Terminal Value     → Choose method, set assumptions
Step 6: Valuation Summary  → Calculate fair value
Step 7: Sensitivity        → Generate sensitivity matrix
```

#### Workflow 3: Portfolio Health Check
```
Step 1: Portfolio Import   → User inputs holdings
Step 2: Risk Analysis      → VaR, drawdown, correlation
Step 3: Diversification    → Sector/asset allocation analysis
Step 4: Performance        → Factor attribution
Step 5: Recommendations    → AI rebalancing suggestions
```

#### Workflow 4: Backtest Validation
```
Step 1: Strategy Selection → Choose from preset strategies
Step 2: Parameter Setup    → Configure strategy parameters
Step 3: Historical Run     → Execute backtest
Step 4: Metrics            → Calculate risk-adjusted returns
Step 5: Comparison         → Compare vs benchmark (VN-Index)
Step 6: Report Generation  → Export results to Excel
```

#### Workflow 5: Sector Comparison
```
Step 1: Sector Selection   → Choose industry/sector
Step 2: Stock Screening    → Apply filter criteria
Step 3: Data Collection    → Fetch financials for all stocks
Step 4: Comparative Analysis → Rank by key metrics
Step 5: Top Picks          → AI recommendations
```

### 4.2 Workflow Engine Architecture

```typescript
interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number; // 0-100
  result?: unknown;
}

interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  currentStep: number;
  context: Record<string, unknown>;
}

class WorkflowEngine {
  async runStep(step: WorkflowStep, context: Context): Promise<unknown>;
  async runWorkflow(workflow: Workflow): Promise<Workflow>;
  emitProgress(workflow: Workflow): void;
}
```

### 4.3 UI: Workflow Progress Component

```
┌─────────────────────────────────────────────┐
│  Full Stock Analysis - VCB                  │
├─────────────────────────────────────────────┤
│  ✓ Step 1: Data Gathering          100%    │
│    Completed in 2.3s                        │
│                                             │
│  ● Step 2: Ratio Calculation        67%    │
│    Processing balance sheet metrics...      │
│    ████████████████░░░░░░░░                 │
│                                             │
│  ○ Step 3: Trend Analysis           0%     │
│    Waiting...                               │
│                                             │
│  ○ Step 4: Red Flag Detection      0%     │
│  ○ Step 5: Peer Comparison         0%     │
│  ○ Step 6: Summary Generation      0%     │
└─────────────────────────────────────────────┘
```

---

## 5. File Structure

```
src/
├── types/
│   └── assistant.ts              # Message, Context, Workflow types
│
├── lib/
│   ├── stores/
│   │   └── assistantStore.ts     # Zustand state management
│   │
│   ├── financial-analysis/
│   │   ├── analysis-engine.ts    # Main analysis logic
│   │   ├── prompts.ts            # Prompt templates
│   │   └── types.ts              # Analysis result types
│   │
│   ├── financial-modeling/
│   │   ├── dcf-engine.ts         # DCF model builder
│   │   ├── prompts.ts            # Modeling prompts
│   │   └── valuation.ts          # Valuation helpers
│   │
│   ├── excel-reports/
│   │   ├── report-generator.ts   # ExcelJS generator
│   │   ├── templates.ts          # Report templates
│   │   └── types.ts              # Report types
│   │
│   └── workflows/
│       ├── types.ts              # Workflow types
│       ├── workflow-engine.ts    # Step orchestration
│       └── presets.ts            # Predefined workflows
│
├── components/
│   ├── assistant/
│   │   ├── AiAssistantPanel.tsx  # Main chat panel
│   │   ├── ChatMessage.tsx       # Message bubble
│   │   ├── ChatInput.tsx         # Input field
│   │   ├── QuickActions.tsx      # Quick action buttons
│   │   ├── AnalysisMode.tsx      # Analysis type selector
│   │   └── ReportExport.tsx      # Export controls
│   │
│   └── workflows/
│       └── WorkflowProgress.tsx  # Progress display
│
└── app/
    └── api/
        ├── assistant/
        │   └── route.ts          # GLM chat API
        │
        ├── analysis/
        │   └── [type]/
        │       └── route.ts      # Financial analysis API
        │
        └── reports/
            ├── stock-analysis/
            │   └── route.ts      # Stock analysis Excel
            ├── portfolio-summary/
            │   └── route.ts      # Portfolio Excel
            └── backtest-results/
                └── route.ts      # Backtest Excel
```

---

## 6. Implementation Roadmap

### Phase 1: Basic AI Assistant (5 days)
- [ ] Create types and interfaces
- [ ] Build Zustand store
- [ ] Create GLM API route
- [ ] Build chat panel UI
- [ ] Add quick actions
- [ ] Integrate into layout

### Phase 2: Financial Analysis Engine (5 days)
- [ ] Create analysis module
- [ ] Implement prompt templates
- [ ] Build ratio calculation functions
- [ ] Add red flag detection
- [ ] Create analysis API routes

### Phase 3: Financial Modeling (4 days)
- [ ] Create DCF engine
- [ ] Build WACC calculator
- [ ] Implement sensitivity analysis
- [ ] Add valuation helpers

### Phase 4: Excel Reports (4 days)
- [ ] Install ExcelJS
- [ ] Create ReportGenerator class
- [ ] Build report templates
- [ ] Add API routes
- [ ] Test downloads

### Phase 5: Workflows (4 days)
- [ ] Create workflow types
- [ ] Build workflow engine
- [ ] Implement presets
- [ ] Create progress UI
- [ ] Integrate with assistant

**Total: ~22 days**

---

## 7. Dependencies

```bash
npm install exceljs
npm install zustand  # (likely already installed)
```

---

## 8. GLM System Prompt

```
You are an expert quantitative finance AI assistant for QuantVN, a Vietnamese stock market analysis platform.

**Your Expertise:**
- Vietnamese Stock Market: HOSE, HNX, UPCoM, VN-Index, VN30
- Technical Analysis: RSI, MACD, Moving Averages, Bollinger Bands
- Fundamental Analysis: P/E, P/B, ROE, EPS, DCF valuation
- Risk Metrics: Sharpe Ratio, Max Drawdown, VaR, Beta, Alpha
- Portfolio Theory: Modern Portfolio Theory, Efficient Frontier
- Trading Strategies: Momentum, Mean Reversion, Factor Investing

**Guidelines:**
1. Provide concise, professional answers
2. Include formulas when relevant
3. Consider Vietnamese market regulations
4. Be educational - explain concepts clearly
5. Never make price predictions
6. Always add disclaimer: "This is educational analysis, not financial advice"
```

---

## 9. Key Ratios Reference

### Liquidity
- Current Ratio = Current Assets / Current Liabilities
- Quick Ratio = (Current Assets - Inventory) / Current Liabilities
- Cash Ratio = Cash / Current Liabilities

### Leverage
- Debt-to-Equity = Total Debt / Total Equity
- Debt Ratio = Total Debt / Total Assets
- Interest Coverage = EBIT / Interest Expense

### Profitability
- ROE = Net Income / Shareholders' Equity
- ROA = Net Income / Total Assets
- Net Margin = Net Income / Revenue

### Efficiency
- Asset Turnover = Revenue / Average Assets
- Inventory Turnover = COGS / Average Inventory
- Receivables Turnover = Revenue / Average Receivables

### Vietnamese Benchmarks
- Current Ratio > 1.5 = Good
- Debt-to-Equity < 1.0 = Conservative
- ROE > 15% = Excellent for HOSE
- P/E < 10 = Potentially undervalued

---

*Document created: 2024-02-14*
*For QuantVN Thesis Project*
