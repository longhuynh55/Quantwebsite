# Assistant Req6 Testing Framework V2.1

Date: 2026-02-19  
Scope: HOSE-only assistant evaluation with accuracy-first gating and expanded edge-case coverage.

## 1) Objective

V2.1 redesigns the question bank and gate criteria to focus on real-user query behavior, especially:
- timeline correctness across listing lifecycle (IPO during period, suspended, delisted)
- robust BS/IS/CF retrieval and cross-statement consistency
- multi-symbol comparison under strict time alignment
- anti-hallucination behavior when data exists vs missing
- small-cap/low-liquidity query stability
- combined OHLCV + fundamentals consistency by time

## 2) Taxonomy and Priority

| Taxonomy | Priority | Purpose |
| --- | --- | --- |
| T1 Timeline + listing-state | P0 | Prevent wrong answers before listing / after delisting / during suspended windows |
| T2 BS+IS+CF retrieval + linkage | P0 | Guarantee grounded financial statement extraction and linkage correctness |
| T3 Multi-symbol compare | P1 | Ensure comparable time basis and fair symbol-to-symbol outputs |
| T4 Anti-hallucination | P0 | Block fabricated numerics and enforce abstain/partial behavior |
| T5 Small-cap / junk stability | P2 | Verify long-tail symbol handling does not degrade quality |
| T6 OHLCV + FS temporal robustness | P1 | Validate cross-source consistency under date/period constraints |

## 3) KPI Gates

| KPI | PR | Nightly | Release |
| --- | --- | --- | --- |
| Critical violations (fabrication, non-HOSE leakage, future leakage, wrong listing-state answer) | 0 | 0 | 0 |
| Weighted overall score | >= 90 | >= 93 | >= 95 |
| P0 average (T1+T2+T4) | >= 92% | >= 95% | >= 97% |
| T1 temporal/listing-state accuracy | >= 95% | >= 97% | >= 99% |
| T2 BS/IS/CF retrieval+linkage accuracy | >= 93% | >= 96% | >= 98% |
| T3 multi-symbol compare correctness | >= 90% | >= 94% | >= 96% |
| T4 hallucination rate (missing-data cases) | <= 1.0% | <= 0.5% | <= 0.2% |
| T6 OHLCV+FS temporal consistency | >= 93% | >= 96% | >= 98% |
| Flake rate (stability rounds) | <= 3% | <= 2% | <= 1% |

## 4) Coverage Targets

| Gate | Total prompts | Mix |
| --- | --- | --- |
| PR | 96 | P0 60% / P1 30% / P2 10% |
| Nightly | 360 | P0 55% / P1 35% / P2 10% |
| Release | 900 | P0 50% / P1 35% / P2 15% |

Stratified sampling policy:
- symbol strata: large 30%, mid 25%, small 30%, junk 15%
- listing-state strata: active 60%, suspended 15%, IPO-gap 10%, delisted 15%
- time strata: 2018-2020 (25%), 2021-2023 (35%), 2024-2025 (40%)
- interaction strata: single-turn 60%, multi-turn 40%

## 5) Question Bank Artifact

Machine-readable prompt set:
- `scripts/assistant-question-bank-v2_1.mjs`

Current bank size:
- 48 prompts = 12 Basic + 12 Intermediate + 12 Hard + 12 Adversarial

Each prompt includes:
- expected tools
- required endpoint citation fragments
- allowed `policyStatus`
- numeric rule (`required|conditional|forbidden`)
- oracle type for deterministic validation

## 6) QA Signoff Flow

1. Freeze HOSE universe snapshot and listing-state metadata.
2. Validate question-bank structure and coverage (lint gate).
3. Execute PR gate subset; block merge on any critical violation.
4. Execute nightly stability rounds with failure clustering by taxonomy.
5. QA reviews all critical failures + random 10% pass samples.
6. Release gate requires zero critical violations and threshold pass.

Mandatory artifacts:
- gate reports
- failed-case evidence with citations
- drift delta vs prior baseline
- explicit risk acceptance (if any non-critical shortfall)

## 7) Commands

- Lint question bank structure/coverage:
`pnpm run eval:assistant:req6:v2.1:lint`

(Execution runner integration can consume this same bank directly in next phase.)

