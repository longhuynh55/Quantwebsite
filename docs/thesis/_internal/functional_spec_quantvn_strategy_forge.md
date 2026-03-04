# QuantVN Strategy Forge: Functional Specification (Internal Working Document)

## Status And Intended Use
This document is an internal working reference for drafting the thesis chapters (especially Chapter 3 methodology/system design and Chapter 4 implementation evidence). It is **not** intended to be submitted to the thesis committee as-is.

The goal is to (1) avoid feature hallucination, (2) keep terminology consistent across chapters, and (3) provide traceability from **user-facing functions** to **system design claims** and **evaluation criteria**.

## Product Summary (Working Description)
QuantVN Strategy Forge is a web-based quantitative research environment for Vietnamese equities (HOSE-oriented), integrating three pillars:

- Market exploration: screening, charting, and fundamentals browsing.
- Research workflows: backtesting, factor views, portfolio optimisation, and risk analytics.
- Assisted interaction: an AI assistant panel that adapts to page context and supports workflow navigation.

The product emphasises **workflow completion** (from idea to backtest evidence) and **reliability signalling** (clear empty states, error states, and diagnostic surfacing).

## Scope Boundaries (What The System Does And Does Not Claim)
- The system supports multiple analytics workspaces (Screener, Charts, Backtesting, Portfolio, Factors, Risk) and a strategy construction workflow (Strategy Builder + Strategy Lab runs).
- The ML Lab page exists as a **sandbox/preview** and should be treated as future-facing in thesis claims (no performance claims).
- The Community/Marketplace exists as a UI experience backed by mock data in the current implementation; thesis claims should treat it as a product direction rather than a production community network.
- A "Connect Broker" call-to-action exists in the UI; do not claim live brokerage connectivity unless implemented elsewhere and verified.

## Functional Map (User-Facing Modules)
The table below is the primary “what users can do” map. References in parentheses indicate concrete implementation evidence for internal validation.

| Module | Route | Primary User Goal | Key Inputs | Key Outputs (UI Evidence) | Reliability/Guardrails (UI Evidence) |
|---|---|---|---|---|---|
| Home / Market Overview | `/` | Discover capabilities and launch workspaces | None (navigation) | Feature launch cards for workspaces; market overview widgets (implementation evidence: `src/app/page.tsx`) | Uses a stable navigation surface; relies on downstream pages for detailed validation |
| Dashboard | `/dashboard` (shell shows `/` as dashboard in Sidebar) | Customisable overview for repeated monitoring | Widget selection and layout | Rearrangeable grid of widgets (market overview, watchlist, performance, etc.) (implementation evidence: `src/components/dashboard/DashboardLayout.tsx`) | Empty state when no widgets; palette gating; defensive dynamic imports |
| Stock Screener | `/screener` | Filter and export a tradable universe | Query, status, sector, liquidity bounds, sorting, pagination | “Screened Universe” table; export flow (CSV) (implementation evidence: `src/app/screener/ScreenerClient.tsx`) | Abortable requests; empty/no-results states; clear validation messaging |
| Charts & Analysis | `/charts` | Explore price history, compare symbols, inspect fundamentals | Symbol, time range, comparison symbols, fundamentals period | Candlestick + multi-line comparison; fundamentals tables (IS/BS/CF) (implementation evidence: `src/app/charts/page.tsx`) | Symbol normalisation; compare-symbol limit; error boundaries around fundamentals |
| Backtesting Workspace | `/backtesting` | Validate a predefined strategy on historical HOSE data | Symbol, strategy type, capital, strategy parameters, execution/cost model | Summary KPIs, charts, trade log, diagnostics, detailed stats; PDF report action (implementation evidence: `src/app/backtesting/page.tsx`) | Parameter validation messaging; explicit error state with retry; result rendering error boundary |
| Strategy Builder | `/strategy-builder` | Construct a strategy artefact and request a Strategy Lab run | Strategy name, capital, visual nodes/properties | Run preview, warnings, run identifiers, “Latest Backtest Result” summary panel (implementation evidence: `src/app/strategy-builder/page.tsx`) | Preview warnings to avoid misleading UI; explicit run status; cancellation path; surfaced failures |
| Portfolio Optimisation | `/portfolio` | Build an optimised portfolio allocation from a set of symbols | Symbol list, solver method | Allocation weights, expected return/volatility/Sharpe; correlation matrix and per-asset stats (implementation evidence: `src/app/portfolio/page.tsx`) | Input validation (min 2 symbols, max 10); abortable requests; exclusion reporting |
| Factor Analytics | `/factors` | Rank equities by factor proxies and inspect distribution | Factor selection | Top/bottom ranking tables; distribution bar chart; theory placeholder (implementation evidence: `src/app/factors/page.tsx`) | Loading/error messaging; limit controls; “theory” treated as explanatory not empirical proof |
| Risk Management | `/risk` | Quantify risk metrics and benchmark-relative diagnostics | Symbol, benchmark | VaR/CVaR, drawdowns, rolling volatility and relative metrics (implementation evidence: `src/app/risk/page.tsx`) | Abortable requests; clear retry flow; empty state prompting a symbol |
| ML Lab (Preview) | `/ml-lab` | Preview future ML workflow direction | None (informational) | “Status: Sandbox Alpha” + preview cards (implementation evidence: `src/app/ml-lab/page.tsx`) | Must be framed as roadmap; no claims of deployed forecasting models |
| Community / Strategy Marketplace | `/community` | Browse and copy shared strategies into personal builder | Search, tags, sorting, paging, copy/import actions | Strategy cards + detail dialog; “copy into my strategies” import flow (implementation evidence: `src/components/community/*`) | Current data source is mock; copy/import flow is deterministic and bounded |
| Learning Hub | `/learn` and `/learn/[topic]` | Provide structured learning topics aligned to quant workflows | Topic selection | Level-based topic index; MDX article render; CTA links to workspaces (implementation evidence: `src/app/learn/page.tsx`, `src/app/learn/[topic]/page.tsx`) | Static generation; notFound for invalid topics; provides guided on-ramps to tools |
| Alert Center | Global panel (Header bell icon) | Poll and display alerts | Open/close; refresh | List of alerts with severity; “unread” count; last updated timestamp (implementation evidence: `src/components/alerts/AlertCenter.tsx`) | Polling interval; robust response-shape checks; escape-to-close and overlay close |
| Command Palette | Global (Ctrl/Cmd+K) | Fast navigation and symbol search | Query text | Suggested actions + symbol results + quick navigation (implementation evidence: `src/components/CommandPalette.tsx`) | Debounced search; abortable search requests; consistent close/reset behaviour |
| AI Assistant Panel | Global (Header trigger) | Context-aware assistance and workflow guidance | Natural language prompt; assistant mode selection | Chat UI, quick actions, context snapshot per page (implementation evidence: `src/components/assistant/AiAssistantPanel.tsx`, `src/components/assistant/AiAssistantTrigger.tsx`) | Rate-limit recovery hints; bounded message rendering; focus management and escape-to-close |

## Core Workflows (Committee-Friendly Narratives Derived From Implementation)
These are the workflows that matter for Chapter 3 and for evaluating the product in Chapter 4. They are written in thesis-compatible language but remain grounded in observed UI behaviour.

### Workflow A: From Universe Discovery To Single-Symbol Validation
1. The user identifies candidates using the Screener (filters, sorting, export).
2. The user selects a symbol and opens Charts to confirm price action and fundamentals context.
3. The user runs a backtest in the Backtesting workspace with a realistic execution and costs configuration.
4. The user interprets outputs through KPIs, diagnostics, and trade logs (and optionally generates a report artefact).

### Workflow B: From Strategy Artefact To Strategy Lab Run Evidence
1. The user constructs a strategy artefact in Strategy Builder (visual assembly plus properties).
2. The system provides a run preview with warnings to avoid misinterpreting visual elements as execution logic.
3. The user submits a run and receives run identifiers plus a status progression (queued/running/terminal).
4. The user reviews “Latest Backtest Result” as a summarised evidence object and may iterate on parameters.

### Workflow C: From Symbol Basket To Portfolio Decision Support
1. The user enters a candidate basket and selects an optimisation solver method.
2. The system returns allocation weights plus risk and diversification diagnostics (correlation matrix, exclusions).
3. The user cross-checks risk metrics and benchmark-relative analytics in the Risk workspace.

## Cross-Cutting Reliability Patterns (Evidence-Backed Claims)
The product implements several UI-level reliability cues and guardrails that can be translated into thesis claims (without describing low-level code).

- Input normalisation and limits: symbol format constraints, compare-symbol cap, basket size cap.
- Abortable network operations: requests are cancelled when superseded to prevent stale UI states.
- Explicit empty/no-results/error states: each workspace defines a clear non-happy-path presentation.
- Error boundaries for complex rendering: complex result views have fallback UI to avoid blank screens.
- Accessibility and focus management: assistant and navigation components implement escape-to-close and focus handling.

## Thesis Alignment Notes (Where This Document Feeds)
- Chapter 3: Use "workflow narratives" and "cross-cutting reliability patterns" to justify design choices, diagrams, and methodology.
- Chapter 4: Use the module map to choose the minimum set of UI screenshots (home, screener, strategy builder, backtesting, assistant) that demonstrate the end-to-end workflow.
- Appendix A: Use internal evidence references to support traceability, but avoid naming internal files in the main thesis body.
