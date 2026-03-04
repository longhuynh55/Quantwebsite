# Module: Community / Strategy Marketplace

## Purpose
The Community module presents a strategy marketplace experience in which users can browse strategies, inspect summary performance metrics, and copy a chosen strategy into their personal Strategy Builder workspace. In the current implementation, this module is best treated as a product direction and usability prototype rather than a production social network.

## User Stories
- As a user, I want to browse and search strategies by tags and sort criteria.
- As a user, I want to inspect a strategy in a detail dialog before copying it.
- As a user, I want to copy/import a strategy into my own builder state to modify and evaluate it.

## Inputs And Controls
- Search query, tag filters, sorting, pagination.
- Strategy detail dialog controls (rating UI, copy action).
- Import flow: confirm, import in progress, success/error feedback.

## Outputs And Evidence Artifacts
- Strategy cards and list/grid views.
- Detail dialog presenting tags and summary metrics.
- Copy/import success confirmation, resulting in a strategy artifact loaded into the builder store.

## Business Rules And Guardrails
See `docs/thesis/_internal/non_claims.yml`:
- Do not claim a production community backend if the module is mock-driven.

## Failure Modes
- Loading error results in a no-results style state with retry.
- Import errors are surfaced with an explicit retry action.

## Dependencies (Conceptual)
- Strategy catalog service (currently mock-driven in the UI implementation).
- Strategy import operation that loads a strategy artifact into the user's builder state.

## UI Evidence (Chapter 4)
This module is optional for Chapter 4. If used:
- Screenshot: Marketplace list/grid and filters.
- Screenshot: Strategy detail dialog with copy action.

## Internal Evidence Pointers (Do Not Cite In Thesis Body)
See `docs/thesis/_internal/evidence_map.yml` -> `modules.community`.

