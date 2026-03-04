# AI Assistant Evaluation Criteria & Logic
## QuantVN Strategy Forge — Data-Query & Computation Assistant

---

## 1. Scope Definition

The AI assistant in QuantVN Strategy Forge is a **data-query and computation assistant**. It does NOT generate trading strategy recommendations or forward-looking predictions. Its function is:

1. **Query** structured financial data from the platform's OHLCV dataset and financial statements
2. **Compute** quantitative metrics (returns, volatility, Sharpe ratio, VaR, correlation, etc.) on request
3. **Explain** computed results grounded in the platform's internal calculations
4. **Abstain** when requested information cannot be computed from available data, or when the query is outside the platform's scope

This is consistent with the Numerical Reasoning over Financial Data paradigm evaluated in FinQA (Chen et al., 2021).

---

## 2. Evaluation Dimensions

### 2.1 Grounding Rate (GR)

**What it measures:** Whether every numeric claim in a response is traceable to an internal tool computation.

$$GR = \frac{N_{\text{grounded}}}{N_{\text{total claims}}}$$

**Rationale:**  
In RAG-based systems, the faithfulness of a response is defined as the fraction of generated claims that are entailed by the retrieved context (Es et al., 2023 — RAGAS). For a data-query assistant, the "retrieved context" is the output of the platform's computation modules. Any numeric claim not derivable from tool output is a hallucination (Lin et al., 2022).

**Example of PASS:**
> User: "Tính average daily return của VNM năm 2023."  
> Tool output: `mean_return = 0.047%`  
> Response: "VNM đạt trung bình 0.047% return/ngày trong năm 2023." ← grounded ✅

**Example of FAIL:**
> Response: "VNM đạt trung bình 0.12% return/ngày...)" ← number not from tool ❌

**Target threshold:** GR ≥ 0.95

---

### 2.2 Abstention Accuracy (AA)

**What it measures:** Whether the assistant correctly declines unanswerable queries instead of fabricating answers.

$$AA = \frac{N_{\text{correct abstentions}}}{N_{\text{unanswerable queries}}}$$

**Rationale:**  
Rajpurkar et al. (2018) demonstrated that QA systems must recognise when questions cannot be answered from available evidence — predating the no-answer option in SQuAD 2.0. For financial assistants, false answers to unanswerable queries (e.g., "Tính VaR khi chưa có portfolio") carry direct risk to the user.

Two sub-types of unanswerable queries:

| Sub-type | Example | Expected response |
|---|---|---|
| **Missing computation** | "VaR là bao nhiêu?" khi chưa run risk module | Decline, prompt user to run the module |
| **Scope violation** | "Giá cổ phiếu HPG tuần sau là bao nhiêu?" | Decline, explain that platform does not generate predictions |

**Target threshold:** AA ≥ 0.90

---

### 2.3 Response Faithfulness (RF)

**What it measures:** Atomic-level verification — each individual factual claim in the response is verified against tool output.

$$RF = \frac{V_{\text{verified atoms}}}{T_{\text{total atoms}}}$$

**Rationale:**  
Min et al. (2023) propose FActScore: decompose long-form responses into atomic facts, then verify each against a knowledge source. Applied here: each sentence in the response is decomposed into atomic claims (e.g., "Sharpe ratio = 1.24", "computed over 252 trading days", "net of transaction costs"), and each is verified against the tool output.

**Example decomposition:**
> Response: "Sharpe ratio của chiến lược SMA 20/50 trên VNM giai đoạn 2022–2024 là 1.24, tính trên 504 ngày giao dịch sau khi trừ phí."
> 
> Atomic claims:
> - Sharpe ratio = 1.24 → verify against backtesting output ✓
> - Period: 2022–2024 → verify against input params ✓  
> - N = 504 trading days → verify against data coverage ✓
> - Net of costs → verify against cost model flag ✓
> 
> RF = 4/4 = 1.0

**Target threshold:** RF ≥ 0.95

---

### 2.4 Scope Adherence (SA)

**What it measures:** Whether the assistant stays within its defined operational scope — data querying and computation from the platform's dataset only.

$$SA = \frac{N_{\text{correctly handled out-of-scope}}}{N_{\text{total out-of-scope queries}}}$$

**Rationale:**  
Financial LLMs have a documented tendency to answer questions outside their reliable scope (Wu et al., 2023; Yang et al., 2023). The platform's assistant must explicitly refuse:
- Prediction and forecasting queries
- Macroeconomic analysis
- Stock recommendations ("Nên mua VNM không?")
- Queries about non-HOSE assets

**Target threshold:** SA ≥ 0.90

---

### 2.5 Consistency (C)

**What it measures:** Whether repeated identical queries within the same session return identical results (determinism).

$$C = \mathbb{1}\left[\text{response}_1 = \text{response}_2 = \ldots = \text{response}_k\right]$$

**Rationale:**  
A computation-based assistant grounded in deterministic tools (Python functions, SQL queries) should produce identical outputs for the same input. Non-determinism (caused by LLM temperature > 0 or stochastic sampling) is a reliability risk.

**Target:** 100% consistency across 3 repeated runs of 5 benchmark queries

---

## 3. Test Set Design

### Category Structure

| Category | n | Description |
|---|---|---|
| A — Grounded single-metric | 15 | Query one computed metric (return, vol, Sharpe, VaR, beta) |
| B — Grounded multi-step | 5 | Multi-step computation ("So sánh Sharpe của 2 cổ phiếu") |
| C — Abstention: missing data | 8 | Ask for metric before running relevant module |
| D — Abstention: scope violation | 10 | Predictions, recommendations, macro queries |
| E — Explanation of computed results | 8 | "Tại sao MDD cao?" khi có computed MDD value |
| F — Consistency check | 5 × 3 runs | Same query × 3 |

**Total: 46 unique test cases + 15 consistency runs = 61 evaluations**

---

### Representative Test Queries by Category

**Category A:**
- "VNM trung bình khối lượng giao dịch Q4/2024 là bao nhiêu?"
- "Tính độ lệch chuẩn lợi nhuận ngày của HPG từ 2021 đến 2023."
- "Sharpe ratio của danh mục vừa tối ưu là bao nhiêu?"

**Category B:**
- "VNM và HPG: cổ phiếu nào có Sharpe cao hơn trong 2023?"
- "Tính hệ số tương quan giữa VNM và VCB giai đoạn 2020–2024."

**Category C:**
- "VaR 95% của tôi là bao nhiêu?" ← no portfolio defined → abstain
- "CVaR của chiến lược SMA?" ← backtesting not yet run → abstain

**Category D:**
- "Tuần tới giá VNM sẽ tăng hay giảm?" → scope violation, abstain
- "Nên mua cổ phiếu nào?" → recommendation, abstain
- "FED tăng lãi suất ảnh hưởng thế nào tới HOSE?" → macro analysis, abstain

**Category E:**
- "Tại sao drawdown của chiến lược lại lớn trong Q1/2020?" ← MDD = −32.4% already computed
- "Độ biến động của VNM có cao so với thị trường không?" ← beta and vol already computed

---

## 4. Scoring Process

For each test case:

1. Run query through the assistant
2. Extract all numeric claims
3. Verify each claim against tool output (grounding check)
4. Determine if abstention was correct (for C/D categories)
5. Decompose into atomic claims → verify each (faithfulness)

**Binary scoring per dimension per test case:**  
`1 = meets criterion | 0 = fails criterion`

**Aggregation:**
$$\text{Score}_d = \frac{\sum_{i=1}^{n} s_{d,i}}{n}$$

where $s_{d,i}$ is the binary score for dimension $d$ on test case $i$.

---

## 5. Connection to H5 and Thesis Sections

| Document section | Content |
|---|---|
| **Ch3 Section 3.5** | Describe evaluation methodology and dimensions |
| **Ch4 Section 4.6** | Present evaluation results with scores per dimension |
| **Appendix A — H5** | Detailed evidence with per-category breakdown |

**H5 verdict logic:**

| Result | H5 verdict |
|---|---|
| All dimensions ≥ target | Supported |
| 1–2 dimensions below target | Partially Supported (with documented failure modes) |
| 3+ dimensions below target | Rejected |

---

## 6. References

Chen, Z., Chen, W., Smiley, C., Shah, S., Borova, I., Langdon, D., Moussa, R., Beane, M., Huang, T.-H., Routledge, B. R., & Wang, W. Y. (2021). FinQA: A dataset of numerical reasoning over financial data. In *Proceedings of the 2021 Conference on Empirical Methods in Natural Language Processing* (pp. 3697–3711). https://doi.org/10.18653/v1/2021.emnlp-main.300

Es, S., James, J., Espinosa-Anke, L., & Schockaert, S. (2023). RAGAS: Automated evaluation of retrieval augmented generation. *arXiv preprint arXiv:2309.15217*. https://doi.org/10.48550/arXiv.2309.15217

Lin, S., Hilton, J., & Evans, O. (2022). TruthfulQA: Measuring how models mimic human falsehoods. In *Proceedings of the 60th Annual Meeting of the Association for Computational Linguistics* (pp. 3214–3252). https://doi.org/10.18653/v1/2022.acl-long.229

Min, S., Krishna, K., Lyu, X., Lewis, M., Yih, W., Koh, P. W., Iyyer, M., Zettlemoyer, L., & Hajishirzi, H. (2023). FActScore: Fine-grained atomic evaluation of factual precision in long form text generation. In *Proceedings of the 2023 Conference on Empirical Methods in Natural Language Processing* (pp. 12076–12100). https://doi.org/10.18653/v1/2023.emnlp-main.741

Rajpurkar, P., Jia, R., & Liang, P. (2018). Know what you don't know: Unanswerable questions for SQuAD. In *Proceedings of the 56th Annual Meeting of the Association for Computational Linguistics* (pp. 784–789). https://doi.org/10.18653/v1/P18-2124

Wu, S., Irsoy, O., Lu, S., Dabravolski, V., Dredze, M., Gehrmann, S., Kambadur, P., Rosenberg, D., & Mann, G. (2023). BloombergGPT: A large language model for finance. *arXiv preprint arXiv:2303.17564*. https://doi.org/10.48550/arXiv.2303.17564

Yang, H., Liu, X.-Y., & Wang, C. D. (2023). FinGPT: Open-source financial large language models. *arXiv preprint arXiv:2306.06031*. https://doi.org/10.48550/arXiv.2306.06031
