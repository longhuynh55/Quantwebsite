# Assistant Real-world Drift Tracking Plan V1

## 1) Scope and Goal
- Scope: assistant query and response quality in HOSE-only product behavior.
- Goal: detect and contain "lab pass, production fail" drift early by combining:
- behavior-realistic scenario sampling
- metric thresholds with warn and critical bands
- stable multi-round gates
- operational incident handling

## 2) Team and Roles
- PM Lead: owns cadence, weekly review, release and rollback decisions.
- AI Evaluation Engineer: owns metric formulas, thresholds, and trend interpretation.
- QA Lead: owns scenario coverage, sampling quality, and rerun policy.
- BA (HOSE domain): owns business acceptance criteria and failure policy.
- SRE/Observability: owns alerting, incident runbook, and SLA tracking.

## 3) Tracking Artifacts
- Criteria: `docs/assistant-realworld-drift-criteria-v1.json`
- Governance monitor report: `artifacts/assistant-governance-monitor-report.json`
- Governance summary: `artifacts/assistant-governance-monitor-summary.md`
- Stability report: `artifacts/assistant-stability-report.json`
- Key suite reports:
- `artifacts/assistant-routing-matrix-report.json`
- `artifacts/assistant-realworld-report.json`
- `artifacts/assistant-policy-matrix-report.json`
- `artifacts/assistant-perf-reliability-report.json`
- `artifacts/assistant-postcheck-anomaly-v1-report.json`

## 4) Drift Dimensions and Metrics
- Intent drift: compare routing intent pass-rate to baseline.
- Tool drift: detect changes in required tool resolution and unexpected tool outcomes.
- Endpoint drift: verify endpoint grounding is still mapped correctly.
- Policy drift: track policy pass-rate and share of non-`ok` statuses.
- Grounding and citation drift: monitor citation pass-rate and realworld citation coverage.
- Context-carry drift: follow-up queries must preserve symbol and date scope.
- Latency drift: monitor p95 response latency.
- Stability drift: monitor flake rate across multi-round gates.

Thresholds are defined in:
- `docs/assistant-realworld-drift-criteria-v1.json` under `driftThresholds`.

## 5) Scenario Sampling Strategy
- Portfolio mix:
- 60% real logs and support-derived patterns
- 20% adversarial/noisy/policy edge cases
- 20% regression from incidents
- Complexity mix:
- simple: 35%
- medium: 40%
- complex multiturn: 25%
- Tool plan complexity mix:
- single-tool: 40%
- multi-tool: 35%
- dependent multi-step: 25%
- Turn structure mix:
- single-turn: 50%
- multiturn guided: 30%
- multiturn ambiguous: 20%

## 6) Weekly Cadence
- Daily:
- run drift monitor and collect artifacts
- watch warn and critical thresholds
- Weekly:
- PM-led drift review with AI, QA, BA, SRE
- classify failures by root cause: routing, policy, data, format, latency, infra
- update backlog and owners
- Monthly:
- re-baseline thresholds from rolling 4-week trend
- PM sign-off for threshold changes

## 7) Governance and Decision Gates
- PR gate:
- required suites: `routing`, `pr-gate`
- minimum rounds: 2
- Nightly gate:
- required suites: `routing`, `realworld`, `pr-gate`, `policy-matrix`, `perf-reliability`, `postcheck-anomaly`
- minimum rounds: 3
- Release gate:
- require at least 2 latest nightly passes
- require zero S1 failures

## 8) Incident Response and SLA
- Detection SLA: <= 5 minutes after threshold breach.
- Acknowledgement SLA: <= 30 minutes.
- Status update cadence: every 30 minutes during incident.
- Postmortem SLA: <= 24 hours after closure.

## 9) BA Acceptance Scorecard
- Accuracy and factual groundedness: 40%
- HOSE-only scope compliance: 25%
- Format usability and actionability: 20%
- Failure policy compliance: 15%

Failure examples:
- answer includes non-HOSE data without explicit limitation
- unsupported numeric claims without grounded evidence
- missing actionable guidance for user follow-up

## 10) Commands
- Local drift monitor:
```bash
pnpm run eval:assistant:drift:monitor
pnpm run eval:assistant:drift:monitor:skip-run
```
- Local baseline and triage:
```bash
pnpm run eval:assistant:drift:baseline
pnpm run eval:assistant:drift:triage
pnpm run eval:assistant:drift:triage:strict
pnpm run eval:assistant:drift:backlog
```
- Docker drift monitor:
```bash
pnpm run docker:eval:assistant:drift:monitor
pnpm run docker:eval:assistant:drift:monitor:skip-run
```
- Docker baseline and triage:
```bash
pnpm run docker:eval:assistant:drift:baseline
pnpm run docker:eval:assistant:drift:triage
pnpm run docker:eval:assistant:drift:triage:strict
pnpm run docker:eval:assistant:drift:backlog
```

## 11) Operational Checklist
1. Run drift monitor and capture report paths.
2. Check stage gates and all critical metrics.
3. If any critical breach, open incident and freeze release.
4. Convert new failures into regression scenarios.
5. Re-run affected stable suites after fixes.
6. Record closure evidence in weekly PM review notes.
