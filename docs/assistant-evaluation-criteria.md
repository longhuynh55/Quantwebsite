# AI Assistant Evaluation Criteria (Data-Query Grounded)

Muc tieu cua tai lieu nay la dinh nghia bo tieu chi danh gia va cach do (metrics + test harness) cho AI Assistant trong QuantVN Strategy Forge, uu tien “query truy xuat dung du lieu” de tu do AI co the binh luan/khuyen nghi dua tren du lieu that.

## 1) Pham vi va gia dinh

### In-scope (uu tien)
- Data retrieval correctness: truy xuat dung bang/field, dung dieu kien loc, dung timeframe, dung symbol.
- Numeric correctness: so lieu, thong ke, ranking, aggregation, join.
- Tool/route reliability: chon dung API/tool, tham so hop le, retry/backoff hop ly, khong OOM.
- Grounded response: cau tra loi phai phan anh dung du lieu da truy xuat; khong tu che so.

### Out-of-scope (giai doan 1)
- Danh gia “alpha” / hieu qua dau tu ngoai mau (neu chua co backtest pipeline giong production).
- Danh gia do an toan phap ly (compliance) theo tung thi truong (se them sau).

### Dinh nghia “Oracle”
- DuckDB duoc xem la “data oracle” cho ket qua query (chinh xac va de tai lap).
- CSV duoc xem la “debug/fallback”, nhung trong evaluation phai co che do so sanh cross-backend (DuckDB vs CSV) de phat hien drift.

## 2) Nguyen tac danh gia (Design Principles)
- Deterministic: cung input -> cung output (hoac dao dong trong bien do cho phep).
- Reproducible: co seed, co snapshot du lieu, co versioning cho schema + dataset.
- Observable: moi request co trace (tool calls, query plan, row counts, timings).
- Fail-safe: thieu du lieu thi phai “abstain” hoac de xuat buoc tiep theo, khong hallucinate.
- Data-first: “tra loi hay” khong duoc uu tien hon “tra loi dung”.

## 3) Taxonomy tieu chi va metrics

### A. Data Query Fidelity (bat buoc)
Danh gia dau ra truy van (ket qua bang/series) so voi oracle.

Metrics goi y:
- `Exact-match`: ket qua bang giong hoan toan (theo row set, sort khong quan trong neu khong yeu cau).
- `Numeric tolerance`: cho phep sai so nho (vd 1e-6) cho float.
- `Top-K overlap`: cho ranking (vd top 20 co bao nhieu phan tu trung).
- `Aggregation check`: sum/avg/count/min/max dung.
- `Join integrity`: so dong, so key bi null, ty le match (left/inner) dung.
- `Schema adherence`: dung column names/types; khong tra ve field khong ton tai.

Loai bai test:
- Single-table filter (symbol, date range).
- Multi-table join (fundamentals + price).
- Derived metrics (PE, PB, market cap, EPS, revenue growth).
- Rolling/indicator queries (MA, RSI, volatility).
- Cross-sectional screening (rank theo metric, loc nhieu dieu kien).

Acceptance gate (goi y):
- Exact-match >= 0.98 tren tap “gold” (khong tinh cac case co tolerance).
- Numeric tolerance pass >= 0.995 tren tap numeric.
- Top-K overlap >= 0.90 (K=20) tren tap screening.

### B. Answer Faithfulness (grounded response)
Danh gia cau tra loi co “faithful” voi du lieu vua truy xuat khong.

Metrics goi y:
- `Attribution coverage`: % so/ket luan quan trong duoc gan “nguon” (tool result / fields).
- `Faithfulness`: khang dinh trong text phai suy ra duoc tu bang/series (rule-based checker).
- `No fabrication`: dem “numbers-not-in-data” (so lieu xuat hien trong text nhung khong co trong ket qua).
- `Abstain correctness`: khi tool fail/empty -> assistant tu choi dung cach (khong doan).

Acceptance gate (goi y):
- Numbers-not-in-data = 0 tren tap gold.
- Faithfulness >= 0.98 tren tap gold.

### C. Tool/Agent Reliability (routing + stability)
Danh gia kha nang tu dong chon dung hanh dong de lay du lieu.

Metrics goi y:
- `Route accuracy`: dung endpoint/tool (vd /api/stocks, /api/fundamentals, /api/market-overview, /api/health/data).
- `Param validity`: symbol/date range/interval hop le, khong 400/500.
- `Success rate`: % thanh cong khong can can thiep.
- `Retry behavior`: so lan retry, thoi gian, khong loop vo han.
- `Latency`: p50/p95 theo loai query.
- `Memory safety`: khong OOM (nhat la trong production container nho).

Acceptance gate (goi y):
- Success rate >= 0.99 tren tap gold (trong moi truong co du lieu).
- No infinite loop; retries <= 2 neu 5xx; retries = 0 neu 4xx.

### D. Robustness (stress, noise, adversarial)
Danh gia tinh ben vung khi prompt xau, dieu kien phuc tap, du lieu thieu.

Metrics goi y:
- `Constraint robustness`: nhieu dieu kien (10-20 filter) van query dung.
- `Symbol normalization`: VNM, VN30, case, space, suffix (neu co).
- `Time boundary`: leap day, day-1, end-of-month, holiday gaps.
- `Large-result handling`: tu dong giam do rong (limit) hoac tinh toan tong hop.

Acceptance gate (goi y):
- 0 crash; 0 OOM; degradation co kiem soat (summarize/limit).

### E. Safety/Policy (toi thieu)
Tap trung “safety as correctness”, khong phai compliance day du.

Metrics goi y:
- `No secrets`: khong lo env keys / internal paths.
- `No financial guarantees`: khong “cam ket loi nhuan”.
- `Disclosure`: neu chi la thong tin tham khao, co canh bao.

## 4) Bo test set (Dataset + Prompt Set)

### 4.1 Test sets (du lieu)
- `Gold set`: 100-300 query co dap an oracle ro rang, on dinh theo snapshot du lieu.
- `Stress set`: 300-1000 query (nhieu dieu kien + nhieu metrics), do throughput + stability.
- `Adversarial set`: prompt loan, nham lan timeframe, nhieu symbol, yeu cau “doan”.
- `Cross-backend set`: chay cung query tren DuckDB va CSV, so sanh ket qua.

### 4.2 Prompt templates (de sinh matrix)
Hang muc yeu cau:
- Screening: “loc top N theo metric A, rang buoc B,C, trong khoang thoi gian T”.
- Time-series: “tinh volatility 20d, return 1m/3m, drawdown”.
- Fundamentals: “PE/PB/ROE/Revenue growth”, ket hop gia.
- Multi-factor: “xep hang theo weighting, conditional, sort node”.

Output can thu:
- Structured JSON (de cham diem): query intent, metrics list, constraints, expected table schema.

## 5) Harness: cach do va bao cao (Implementation Blueprint)

### 5.1 Trace format (goi y)
Moi testcase luu:
- input prompt, normalized intent
- tool calls (ten tool, params, status)
- query/oracle result checksum (hash), row/col counts
- assistant final answer + extracted numbers
- verdicts cho moi metric (pass/fail + ly do)

### 5.2 Oracle comparator
Nguyen tac:
- Neu output la table: so sanh theo set (order-insensitive) hoac stable sort neu co.
- Neu output la series: so sanh theo index (date) va numeric tolerance.
- Cho ranking: dung top-K overlap + spearman (neu can).

### 5.3 Gating (Release gate)
De deploy len Railway / public demo:
- Gold: pass tat ca gate A+B+C.
- Stress: 0 crash, 0 OOM, success rate >= 0.98.
- Cross-backend: neu drift > nguong -> can review schema/loaders.

## 6) Lien ket voi feature cua app (Strategy Builder + Functions)
Voi Strategy Builder (node graph):
- Can test “node-generated query intent” va “assistant suggestion -> node graph output”.
- Test tinh nhat quan: cung graph -> cung ket qua query.
- Test edge cases: missing edge, invalid connection, conditional/sort/weighting.

Voi cac function: risk management, optimization, factor analysis, dashboard:
- Moi function co “contract test”: dau vao (symbol, timeframe, constraints) -> API calls -> ket qua.
- Neu con mock data: danh dau “not eligible for release gate”.

## 7) Reference papers / benchmarks (de tham khao)
Luu y: cac tai lieu duoi day duoc dung de “borrow evaluation ideas”, khong nhat thiet phai adopt 1:1.

### LLM evaluation (chat quality / holistic)
- HELM: Holistic Evaluation of Language Models. `arXiv:2211.09110`
- MT-Bench: Multi-turn benchmark (LMSYS). (tham khao rubric multi-turn)

### Tool-using / agent evaluation
- ToolBench: Benchmark for tool-augmented LLMs. `arXiv:2307.16789`
- ToolLLM: Tool use instruction tuning (tool calling correctness). `arXiv:2307.16789` (lien quan ToolBench ecosystem)
- Gorilla: LLMs as API callers (tool call accuracy). `arXiv:2305.15334`

### RAG / faithfulness evaluation (ap dung cho “grounding”)
- RAGAS: Retrieval-Augmented Generation Assessment (faithfulness, answer relevance). (paper + lib ecosystem)
- ARES: Automated RAG Evaluation (judge-based) (tham khao cach cham faithfulness)

### Text-to-SQL / structured query correctness (gan voi DuckDB oracle)
- Spider benchmark (text-to-SQL exact match)
- BIRD benchmark (text-to-SQL with large DB + real-world complexity)

### Finance QA / numeric reasoning (tham khao)
- FinQA / ConvFinQA (numeric reasoning + tables) (tham khao cach check ket qua so)
- (Neu can) FiQA (sentiment/QA), nhung khong tap trung query.

## 8) Practical next steps (de chuyen thanh testing)
Sau khi chot tieu chi:
1. Chot “gold queries” (CSV/JSON) + oracle SQL/DuckDB scripts.
2. Them evaluator scripts: run tool/assistant -> capture trace -> compare vs oracle.
3. Them CI gate: fail neu vuot nguong drift / hallucination.
4. Them report artifact: `artifacts/assistant-eval/report.json` + summary markdown.

