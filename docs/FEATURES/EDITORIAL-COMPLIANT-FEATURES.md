# QuantVN Feature Enhancements - Editorial Design Compliant

> **Design System**: All features must follow `EDITORIAL-DESIGN-SYSTEM.md`
> **Style**: Editorial Fintech (Bloomberg, Financial Times, Wall Street Journal aesthetic)

---

## Design Principles Summary

### Typography
```
HEADLINES: font-serif text-4xl font-bold tracking-tight text-stone-900 dark:text-white
BODY: font-sans text-sm text-stone-600 dark:text-neutral-400
LABELS: text-xs uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500
```

### Colors
```
LIGHT MODE:
- Backgrounds: stone-50, stone-100, white
- Text: stone-900 (primary), stone-600 (secondary), stone-500 (muted)
- Accent: emerald-700 (primary), emerald-800 (hover)
- Borders: stone-200, stone-300

DARK MODE:
- Backgrounds: neutral-950, neutral-900
- Text: white (primary), neutral-400 (secondary), neutral-500 (muted)
- Accent: emerald-400 (primary), emerald-300 (hover)
- Borders: neutral-800, neutral-700
```

### Component Patterns
```
CARDS: border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900
BUTTONS: uppercase tracking-wider font-semibold
NO: rounded-*, shadow-*, bg-gradient-*, blue-*
```

---

## Feature 1: Enhanced Watchlist System (Koyfin-style)

### Component: WatchlistPanel

```tsx
// WatchlistPanel.tsx - Editorial Design Compliant
"use client";

import { useState } from "react";
import { Plus, TrendingUp, TrendingDown, GripVertical } from "lucide-react";

interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export function WatchlistPanel() {
  const [items, setItems] = useState<WatchlistItem[]>([]);

  return (
    <div className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      {/* Section Header - Editorial Style */}
      <div className="border-b border-stone-200 dark:border-neutral-800 p-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-400" />
          <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
            Watchlist
          </span>
        </div>
        <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-white">
          My Stocks
        </h3>
      </div>

      {/* Watchlist Items */}
      <div className="divide-y divide-stone-100 dark:divide-neutral-800">
        {items.map((item) => (
          <div
            key={item.symbol}
            className="flex items-center justify-between p-4 hover:bg-stone-50 dark:hover:bg-neutral-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <GripVertical className="w-4 h-4 text-stone-300 dark:text-neutral-600 cursor-grab" />
              <div>
                <span className="font-bold text-stone-900 dark:text-white">
                  {item.symbol}
                </span>
                <p className="text-xs text-stone-500 dark:text-neutral-500">
                  {item.name}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="font-serif text-lg font-bold text-stone-900 dark:text-white">
                {item.price.toLocaleString()}
              </div>
              <div className={cn(
                "text-xs font-sans uppercase tracking-wider",
                item.change >= 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              )}>
                {item.change >= 0 ? "+" : ""}{item.changePercent.toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Button - Editorial Style */}
      <button className="w-full p-4 border-t border-stone-200 dark:border-neutral-800
        text-stone-500 dark:text-neutral-500
        hover:bg-stone-50 dark:hover:bg-neutral-800/50
        font-sans text-sm uppercase tracking-wider font-semibold
        transition-colors">
        <Plus className="w-4 h-4 inline mr-2" />
        Add Symbol
      </button>
    </div>
  );
}
```

### Create Watchlist Modal

```tsx
// CreateWatchlistModal.tsx - Editorial Design Compliant
"use client";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function CreateWatchlistModal({ isOpen, onClose }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <div className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 max-w-md">
        {/* Modal Header */}
        <div className="border-b border-stone-200 dark:border-neutral-800 p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-400" />
            <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
              New Watchlist
            </span>
          </div>
          <h2 className="font-serif text-2xl font-bold text-stone-900 dark:text-white">
            Create Watchlist
          </h2>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500 mb-2">
              Name
            </label>
            <input
              type="text"
              className="w-full border border-stone-200 dark:border-neutral-800
                bg-white dark:bg-neutral-900
                px-4 py-3
                font-sans text-sm text-stone-900 dark:text-white
                focus:border-emerald-700 dark:focus:border-emerald-400
                outline-none transition-colors"
              placeholder="Enter watchlist name..."
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-stone-200 dark:border-neutral-800 p-6 flex justify-end gap-3">
          <Button variant="outline" className="uppercase tracking-wider">
            Cancel
          </Button>
          <Button className="bg-emerald-700 dark:bg-emerald-600 text-white uppercase tracking-wider">
            Create
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
```

---

## Feature 2: Price Alerts & Notifications System

### Component: AlertsPanel

```tsx
// AlertsPanel.tsx - Editorial Design Compliant
"use client";

import { Bell, TrendingUp, TrendingDown, X } from "lucide-react";

interface Alert {
  id: string;
  symbol: string;
  type: "price_above" | "price_below";
  targetPrice: number;
  currentPrice: number;
  status: "active" | "triggered";
}

export function AlertsPanel() {
  return (
    <div className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      {/* Section Header */}
      <div className="border-b border-stone-200 dark:border-neutral-800 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-400" />
              <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
                Price Alerts
              </span>
            </div>
            <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-white">
              Notifications
            </h3>
          </div>
          <button className="bg-emerald-700 dark:bg-emerald-600 text-white
            px-4 py-2 font-sans text-xs uppercase tracking-wider font-semibold
            hover:bg-emerald-800 dark:hover:bg-emerald-500 transition-colors">
            <Bell className="w-3 h-3 inline mr-2" />
            New Alert
          </button>
        </div>
      </div>

      {/* Alert Items */}
      <div className="divide-y divide-stone-100 dark:divide-neutral-800">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={cn(
              "flex items-center justify-between p-4",
              alert.status === "triggered" && "bg-emerald-50 dark:bg-emerald-950/50"
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-8 h-8 flex items-center justify-center",
                alert.type === "price_above"
                  ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400"
                  : "bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400"
              )}>
                {alert.type === "price_above"
                  ? <TrendingUp className="w-4 h-4" />
                  : <TrendingDown className="w-4 h-4" />
                }
              </div>
              <div>
                <span className="font-bold text-stone-900 dark:text-white">
                  {alert.symbol}
                </span>
                <p className="text-xs text-stone-500 dark:text-neutral-500 uppercase tracking-wider">
                  {alert.type === "price_above" ? "Above" : "Below"} {alert.targetPrice.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="font-serif text-lg font-bold text-stone-900 dark:text-white">
                {alert.currentPrice.toLocaleString()}
              </div>
              <span className={cn(
                "text-xs font-sans uppercase tracking-wider px-2 py-0.5",
                alert.status === "triggered"
                  ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400"
                  : "bg-stone-100 dark:bg-neutral-800 text-stone-500 dark:text-neutral-500"
              )}>
                {alert.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Create Alert Modal

```tsx
// CreateAlertModal.tsx - Editorial Design Compliant
export function CreateAlertModal() {
  return (
    <div className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 max-w-md">
      {/* Header */}
      <div className="border-b border-stone-200 dark:border-neutral-800 p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-400" />
          <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
            New Alert
          </span>
        </div>
        <h2 className="font-serif text-2xl font-bold text-stone-900 dark:text-white">
          Create Price Alert
        </h2>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        {/* Symbol Input */}
        <div>
          <label className="block text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500 mb-2">
            Symbol
          </label>
          <input
            type="text"
            className="w-full border border-stone-200 dark:border-neutral-800
              bg-white dark:bg-neutral-900 px-4 py-3
              font-sans text-sm text-stone-900 dark:text-white
              focus:border-emerald-700 dark:focus:border-emerald-400
              outline-none transition-colors"
            placeholder="VIC, VNM, FPT..."
          />
        </div>

        {/* Condition Select */}
        <div>
          <label className="block text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500 mb-2">
            Condition
          </label>
          <select className="w-full border border-stone-200 dark:border-neutral-800
            bg-white dark:bg-neutral-900 px-4 py-3
            font-sans text-sm text-stone-900 dark:text-white
            focus:border-emerald-700 dark:focus:border-emerald-400
            outline-none transition-colors appearance-none">
            <option value="price_above">Price Above</option>
            <option value="price_below">Price Below</option>
            <option value="change_above">Change % Above</option>
            <option value="change_below">Change % Below</option>
          </select>
        </div>

        {/* Target Price */}
        <div>
          <label className="block text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500 mb-2">
            Target Price
          </label>
          <input
            type="number"
            className="w-full border border-stone-200 dark:border-neutral-800
              bg-white dark:bg-neutral-900 px-4 py-3
              font-sans text-sm text-stone-900 dark:text-white
              focus:border-emerald-700 dark:focus:border-emerald-400
              outline-none transition-colors"
            placeholder="0"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-stone-200 dark:border-neutral-800 p-6 flex justify-end gap-3">
        <button className="px-6 py-3 border-2 border-stone-900 dark:border-white
          text-stone-900 dark:text-white
          font-sans text-sm uppercase tracking-wider font-semibold
          hover:bg-stone-900 dark:hover:bg-white
          hover:text-white dark:hover:text-stone-900
          transition-colors">
          Cancel
        </button>
        <button className="px-6 py-3 bg-emerald-700 dark:bg-emerald-600 text-white
          font-sans text-sm uppercase tracking-wider font-semibold
          hover:bg-emerald-800 dark:hover:bg-emerald-500
          transition-colors">
          Create Alert
        </button>
      </div>
    </div>
  );
}
```

---

## Feature 3: Market Movers Widget

### Component: MarketMoversWidget

```tsx
// MarketMoversWidget.tsx - Editorial Design Compliant
"use client";

import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import Link from "next/link";

interface MoverItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

export function MarketMoversWidget() {
  return (
    <div className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      {/* Section Header */}
      <div className="border-b border-stone-200 dark:border-neutral-800 p-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-400" />
          <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
            HOSE Market
          </span>
        </div>
        <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-white">
          Top Movers
        </h3>
      </div>

      {/* Two Column Grid with Divider */}
      <div className="grid grid-cols-2 gap-0">
        {/* Gainers Column */}
        <div className="border-r border-stone-200 dark:border-neutral-800">
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 border-b border-stone-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
              <span className="text-xs font-sans uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-400">
                Gainers
              </span>
            </div>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-neutral-800">
            {gainers.map((item) => (
              <Link
                key={item.symbol}
                href={`/charts?symbol=${item.symbol}`}
                className="flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div>
                  <span className="font-bold text-sm text-stone-900 dark:text-white">
                    {item.symbol}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-serif text-sm font-bold text-stone-900 dark:text-white">
                    {item.price.toLocaleString()}
                  </div>
                  <div className="text-xs font-sans uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    +{item.changePercent.toFixed(2)}%
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Losers Column */}
        <div>
          <div className="bg-rose-50/50 dark:bg-rose-950/20 p-3 border-b border-stone-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-3 h-3 text-rose-600 dark:text-rose-400" />
              <span className="text-xs font-sans uppercase tracking-wider font-bold text-rose-600 dark:text-rose-400">
                Losers
              </span>
            </div>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-neutral-800">
            {losers.map((item) => (
              <Link
                key={item.symbol}
                href={`/charts?symbol=${item.symbol}`}
                className="flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div>
                  <span className="font-bold text-sm text-stone-900 dark:text-white">
                    {item.symbol}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-serif text-sm font-bold text-stone-900 dark:text-white">
                    {item.price.toLocaleString()}
                  </div>
                  <div className="text-xs font-sans uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    {item.changePercent.toFixed(2)}%
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-stone-200 dark:border-neutral-800 p-3">
        <Link
          href="/screener"
          className="flex items-center justify-center gap-2
            text-xs font-sans uppercase tracking-wider font-semibold
            text-stone-500 dark:text-neutral-500
            hover:text-emerald-700 dark:hover:text-emerald-400
            transition-colors"
        >
          View All
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
```

---

## Feature 4: AI-Powered Strategy Assistant (Composer-style)

### Component: AiAssistantPanel

```tsx
// AiAssistantPanel.tsx - Editorial Design Compliant
"use client";

import { useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";

export function AiAssistantPanel() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  return (
    <div className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-stone-200 dark:border-neutral-800 p-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-400" />
          <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
            AI Assistant
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-white">
            Strategy Builder
          </h3>
        </div>
        <p className="text-sm text-stone-500 dark:text-neutral-500 mt-1">
          Describe your investment strategy in natural language
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center
              border border-emerald-200 dark:border-emerald-900
              bg-emerald-50 dark:bg-emerald-950/50">
              <Sparkles className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            </div>
            <p className="font-serif text-lg font-bold text-stone-900 dark:text-white">
              Start Building Your Strategy
            </p>
            <p className="text-sm text-stone-500 dark:text-neutral-500 mt-1">
              Try: "Create a momentum strategy for HOSE stocks"
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "p-4 max-w-[85%]",
              msg.role === "user"
                ? "ml-auto bg-stone-100 dark:bg-neutral-800"
                : "border border-stone-200 dark:border-neutral-800"
            )}
          >
            <p className="font-sans text-sm text-stone-900 dark:text-white">
              {msg.content}
            </p>
          </div>
        ))}

        {isLoading && (
          <div className="border border-stone-200 dark:border-neutral-800 p-4 max-w-[85%]">
            <div className="flex items-center gap-2 text-stone-500 dark:text-neutral-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-sans">Analyzing...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-stone-200 dark:border-neutral-800 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 border border-stone-200 dark:border-neutral-800
              bg-white dark:bg-neutral-900 px-4 py-3
              font-sans text-sm text-stone-900 dark:text-white
              focus:border-emerald-700 dark:focus:border-emerald-400
              outline-none transition-colors"
            placeholder="Describe your strategy..."
          />
          <button
            className="px-4 py-3 bg-emerald-700 dark:bg-emerald-600 text-white
              font-sans text-sm uppercase tracking-wider font-semibold
              hover:bg-emerald-800 dark:hover:bg-emerald-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
            disabled={!input.trim() || isLoading}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Quick Strategy Templates

```tsx
// StrategyTemplates.tsx - Editorial Design Compliant
export function StrategyTemplates() {
  const templates = [
    {
      id: "momentum",
      name: "Momentum Strategy",
      description: "Buy stocks with strong price momentum"
    },
    {
      id: "value",
      name: "Value Investing",
      description: "Invest in undervalued stocks"
    },
    {
      id: "dividend",
      name: "Dividend Income",
      description: "Focus on high dividend yield stocks"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {templates.map((template) => (
        <button
          key={template.id}
          className="border border-stone-200 dark:border-neutral-800
            bg-white dark:bg-neutral-900 p-6 text-left
            hover:border-emerald-600 dark:hover:border-emerald-400
            hover:bg-stone-50 dark:hover:bg-neutral-800/50
            transition-colors group"
        >
          {/* Label */}
          <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-600">
            Template
          </span>

          {/* Name */}
          <h4 className="font-serif text-lg font-bold text-stone-900 dark:text-white mt-2
            group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
            {template.name}
          </h4>

          {/* Description */}
          <p className="font-sans text-sm text-stone-500 dark:text-neutral-500 mt-2">
            {template.description}
          </p>
        </button>
      ))}
    </div>
  );
}
```

---

## Feature 5: Enhanced Chart Indicators

### Component: IndicatorSelector

```tsx
// IndicatorSelector.tsx - Editorial Design Compliant
"use client";

import { Search, Plus } from "lucide-react";

const INDICATORS = [
  { id: "sma", name: "SMA", category: "trend", description: "Simple Moving Average" },
  { id: "ema", name: "EMA", category: "trend", description: "Exponential Moving Average" },
  { id: "rsi", name: "RSI", category: "momentum", description: "Relative Strength Index" },
  { id: "macd", name: "MACD", category: "oscillator", description: "Moving Average Convergence Divergence" },
  { id: "bb", name: "BB", category: "volatility", description: "Bollinger Bands" },
  { id: "atr", name: "ATR", category: "volatility", description: "Average True Range" }
];

export function IndicatorSelector() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = ["trend", "momentum", "volatility", "oscillator"];

  return (
    <div className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 w-72">
      {/* Header */}
      <div className="border-b border-stone-200 dark:border-neutral-800 p-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-400" />
          <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
            Technical Analysis
          </span>
        </div>
        <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-white">
          Indicators
        </h3>
      </div>

      {/* Search */}
      <div className="border-b border-stone-200 dark:border-neutral-800 p-3">
        <div className="flex items-center gap-2 border border-stone-200 dark:border-neutral-800
          bg-stone-50 dark:bg-neutral-800 px-3 py-2">
          <Search className="w-4 h-4 text-stone-400 dark:text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent font-sans text-sm text-stone-900 dark:text-white
              outline-none placeholder:text-stone-400 dark:placeholder:text-neutral-600"
            placeholder="Search indicators..."
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-stone-200 dark:border-neutral-800 overflow-x-auto">
        <button
          onClick={() => setActiveCategory(null)}
          className={cn(
            "px-4 py-2 font-sans text-xs uppercase tracking-wider font-semibold whitespace-nowrap",
            activeCategory === null
              ? "text-emerald-700 dark:text-emerald-400 border-b-2 border-emerald-700 dark:border-emerald-400"
              : "text-stone-500 dark:text-neutral-500"
          )}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-4 py-2 font-sans text-xs uppercase tracking-wider font-semibold whitespace-nowrap",
              activeCategory === cat
                ? "text-emerald-700 dark:text-emerald-400 border-b-2 border-emerald-700 dark:border-emerald-400"
                : "text-stone-500 dark:text-neutral-500"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Indicator List */}
      <div className="max-h-80 overflow-y-auto">
        {INDICATORS
          .filter((ind) => !activeCategory || ind.category === activeCategory)
          .filter((ind) => ind.name.toLowerCase().includes(search.toLowerCase()))
          .map((indicator) => (
            <button
              key={indicator.id}
              className="w-full flex items-center justify-between p-3
                hover:bg-stone-50 dark:hover:bg-neutral-800/50 transition-colors
                border-b border-stone-100 dark:border-neutral-800 last:border-b-0"
            >
              <div className="text-left">
                <span className="font-bold text-sm text-stone-900 dark:text-white">
                  {indicator.name}
                </span>
                <p className="text-xs text-stone-500 dark:text-neutral-500">
                  {indicator.description}
                </p>
              </div>
              <Plus className="w-4 h-4 text-stone-400 dark:text-neutral-500" />
            </button>
          ))}
      </div>
    </div>
  );
}
```

---

## Feature 6: Enhanced Strategy Builder

### Component: StrategyCanvas (Editorial Style)

```tsx
// StrategyCanvas.tsx - Editorial Design Compliant
"use client";

import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export function StrategyCanvas() {
  return (
    <div className="border border-stone-200 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-950 h-[600px]">
      {/* Toolbar */}
      <div className="border-b border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-400" />
              <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
                Strategy Builder
              </span>
            </div>
            <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-white">
              Visual Canvas
            </h3>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-stone-200 dark:border-neutral-800
              bg-white dark:bg-neutral-900
              font-sans text-xs uppercase tracking-wider font-semibold
              text-stone-700 dark:text-neutral-300
              hover:bg-stone-50 dark:hover:bg-neutral-800
              transition-colors">
              Save
            </button>
            <button className="px-4 py-2 bg-emerald-700 dark:bg-emerald-600 text-white
              font-sans text-xs uppercase tracking-wider font-semibold
              hover:bg-emerald-800 dark:hover:bg-emerald-500
              transition-colors">
              Run Backtest
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        className="bg-stone-50 dark:bg-neutral-950"
      >
        <Background color="#78716c" gap={20} />
        <Controls className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900" />
      </ReactFlow>
    </div>
  );
}
```

### Custom Node Components

```tsx
// StrategyNodes.tsx - Editorial Design Compliant
import { Handle, Position, type NodeProps } from "@xyflow/react";

export function DataSourceNode({ data }: NodeProps) {
  return (
    <div className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 min-w-[180px]">
      {/* Node Header */}
      <div className="bg-stone-100 dark:bg-neutral-800 px-3 py-2 border-b border-stone-200 dark:border-neutral-700">
        <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
          Data Source
        </span>
      </div>

      {/* Node Body */}
      <div className="p-3">
        <p className="font-serif text-sm font-bold text-stone-900 dark:text-white">
          {data.symbol || "Select Symbol"}
        </p>
        <p className="text-xs text-stone-500 dark:text-neutral-500">
          {data.timeframe || "1D"}
        </p>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-emerald-700 dark:bg-emerald-400 border-2 border-white dark:border-neutral-900"
      />
    </div>
  );
}

export function IndicatorNode({ data }: NodeProps) {
  return (
    <div className="border border-emerald-600 dark:border-emerald-400 bg-white dark:bg-neutral-900 min-w-[180px]">
      {/* Node Header */}
      <div className="bg-emerald-50 dark:bg-emerald-950/50 px-3 py-2 border-b border-emerald-200 dark:border-emerald-900">
        <span className="text-xs font-sans uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-400">
          Indicator
        </span>
      </div>

      {/* Node Body */}
      <div className="p-3">
        <p className="font-serif text-sm font-bold text-stone-900 dark:text-white">
          {data.name || "Select Indicator"}
        </p>
        <p className="text-xs text-stone-500 dark:text-neutral-500">
          Period: {data.period || 14}
        </p>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-stone-400 dark:bg-neutral-600 border-2 border-white dark:border-neutral-900"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-emerald-700 dark:bg-emerald-400 border-2 border-white dark:border-neutral-900"
      />
    </div>
  );
}

export function SignalNode({ data }: NodeProps) {
  return (
    <div className="border border-stone-900 dark:border-white bg-white dark:bg-neutral-900 min-w-[180px]">
      {/* Node Header */}
      <div className="bg-stone-900 dark:bg-white px-3 py-2">
        <span className="text-xs font-sans uppercase tracking-[0.15em] text-white dark:text-stone-900">
          Signal
        </span>
      </div>

      {/* Node Body */}
      <div className="p-3">
        <p className="font-serif text-sm font-bold text-stone-900 dark:text-white">
          {data.type || "Buy/Sell"}
        </p>
        <p className="text-xs text-stone-500 dark:text-neutral-500">
          {data.condition || "Set condition"}
        </p>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-stone-400 dark:bg-neutral-600 border-2 border-white dark:border-neutral-900"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-stone-900 dark:bg-white border-2 border-white dark:border-neutral-900"
      />
    </div>
  );
}
```

---

## Utility: cn() helper

```tsx
// Required for conditional classNames
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## Implementation Checklist

### Phase 1: Watchlist System
- [ ] `WatchlistPanel.tsx` - Main watchlist component
- [ ] `CreateWatchlistModal.tsx` - Create new watchlist
- [ ] `WatchlistItem.tsx` - Individual stock item
- [ ] `watchlistStore.ts` - Zustand store for state

### Phase 2: Alerts System
- [ ] `AlertsPanel.tsx` - Main alerts component
- [ ] `CreateAlertModal.tsx` - Create new alert
- [ ] `AlertNotification.tsx` - Toast notification
- [ ] `alertsStore.ts` - Zustand store

### Phase 3: Market Movers
- [ ] `MarketMoversWidget.tsx` - Dashboard widget
- [ ] `/api/market/movers` - API endpoint

### Phase 4: AI Assistant
- [ ] `AiAssistantPanel.tsx` - Chat interface
- [ ] `StrategyTemplates.tsx` - Quick templates
- [ ] `/api/assistant` - GLM API integration

### Phase 5: Chart Indicators
- [ ] `IndicatorSelector.tsx` - Indicator picker
- [ ] `RSIIndicator.tsx` - RSI overlay
- [ ] `MACDIndicator.tsx` - MACD pane
- [ ] `BBIndicator.tsx` - Bollinger Bands

### Phase 6: Strategy Builder
- [ ] `StrategyCanvas.tsx` - React Flow canvas
- [ ] `StrategyNodes.tsx` - Custom node types
- [ ] `NodePalette.tsx` - Draggable node library
- [ ] `PropertyPanel.tsx` - Node configuration

---

*Document Version: 2.0*
*Last Updated: February 2026*
*Compliance: EDITORIAL-DESIGN-SYSTEM.md*
