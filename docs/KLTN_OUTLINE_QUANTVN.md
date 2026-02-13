# KLTN Outline (QuantVN / Quant Website)

Muc tieu cua file nay la cung cap "khung" de viet KLTN theo style do an mau (Introduction -> Literature -> Methods -> Results -> Conclusion), nhung map truc tiep vao project QuantVN hien tai (Next.js + API routes + quant library + data robustness + Docker).

Ban co the copy/paste outline nay vao Word/Google Docs va dien noi dung.

---

## Front Matter

- Cover page:
  - Ten de tai (goi y ben duoi)
  - GVHD, sinh vien, MSSV, lop, truong/khoa
- Acknowledgements
- Instructor's comment (neu co form)
- Table of content
- List of figures
- List of tables
- List of abbreviations
- Abstract (150-250 words)

**Goi y ten de tai (chinh):**
- "Xay dung nen tang phan tich dinh luong co phieu Viet Nam: sang loc, backtest, toi uu danh muc va quan tri rui ro"

**Goi y keywords:**
- Quantitative finance, Vietnamese stock market, Backtesting, Portfolio optimization, Risk metrics, Data robustness

---

## Chapter 1. Introduction

### 1.1 Statement of the problem
- Van de thuc te: nha dau tu/nguoi hoc can cong cu phan tich co phieu (chart, indicator, risk, backtest, optimize) nhung du lieu thi thuong bi thieu, timeline lech, chat luong khong dong nhat.
- Rui ro logic: neu khong align date va khong kiem soat data quality, ket qua se sai (beta/TE, optimize covariance, momentum off-by-one...).

### 1.2 Objectives
- General objective: xay dung he thong phan tich dinh luong (web) cho tap co phieu VN, co xu ly robust data.
- Specific objectives (goi y):
  - Load/validate du lieu OHLCV + index + metadata
  - Cung cap API cho backtest, factors, risk, optimize
  - Xay dung UI de truy cap cac chuc nang tren
  - Dam bao reproducibility qua Docker + smoke tests

### 1.3 Research questions (or Project questions)
- He thong can xu ly timeline mismatch giua cac co phieu nhu the nao de optimize/risk co y nghia?
- Can co policy nao de loai bo symbol stale/inactive/insufficient history?
- Cach dam bao du lieu dau vao (CSV) khong lam vo cac ham quant?

### 1.4 Subject and scope
- Subject: du lieu co phieu VN (OHLCV), index benchmark, metadata.
- Scope:
  - Khong ket noi DB / external API (local CSV)
  - Khong trading live
  - Backtest long-only, daily frequency

### 1.5 Methods
- Literature/background (indicator, portfolio, risk)
- System analysis & design (architecture, API design)
- Implementation (Next.js + TS)
- Testing (smoke test, data quality checks, Docker)

### 1.6 Contributions
- Tang data robustness (schema validation, OHLC bounds validation, quality report, gating)
- Timeline-aware optimization (intersection by date, overlap filtering, exclusion reasons)
- Reproducible workflow (Docker dev/prod + smoke runner)

### 1.7 Thesis structure
- Tom tat moi chuong (1-2 cau/chuong)

---

## Chapter 2. Background / Literature Review

### 2.1 Financial time series basics
- OHLCV, trading days, benchmark index, corporate actions (chi mention neu co)

### 2.2 Technical indicators (used in project)
- SMA, EMA, RSI, Bollinger Bands, MACD
- Luu y: lookback windows va vung valid (null region)

### 2.3 Backtesting basics
- Signal generation, execution assumption, metrics (return, Sharpe, MDD)
- Biases: look-ahead, survivorship bias (mention)

### 2.4 Portfolio optimization basics
- Mean-variance (Markowitz)
- Risk parity / equal-weight (practical baselines)
- Importance of covariance, alignment, overlap window

### 2.5 Risk metrics basics
- VaR, CVaR, volatility, beta, tracking error, information ratio
- Date alignment requirement for beta/TE

### 2.6 Data quality and robustness
- Why data validation matters (bad candles, missing dates, stale series)
- Typical checks: numeric validity, OHLC bounds, recency gap

**Figures goi y:**
- F2.x: Conceptual architecture (Client -> API -> Data -> Quant)

---

## Chapter 3. Data and Methodology

### 3.1 Data description
- Dataset files:
  - `public/data/HOSE_VERIFIED_2020_2025.csv`
  - `public/data/ohlcv_enriched.csv`
  - `public/data/Market_Indices_Daily_2020_2025.csv`
- Fields (brief)
- Size (rows, symbols) + coverage (2020-2025)

### 3.2 Data preprocessing / validation
- CSV parsing pipeline (schema + row validation)
- Quality report:
  - accepted ratio, rejection reasons
- OHLC bounds validation:
  - high >= open/close
  - low <= open/close
  - high >= low
  - volume >= 0

### 3.3 Timeline policy (important for thesis)
- Benchmark calendar
- Recency policy (MAX_RECENCY_GAP_TRADING_DAYS)
- Minimum history days for optimize
- Minimum overlap days for covariance / optimize
- Exclusion reasons (stale, inactive, insufficient history, not in benchmark calendar)

### 3.4 Quant methods implemented
- Backtest strategies (list + params)
- Factors:
  - momentum, value proxy, volatility factor, size factor
- Risk metrics:
  - VaR/CVaR, drawdown, rolling vol, beta/TE
- Optimization:
  - return series by date key
  - pairwise intersection + overlap diagnostics
  - iterative exclusion when overlap insufficient

### 3.5 (Optional) Minimal evaluation
Neu can 1 bang ket qua "vua du" cho do an:
- Total Return (%), Max Drawdown (%), Sharpe
- Baseline: Buy & Hold VNINDEX (or equal-weight)

**Table template (Markdown):**

| Module | Case | Baseline | Total Return | Sharpe | Max DD | Notes |
|---|---|---|---:|---:|---:|---|
| Backtest | SMA crossover (VNM) | Buy&Hold |  |  |  |  |
| Optimize | Risk parity (VNM,FPT,HPG) | Equal weight |  |  |  |  |

---

## Chapter 4. System Design and Implementation

### 4.1 Architecture overview
- Next.js App Router
- API routes: `/api/stocks`, `/api/backtesting`, `/api/factors`, `/api/optimize`, `/api/risk`, `/api/market-overview`
- Quant library in `src/lib/quant/*`

**Figure goi y:**
- F4.1: High-level architecture diagram
- F4.2: Data flow (request -> validation -> compute -> response)

### 4.2 Data flow details
- `loadStockMetadata`, `loadOHLCVData`, `loadIndexData`
- Caching strategy
- Error handling / fallback

### 4.3 API design
- Input validation (symbol regex, bounds, method selection)
- Rate limiting approach + proxy header trust policy (env `TRUST_PROXY_HEADERS`)
- Error responses (400/404/503/500)

### 4.4 Robustness features
- Quality gating with 503 when dataset ratio < threshold
- Symbol exclusion transparency (excludedSymbols + reasons)
- Overlap diagnostics returned from optimizer

### 4.5 Deployment / reproducibility
- Docker dev + prod profiles
- Smoke tests:
  - `scripts/smoke.mjs`
- Runbook:
  - `docs/DOCKER_RUNBOOK.md`

**Appendix goi y:**
- A4.x: API request/response examples
- A4.x: Smoke test output sample

---

## Chapter 5. Results and Discussion

### 5.1 Functional demonstration (recommended for do an)
- Scenario 1: Chart + stocks API
- Scenario 2: Backtesting strategy on a symbol
- Scenario 3: Risk metrics with benchmark alignment
- Scenario 4: Portfolio optimization with timeline mismatch handling
- Scenario 5: Market overview movers with recency filter

### 5.2 Data quality findings
- Report accepted ratio + top rejection reasons
- How this affects feature correctness (risk/optimize/factors)

### 5.3 Discussion
- What works well
- Tradeoffs:
  - strict validation vs data coverage
  - overlap thresholds vs universe size

### 5.4 Limitations
- Local CSV only, no corporate actions adjustment
- No transaction cost/slippage in backtest (if not implemented)
- Rate limiting is in-memory, single instance
- UI/UX still evolving (neu can mention)

---

## Chapter 6. Conclusion and Future Work

### 6.1 Conclusion
- Recap deliverables + robustness + reproducibility

### 6.2 Recommendations / Future work (goi y)
- Add transaction costs + slippage
- Add constraints in optimizer (max weight, turnover penalty)
- Add data ingestion pipeline (ETL) / DB
- Add more evaluation cases + CI pipeline

---

## References
- Cite doc/papers for indicators, Markowitz, risk parity, VaR/CVaR
- Cite Next.js, lightweight-charts, etc. (as software references)

---

## Appendices (recommended)

- Appendix A: Dataset schema and columns
- Appendix B: API documentation excerpts
- Appendix C: Docker runbook + smoke commands
- Appendix D: Selected diagrams (architecture/DFD/sequence)

---

## Quick checklist (for defense)

- Build: `npm run build` (PASS)
- Smoke dev: `npm run docker:up` + `npm run docker:smoke`
- Smoke prod: `npm run docker:up:prod` + `npm run docker:smoke:prod`
- Demo script: 5 scenarios in Chapter 5
