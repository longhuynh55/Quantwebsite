# Module: AI Assistant Panel

## Purpose
The AI Assistant Panel provides context-aware assistance across the platform by combining a conversational interface with workflow-oriented quick actions. Its role in the product is not to replace quantitative evaluation, but to reduce interaction cost: guiding users toward the right workspace, narrowing ambiguous requests, and supporting a more reliable “question to evidence” loop.

## User Stories
- As a user, I want to ask natural language questions while staying inside my current workflow.
- As a user, I want the assistant to understand which page I am on and tailor its guidance accordingly.
- As a user, I want quick actions that jump to the relevant workspace or trigger a supported analysis step.

## Inputs And Controls
- Prompt input (text) with bounded length and history.
- Mode selection: copilot panel and full screener workspace mode.
- Quick actions: pre-defined actions that pass structured context (symbol lists, timeframe, etc.).

## Outputs And Evidence Artifacts
- Assistant responses displayed as message blocks.
- Recovery hints when rate-limited or when a request falls outside grounded scope.
- Composer-like workflow UI elements (when enabled) that structure multi-step actions.

## Business Rules And Guardrails
See `docs/thesis/_internal/business_rules.yml`:
- Rate limits and payload limits (`api_rate_limits_and_payload_limits.assistant`)
- Message retention bounds (`ui_limits_and_defaults.assistant_ui`)
- Tool fanout/concurrency constraints (internal capacity protection; see implementation evidence pointers)
- Reliability cues: bounded rendering and explicit recovery hints.

## Failure Modes
- Rate limiting: the UI surfaces a recovery hint instructing the user to retry later or narrow the request.
- Provider/backend errors: the UI surfaces a retry-oriented message rather than failing silently.
- Grounding fallback: the assistant may request more specific scope (symbol, metric, timeframe) to improve reliability.

## Dependencies (Conceptual)
- Assistant service that executes grounded tool calls against supported analytics services.
- Telemetry collection for UI KPI tracking (bounded and rate-limited).

## UI Evidence (Chapter 4)
- Screenshot: Assistant panel open on a workflow page (e.g., Screener or Strategy Builder).
- Screenshot: Quick actions menu and a triggered action result (optional).

## Internal Evidence Pointers (Do Not Cite In Thesis Body)
See `docs/thesis/_internal/evidence_map.yml` -> `modules.assistant`.

