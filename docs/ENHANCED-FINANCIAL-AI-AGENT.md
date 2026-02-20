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
| **1. Liquidity Ratios** | Current ratio, Quick ratio, Cash ratio | Direct calculation from data | âœ… High |
| **2. Leverage Analysis** | Debt-to-Equity, Interest Coverage | Formula + trend analysis | âœ… High |
| **3. Efficiency Metrics** | Asset/Inventory/Receivables turnover | Multi-period calculation | âœ… High |
| **4. Red Flags Detection** | High debt, declining liquidity, negative equity | Pattern matching prompts | âš ï¸ Medium |
| **5. Peer Comparison** | Industry benchmarking | Requires peer data | âœ… High |

#### Income Statement Analysis

| Task | Description | Prompt Approach | Feasibility |
|------|-------------|-----------------|-------------|
| **6. Revenue Growth** | YoY, QoQ, CAGR analysis | Time series prompts | âœ… High |
| **7. Profit Margins** | Gross, Operating, Net margins | Direct calculation | âœ… High |
| **8. EPS Analysis** | Basic/Diluted EPS, P/E ratio | Formula + comparison | âœ… High |
| **9. Expense Ratios** | OpEx as % of revenue | Category breakdown | âœ… High |
| **10. Quality of Earnings** | Cash flow vs net income | Accrual analysis | âš ï¸ Medium |

#### Cash Flow Analysis

| Task | Description | Prompt Approach | Feasibility |
|------|-------------|-----------------|-------------|
| **11. OCF Quality** | Operating cash consistency | Trend + volatility | âœ… High |
| **12. Free Cash Flow** | OCF - CapEx | Direct calculation | âœ… High |
| **13. Cash vs Net Income** | Accrual vs cash earnings | Reconciliation | âœ… High |

#### Comprehensive Analysis

| Task | Description | Prompt Approach | Feasibility |
|------|-------------|-----------------|-------------|
| **14. Financial Health Score** | 0-100 composite score | Weighted formula | âœ… High |
| **15. VAS Adjustment** | Vietnamese accounting adjustments | Domain rules | âš ï¸ Medium |

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
â”‚
â”œâ”€â”€ Sheet 1: Executive Summary
â”‚   â”œâ”€â”€ Company header (Name, Symbol, Exchange)
â”‚   â”œâ”€â”€ Key Metrics Table (Price, P/E, Market Cap, etc.)
â”‚   â”œâ”€â”€ AI-Generated Analysis (2-3 paragraphs)
â”‚   â””â”€â”€ Recommendation Box
â”‚
â”œâ”€â”€ Sheet 2: Technical Analysis
â”‚   â”œâ”€â”€ Price Summary (52-week high/low, current)
â”‚   â”œâ”€â”€ Indicators Table (RSI, MACD, SMA, Bollinger)
â”‚   â”œâ”€â”€ Trend Assessment
â”‚   â””â”€â”€ Support/Resistance Levels
â”‚
â”œâ”€â”€ Sheet 3: Financial Statements
â”‚   â”œâ”€â”€ Balance Sheet (5 years)
â”‚   â”œâ”€â”€ Income Statement (5 years)
â”‚   â”œâ”€â”€ Cash Flow (5 years)
â”‚   â””â”€â”€ Key Ratios Table
â”‚
â”œâ”€â”€ Sheet 4: Price History
â”‚   â”œâ”€â”€ Date | Open | High | Low | Close | Volume
â”‚   â””â”€â”€ (Up to 1000 rows)
â”‚
â””â”€â”€ Sheet 5: AI Insights
    â”œâ”€â”€ Financial Health Score (0-100)
    â”œâ”€â”€ Red Flags Detected
    â”œâ”€â”€ Positive Indicators
    â”œâ”€â”€ Peer Comparison Summary
    â””â”€â”€ Investment Thesis
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
Step 1: Data Gathering     â†’ Fetch financial statements from Vietstock
Step 2: Ratio Calculation  â†’ Calculate key ratios (liquidity, leverage, etc.)
Step 3: Trend Analysis     â†’ Multi-period comparison
Step 4: Red Flag Detection â†’ Identify financial warning signs
Step 5: Peer Comparison    â†’ Compare with industry benchmarks
Step 6: Summary Generation â†’ AI-generated executive summary
```

#### Workflow 2: DCF Valuation
```
Step 1: Company Selection  â†’ User selects stock to value
Step 2: Data Collection    â†’ Fetch historical financials
Step 3: FCF Projection     â†’ AI-assisted growth assumptions
Step 4: WACC Calculation   â†’ Calculate cost of capital
Step 5: Terminal Value     â†’ Choose method, set assumptions
Step 6: Valuation Summary  â†’ Calculate fair value
Step 7: Sensitivity        â†’ Generate sensitivity matrix
```

#### Workflow 3: Portfolio Health Check
```
Step 1: Portfolio Import   â†’ User inputs holdings
Step 2: Risk Analysis      â†’ VaR, drawdown, correlation
Step 3: Diversification    â†’ Sector/asset allocation analysis
Step 4: Performance        â†’ Factor attribution
Step 5: Recommendations    â†’ AI rebalancing suggestions
```

#### Workflow 4: Backtest Validation
```
Step 1: Strategy Selection â†’ Choose from preset strategies
Step 2: Parameter Setup    â†’ Configure strategy parameters
Step 3: Historical Run     â†’ Execute backtest
Step 4: Metrics            â†’ Calculate risk-adjusted returns
Step 5: Comparison         â†’ Compare vs benchmark (VN-Index)
Step 6: Report Generation  â†’ Export results to Excel
```

#### Workflow 5: Sector Comparison
```
Step 1: Sector Selection   â†’ Choose industry/sector
Step 2: Stock Screening    â†’ Apply filter criteria
Step 3: Data Collection    â†’ Fetch financials for all stocks
Step 4: Comparative Analysis â†’ Rank by key metrics
Step 5: Top Picks          â†’ AI recommendations
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
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Full Stock Analysis - VCB                  â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  âœ“ Step 1: Data Gathering          100%    â”‚
â”‚    Completed in 2.3s                        â”‚
â”‚                                             â”‚
â”‚  â— Step 2: Ratio Calculation        67%    â”‚
â”‚    Processing balance sheet metrics...      â”‚
â”‚    â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘                 â”‚
â”‚                                             â”‚
â”‚  â—‹ Step 3: Trend Analysis           0%     â”‚
â”‚    Waiting...                               â”‚
â”‚                                             â”‚
â”‚  â—‹ Step 4: Red Flag Detection      0%     â”‚
â”‚  â—‹ Step 5: Peer Comparison         0%     â”‚
â”‚  â—‹ Step 6: Summary Generation      0%     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 5. File Structure

```
src/
â”œâ”€â”€ types/
â”‚   â””â”€â”€ assistant.ts              # Message, Context, Workflow types
â”‚
â”œâ”€â”€ lib/
â”‚   â”œâ”€â”€ stores/
â”‚   â”‚   â””â”€â”€ assistantStore.ts     # Zustand state management
â”‚   â”‚
â”‚   â”œâ”€â”€ financial-analysis/
â”‚   â”‚   â”œâ”€â”€ analysis-engine.ts    # Main analysis logic
â”‚   â”‚   â”œâ”€â”€ prompts.ts            # Prompt templates
â”‚   â”‚   â””â”€â”€ types.ts              # Analysis result types
â”‚   â”‚
â”‚   â”œâ”€â”€ financial-modeling/
â”‚   â”‚   â”œâ”€â”€ dcf-engine.ts         # DCF model builder
â”‚   â”‚   â”œâ”€â”€ prompts.ts            # Modeling prompts
â”‚   â”‚   â””â”€â”€ valuation.ts          # Valuation helpers
â”‚   â”‚
â”‚   â”œâ”€â”€ excel-reports/
â”‚   â”‚   â”œâ”€â”€ report-generator.ts   # ExcelJS generator
â”‚   â”‚   â”œâ”€â”€ templates.ts          # Report templates
â”‚   â”‚   â””â”€â”€ types.ts              # Report types
â”‚   â”‚
â”‚   â””â”€â”€ workflows/
â”‚       â”œâ”€â”€ types.ts              # Workflow types
â”‚       â”œâ”€â”€ workflow-engine.ts    # Step orchestration
â”‚       â””â”€â”€ presets.ts            # Predefined workflows
â”‚
â”œâ”€â”€ components/
â”‚   â”œâ”€â”€ assistant/
â”‚   â”‚   â”œâ”€â”€ AiAssistantPanel.tsx  # Main chat panel
â”‚   â”‚   â”œâ”€â”€ ChatMessage.tsx       # Message bubble
â”‚   â”‚   â”œâ”€â”€ ChatInput.tsx         # Input field
â”‚   â”‚   â”œâ”€â”€ QuickActions.tsx      # Quick action buttons
â”‚   â”‚   â”œâ”€â”€ AnalysisMode.tsx      # Analysis type selector
â”‚   â”‚   â””â”€â”€ ReportExport.tsx      # Export controls
â”‚   â”‚
â”‚   â””â”€â”€ workflows/
â”‚       â””â”€â”€ WorkflowProgress.tsx  # Progress display
â”‚
â””â”€â”€ app/
    â””â”€â”€ api/
        â”œâ”€â”€ assistant/
        â”‚   â””â”€â”€ route.ts          # GLM chat API
        â”‚
        â”œâ”€â”€ analysis/
        â”‚   â””â”€â”€ [type]/
        â”‚       â””â”€â”€ route.ts      # Financial analysis API
        â”‚
        â””â”€â”€ reports/
            â”œâ”€â”€ stock-analysis/
            â”‚   â””â”€â”€ route.ts      # Stock analysis Excel
            â”œâ”€â”€ portfolio-summary/
            â”‚   â””â”€â”€ route.ts      # Portfolio Excel
            â””â”€â”€ backtest-results/
                â””â”€â”€ route.ts      # Backtest Excel
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
pnpm install exceljs
pnpm install zustand  # (likely already installed)
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

