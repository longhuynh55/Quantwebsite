# Editorial Fintech Style Compliance Tracking

**Worktree:** quant-website (main)
**Branch:** master
**Last Updated:** 2026-02-22
**Style Guide:** EDITORIAL-DESIGN-SYSTEM.md

---

## Executive Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EDITORIAL FINTECH COMPLIANCE STATUS                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Pages Scanned:           11                                                │
│  Pages with Violations:   9 (82%)                                          │
│  Components Scanned:      60+                                               │
│  Components with Issues:  60 (100%)                                        │
│                                                                             │
│  Total "rounded-*" uses:  ~80+                                              │
│  Total "shadow-*" uses:   ~25+                                              │
│  Total "blue-*" uses:     ~6+                                               │
│  Total "gradient" uses:   ~4+                                               │
│                                                                             │
│  COMPLIANCE SCORE:        35% (CRITICAL - Requires Remediation)             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Page-by-Page Analysis

### 🔴 CRITICAL PAGES (High Violation Count)

| Page | rounded-* | shadow-* | blue-* | gradient | Total | Priority |
|------|-----------|----------|--------|----------|-------|----------|
| **ml-lab/page.tsx** | 17 | 1 | 0 | 0 | 18 | P0 |
| **backtesting/page.tsx** | 13 | 7 | 0 | 1 | 21 | P0 |
| **portfolio/page.tsx** | 14 | 6 | 0 | 0 | 20 | P0 |
| **risk/page.tsx** | 12 | 5 | 0 | 0 | 17 | P0 |
| **factors/page.tsx** | 9 | 5 | 0 | 0 | 14 | P0 |
| **charts/page.tsx** | 7 | 0 | 0 | 1 | 8 | P1 |

### 🟡 MODERATE PAGES

| Page | rounded-* | shadow-* | blue-* | gradient | Total | Priority |
|------|-----------|----------|--------|----------|-------|----------|
| **strategy-builder/page.tsx** | 5 | 0 | 0 | 0 | 5 | P1 |
| **community/page.tsx** | 3 | 0 | 0 | 0 | 3 | P2 |
| **learn/page.tsx** | 1 | 1 | 6 | 1 | 9 | P1 |

### 🟢 CLEAN PAGES

| Page | Status |
|------|--------|
| **dashboard/page.tsx** | ✅ No violations |
| **screener/page.tsx** | ✅ No violations |

---

## Component Analysis

### UI Components with Violations (20 files)

| Component | Issues | Remediation |
|-----------|--------|-------------|
| `badge.tsx` | rounded, blue | Remove rounded, use emerald |
| `button.tsx` | rounded, gradient | Solid, uppercase, tracking-wider |
| `card.tsx` | rounded, shadow | Border-defined, flat |
| `chart-wrapper.tsx` | rounded | Sharp corners |
| `command.tsx` | rounded | Sharp corners |
| `DataTable.tsx` | rounded | Sharp corners |
| `dialog.tsx` | rounded, shadow | Border-defined |
| `dropdown-menu.tsx` | rounded | Sharp corners |
| `empty-state.tsx` | rounded | Sharp corners |
| `error-boundary.tsx` | rounded | Sharp corners |
| `error-state.tsx` | rounded | Sharp corners |
| `input.tsx` | rounded | Sharp corners |
| `popover.tsx` | rounded | Sharp corners |
| `progress.tsx` | rounded | Sharp corners |
| `select.tsx` | rounded | Sharp corners |
| `skeleton.tsx` | rounded | Sharp corners |
| `skip-link.tsx` | rounded | Sharp corners |
| `slider.tsx` | rounded | Sharp corners |
| `switch.tsx` | rounded | Sharp corners |
| `tabs.tsx` | rounded | Sharp corners |

### Feature Components with Violations (40+ files)

**AI Assistant:**
- AIResponsePanel.tsx
- StrategyGenerator.tsx
- StrategyPreview.tsx

**Alerts:**
- AlertCenter.tsx

**Assistant:**
- AiAssistantPanel.tsx
- AiAssistantTrigger.tsx
- ChatInput.tsx
- ChatMessage.tsx
- ComposerWorkflow.tsx
- QuickActions.tsx
- TypingIndicator.tsx

**Charts:**
- CandlestickChart.tsx
- CorrelationMatrix.tsx
- DrawdownChart.tsx
- LineChart.tsx
- MonthlyReturnsHeatmap.tsx
- lazy.tsx

**Community:**
- StrategyCard.tsx
- StrategyDetail.tsx
- StrategyImporter.tsx
- StrategyMarketplace.tsx

**Dashboard:**
- DashboardLayout.tsx
- WidgetPalette.tsx
- WidgetWrapper.tsx

**Layout:**
- Footer.tsx
- Header.tsx
- Navbar.tsx
- Sidebar.tsx

**Learn:**
- Callout.tsx
- (and more...)

---

## Style Rules Violated

### ❌ NEVER USE (Found in codebase)

| Pattern | Count | Files |
|---------|-------|-------|
| `rounded-xl` | ~40+ | Most pages |
| `rounded-2xl` | ~25+ | Cards, inputs |
| `rounded-3xl` | ~5+ | Empty states |
| `rounded-lg` | ~10+ | Buttons |
| `shadow-md` | ~10+ | Cards |
| `shadow-lg` | ~8+ | Modals |
| `shadow-sm` | ~7+ | Inputs |
| `bg-blue-600` | ~6+ | Learn pages |
| `bg-gradient-to-r` | ~4+ | Buttons, headers |

### ✅ SHOULD USE (Missing)

| Pattern | Status | Needed In |
|---------|--------|-----------|
| `font-serif` headlines | ❌ Missing | All pages |
| Kicker `w-8 h-px bg-emerald-700` | ❌ Missing | All pages |
| `gap-px bg-stone-200` grid | ❌ Missing | Data grids |
| `border border-stone-200` cards | ❌ Mixed | Card components |
| `uppercase tracking-wider` buttons | ⚠️ Partial | Button components |

---

## Remediation Plan

### Phase 1: UI Components (Foundation) - P0

1. **button.tsx** - Remove rounded, add uppercase tracking-wider
2. **card.tsx** - Remove shadow, add border-defined
3. **input.tsx** - Remove rounded
4. **select.tsx** - Remove rounded
5. **tabs.tsx** - Remove rounded, use underline style
6. **dialog.tsx** - Remove rounded, shadow

### Phase 2: High-Traffic Pages - P0

1. **backtesting/page.tsx** - Full Editorial redesign
2. **portfolio/page.tsx** - Full Editorial redesign
3. **risk/page.tsx** - Full Editorial redesign
4. **factors/page.tsx** - Full Editorial redesign

### Phase 3: Feature Pages - P1

1. **ml-lab/page.tsx** - Full Editorial redesign
2. **charts/page.tsx** - Full Editorial redesign
3. **strategy-builder/page.tsx** - Style update
4. **learn/page.tsx** - Replace blue with emerald

### Phase 4: Feature Components - P1

1. All AI Assistant components
2. All Chart components
3. All Layout components
4. All Community components

### Phase 5: Remaining Pages - P2

1. community/page.tsx
2. learn/[topic]/page.tsx

---

## Progress Tracking

### Completed

- [x] Style guide created (EDITORIAL-DESIGN-SYSTEM.md)
- [x] Compliance tracking created (this document)
- [x] Scan all pages for violations
- [x] Scan all components for violations

### In Progress

- [ ] UI component updates

### Not Started

- [ ] Page redesigns
- [ ] Feature component updates
- [ ] Final compliance verification

---

## Quick Reference: Editorial Fintech Patterns

```tsx
// ✅ CORRECT Headline
<h1 className="font-serif text-4xl font-bold text-stone-900 dark:text-white">

// ✅ CORRECT Kicker
<div className="flex items-center gap-3 mb-2">
  <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
  <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500">
    SECTION LABEL
  </span>
</div>

// ✅ CORRECT Card
<div className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">

// ✅ CORRECT Button (Primary)
<button className="px-6 py-3 bg-emerald-700 dark:bg-emerald-600 text-white
  font-sans font-semibold text-sm uppercase tracking-wider">

// ✅ CORRECT Button (Secondary)
<button className="px-6 py-3 border-2 border-stone-900 dark:border-white
  font-sans font-semibold text-sm uppercase tracking-wider text-stone-900 dark:text-white">

// ✅ CORRECT Grid with Dividers
<div className="grid grid-cols-4 gap-px bg-stone-200 dark:bg-neutral-700">
  <div className="bg-white dark:bg-neutral-900 p-4">Cell 1</div>
  <div className="bg-white dark:bg-neutral-900 p-4">Cell 2</div>
</div>

// ❌ NEVER USE
<div className="rounded-xl shadow-md bg-blue-600 bg-gradient-to-r">
```

---

*Generated: 2026-02-22*
*Next Review: After Phase 1 completion*
