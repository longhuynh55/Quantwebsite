# Chapter 5: Conclusion and Future Work

## 5.1 Conclusion
This thesis frames a finance AI assistant as a reliability-critical system, not only a conversational interface. The implemented QuantVN architecture combines (1) validated local datasets, (2) deterministic quant computation services, and (3) a grounded assistant with policy gating and evaluation scripts. The core outcome is a practical definition of reliability: numeric answers are produced only when backed by internal evidence; otherwise the system abstains with clear diagnostics.

## 5.2 Answer to Research Questions
- RQ1: Policy-gated grounding reduces unsupported numeric outputs by forcing evidence retrieval and blocking low-evidence completions.
- RQ2: Strict robustness can reduce answer coverage, but it improves trustworthiness in finance contexts where numeric errors are costly.
- RQ3: A five-metric gate provides an operational definition of reliability that is measurable and regression-testable across releases.

## 5.3 Practical Contributions
- A reproducible engineering workflow from issue reproduction to regression testing.
- A lightweight CI pattern suitable for balancing thesis progress and product quality.
- A thesis-aligned metric framework that links design decisions to measurable outcomes.
 - A concrete, extensible codebase structure (App Router + `src/lib` modules) that supports both classic quant workflows and assistant-driven interaction.

## 5.4 Limitations
- Limited symbol universe and historical range.
- Dependence on internal endpoint availability and data freshness.
- Provider-level variability may affect language quality even with grounding controls.
 - In-memory rate limiting and process-level caching are suitable for a single deployment instance but require a distributed alternative for horizontal scaling.
 - Corporate actions and more advanced market microstructure effects are out of scope for this graduation project.

## 5.5 Future Work
Engineering roadmap:
- Replace in-memory rate limiting with Redis-backed limits and shared counters for multi-instance deployments.
- Introduce persistent storage for Strategy Lab runs, artifacts, and event streams (see `docs/STRATEGY_LAB_BACKEND_TECH_DESIGN.md`).
- Add richer data lineage and dataset snapshotting (manifest versioning, reproducible “data snapshot IDs” for experiments).

Evaluation roadmap:
- Expand assistant prompt suites with more adversarial and longitudinal prompts, and add scheduled regression pipelines with drift dashboards.
- Add calibration and uncertainty reporting for non-numeric narrative outputs, without weakening numeric evidence gates.

## 5.6 Final Remark
For financial assistant systems, robust abstention with explicit evidence is often more valuable than broad but weakly supported responses. This principle should guide both product roadmap and future research.
