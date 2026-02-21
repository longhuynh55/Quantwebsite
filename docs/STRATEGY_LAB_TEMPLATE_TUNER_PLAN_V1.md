# Strategy Lab Template Tuner Plan (V1)

## Goal
Giữ trải nghiệm **kéo-thả** (Strategy Builder canvas) nhưng đảm bảo thứ user “build” ra là **một strategy template chạy đúng theo engine hiện có**, không tạo cảm giác “graph compiler” khi hệ thống chưa compile graph.

## Non-Goals (V1)
- Không build graph compiler/DSL (node + edge semantics đầy đủ).
- Không hỗ trợ portfolio/multi-symbol run trong Strategy Lab.
- Không làm optimization/walk-forward full ngay trong V1 (chỉ chuẩn bị nền tảng).

## Product Positioning (V1)
- Tên/định vị: **Template Tuner** (Template-driven strategy).
- Promise: “Chọn template, chỉnh tham số, chạy backtest, so sánh các lần chạy, export kết quả.”
- Canvas: vẫn kéo-thả, nhưng **edges/flow chỉ để bố cục** (hoặc auto-layout), không thay đổi logic execution.

## Core Contract
1. Strategy Builder graph phải map **deterministically** sang:
   - `strategyType` (1 trong 5: `sma_crossover|ema_crossover|rsi_mean_reversion|bollinger_bands|momentum`)
   - `params` đúng key/constraints
   - `config` bias-safe (default `executionModel=next_open`)
2. UI phải show “Execution Preview” trước khi chạy:
   - Template được chọn + params + config + dateRange + capital
   - “Ignored/Non-semantic UI parts” (nếu còn node/edge không dùng)
3. Không được silent fallback:
   - Unsupported indicator/filter/node => error rõ ràng, gợi ý fix.

## Milestones

### M0 - Scope Lock (P0)
- Decide giữ/loại node types:
  - Keep: Data Source, Template/Indicator (restricted), Filter (restricted)
  - Remove/Disable: Signal, Output (nếu không có semantics)
  - Edges: non-semantic (decorative) hoặc disable connect hoàn toàn.

### M1 - Builder UX Hardening (P0)
- Palette/PropertyPanel chỉ cho chọn options engine hỗ trợ.
- Execution Preview panel + warning banners (scope + bias notes).

### M2 - Mapping & Validation (P0)
- `builder-mapper` strict mapping rules.
- Determinism tests + no silent fallback tests.

### M3 - Engine Guardrails (P0)
- Strategy Lab defaults:
  - `executionModel=next_open` (bias-safe)
  - costs/lotSize surfaced explicitly in result assumptions.
- Add invariants tests in backtest engine.

### M4 - Iteration Loop (P1)
- Run history list + compare (2-4 runs) + baseline (buy-and-hold symbol).
- Export basic report (JSON/CSV).

### M5 - QA Gates (P0/P1)
- E2E smoke for: build -> preview -> run -> terminal -> summary -> compare.
- Perf & reliability thresholds.

## Tech Notes (Where to Implement)
- UI canvas/nodes:
  - `src/app/strategy-builder/page.tsx`
  - `src/components/strategy-builder/*`
  - `src/lib/stores/strategyBuilderStore.ts`
- Mapping:
  - `src/lib/strategy-lab/builder-mapper.ts`
- Execution + engine:
  - `src/lib/strategy-lab/executor.ts`
  - `src/lib/quant/backtest.ts`
- Strategy Lab APIs:
  - `src/app/api/strategy-lab/*`

## Acceptance (Production Grade for V1)
- No misleading capability claims (UI copy matches execution).
- Deterministic mapping + strict validation.
- Bias-safe defaults and explicit assumptions.
- Run pipeline is stable: create -> poll -> terminal -> result, with useful errors.
- QA gate suite covers the top user flows and edge cases.

