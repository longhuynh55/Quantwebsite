# QuantVN Pro Features Roadmap

## Overview
Implementation of Composer.trade + Koyfin style features for Vietnamese stock market.

## Target Metrics (6 Months)
| Metric | Current | Target |
|--------|---------|--------|
| Unique Features | 0 | 4 (Builder, Dashboard, AI, Community) |
| User Engagement | Baseline | +150% |
| Competitive Moat | Low | High |
| Premium Conversion | 0% | 15% |

---

## Phase 1: Foundation (Weeks 1-4)
**Status:** 🚧 In Progress

### 1.1 Customizable Dashboard Widgets
- [ ] DashboardLayout component
- [ ] WidgetWrapper component
- [ ] WidgetPalette component
- [ ] 6 widget types
- [ ] Layout persistence

### 1.2 Enhanced Charts with Drawing Tools
- [ ] DrawingToolbar component
- [ ] Drawing state management
- [ ] 5 drawing tool types
- [ ] Save/load drawings

---

## Phase 2: Core Features (Weeks 5-10)
**Status:** ⏳ Planned

### 2.1 Visual Strategy Builder
- [ ] StrategyCanvas with React Flow
- [ ] 5 custom node types
- [ ] PropertyPanel
- [ ] Strategy validation
- [ ] Backtesting integration

### 2.2 Real-time Data Infrastructure
- [ ] WebSocketManager
- [ ] SubscriptionManager
- [ ] Zustand stores
- [ ] useRealtimePrice hook

---

## Phase 3: AI & Community (Weeks 11-16)
**Status:** ⏳ Planned

### 3.1 AI Strategy Assistant
- [ ] GLM integration
- [ ] Vietnamese language support
- [ ] Strategy validation

### 3.2 Community Strategy Sharing
- [ ] Strategy marketplace
- [ ] CRUD API
- [ ] Rating system

---

## Phase 4: Polish (Weeks 17-20)
**Status:** ⏳ Planned

- [ ] Multi-chart sync
- [ ] Performance optimization
- [ ] Mobile responsiveness

---

## Dependencies
```json
{
  "react-grid-layout": "^2.2.2",
  "@xyflow/react": "^12.10.1",
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^10.0.0"
}
```
