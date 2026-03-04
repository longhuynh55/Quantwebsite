# Module: Dashboard

## Purpose
The Dashboard module supports repeated monitoring by allowing users to assemble a personalised grid of widgets. It provides a lightweight, configurable “home base” for common tasks such as watchlist tracking and market overview scanning, complementing deeper analytical workspaces.

## User Stories
- As a user, I want to add/remove widgets and persist a preferred layout.
- As a user, I want a quick glance at market overview and watchlist performance without running a full analysis.

## Inputs And Controls
- Widget palette selection.
- Grid layout operations: drag, resize, reset to default.

## Outputs And Evidence Artifacts
- Configured widget grid rendering.
- Empty state when no widgets are selected.

## Business Rules And Guardrails
- Widgets are dynamically imported to reduce initial load costs and keep the page responsive.
- Empty state is explicit to avoid ambiguity when the dashboard is cleared.

## Failure Modes
- If a widget fails to load, the dashboard should still render other widgets (implementation-dependent resilience).

## Dependencies (Conceptual)
- Underlying services used by individual widgets (e.g., market overview, watchlist metrics).

## UI Evidence (Chapter 4)
- Screenshot: Dashboard grid with at least two widgets.
- Screenshot: Widget palette (optional).

## Internal Evidence Pointers (Do Not Cite In Thesis Body)
See `docs/thesis/_internal/evidence_map.yml` -> `modules.dashboard`.

