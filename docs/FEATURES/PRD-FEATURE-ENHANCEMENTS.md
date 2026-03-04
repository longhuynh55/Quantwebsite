# QuantVN Feature Enhancements - Product Requirements Document (PRD)

> **Version**: 1.0
> **Last Updated**: 2026-02-24
> **Design System**: EDITORIAL-DESIGN-SYSTEM.md
> **Reference**: Koyfin, Composer.trade

---

## Executive Summary

This PRD outlines six major feature enhancements for QuantVN, a quantitative finance platform for the Vietnamese stock market (HOSE). All features must comply with the Editorial Fintech Design System.

---

## Feature 1: Enhanced Watchlist System

### 1.1 Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 (Critical) |
| **Effort** | Medium (3-5 days) |
| **Dependencies** | None |
| **Reference** | Koyfin Watchlists |

### 1.2 User Stories

```
US-1.1: As a trader, I want to create multiple watchlists so I can organize stocks by strategy
US-1.2: As a trader, I want to add/remove stocks from watchlists via drag-and-drop
US-1.3: As a trader, I want to see real-time price updates for watched stocks
US-1.4: As a trader, I want to reorder stocks within a watchlist
US-1.5: As a trader, I want to share watchlists with other users
US-1.6: As a trader, I want to duplicate an existing watchlist
```

### 1.3 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-1.1 | Create new watchlist with custom name | P0 | Pending |
| FR-1.2 | Add stock to watchlist via search or symbol input | P0 | Pending |
| FR-1.3 | Remove stock from watchlist | P0 | Pending |
| FR-1.4 | Display stock price, change, change% in real-time | P0 | Pending |
| FR-1.5 | Reorder stocks via drag-and-drop | P1 | Pending |
| FR-1.6 | Delete watchlist with confirmation | P0 | Pending |
| FR-1.7 | Rename watchlist | P1 | Pending |
| FR-1.8 | Export watchlist as CSV | P2 | Pending |
| FR-1.9 | Import watchlist from CSV | P2 | Pending |
| FR-1.10 | Persist watchlists to localStorage | P0 | Pending |
| FR-1.11 | Sync watchlists to backend (authenticated users) | P1 | Pending |

### 1.4 Non-Functional Requirements

| ID | Requirement | Metric |
|----|-------------|--------|
| NFR-1.1 | Real-time price latency | < 500ms |
| NFR-1.2 | Watchlist load time | < 200ms |
| NFR-1.3 | Support up to 100 stocks per watchlist | - |
| NFR-1.4 | Support up to 20 watchlists per user | - |

### 1.5 UI Components (Editorial Design Compliant)

```
src/components/watchlist/
├── WatchlistPanel.tsx        # Main container
├── WatchlistHeader.tsx       # Section header with kicker
├── WatchlistItem.tsx         # Individual stock row
├── WatchlistSelector.tsx     # Dropdown to switch watchlists
├── CreateWatchlistModal.tsx  # Modal for new watchlist
├── AddSymbolModal.tsx        # Modal to add symbols
└── index.ts
```

### 1.6 API Endpoints

```
GET    /api/watchlists              # Get all user watchlists
POST   /api/watchlists              # Create new watchlist
GET    /api/watchlists/:id          # Get watchlist by ID
PUT    /api/watchlists/:id          # Update watchlist
DELETE /api/watchlists/:id          # Delete watchlist
POST   /api/watchlists/:id/symbols  # Add symbols to watchlist
DELETE /api/watchlists/:id/symbols  # Remove symbols from watchlist
PUT    /api/watchlists/:id/reorder  # Reorder symbols
```

### 1.7 State Management

```typescript
// src/lib/stores/watchlistStore.ts
interface WatchlistState {
  watchlists: Watchlist[];
  activeWatchlistId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchWatchlists: () => Promise<void>;
  createWatchlist: (name: string) => Promise<Watchlist>;
  deleteWatchlist: (id: string) => Promise<void>;
  addSymbol: (watchlistId: string, symbol: string) => Promise<void>;
  removeSymbol: (watchlistId: string, symbol: string) => Promise<void>;
  reorderSymbols: (watchlistId: string, symbols: string[]) => Promise<void>;
  setActiveWatchlist: (id: string) => void;
}
```

---

## Feature 2: Price Alerts & Notifications System

### 2.1 Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 (Critical) |
| **Effort** | Medium (3-5 days) |
| **Dependencies** | WebSocket infrastructure |
| **Reference** | Koyfin Alerts |

### 2.2 User Stories

```
US-2.1: As a trader, I want to set price alerts for stocks I'm watching
US-2.2: As a trader, I want to receive notifications when alerts trigger
US-2.3: As a trader, I want to set alerts for price above/below thresholds
US-2.4: As a trader, I want to set alerts for percentage changes
US-2.5: As a trader, I want to manage (edit/delete) my alerts
US-2.6: As a trader, I want to see alert history
```

### 2.3 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-2.1 | Create price alert (above/below) | P0 | Pending |
| FR-2.2 | Create percentage change alert | P0 | Pending |
| FR-2.3 | Create volume alert | P1 | Pending |
| FR-2.4 | Display active alerts list | P0 | Pending |
| FR-2.5 | Display triggered alerts history | P1 | Pending |
| FR-2.6 | Edit existing alert | P1 | Pending |
| FR-2.7 | Delete alert | P0 | Pending |
| FR-2.8 | Pause/resume alert | P2 | Pending |
| FR-2.9 | Browser notification on trigger | P0 | Pending |
| FR-2.10 | In-app toast notification | P0 | Pending |
| FR-2.11 | Email notification (optional) | P2 | Pending |

### 2.4 Alert Types

```typescript
type AlertType =
  | "price_above"      // Price > X
  | "price_below"      // Price < X
  | "change_above"     // Change % > X
  | "change_below"     // Change % < X
  | "volume_above"     // Volume > X
  | "volume_below";    // Volume < X

interface Alert {
  id: string;
  symbol: string;
  type: AlertType;
  targetValue: number;
  currentValue: number;
  status: "active" | "triggered" | "paused";
  createdAt: string;
  triggeredAt?: string;
  notificationSent: boolean;
}
```

### 2.5 Non-Functional Requirements

| ID | Requirement | Metric |
|----|-------------|--------|
| NFR-2.1 | Alert trigger latency | < 1 second |
| NFR-2.2 | Notification delivery | < 3 seconds |
| NFR-2.3 | Support 50 active alerts per user | - |

### 2.6 UI Components

```
src/components/alerts/
├── AlertsPanel.tsx           # Main alerts container
├── AlertItem.tsx             # Individual alert row
├── CreateAlertModal.tsx      # Create new alert
├── AlertNotification.tsx     # Toast notification
├── AlertHistoryPanel.tsx     # Triggered alerts
└── index.ts
```

### 2.7 API Endpoints

```
GET    /api/alerts              # Get all user alerts
POST   /api/alerts              # Create new alert
PUT    /api/alerts/:id          # Update alert
DELETE /api/alerts/:id          # Delete alert
GET    /api/alerts/history      # Get alert history
POST   /api/alerts/:id/pause    # Pause alert
POST   /api/alerts/:id/resume   # Resume alert
```

---

## Feature 3: Market Movers Widget

### 3.1 Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 (High) |
| **Effort** | Low (1-2 days) |
| **Dependencies** | Market data API |
| **Reference** | Koyfin Market Movers |

### 3.2 User Stories

```
US-3.1: As a trader, I want to see top gainers in HOSE market
US-3.2: As a trader, I want to see top losers in HOSE market
US-3.3: As a trader, I want to see most active stocks by volume
US-3.4: As a trader, I want to click a stock to view its chart
```

### 3.3 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-3.1 | Display top 10 gainers | P0 | Pending |
| FR-3.2 | Display top 10 losers | P0 | Pending |
| FR-3.3 | Display top 10 by volume | P1 | Pending |
| FR-3.4 | Auto-refresh every 30 seconds | P0 | Pending |
| FR-3.5 | Click to navigate to chart page | P0 | Pending |
| FR-3.6 | Filter by market (HOSE/HNX/UPCOM) | P1 | Pending |
| FR-3.7 | Configurable number of items | P2 | Pending |

### 3.4 UI Components

```
src/components/dashboard/widgets/
├── MarketMoversWidget.tsx    # Main widget
├── MoversColumn.tsx          # Gainers/Losers column
├── MoverItem.tsx             # Individual stock row
└── index.ts
```

### 3.5 API Endpoints

```
GET /api/market/movers?type=gainers&limit=10&market=HOSE
GET /api/market/movers?type=losers&limit=10&market=HOSE
GET /api/market/movers?type=volume&limit=10&market=HOSE
```

---

## Feature 4: AI-Powered Strategy Assistant

### 4.1 Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 (High) |
| **Effort** | High (7-10 days) |
| **Dependencies** | GLM API integration |
| **Reference** | Composer.trade AI |

### 4.2 User Stories

```
US-4.1: As a user, I want to describe my strategy in natural language
US-4.2: As a user, I want the AI to suggest strategy improvements
US-4.3: As a user, I want to select from pre-built strategy templates
US-4.4: As a user, I want the AI to explain strategy logic
US-4.5: As a user, I want to export AI-generated strategies to the builder
```

### 4.3 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-4.1 | Chat interface for strategy input | P0 | Pending |
| FR-4.2 | Natural language strategy parsing | P0 | Pending |
| FR-4.3 | Strategy template library | P0 | Pending |
| FR-4.4 | Strategy explanation generation | P1 | Pending |
| FR-4.5 | Export to Strategy Builder | P1 | Pending |
| FR-4.6 | Chat history persistence | P1 | Pending |
| FR-4.7 | Vietnamese language support | P1 | Pending |
| FR-4.8 | Context-aware suggestions | P2 | Pending |

### 4.4 GLM API Integration

```typescript
// src/app/api/assistant/route.ts
const GLM_CONFIG = {
  baseUrl: "https://api.z.ai/api/coding/paas/v4",
  model: "glm-4.7-flash",
  apiKey: process.env.GLM_API_KEY
};

interface AssistantMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface StrategySuggestion {
  type: "momentum" | "value" | "mean_reversion" | "custom";
  description: string;
  parameters: Record<string, unknown>;
  code?: string;
}
```

### 4.5 UI Components

```
src/components/assistant/
├── AiAssistantPanel.tsx      # Main chat panel
├── ChatMessage.tsx           # Message bubble
├── ChatInput.tsx             # Input field
├── StrategyTemplates.tsx     # Quick templates
├── SuggestedActions.tsx      # Quick action buttons
└── index.ts
```

### 4.6 Pre-built Templates

| Template | Description |
|----------|-------------|
| Momentum | Buy stocks with 12-month momentum |
| Value | Invest in low P/E stocks |
| Dividend | High dividend yield strategy |
| Low Volatility | Minimum variance portfolio |
| Mean Reversion | Buy oversold, sell overbought |
| Pairs Trading | Cointegrated pair trading |

---

## Feature 5: Enhanced Chart Indicators

### 5.1 Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 (High) |
| **Effort** | Medium (3-5 days) |
| **Dependencies** | lightweight-charts, technicalindicators |
| **Reference** | TradingView |

### 5.2 User Stories

```
US-5.1: As a trader, I want to add RSI indicator to charts
US-5.2: As a trader, I want to add MACD indicator to charts
US-5.3: As a trader, I want to add Bollinger Bands to charts
US-5.4: As a trader, I want to customize indicator parameters
US-5.5: As a trader, I want to save my indicator preferences
```

### 5.3 Indicator Specifications

| Indicator | Type | Default Params | Category |
|-----------|------|----------------|----------|
| SMA | Overlay | period: 20 | Trend |
| EMA | Overlay | period: 20 | Trend |
| RSI | Pane | period: 14, overbought: 70, oversold: 30 | Momentum |
| MACD | Pane | fast: 12, slow: 26, signal: 9 | Oscillator |
| Bollinger Bands | Overlay | period: 20, stdDev: 2 | Volatility |
| ATR | Pane | period: 14 | Volatility |
| Stochastic | Pane | k: 14, d: 3, smooth: 3 | Momentum |
| OBV | Pane | - | Volume |

### 5.4 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-5.1 | Add RSI indicator | P0 | Pending |
| FR-5.2 | Add MACD indicator | P0 | Pending |
| FR-5.3 | Add Bollinger Bands | P0 | Pending |
| FR-5.4 | Add Stochastic | P1 | Pending |
| FR-5.5 | Add ATR | P1 | Pending |
| FR-5.6 | Add OBV | P1 | Pending |
| FR-5.7 | Customize indicator parameters | P0 | Pending |
| FR-5.8 | Remove indicator | P0 | Pending |
| FR-5.9 | Persist indicator settings | P1 | Pending |
| FR-5.10 | Indicator search/filter | P1 | Pending |

### 5.5 UI Components

```
src/components/charts/indicators/
├── IndicatorSelector.tsx      # Indicator picker panel
├── IndicatorConfig.tsx        # Parameter configuration
├── IndicatorOverlay.tsx       # Overlay indicators (MA, BB)
├── IndicatorPane.tsx          # Pane indicators (RSI, MACD)
├── indicators/
│   ├── RSI.tsx
│   ├── MACD.tsx
│   ├── BollingerBands.tsx
│   ├── Stochastic.tsx
│   ├── ATR.tsx
│   └── OBV.tsx
└── index.ts
```

---

## Feature 6: Enhanced Strategy Builder

### 6.1 Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 (High) |
| **Effort** | High (7-10 days) |
| **Dependencies** | React Flow, Backtesting API |
| **Reference** | Composer.trade Visual Builder |

### 6.2 User Stories

```
US-6.1: As a user, I want to drag-and-drop strategy blocks
US-6.2: As a user, I want to connect blocks to define data flow
US-6.3: As a user, I want to configure each block's parameters
US-6.4: As a user, I want to validate my strategy before backtesting
US-6.5: As a user, I want to save/load strategies
US-6.6: As a user, I want to export strategy code
```

### 6.3 Node Types

| Node Type | Description | Inputs | Outputs |
|-----------|-------------|--------|---------|
| DataSource | Stock/ETF data | - | OHLCV |
| Indicator | Technical indicator | Price | Value |
| Filter | Screening condition | Data | Filtered |
| Signal | Buy/Sell generation | Data | Signals |
| Position | Position sizing | Signals | Positions |
| Output | Results/Visualization | Data | - |

### 6.4 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-6.1 | Drag-and-drop nodes | P0 | Pending |
| FR-6.2 | Connect nodes with edges | P0 | Pending |
| FR-6.3 | Configure node parameters | P0 | Pending |
| FR-6.4 | Delete nodes/edges | P0 | Pending |
| FR-6.5 | Validate strategy connections | P0 | Pending |
| FR-6.6 | Save strategy to localStorage | P0 | Pending |
| FR-6.7 | Load saved strategies | P0 | Pending |
| FR-6.8 | Export as Python code | P1 | Pending |
| FR-6.9 | Undo/Redo actions | P2 | Pending |
| FR-6.10 | Strategy templates | P1 | Pending |

### 6.5 UI Components

```
src/components/strategy-builder/
├── StrategyCanvas.tsx        # Main React Flow canvas
├── NodePalette.tsx           # Draggable node library
├── PropertyPanel.tsx         # Node configuration panel
├── nodes/
│   ├── DataSourceNode.tsx
│   ├── IndicatorNode.tsx
│   ├── FilterNode.tsx
│   ├── SignalNode.tsx
│   ├── PositionNode.tsx
│   └── OutputNode.tsx
├── edges/
│   └── CustomEdge.tsx
└── index.ts
```

---

## Timeline & Milestones

### Sprint 1 (Week 1-2): Core Features
- [ ] Feature 1: Watchlist System (P0)
- [ ] Feature 2: Alerts System (P0)
- [ ] Feature 3: Market Movers Widget (P1)

### Sprint 2 (Week 3-4): Advanced Features
- [ ] Feature 4: AI Assistant (P1)
- [ ] Feature 5: Chart Indicators (P1)

### Sprint 3 (Week 5-6): Strategy Builder
- [ ] Feature 6: Strategy Builder Enhancement (P1)

---

## Success Metrics

| Feature | Metric | Target |
|---------|--------|--------|
| Watchlist | Daily Active Users using watchlists | 60% |
| Alerts | Alerts created per user per week | 5+ |
| Market Movers | Widget engagement rate | 40% |
| AI Assistant | Queries per session | 3+ |
| Indicators | Indicators per chart | 2+ |
| Strategy Builder | Strategies saved per user | 2+ |

---

*Document Version: 1.0*
*Last Updated: 2026-02-24*
*Owner: QuantVN Team*
