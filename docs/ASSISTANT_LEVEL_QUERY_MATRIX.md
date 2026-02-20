# Assistant Level Query Matrix (HOSE only)

Muc tieu: moi muc do query deu co bo cau hoi de test lai routing + grounding cua LLM.

## L1 - Co ban, ro rang
- `Cho toi top 10 co phieu gia dong cua cao nhat ngay 28/05/2024`
  - Expect: `intent=stock_snapshot`, tool `stockSnapshot` success, citation `/api/stocks`
- `Gia dong cua FPT ngay 28/05/2024 la bao nhieu`
  - Expect: `intent=stock_snapshot`, citation `/api/stocks?symbol=FPT`

## L2 - Follow-up theo context
- Turn 1: `Cho toi top 10 co phieu gia dong cua cao nhat ngay 28/05/2024`
- Turn 2: `con theo volume thi sao`
  - Context filters: `date=28/05/2024`, `limit=10`, `metric=volume`, `exchange=HOSE`
  - Expect: van route `stockSnapshot` + citation `/api/stocks`
- `Cho BCTN moi nhat cua VNM, chi tra doanh thu va loi nhuan sau thue.`
  - Expect: `intent=fundamentals`, tool `fundamentalSnapshot` success

## L3 - Da chieu, phan tich
- `Tinh beta va max drawdown cua FPT so voi VNINDEX`
  - Expect: `intent=risk`, tool `riskSnapshot` success
- `Trong nhom ngan hang HOSE ngay 31/12/2025, liet ke top 5 co phieu co P/E cao nhat.`
  - Expect: `intent=valuation_ranking`, tool `valuationRanking` success

## L4 - Noisy/adversarial
- `dm top 5 close 28-05-2024 nhanh`
  - Expect: van route dung `stockSnapshot`, citation `/api/stocks`
- `top 10 gia dong cua cao nhat ngay 28/05/2024 tren HNX`
  - Expect: guard HOSE-only, khong bịa so lieu HNX, citation co `/api/stocks` va `exchange=HOSE`

## Run commands
- Routing matrix:
```bash
ASSISTANT_EVAL_BASE_URL=http://localhost:3010 pnpm run eval:assistant:routing
```
- Real-world matrix:
```bash
ASSISTANT_EVAL_BASE_URL=http://localhost:3010 pnpm run eval:assistant:realworld
```

Bao cao mac dinh:
- `artifacts/assistant-routing-matrix-report.json`
