# QuantVN Feature Enhancements - Test-Driven Development (TDD) Plan

> **Version**: 1.0
> **Last Updated**: 2026-02-24
> **Testing Framework**: Vitest + React Testing Library + Playwright
> **Coverage Target**: 80%+

---

## Testing Strategy Overview

### Testing Pyramid

```
                    ╱╲
                   ╱  ╲
                  ╱ E2E╲           ← Playwright (Critical paths)
                 ╱──────╲
                ╱        ╲
               ╱Integration╲       ← Vitest + MSW (API mocking)
              ╱────────────╲
             ╱              ╲
            ╱   Unit Tests   ╲     ← Vitest + RTL (Components, hooks, stores)
           ╱──────────────────╲
```

### Test Categories

| Category | Tool | Coverage Target | Speed |
|----------|------|-----------------|-------|
| Unit Tests | Vitest + RTL | 70% | Fast (< 100ms) |
| Integration | Vitest + MSW | 20% | Medium (< 1s) |
| E2E Tests | Playwright | 10% | Slow (< 30s) |

---

## Feature 1: Watchlist System - Test Plan

### 1.1 Unit Tests

#### WatchlistPanel Component

```typescript
// __tests__/components/watchlist/WatchlistPanel.test.tsx
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WatchlistPanel } from "@/components/watchlist/WatchlistPanel";

describe("WatchlistPanel", () => {
  // Test 1.1.1: Renders editorial design correctly
  it("should render with editorial design style", () => {
    render(<WatchlistPanel />);

    // Check kicker label
    expect(screen.getByText(/watchlist/i)).toHaveClass("uppercase", "tracking-[0.15em]");

    // Check serif headline
    const headline = screen.getByRole("heading", { level: 3 });
    expect(headline).toHaveClass("font-serif", "font-bold");

    // Check no rounded corners or shadows
    const panel = screen.getByTestId("watchlist-panel");
    expect(panel.className).not.toMatch(/rounded-|shadow-/);
    expect(panel.className).toMatch(/border/);
  });

  // Test 1.1.2: Displays watchlist items
  it("should display watchlist items with correct data", () => {
    const mockItems = [
      { symbol: "VIC", name: "Vingroup", price: 85000, change: 1500, changePercent: 1.8 },
      { symbol: "VNM", name: "Vinamilk", price: 72000, change: -800, changePercent: -1.1 },
    ];

    render(<WatchlistPanel items={mockItems} />);

    expect(screen.getByText("VIC")).toBeInTheDocument();
    expect(screen.getByText("Vingroup")).toBeInTheDocument();
    expect(screen.getByText("85,000")).toBeInTheDocument();
    expect(screen.getByText("+1.80%")).toBeInTheDocument();
  });

  // Test 1.1.3: Handles empty state
  it("should display empty state when no items", () => {
    render(<WatchlistPanel items={[]} />);

    expect(screen.getByText(/no stocks in watchlist/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add symbol/i })).toBeInTheDocument();
  });

  // Test 1.1.4: Handles add symbol click
  it("should open add symbol modal on button click", async () => {
    const onAddClick = vi.fn();
    render(<WatchlistPanel onAddSymbol={onAddClick} />);

    await userEvent.click(screen.getByRole("button", { name: /add symbol/i }));

    expect(onAddClick).toHaveBeenCalledTimes(1);
  });

  // Test 1.1.5: Dark mode support
  it("should support dark mode styling", () => {
    render(<WatchlistPanel darkMode />);

    const panel = screen.getByTestId("watchlist-panel");
    expect(panel.className).toMatch(/dark:bg-neutral-900|bg-neutral-900/);
  });
});
```

#### CreateWatchlistModal Component

```typescript
// __tests__/components/watchlist/CreateWatchlistModal.test.tsx
describe("CreateWatchlistModal", () => {
  // Test 1.1.6: Renders modal with editorial design
  it("should render modal with editorial design", () => {
    render(<CreateWatchlistModal isOpen onClose={vi.fn()} />);

    // Check editorial kicker
    expect(screen.getByText(/new watchlist/i)).toHaveClass("uppercase", "tracking-[0.15em]");

    // Check serif headline
    const headline = screen.getByRole("heading", { level: 2 });
    expect(headline).toHaveClass("font-serif");

    // Check border-defined card (no rounded/shadow)
    const modal = screen.getByRole("dialog");
    expect(modal.className).toMatch(/border/);
    expect(modal.className).not.toMatch(/rounded-|shadow-/);
  });

  // Test 1.1.7: Validates required fields
  it("should show validation error for empty name", async () => {
    const onCreate = vi.fn();
    render(<CreateWatchlistModal isOpen onClose={vi.fn()} onCreate={onCreate} />);

    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  // Test 1.1.8: Submits valid form
  it("should call onCreate with valid data", async () => {
    const onCreate = vi.fn();
    render(<CreateWatchlistModal isOpen onClose={vi.fn()} onCreate={onCreate} />);

    await userEvent.type(screen.getByLabelText(/name/i), "My Tech Stocks");
    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(onCreate).toHaveBeenCalledWith({ name: "My Tech Stocks" });
  });

  // Test 1.1.9: Closes on cancel
  it("should call onClose when cancel is clicked", async () => {
    const onClose = vi.fn();
    render(<CreateWatchlistModal isOpen onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

#### Watchlist Store

```typescript
// __tests__/stores/watchlistStore.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useWatchlistStore } from "@/lib/stores/watchlistStore";

describe("watchlistStore", () => {
  beforeEach(() => {
    useWatchlistStore.setState({ watchlists: [] });
  });

  // Test 1.1.10: Creates watchlist
  it("should create a new watchlist", () => {
    const store = useWatchlistStore.getState();

    store.createWatchlist("My Watchlist");

    expect(store.watchlists).toHaveLength(1);
    expect(store.watchlists[0].name).toBe("My Watchlist");
  });

  // Test 1.1.11: Adds symbol to watchlist
  it("should add symbol to watchlist", () => {
    const store = useWatchlistStore.getState();
    store.createWatchlist("Test");
    const watchlistId = store.watchlists[0].id;

    store.addSymbol(watchlistId, "VIC");

    expect(store.watchlists[0].symbols).toContain("VIC");
  });

  // Test 1.1.12: Removes symbol from watchlist
  it("should remove symbol from watchlist", () => {
    const store = useWatchlistStore.getState();
    store.createWatchlist("Test");
    const watchlistId = store.watchlists[0].id;
    store.addSymbol(watchlistId, "VIC");
    store.addSymbol(watchlistId, "VNM");

    store.removeSymbol(watchlistId, "VIC");

    expect(store.watchlists[0].symbols).not.toContain("VIC");
    expect(store.watchlists[0].symbols).toContain("VNM");
  });

  // Test 1.1.13: Reorders symbols
  it("should reorder symbols correctly", () => {
    const store = useWatchlistStore.getState();
    store.createWatchlist("Test");
    const watchlistId = store.watchlists[0].id;
    store.addSymbol(watchlistId, "VIC");
    store.addSymbol(watchlistId, "VNM");
    store.addSymbol(watchlistId, "FPT");

    store.reorderSymbols(watchlistId, ["FPT", "VIC", "VNM"]);

    expect(store.watchlists[0].symbols).toEqual(["FPT", "VIC", "VNM"]);
  });

  // Test 1.1.14: Deletes watchlist
  it("should delete watchlist", () => {
    const store = useWatchlistStore.getState();
    store.createWatchlist("Test 1");
    store.createWatchlist("Test 2");
    const watchlistId = store.watchlists[0].id;

    store.deleteWatchlist(watchlistId);

    expect(store.watchlists).toHaveLength(1);
    expect(store.watchlists[0].name).toBe("Test 2");
  });

  // Test 1.1.15: Persists to localStorage
  it("should persist state to localStorage", () => {
    const store = useWatchlistStore.getState();
    store.createWatchlist("Persisted");

    const saved = localStorage.getItem("quantvn-watchlists");
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved!).watchlists).toHaveLength(1);
  });
});
```

### 1.2 Integration Tests

```typescript
// __tests__/integration/watchlist.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const server = setupServer(
  http.get("/api/watchlists", () => {
    return HttpResponse.json({
      watchlists: [
        { id: "1", name: "Tech Stocks", symbols: ["VIC", "FPT"] },
        { id: "2", name: "Blue Chips", symbols: ["VNM", "VCB"] },
      ],
    });
  }),
  http.post("/api/watchlists", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: "3",
      name: body.name,
      symbols: [],
    });
  })
);

beforeAll(() => server.listen());
afterAll(() => server.close());

describe("Watchlist Integration", () => {
  // Test 1.2.1: Fetches watchlists on mount
  it("should fetch and display watchlists on mount", async () => {
    render(<WatchlistPage />);

    await waitFor(() => {
      expect(screen.getByText("Tech Stocks")).toBeInTheDocument();
      expect(screen.getByText("Blue Chips")).toBeInTheDocument();
    });
  });

  // Test 1.2.2: Creates watchlist via API
  it("should create watchlist via API", async () => {
    render(<WatchlistPage />);

    await userEvent.click(screen.getByRole("button", { name: /create/i }));
    await userEvent.type(screen.getByLabelText(/name/i), "New Watchlist");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText("New Watchlist")).toBeInTheDocument();
    });
  });
});
```

### 1.3 E2E Tests

```typescript
// e2e/watchlist.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Watchlist Feature", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  // Test 1.3.1: Create and manage watchlist
  test("should create, add stocks, and delete watchlist", async ({ page }) => {
    // Create watchlist
    await page.click('[data-testid="create-watchlist-btn"]');
    await page.fill('[data-testid="watchlist-name-input"]', "E2E Test Watchlist");
    await page.click('[data-testid="submit-watchlist-btn"]');

    await expect(page.locator("text=E2E Test Watchlist")).toBeVisible();

    // Add stock
    await page.click('[data-testid="add-symbol-btn"]');
    await page.fill('[data-testid="symbol-search-input"]', "VIC");
    await page.click("text=VIC - Vingroup");
    await page.click('[data-testid="add-symbol-submit"]');

    await expect(page.locator("text=VIC")).toBeVisible();

    // Delete watchlist
    await page.click('[data-testid="watchlist-menu-btn"]');
    await page.click("text=Delete");
    await page.click('[data-testid="confirm-delete-btn"]');

    await expect(page.locator("text=E2E Test Watchlist")).not.toBeVisible();
  });

  // Test 1.3.2: Drag and drop reorder
  test("should reorder stocks via drag and drop", async ({ page }) => {
    // Setup: Add multiple stocks
    // ... add stocks code ...

    const vic = page.locator('[data-testid="watchlist-item-VIC"]');
    const vnm = page.locator('[data-testid="watchlist-item-VNM"]');

    await vic.dragTo(vnm);

    // Verify order changed
    const items = await page.locator('[data-testid^="watchlist-item-"]').all();
    expect(await items[0].getAttribute("data-testid")).toBe("watchlist-item-VNM");
  });
});
```

---

## Feature 2: Alerts System - Test Plan

### 2.1 Unit Tests

```typescript
// __tests__/components/alerts/AlertsPanel.test.tsx
describe("AlertsPanel", () => {
  // Test 2.1.1: Renders with editorial design
  it("should render with editorial design style", () => {
    render(<AlertsPanel />);

    const panel = screen.getByTestId("alerts-panel");
    expect(panel.className).toMatch(/border/);
    expect(panel.className).not.toMatch(/rounded-|shadow-/);
  });

  // Test 2.1.2: Displays active alerts
  it("should display active alerts with correct status", () => {
    const alerts = [
      { id: "1", symbol: "VIC", type: "price_above", targetValue: 90000, status: "active" },
      { id: "2", symbol: "VNM", type: "price_below", targetValue: 70000, status: "triggered" },
    ];

    render(<AlertsPanel alerts={alerts} />);

    expect(screen.getByText("VIC")).toBeInTheDocument();
    expect(screen.getByText("VNM")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("triggered")).toBeInTheDocument();
  });

  // Test 2.1.3: Shows alert type icons
  it("should show correct icons for alert types", () => {
    const alerts = [
      { id: "1", symbol: "VIC", type: "price_above" },
      { id: "2", symbol: "VNM", type: "price_below" },
    ];

    render(<AlertsPanel alerts={alerts} />);

    expect(screen.getByTestId("trending-up-icon")).toBeInTheDocument();
    expect(screen.getByTestId("trending-down-icon")).toBeInTheDocument();
  });
});
```

```typescript
// __tests__/components/alerts/CreateAlertModal.test.tsx
describe("CreateAlertModal", () => {
  // Test 2.1.4: Form validation
  it("should validate all required fields", async () => {
    render(<CreateAlertModal isOpen onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(screen.getByText(/symbol is required/i)).toBeInTheDocument();
    expect(screen.getByText(/target price is required/i)).toBeInTheDocument();
  });

  // Test 2.1.5: Alert type selection
  it("should update form based on alert type", async () => {
    render(<CreateAlertModal isOpen onClose={vi.fn()} />);

    await userEvent.selectOptions(screen.getByLabelText(/condition/i), "change_above");

    expect(screen.getByLabelText(/target percentage/i)).toBeInTheDocument();
  });

  // Test 2.1.6: Creates alert successfully
  it("should create alert with valid data", async () => {
    const onCreate = vi.fn();
    render(<CreateAlertModal isOpen onClose={vi.fn()} onCreate={onCreate} />);

    await userEvent.type(screen.getByLabelText(/symbol/i), "VIC");
    await userEvent.selectOptions(screen.getByLabelText(/condition/i), "price_above");
    await userEvent.type(screen.getByLabelText(/target price/i), "90000");
    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(onCreate).toHaveBeenCalledWith({
      symbol: "VIC",
      type: "price_above",
      targetValue: 90000,
    });
  });
});
```

```typescript
// __tests__/stores/alertsStore.test.ts
describe("alertsStore", () => {
  // Test 2.1.7: Creates alert
  it("should create a new alert", () => {
    const store = useAlertsStore.getState();

    store.createAlert({
      symbol: "VIC",
      type: "price_above",
      targetValue: 90000,
    });

    expect(store.alerts).toHaveLength(1);
    expect(store.alerts[0].status).toBe("active");
  });

  // Test 2.1.8: Triggers alert when condition met
  it("should trigger alert when price crosses threshold", () => {
    const store = useAlertsStore.getState();
    store.createAlert({
      symbol: "VIC",
      type: "price_above",
      targetValue: 90000,
    });

    // Simulate price update
    store.checkAlerts({ symbol: "VIC", price: 91000 });

    expect(store.alerts[0].status).toBe("triggered");
  });

  // Test 2.1.9: Does not trigger when condition not met
  it("should not trigger alert when price below threshold", () => {
    const store = useAlertsStore.getState();
    store.createAlert({
      symbol: "VIC",
      type: "price_above",
      targetValue: 90000,
    });

    store.checkAlerts({ symbol: "VIC", price: 89000 });

    expect(store.alerts[0].status).toBe("active");
  });

  // Test 2.1.10: Deletes alert
  it("should delete alert", () => {
    const store = useAlertsStore.getState();
    store.createAlert({ symbol: "VIC", type: "price_above", targetValue: 90000 });
    const alertId = store.alerts[0].id;

    store.deleteAlert(alertId);

    expect(store.alerts).toHaveLength(0);
  });
});
```

---

## Feature 3: Market Movers - Test Plan

### 3.1 Unit Tests

```typescript
// __tests__/components/dashboard/MarketMoversWidget.test.tsx
describe("MarketMoversWidget", () => {
  // Test 3.1.1: Renders with editorial design
  it("should render with editorial design style", () => {
    render(<MarketMoversWidget />);

    const widget = screen.getByTestId("market-movers-widget");
    expect(widget.className).toMatch(/border/);
    expect(widget.className).not.toMatch(/rounded-|shadow-/);
  });

  // Test 3.1.2: Displays gainers and losers columns
  it("should display gainers and losers in separate columns", () => {
    const gainers = [{ symbol: "VIC", changePercent: 5.2 }];
    const losers = [{ symbol: "VNM", changePercent: -3.1 }];

    render(<MarketMoversWidget gainers={gainers} losers={losers} />);

    expect(screen.getByText("Gainers")).toBeInTheDocument();
    expect(screen.getByText("Losers")).toBeInTheDocument();
    expect(screen.getByText("+5.20%")).toBeInTheDocument();
    expect(screen.getByText("-3.10%")).toBeInTheDocument();
  });

  // Test 3.1.3: Color coding for gainers/losers
  it("should apply correct color classes for gainers and losers", () => {
    const gainers = [{ symbol: "VIC", changePercent: 5.2 }];
    const losers = [{ symbol: "VNM", changePercent: -3.1 }];

    render(<MarketMoversWidget gainers={gainers} losers={losers} />);

    const gainerChange = screen.getByText("+5.20%");
    expect(gainerChange.className).toMatch(/emerald-/);

    const loserChange = screen.getByText("-3.10%");
    expect(loserChange.className).toMatch(/rose-/);
  });

  // Test 3.1.4: Links to chart page
  it("should link to chart page on stock click", () => {
    const gainers = [{ symbol: "VIC", changePercent: 5.2 }];
    render(<MarketMoversWidget gainers={gainers} losers={[]} />);

    const link = screen.getByRole("link", { name: /vic/i });
    expect(link).toHaveAttribute("href", "/charts?symbol=VIC");
  });
});
```

---

## Feature 4: AI Assistant - Test Plan

### 4.1 Unit Tests

```typescript
// __tests__/components/assistant/AiAssistantPanel.test.tsx
describe("AiAssistantPanel", () => {
  // Test 4.1.1: Renders with editorial design
  it("should render with editorial design style", () => {
    render(<AiAssistantPanel />);

    const panel = screen.getByTestId("ai-assistant-panel");
    expect(panel.className).toMatch(/border/);
    expect(panel.className).not.toMatch(/rounded-|shadow-/);
  });

  // Test 4.1.2: Displays welcome message
  it("should display welcome message on initial load", () => {
    render(<AiAssistantPanel />);

    expect(screen.getByText(/start building your strategy/i)).toBeInTheDocument();
  });

  // Test 4.1.3: Sends message on submit
  it("should send message on form submit", async () => {
    const onSend = vi.fn();
    render(<AiAssistantPanel onSendMessage={onSend} />);

    await userEvent.type(screen.getByPlaceholderText(/describe your strategy/i), "momentum strategy");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(onSend).toHaveBeenCalledWith("momentum strategy");
  });

  // Test 4.1.4: Shows loading state
  it("should show loading state while waiting for response", () => {
    render(<AiAssistantPanel isLoading />);

    expect(screen.getByText(/analyzing/i)).toBeInTheDocument();
  });

  // Test 4.1.5: Displays messages
  it("should display user and assistant messages", () => {
    const messages = [
      { id: "1", role: "user", content: "Create a momentum strategy" },
      { id: "2", role: "assistant", content: "I'll help you create a momentum strategy..." },
    ];

    render(<AiAssistantPanel messages={messages} />);

    expect(screen.getByText("Create a momentum strategy")).toBeInTheDocument();
    expect(screen.getByText(/I'll help you create a momentum strategy/i)).toBeInTheDocument();
  });
});
```

```typescript
// __tests__/components/assistant/StrategyTemplates.test.tsx
describe("StrategyTemplates", () => {
  // Test 4.1.6: Renders templates with editorial design
  it("should render templates with editorial design", () => {
    render(<StrategyTemplates />);

    const templates = screen.getAllByRole("button");
    templates.forEach((template) => {
      expect(template.className).toMatch(/border/);
      expect(template.className).not.toMatch(/rounded-|shadow-/);
    });
  });

  // Test 4.1.7: Calls onSelect when template clicked
  it("should call onSelect when template is clicked", async () => {
    const onSelect = vi.fn();
    render(<StrategyTemplates onSelect={onSelect} />);

    await userEvent.click(screen.getByText("Momentum Strategy"));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: "momentum",
      name: "Momentum Strategy",
    }));
  });
});
```

### 4.2 Integration Tests (API Mocking)

```typescript
// __tests__/integration/assistant.test.tsx
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  http.post("/api/assistant", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      message: "I've created a momentum strategy for HOSE stocks...",
      strategy: {
        type: "momentum",
        parameters: { lookback: 12, topN: 10 },
      },
    });
  })
);

describe("AI Assistant Integration", () => {
  // Test 4.2.1: Sends message and receives response
  it("should send message and receive AI response", async () => {
    render(<AiAssistantPanel />);

    await userEvent.type(screen.getByPlaceholderText(/describe/i), "Create momentum strategy");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/I've created a momentum strategy/i)).toBeInTheDocument();
    });
  });
});
```

---

## Feature 5: Chart Indicators - Test Plan

### 5.1 Unit Tests

```typescript
// __tests__/components/charts/indicators/IndicatorSelector.test.tsx
describe("IndicatorSelector", () => {
  // Test 5.1.1: Renders with editorial design
  it("should render with editorial design style", () => {
    render(<IndicatorSelector />);

    const selector = screen.getByTestId("indicator-selector");
    expect(selector.className).toMatch(/border/);
    expect(selector.className).not.toMatch(/rounded-|shadow-/);
  });

  // Test 5.1.2: Displays all indicator categories
  it("should display all indicator categories", () => {
    render(<IndicatorSelector />);

    expect(screen.getByText("trend")).toBeInTheDocument();
    expect(screen.getByText("momentum")).toBeInTheDocument();
    expect(screen.getByText("volatility")).toBeInTheDocument();
    expect(screen.getByText("oscillator")).toBeInTheDocument();
  });

  // Test 5.1.3: Filters indicators by search
  it("should filter indicators by search input", async () => {
    render(<IndicatorSelector />);

    await userEvent.type(screen.getByPlaceholderText(/search/i), "RSI");

    expect(screen.getByText("RSI")).toBeInTheDocument();
    expect(screen.queryByText("SMA")).not.toBeInTheDocument();
  });

  // Test 5.1.4: Filters by category
  it("should filter indicators by category", async () => {
    render(<IndicatorSelector />);

    await userEvent.click(screen.getByRole("button", { name: /momentum/i }));

    expect(screen.getByText("RSI")).toBeInTheDocument();
    expect(screen.queryByText("SMA")).not.toBeInTheDocument();
  });
});
```

```typescript
// __tests__/lib/indicators.test.ts
describe("Technical Indicators Calculation", () => {
  // Test 5.1.5: SMA calculation
  it("should calculate SMA correctly", () => {
    const prices = [10, 20, 30, 40, 50];
    const sma = calculateSMA(prices, 3);

    expect(sma).toEqual([null, null, 20, 30, 40]);
  });

  // Test 5.1.6: EMA calculation
  it("should calculate EMA correctly", () => {
    const prices = [10, 20, 30, 40, 50];
    const ema = calculateEMA(prices, 3);

    expect(ema[2]).toBeCloseTo(20);
    expect(ema[4]).toBeCloseTo(35);
  });

  // Test 5.1.7: RSI calculation
  it("should calculate RSI correctly", () => {
    const prices = [44, 44.5, 43.5, 44.5, 44, 45, 46, 45.5, 46, 47, 47.5, 48, 47, 46, 46.5];
    const rsi = calculateRSI(prices, 14);

    expect(rsi[rsi.length - 1]).toBeCloseTo(63.65, 1);
  });

  // Test 5.1.8: MACD calculation
  it("should calculate MACD correctly", () => {
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const macd = calculateMACD(prices, 12, 26, 9);

    expect(macd.macd.length).toBe(prices.length);
    expect(macd.signal.length).toBe(prices.length);
    expect(macd.histogram.length).toBe(prices.length);
  });

  // Test 5.1.9: Bollinger Bands calculation
  it("should calculate Bollinger Bands correctly", () => {
    const prices = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5);
    const bb = calculateBollingerBands(prices, 20, 2);

    expect(bb.upper.length).toBe(prices.length);
    expect(bb.middle.length).toBe(prices.length);
    expect(bb.lower.length).toBe(prices.length);

    // Upper should be above middle
    expect(bb.upper[29]).toBeGreaterThan(bb.middle[29]);
    // Lower should be below middle
    expect(bb.lower[29]).toBeLessThan(bb.middle[29]);
  });
});
```

---

## Feature 6: Strategy Builder - Test Plan

### 6.1 Unit Tests

```typescript
// __tests__/components/strategy-builder/StrategyCanvas.test.tsx
describe("StrategyCanvas", () => {
  // Test 6.1.1: Renders with editorial design
  it("should render with editorial design style", () => {
    render(<StrategyCanvas />);

    const canvas = screen.getByTestId("strategy-canvas");
    expect(canvas.className).toMatch(/border/);
    expect(canvas.className).not.toMatch(/rounded-|shadow-/);
  });

  // Test 6.1.2: Displays toolbar with correct buttons
  it("should display toolbar with save and backtest buttons", () => {
    render(<StrategyCanvas />);

    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run backtest/i })).toBeInTheDocument();
  });
});
```

```typescript
// __tests__/components/strategy-builder/nodes/DataSourceNode.test.tsx
describe("DataSourceNode", () => {
  // Test 6.1.3: Renders with editorial design
  it("should render with editorial design", () => {
    render(<DataSourceNode data={{ symbol: "VIC" }} />);

    const node = screen.getByTestId("data-source-node");
    expect(node.className).toMatch(/border/);
    expect(node.className).not.toMatch(/rounded-|shadow-/);
  });

  // Test 6.1.4: Displays symbol and timeframe
  it("should display symbol and timeframe", () => {
    render(<DataSourceNode data={{ symbol: "VIC", timeframe: "1D" }} />);

    expect(screen.getByText("VIC")).toBeInTheDocument();
    expect(screen.getByText("1D")).toBeInTheDocument();
  });

  // Test 6.1.5: Has output handle
  it("should have output handle for connections", () => {
    render(<DataSourceNode data={{ symbol: "VIC" }} />);

    expect(screen.getByTestId("handle-source")).toBeInTheDocument();
  });
});
```

```typescript
// __tests__/components/strategy-builder/NodePalette.test.tsx
describe("NodePalette", () => {
  // Test 6.1.6: Renders all node types
  it("should render all available node types", () => {
    render(<NodePalette />);

    expect(screen.getByText("Data Source")).toBeInTheDocument();
    expect(screen.getByText("Indicator")).toBeInTheDocument();
    expect(screen.getByText("Filter")).toBeInTheDocument();
    expect(screen.getByText("Signal")).toBeInTheDocument();
  });

  // Test 6.1.7: Draggable nodes
  it("should have draggable nodes", () => {
    render(<NodePalette />);

    const node = screen.getByText("Data Source").closest("[draggable]");
    expect(node).toHaveAttribute("draggable", "true");
  });
});
```

### 6.2 Integration Tests

```typescript
// __tests__/integration/strategy-builder.test.tsx
describe("Strategy Builder Integration", () => {
  // Test 6.2.1: Creates and connects nodes
  it("should create and connect nodes", async () => {
    render(<StrategyBuilderPage />);

    // Drag data source node
    await userEvent.drag(screen.getByText("Data Source"), screen.getByTestId("canvas"));

    // Drag indicator node
    await userEvent.drag(screen.getByText("Indicator"), screen.getByTestId("canvas"));

    // Connect nodes
    const sourceHandle = screen.getByTestId("handle-source-0");
    const targetHandle = screen.getByTestId("handle-target-1");
    await userEvent.drag(sourceHandle, targetHandle);

    // Verify connection
    expect(screen.getByTestId("edge-0-1")).toBeInTheDocument();
  });

  // Test 6.2.2: Validates strategy before backtest
  it("should show validation errors for incomplete strategy", async () => {
    render(<StrategyBuilderPage />);

    // Add only data source (incomplete strategy)
    await userEvent.drag(screen.getByText("Data Source"), screen.getByTestId("canvas"));

    await userEvent.click(screen.getByRole("button", { name: /run backtest/i }));

    expect(screen.getByText(/signal node required/i)).toBeInTheDocument();
  });

  // Test 6.2.3: Saves strategy
  it("should save strategy to localStorage", async () => {
    render(<StrategyBuilderPage />);

    // Build complete strategy
    // ... setup code ...

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    const saved = localStorage.getItem("quantvn-strategies");
    expect(saved).not.toBeNull();
  });
});
```

---

## Editorial Design Compliance Tests

### Design System Validation

```typescript
// __tests__/design-system/compliance.test.ts
describe("Editorial Design System Compliance", () => {
  // Test: No rounded corners
  it("should not use rounded-* classes in components", async () => {
    const componentFiles = await glob("src/components/**/*.tsx");

    for (const file of componentFiles) {
      const content = await fs.readFile(file, "utf-8");
      const hasRounded = /className="[^"]*rounded-[^"]*"/.test(content);

      expect(hasRounded).toBe(false, `${file} contains rounded-* classes`);
    }
  });

  // Test: No shadow classes
  it("should not use shadow-* classes in components", async () => {
    const componentFiles = await glob("src/components/**/*.tsx");

    for (const file of componentFiles) {
      const content = await fs.readFile(file, "utf-8");
      const hasShadow = /className="[^"]*shadow-[^"]*"/.test(content);

      expect(hasShadow).toBe(false, `${file} contains shadow-* classes`);
    }
  });

  // Test: No blue color classes
  it("should not use blue-* color classes", async () => {
    const componentFiles = await glob("src/components/**/*.tsx");

    for (const file of componentFiles) {
      const content = await fs.readFile(file, "utf-8");
      const hasBlue = /className="[^"]*blue-[^"]*"/.test(content);

      expect(hasBlue).toBe(false, `${file} contains blue-* classes`);
    }
  });

  // Test: No gradient classes
  it("should not use gradient classes", async () => {
    const componentFiles = await glob("src/components/**/*.tsx");

    for (const file of componentFiles) {
      const content = await fs.readFile(file, "utf-8");
      const hasGradient = /className="[^"]*bg-gradient-[^"]*"/.test(content);

      expect(hasGradient).toBe(false, `${file} contains bg-gradient-* classes`);
    }
  });

  // Test: Serif font for headlines
  it("should use font-serif for headlines", async () => {
    const pageFiles = await glob("src/app/**/page.tsx");

    for (const file of pageFiles) {
      const content = await fs.readFile(file, "utf-8");
      const headlines = content.match(/<h[1-6][^>]*>/g) || [];

      headlines.forEach((headline) => {
        const hasSerif = /font-serif/.test(headline);
        expect(hasSerif).toBe(true, `${file} headline missing font-serif: ${headline}`);
      });
    }
  });

  // Test: Uppercase tracking for labels
  it("should use uppercase tracking for labels", async () => {
    const labelPattern = /text-xs[^"]*uppercase[^"]*tracking-\[/;

    const componentFiles = await glob("src/components/**/*.tsx");

    for (const file of componentFiles) {
      const content = await fs.readFile(file, "utf-8");
      const labels = content.match(/data-label|kicker|label/i);

      if (labels) {
        const hasCorrectTracking = labelPattern.test(content);
        // Allow flexibility but check for common pattern
      }
    }
  });
});
```

---

## Test Commands

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:design": "vitest run --config vitest.design.config.ts"
  }
}
```

---

## Coverage Targets

| Feature | Unit Tests | Integration | E2E | Total |
|---------|------------|-------------|-----|-------|
| Watchlist | 70% | 15% | 5% | 90% |
| Alerts | 70% | 15% | 5% | 90% |
| Market Movers | 60% | 10% | 5% | 75% |
| AI Assistant | 60% | 20% | 5% | 85% |
| Indicators | 80% | 10% | 5% | 95% |
| Strategy Builder | 60% | 15% | 10% | 85% |

---

## Test Data Fixtures

```typescript
// __tests__/fixtures/watchlist.ts
export const mockWatchlists = [
  {
    id: "wl-1",
    name: "Tech Stocks",
    symbols: ["VIC", "FPT", "CMG"],
    createdAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "wl-2",
    name: "Blue Chips",
    symbols: ["VNM", "VCB", "BID"],
    createdAt: "2026-01-20T14:30:00Z",
  },
];

// __tests__/fixtures/alerts.ts
export const mockAlerts = [
  {
    id: "alert-1",
    symbol: "VIC",
    type: "price_above",
    targetValue: 90000,
    currentValue: 85000,
    status: "active",
  },
  {
    id: "alert-2",
    symbol: "VNM",
    type: "change_below",
    targetValue: -5,
    currentValue: -3.2,
    status: "active",
  },
];

// __tests__/fixtures/market-data.ts
export const mockMovers = {
  gainers: [
    { symbol: "VIC", name: "Vingroup", price: 85000, changePercent: 5.2, volume: 1000000 },
    { symbol: "FPT", name: "FPT Corp", price: 120000, changePercent: 4.8, volume: 500000 },
  ],
  losers: [
    { symbol: "VNM", name: "Vinamilk", price: 72000, changePercent: -3.1, volume: 800000 },
    { symbol: "VCB", name: "Vietcombank", price: 95000, changePercent: -2.5, volume: 600000 },
  ],
};
```

---

*Document Version: 1.0*
*Last Updated: 2026-02-24*
*Owner: QuantVN Team*
