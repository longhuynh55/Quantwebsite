# Assistant Grouping/Orchestration Assessment (2026-02-17)

## Scope
- Question: does strict grouping in reasoning/tool orchestration reduce model effectiveness?
- Model under test: `openai/gpt-oss-120b`.
- Team review: 3 independent explorer passes (orchestration flow, planner/policy interplay, eval pipeline).

## Code Findings (High impact)
- `src/lib/assistant/tools.ts`: query-plan steps can hard-gate tool execution when strict mode is on.
- This is now made configurable via `ASSISTANT_QUERY_PLAN_STRICT` for controlled A/B evaluation.
- Default remains strict (`true`) to prioritize grounded precision.

## Experiment Design
- Service: local Docker app (`http://localhost:3010` / `3011`).
- Eval suites:
  - `scripts/model-stress-lite.mjs`
  - `scripts/eval-assistant-comprehensive.mjs` (`ASSISTANT_EVAL_PROFILE=quick`, 8 assistant symbols, 24 backtest symbols)
- A/B:
  - **Strict**: `ASSISTANT_QUERY_PLAN_STRICT=true`
  - **Blended**: `ASSISTANT_QUERY_PLAN_STRICT=false`

## Quantitative Results

### Comprehensive eval (quick profile)
| Metric | Strict | Blended |
|---|---:|---:|
| numericSymbolPassRate | 87.5% | 75.0% |
| unsupportedClaimRate | 12.5% | 25.0% |
| supportedClaimPrecision | 85.71% | 83.33% |
| overallClaimAccuracy | 75.0% | 62.5% |
| groundingPassRate | 100% | 100% |
| abstentionAccuracy | 100% | 100% |
| deceptionResistanceRate | 100% | 100% |
| durationMs | 166,495 | 156,190 |

### Lite stress eval
| Metric | Strict | Blended |
|---|---:|---:|
| passRate | 100% | 100% |
| avg latency | 11,379 ms | 18,485 ms |
| p95 latency | 17,305 ms | 29,130 ms |

## Conclusion
- With current dataset/tasks, **strict grouping is not reducing quality**.
- Relaxing grouping globally (blended mode) increases hallucination risk (`unsupportedClaimRate` doubled from 12.5% to 25%).
- Latency tradeoff is mixed by suite, but lite stress shows strict mode faster.

## Recommendation
1. Keep `ASSISTANT_QUERY_PLAN_STRICT=true` in production path.
2. Use `ASSISTANT_QUERY_PLAN_STRICT=false` only for targeted experiments on specific prompt families.
3. Add a small recurring regression check (lite + quick comprehensive) and track:
   - `unsupportedClaimRate`
   - `overallClaimAccuracy`
   - `numericSymbolPassRate`
   - latency (`avg`, `p95`)

## Artifacts
- `artifacts/grouping-eval/model-lite-strict.json`
- `artifacts/grouping-eval/model-lite-blended.json`
- `artifacts/grouping-eval/comprehensive-strict.json`
- `artifacts/grouping-eval/comprehensive-blended.json`
