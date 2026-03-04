# QuantVN Strategy Forge: Internal Knowledge Store (KB)

## Purpose
This folder is a **non-submission** internal knowledge store used to support thesis writing. It is designed to:

- Provide a stable, auditable map of **what the product does** (functions, modules, workflows).
- Capture **business rules** (limits, defaults, validation, rate limits) that materially affect user outcomes.
- Provide internal **evidence pointers** (pages/components/API routes) to avoid feature hallucination.
- Maintain consistent **terminology** across Chapters 1-5.

This KB is written to be thesis-compatible in tone, while keeping implementation traceability separate from the main thesis body.

## Canonical Sources
- High-level internal overview (narrative): `docs/thesis/_internal/functional_spec_quantvn_strategy_forge.md`
- Structured module inventory: `docs/thesis/_internal/functional_map.yml`
- Business rules and guardrails: `docs/thesis/_internal/business_rules.yml`
- Workflow definitions (for Ch3 diagrams and Ch4 evidence): `docs/thesis/_internal/workflows.yml`
- Terminology control (glossary): `docs/thesis/_internal/glossary.yml`
- Safety list (do-not-claim items): `docs/thesis/_internal/non_claims.yml`
- Evidence pointers (internal only): `docs/thesis/_internal/evidence_map.yml`
- Per-module write-ups: `docs/thesis/_internal/modules/`

## Update Rules (To Keep This Useful)
- When a page changes user-visible behaviour, update:
  `functional_map.yml`, the corresponding file in `modules/`, and any impacted entry in `business_rules.yml`.
- When a feature is only a mock/preview, label it explicitly in:
  `functional_map.yml` (`status: mock|preview`) and `non_claims.yml`.
- Do not reference file paths in the thesis body; keep file pointers inside this KB and Appendix A only.

## Suggested Thesis Usage
- Chapter 3: Use `workflows.yml` and `business_rules.yml` to justify design decisions and reliability measures.
- Chapter 4: Use the “UI Evidence” sections in `modules/*` to decide screenshots and captions.

