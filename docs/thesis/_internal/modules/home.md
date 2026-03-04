# Module: Home / Market Overview

## Purpose
The Home module provides an entry point into the QuantVN Strategy Forge workflow by presenting a concise overview of platform capabilities and guiding users toward the appropriate workspace for their task (screening, charting, backtesting, portfolio/risk analysis, or strategy construction). In thesis terms, it functions as a workflow gateway that reduces friction in moving from an abstract research intent to a concrete analysis toolchain.

## User Stories
- As a user, I want to quickly understand what the platform supports so that I can choose the right workspace.
- As a user, I want a high-level market snapshot to orient my next action (screen, analyse, or backtest).

## Inputs And Controls
Home is primarily navigational. It does not require user inputs beyond choosing a destination workspace.

## Outputs And Evidence Artifacts
- Feature launch surfaces that link to the main workspaces.
- A market overview snapshot panel (as rendered on the landing page).

## Business Rules And Guardrails
- The module relies on downstream pages to validate inputs. Guardrails are therefore concentrated in the workspaces (Screener/Charts/Backtesting).

## Failure Modes
- If market overview data is unavailable, the UI should degrade gracefully (implementation-dependent), while preserving navigation to the workspaces.

## Dependencies (Conceptual)
- Market overview service providing a summary snapshot of the tradable universe.

## UI Evidence (Chapter 4)
- Screenshot: Home landing section with workspace launch cards.
- Screenshot: Market overview summary area (if visible).

## Internal Evidence Pointers (Do Not Cite In Thesis Body)
See `docs/thesis/_internal/evidence_map.yml` -> `modules.home`.

