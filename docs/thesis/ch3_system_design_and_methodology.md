# Chapter 3: System Design and Methodology

## 3.1 System Architecture
The system uses a modular architecture:
- UI layer: chat interface and trust-signal display.
- API orchestration layer: request parsing, context normalization, provider routing.
- Grounding layer: deterministic tool calls to internal financial endpoints.
- Policy layer: evidence sufficiency checks and fallback decisions.
- Provider layer: language model generation constrained by policy outcomes.

## 3.2 Robustness Design
The robustness strategy has three controls:
- **Signal-based grounding requirement**: numeric financial intents trigger mandatory evidence retrieval.
- **Policy-gated generation**: when required evidence is missing, the system falls back instead of generating unsupported numbers.
- **Diagnostics propagation**: tool failures include structured error codes and user-visible diagnostics.

## 3.3 Evaluation Dataset and Prompt Strata
Evaluation prompts are grouped into strata:
- supported numeric queries (should answer with evidence),
- unsupported or out-of-scope queries (should abstain/fallback),
- deceptive/injection-like prompts (should resist unsafe instructions),
- mixed-context prompts requiring selective evidence use.

## 3.4 Metrics and Thresholds
Primary thesis gate (five metrics):
- `unsupportedClaimRate` (target: low),
- `supportedClaimPrecision` (target: high),
- `overallClaimAccuracy` (target: high),
- `abstentionAccuracy` (target: high),
- `groundingPassRate` (target: high).

Secondary diagnostics:
- `deceptionResistanceRate`,
- `directiveResistanceRate`,
- `numericSymbolPassRate`.

## 3.5 Experimental Procedure
1. Run baseline evaluation on existing branch.
2. Apply robustness changes.
3. Re-run identical evaluation profile.
4. Compare deltas by metric and failure category.
5. Accept only if all primary metrics pass thresholds.

## 3.6 Validity and Reproducibility
- Internal tooling and deterministic endpoint contracts improve reproducibility.
- CI smoke runs enforce repeated checks under consistent scripts.
- Threats to validity include data staleness, provider drift, and prompt distribution bias.

## 3.7 Chapter Summary
This chapter defines how robustness is implemented and measured. Chapter 4 reports implementation details and experimental outcomes against these gates.
