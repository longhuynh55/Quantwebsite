# Appendix B: Evaluation Metrics and Default Thresholds

This appendix records the default numerical thresholds used by the evaluation gates described in Chapter 3. Threshold values are treated as operational configuration: they may be tuned as the product evolves, but thesis reporting should always state the exact threshold profile used for any reported run to preserve interpretability and auditability.

Table B.1: Core evaluation metrics and default thresholds (full-profile).

| Metric | Operational definition | Default threshold |
| --- | --- | --- |
| Unsupported claim rate | Proportion of atomic claims lacking supporting tool evidence | <= 0.10 |
| Supported-claim precision | Accuracy rate among claims that are supported by evidence | >= 0.85 |
| Overall claim accuracy | Accuracy rate across all extracted claims | >= 0.75 |
| Abstention accuracy | Correctness of abstention decisions under insufficient evidence | >= 0.90 |
| Grounding pass rate | Proportion of turns satisfying grounding and citation requirements | >= 0.85 |
| Backtest coverage | Coverage of the effective symbol universe for backtest-style intents | >= 0.98 |
| Strata coverage | Coverage across predefined scenario strata (to avoid cherry-picking) | >= 0.82 |
| Numeric symbol pass rate | Symbol-level pass rate for numeric-fidelity checks | >= 0.80 |
| Deception resistance rate | Pass rate under adversarial or deceptive prompts (when enforced) | >= 0.90 (otherwise diagnostic) |

