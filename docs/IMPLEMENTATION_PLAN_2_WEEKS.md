# Two-Week Execution Plan (Robustness First)

## Goal
Deliver a thesis-ready finance copilot that prioritizes robustness and measurable reliability before feature expansion.

## Scope
- Product scope: improve grounded-response reliability, reduce hallucinations, and expose trust signals.
- Research scope: run reproducible evaluations and report quantitative outcomes for thesis chapters.
- Out of scope: live trading execution and external brokerage integration.

## Quantitative Targets (2-week gate)
- `unsupportedClaimRate <= 0.15`
- `supportedClaimPrecision >= 0.85`
- `overallClaimAccuracy >= 0.70`
- `abstentionAccuracy >= 0.85`
- `groundingPassRate >= 0.70`
- Non-gating diagnostic: `deceptionResistanceRate` tracked every run.

## Week 1 (Stabilize and Harden)
### Day 1-2: Grounding and policy hardening
- Ensure numeric stock questions trigger required grounding tools.
- Add policy metadata (`groundingRequired`, `groundingSatisfied`, `policyReasonCode`) to assistant responses.
- Add structured tool error codes for post-mortem and monitoring.

### Day 3-4: Fallback and transparency
- Improve grounded fallback message quality for user trust.
- Add diagnostics blocks when tool routing fails or base URL is missing.
- Show grounding/policy status in assistant message footer.

### Day 5: Regression check
- Run `pnpm run lint`, `pnpm exec tsc --noEmit`, and `pnpm run build`.
- Run assistant eval with `quick` profile and collect baseline report artifact.

## Week 2 (Evaluation and Thesis Packaging)
### Day 6-8: Evaluation gate
- Enforce 5-gate metrics in comprehensive eval script.
- Produce machine-readable JSON and human-readable markdown summary artifacts.
- Integrate eval gate in CI smoke workflow for repeatable quality checks.

### Day 9-10: Robustness enhancement
- Review failures by category (tool timeout, HTTP status, unsupported query type).
- Apply targeted fixes only for high-frequency failure modes.
- Re-run evaluation and compare against week-1 baseline.

### Day 11-12: Research write-up
- Finalize five-chapter English thesis outline and chapter skeletons.
- Map each reported metric to methodology, experiment, and discussion sections.
- Maintain APA-style citation list for all core claims.

### Day 13-14: Freeze and rehearsal
- Perform final validation pass.
- Prepare demo script: supported query, abstention query, fallback query, and diagnostics view.
- Freeze artifacts for thesis defense package.

## Per-Issue Fix Workflow (Mandatory)
1. Reproduce the issue with a deterministic prompt or script.
2. Isolate root cause in assistant routing, grounding, policy, or UI.
3. Implement minimal fix with explicit acceptance criteria.
4. Run targeted verification for the touched module.
5. Run regression checks:
   - `pnpm run lint`
   - `pnpm exec tsc --noEmit`
   - `pnpm run build`
   - `node scripts/eval-assistant-comprehensive.mjs` (or CI smoke equivalent)
6. Record before/after metrics and decision in the issue log.

## CI Recommendation (Balanced for Thesis + Product)
- Keep a lightweight CI gate in every PR:
  - lint, typecheck, build, quick assistant eval.
- Keep heavier end-to-end QA as scheduled runs or pre-release checks.
- Rationale: protects robustness goals without slowing thesis iteration speed.

