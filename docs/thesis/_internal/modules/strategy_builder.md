# Module: Strategy Builder

## Purpose
The Strategy Builder module supports strategy authoring as a structured artifact rather than an ad hoc text description. It provides a visual canvas and property panels for assembling strategy components, and it connects authoring to evaluation by allowing the user to submit an execution request and review the latest run outcome. In thesis terms, it is the primary interface for transforming a conceptual strategy idea into an executable and evaluable object.

## User Stories
- As a user, I want to create a strategy artifact with reusable components and editable parameters.
- As a user, I want to preview the run configuration before submitting execution to reduce user errors.
- As a user, I want to submit a run, observe status progression, and cancel if needed.
- As a user, I want the latest run result summarised in a compact panel for iteration.

## Inputs And Controls
- Strategy metadata: name and capital.
- Canvas composition: adding nodes from a palette, editing node properties, deleting nodes.
- Run controls: submit run, cancel run, download action (UI control).

## Outputs And Evidence Artifacts
- Strategy artifact (nodes + properties) stored in the builder state.
- Run preview panel with payload summary and warnings.
- Run identifiers (run id, job id where applicable) and status indicator.
- Latest backtest summary panel (return, Sharpe, max drawdown, trade count, coverage diagnostic).

## Business Rules And Guardrails
See `docs/thesis/_internal/business_rules.yml`:
- Symbol/parameter normalisation constraints (applied in run builder and services).
- Maximum capital constraint (shared with execution constraints).
- Guardrail warnings:
  - Certain legacy node types are ignored by the execution template.
  - Visual connections are explicitly stated as non-executing (visual-only) to prevent misinterpretation.

## Failure Modes
- Invalid run configuration surfaces a preview error rather than allowing submission.
- Run failures are surfaced in the run status area with a human-readable message.
- Cancellation transitions are surfaced explicitly so users can distinguish cancellation from failure.

## Dependencies (Conceptual)
- Strategy Lab service for asynchronous execution and result retrieval.
- Strategy artifact schema and mapping layer between UI and execution requests.

## UI Evidence (Chapter 4)
- Screenshot: Canvas with palette and properties panel (shows authoring).
- Screenshot: Run preview panel with warnings (shows reliability guardrails).
- Screenshot: Latest backtest result panel after a completed run.

## Internal Evidence Pointers (Do Not Cite In Thesis Body)
See `docs/thesis/_internal/evidence_map.yml` -> `modules.strategy_builder`.

