# Module: Command Palette

## Purpose
The Command Palette provides a fast interaction layer for navigation and symbol search. It reduces workflow friction by letting users jump between tools and load symbol analysis with minimal UI traversal, which is valuable when iterating across many candidates.

## User Stories
- As a user, I want to open a command dialog and navigate to a workspace quickly.
- As a user, I want to type a symbol query and open the corresponding chart analysis.

## Inputs And Controls
- Keyboard shortcut to open the palette.
- Query input used for both commands and symbol search.

## Outputs And Evidence Artifacts
- Suggested navigation commands.
- Symbol search results (small list) linking to chart analysis.

## Business Rules And Guardrails
See `docs/thesis/_internal/business_rules.yml`:
- Abortable requests to avoid stale results when typing rapidly (`reliability_patterns.abortable_requests`).

## Failure Modes
- If the search service fails, the palette should degrade by showing no results while remaining usable for navigation.

## Dependencies (Conceptual)
- Symbol search service exposed by the stocks endpoint.

## UI Evidence (Chapter 4)
Optional:
- Screenshot: Command palette with suggestions and a symbol search result.

## Internal Evidence Pointers (Do Not Cite In Thesis Body)
See `docs/thesis/_internal/evidence_map.yml` -> `modules.command_palette`.

