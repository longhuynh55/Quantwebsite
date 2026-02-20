# Assistant BA-QA-UX Testing Process (HOSE Only)

## 1) Muc tieu
- Test khong dua tren so prompt, ma dua tren do phuc tap truy van, routing tool, do dung du lieu, va cach hien thi.
- Dong bo 3 goc nhin: BA (nghiep vu), QA (he thong), UX (chat readability + trust).
- Giam khoang cach giua "test dep" va "dung thuc te bi te".

## 2) Pham vi va rang buoc
- Du lieu co pham vi `HOSE` only.
- Assistant grounding hien tai tra `messageBlocks` dang `table/text` (chua co `chart` block):
  - `src/types/assistant.ts`
  - `src/components/assistant/ChatMessage.tsx`
  - `src/lib/assistant/tools.ts`
- Routing/metadata can kiem soat qua:
  - `policyStatus`, `usedTools`, `citations`, `queryPlanSummary` trong `/api/assistant`
  - `src/app/api/assistant/route.ts`

## 3) Mo hinh team va ownership
| Vai tro | Ownership chinh | Deliverable |
|---|---|---|
| BA | User journey + business acceptance | Scenario catalog theo nghiep vu, severity S1-S4 |
| QA | Test architecture + automation + gates | Matrix test, report JSON/CI gates |
| UX Conversation QA | Readability, format, trust, context carry | Rubric chat quality, format/table/citation checklist |
| Backend/API | Contract + data correctness | API contract tests, fallback behavior |
| Frontend | Rendering + interaction | UI render checks (table/citation/trace/chart page) |
| LLM Ops | Routing/policy/model configs | Regression control va latency budget |

## 4) Testing architecture (6 tang)
| Tang | Muc tieu | Cach test | Gate goi y |
|---|---|---|---|
| L0 Data/API Contract | API tra dung schema, date/as-of, scope HOSE | `smoke`, `qa`, API matrix | 100% contract pass |
| L1 Routing/Tool | Dung intent, dung tool, dung endpoint | `eval:assistant:routing` | tool/endpoint/intent >= 0.95 |
| L2 Grounded Accuracy | So lieu co grounding, khong bia | `eval:assistant:realworld` + targeted numeric checks | grounded numeric precision >= 0.90 |
| L3 Policy/Safety | Case thieu du lieu, non-HOSE, injection | adversarial scenarios | abstention quality >= 0.98, 0 case S1 |
| L4 UX/Format | Bang, luan diem, citation, trace, context carry | rubric score + manual spot checks | context carry >= 0.90 |
| L5 Performance | Latency, tool budget/turn, timeout | routing perf gates + logs | p95 <= threshold, tool budget pass |

## 5) Quy tac thiet ke scenario (bat buoc)
1. Bao phu day du function groups:
- stock ranking/date
- symbol as-of/range
- fundamentals
- valuation
- risk/backtest/factor
- market/icb snapshot
- unsupported scope + safety

2. Muc do query phai da dang:
- clear single-turn
- multi-criteria filters (`date`, `metric`, `icb`, `pe/pb`, `order`, `limit`)
- multi-turn context carry
- noisy/typo/angry
- adversarial/injection
- unsupported scope (HNX/UPCOM)

3. Moi scenario phai co expected ro rang:
- `expected intent`
- `required tools`
- `endpoint fragments`
- `allowed policyStatus`
- `numeric claim constraints`
- `format constraints` (table/citation/trace)

## 6) Matrix coverage toi thieu (PR gate)
- Dung catalog:
  - `docs/ASSISTANT_REAL_WORLD_SCENARIO_CATALOG.md`
  - `docs/ASSISTANT_LEVEL_QUERY_MATRIX.md`
- Bo toi thieu khuyen nghi:
  - `A01, A02, A06, A09`
  - `B01, B02`
  - `C01, C04`
  - `D01, D02`
  - `E01, E02, E06`
  - `F01, F02`

## 7) Rule danh gia chat quality response (UX rubric)
| Hang muc | Dat | Khong dat |
|---|---|---|
| Clarity | Co cau truc ro, de scan, co assumption neu mo ho | Van ban dai, mo ho, khong ne assumption |
| Grounding trust | Co citation + tool trace + policy badge dung | So lieu khong citation/tool evidence |
| Table quality | Cot/so lieu hop le, format nhat quan | Bang lech cot, so lieu sai format |
| Context carry | Follow-up giu date/symbol/scope dung | Mat context hoac reset scope sai |
| Error/insufficient data | Tu choi dung cach, khong bia | Van dua so lieu du doan/bia |

## 8) Quy trinh test chart (tool + data + UI)
### 8.1 Current-state (ap dung ngay)
- Assistant chat chua co `chart` message block native.
- Neu user yeu cau "ve chart", test theo 3 buoc:
1. **Tool correctness**
   - Verify assistant route dung (`stockSnapshot`/`riskSnapshot`/`factorSnapshot` tuy query).
   - Verify citations endpoint dung.
2. **Data correctness**
   - So lieu trong text/table phai khop API grounding (symbol/date/timeframe).
3. **UI correctness**
   - Chat UI hien dung table/text/citation/trace.
   - Chart visualization kiem rieng tren chart components/page:
     - `src/components/charts/LineChart.tsx`
     - `src/components/charts/CandlestickChart.tsx`
     - `src/components/charts/index.ts`

### 8.2 Target-state (nen lam tiep)
- Them `chart` block trong `AssistantMessageBlock` va renderer trong `ChatMessage`.
- Khi do test E2E cho chart-in-chat se them gates:
  - tool called = true
  - chart config valid
  - series/axis/legend dung
  - UI render chart khong crash, responsive

## 9) Commands thuc thi
```bash
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
pnpm run eval:assistant:routing
pnpm run eval:assistant:realworld
pnpm run eval:assistant:pr-gate
pnpm run docker:smoke
pnpm run docker:qa
```

### 9.1 PR gate automation runner (M1)
- Script: `scripts/eval-assistant-pr-gate.mjs`
- Scope: minimum PR gate set (`A01,A02,A06,A09,B01,B02,C01,C04,D01,D02,E01,E02,E06,F01,F02`)
- HOSE-only assumption is explicit in report (`supportedExchanges=["HOSE"]`).
- Output JSON includes explicit sections:
  - `BA`
  - `QA`
  - `UX`
  - `selfCritique`
  - `mitigations`
- Default report path: `artifacts/assistant-pr-gate-report.json`
- Dry run (config + matrix validation, no API call):
```bash
pnpm run eval:assistant:pr-gate -- --dry-run
```

Configurable gates (env):
- `ASSISTANT_PR_GATE_MIN_TOOL_ROUTE_RATE` (default `0.95`)
- `ASSISTANT_PR_GATE_MIN_ENDPOINT_MATCH_RATE` (default `0.95`)
- `ASSISTANT_PR_GATE_MIN_INTENT_ROUTE_RATE` (default `0.92`)
- `ASSISTANT_PR_GATE_MIN_POLICY_SAFETY_RATE` (default `0.98`)
- `ASSISTANT_PR_GATE_MIN_UX_TRUST_RATE` (default `0.90`)
- `ASSISTANT_PR_GATE_MAX_LATENCY_P95_MS` (default `25000`)
- `ASSISTANT_PR_GATE_MAX_TOOL_CALLS_PER_TURN` (default `3`)
- `ASSISTANT_PR_GATE_MIN_TOOL_BUDGET_PASS_RATE` (default `1.0`)
- `ASSISTANT_PR_GATE_MAX_S1_FAILURES` (default `0`)

## 10) Artifact + report template (bat buoc)
Moi lan test phai luu:
- Config snapshot:
  - `ASSISTANT_POLICY_MODE`
  - `ASSISTANT_QUERY_PLAN_STRICT`
  - `ASSISTANT_BASELINE_ONLY`
- Metrics:
  - routing (tool/endpoint/intent)
  - policy/message/evidence checks
  - p50/p95 latency + tool calls per turn
- Failures top S1/S2:
  - prompt
  - expected vs actual tool/endpoint/policy
  - root cause
  - owner + ETA fix

## 11) Release gates de nghi
- `intentRoutingAccuracy >= 0.92`
- `endpointMatchRate >= 0.95`
- `groundedNumericPrecision >= 0.90`
- `abstentionQuality >= 0.98`
- `contextCarryRate >= 0.90`
- `0` S1 failures o cac intent uu tien cao.
