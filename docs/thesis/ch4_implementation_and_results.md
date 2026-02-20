# Chapter 4: Implementation and Experimental Results

## 4.1 Implementation Overview
Robustness-focused implementation includes:
- enriched policy metadata in assistant response objects,
- improved signal routing for numeric stock requests,
- structured grounding error codes and diagnostic message blocks,
- comprehensive evaluation script updates with explicit five-metric gate,
- CI integration for quick-profile reliability checks.

## 4.2 Key Engineering Artifacts
- Assistant API route orchestration and fallback policy.
- Grounding task execution and error normalization.
- Evaluation script producing JSON and markdown summary artifacts.
- CI workflow step enforcing comprehensive metrics in smoke job.

## 4.3 Experimental Setup
- Evaluation profiles: `quick`, `standard`, `full`.
- Environment checks: lint, typecheck, build, then eval script.
- Report artifacts:
  - `artifacts/assistant-eval-comprehensive-report.json`,
  - `artifacts/assistant-eval-summary.md`.

## 4.4 Result Template (to be filled after full run)
Use this table in the final thesis draft:

| Metric | Baseline | Improved | Threshold | Pass/Fail |
|---|---:|---:|---:|---|
| unsupportedClaimRate | TBD | TBD | <= 0.15 | TBD |
| supportedClaimPrecision | TBD | TBD | >= 0.85 | TBD |
| overallClaimAccuracy | TBD | TBD | >= 0.70 | TBD |
| abstentionAccuracy | TBD | TBD | >= 0.85 | TBD |
| groundingPassRate | TBD | TBD | >= 0.70 | TBD |

## 4.5 Error Analysis Template
Categorize failures by:
- tool transport failure (timeout/network),
- endpoint failure (HTTP 4xx/5xx),
- insufficient citation coverage,
- policy fallback false-positive/false-negative.

For each category, provide:
- count and ratio,
- representative prompts,
- root cause,
- mitigation in next iteration.

## 4.6 Discussion
Expected findings should discuss:
- whether stricter policy reduces hallucination at acceptable coverage cost,
- where abstention behavior improves trustworthiness,
- remaining engineering debt before production-grade deployment.

## 4.7 Chapter Summary
This chapter documents implementation and measured impact. Chapter 5 consolidates conclusions, limitations, and future work.
