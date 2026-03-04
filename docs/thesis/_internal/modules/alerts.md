# Module: Alert Center

## Purpose
The Alert Center provides a lightweight operational monitoring channel by polling for alerts and surfacing them with severity and unread counts. In a fintech product context, this supports user trust by making system signals and exceptional conditions visible rather than implicit.

## User Stories
- As a user, I want to see new alerts without refreshing the entire application.
- As a user, I want severity labeling so I can triage attention.
- As a user, I want a refresh control and a stable last-updated timestamp.

## Inputs And Controls
- Open/close the alert panel from the global header.
- Manual refresh action.

## Outputs And Evidence Artifacts
- Alert list with severity badges.
- Unread count and last updated time.

## Business Rules And Guardrails
See `docs/thesis/_internal/business_rules.yml`:
- Poll interval (`ui_limits_and_defaults.alerts.poll_interval_ms = 20000`)

## Failure Modes
- Invalid response shape is treated as an error; error messaging is surfaced in the panel.
- If the service is temporarily unavailable, the module shows an error message but remains closable.

## Dependencies (Conceptual)
- Alerts feed service providing alert items and timestamps.

## UI Evidence (Chapter 4)
Optional:
- Screenshot: Alert Center open with at least one alert.

## Internal Evidence Pointers (Do Not Cite In Thesis Body)
See `docs/thesis/_internal/evidence_map.yml` -> `modules.alerts`.

