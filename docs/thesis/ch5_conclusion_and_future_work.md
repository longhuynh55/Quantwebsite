# Chapter 5: Conclusion and Future Work

## 5.1 Conclusion
This thesis frames a finance copilot as a reliability-critical system, not only a conversational interface. The implemented architecture combines grounding, policy gating, and evaluation metrics to reduce unsupported numeric claims and improve transparency.

## 5.2 Answer to Research Questions
- RQ1: Policy-gated grounding is expected to reduce unsupported numeric outputs.
- RQ2: Strict robustness can reduce answer coverage, but improves trustworthiness in finance contexts.
- RQ3: A five-metric gate gives a clear operational definition of reliability.

## 5.3 Practical Contributions
- A reproducible engineering workflow from issue reproduction to regression testing.
- A lightweight CI pattern suitable for balancing thesis progress and product quality.
- A thesis-aligned metric framework that links design decisions to measurable outcomes.

## 5.4 Limitations
- Limited symbol universe and historical range.
- Dependence on internal endpoint availability and data freshness.
- Provider-level variability may affect language quality even with grounding controls.

## 5.5 Future Work
- Expand market and statement coverage (e.g., additional exchanges and macro indicators).
- Introduce confidence calibration and uncertainty scoring.
- Build larger benchmark suites with adversarial and longitudinal prompts.
- Add scheduled regression pipelines with trend dashboards for metric drift.

## 5.6 Final Remark
For financial assistant systems, robust abstention with explicit evidence is often more valuable than broad but weakly supported responses. This principle should guide both product roadmap and future research.
