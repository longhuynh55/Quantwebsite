# Module: Learning Hub

## Purpose
The Learning Hub provides structured educational content aligned to the platform workflow, guiding users from fundamentals to intermediate strategy design and then advanced topics such as portfolios and ML concepts. In the thesis narrative, it supports onboarding and reduces user error by making the research workflow more learnable.

## User Stories
- As a user, I want a structured index of learning topics by level (beginner/intermediate/advanced).
- As a user, I want to read a topic page and then try the relevant tool (e.g., screener) via a call-to-action.

## Inputs And Controls
- Topic selection from the index.
- Topic page navigation back to the index.

## Outputs And Evidence Artifacts
- Level-based topic index with counts and estimated total learning time.
- Topic article rendering in a consistent format.
- Calls-to-action to tools (e.g., “Try the Screener”).

## Business Rules And Guardrails
- Topics are statically generated; invalid topics result in a not-found response rather than a broken page.

## Failure Modes
- Non-existent topics are handled explicitly via a not-found path.

## Dependencies (Conceptual)
- Curated content store for learning topics (MDX-backed).

## UI Evidence (Chapter 4)
- Screenshot: Learn index with levels and topic cards.
- Screenshot: A topic page with CTA to Screener.

## Internal Evidence Pointers (Do Not Cite In Thesis Body)
See `docs/thesis/_internal/evidence_map.yml` -> `modules.learn`.

