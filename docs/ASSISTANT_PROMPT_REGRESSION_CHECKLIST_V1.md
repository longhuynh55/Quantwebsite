# Assistant Prompt Regression Checklist V1

Muc tieu: test nhanh do robust/matching cua AI Assistant (date parsing, symbol routing, policy guard, grounding).

## Cach dung

- Chay tung prompt tren production URL.
- Moi prompt danh dau: `PASS` / `FAIL`.
- Neu fail, luu `Request ID`, `Provider`, `Tool summary`, `Reason` trong Execution Trace.

## Prompt matrix (da dang ngay/thang)

| # | Prompt | Ky vong chinh |
|---|---|---|
| 1 | `Gia dong VCB ngay 02/01/2025` | Parse date dung (`2025-01-02`), co citation stock endpoint. |
| 2 | `Gia dong VCB ngay 15/03/2024` | Parse dung dd/mm/yyyy. |
| 3 | `Gia dong VCB ngay 29/02/2024` | Leap year hop le, khong fallback policy. |
| 4 | `Gia dong VCB ngay 29/02/2023` | Invalid date, khong duoc tra so lieu gia. |
| 5 | `Gia dong VCB ngay 31/04/2025` | Invalid date, khong duoc tra so lieu gia. |
| 6 | `Gia dong VCB ngay 01/01/2026` | Future-date guard, tra `INSUFFICIENT_DATA`. |
| 7 | `Gia dong VCB ngay 31 thang 12 nam 2025` | Natural-language date parse dung. |
| 8 | `gia dong cua vcb ngay 31/12/2025` | Lowercase ticker van resolve ra `VCB`. |
| 9 | `Gia dong cua co phieu VCb ngay 31/12/2025` | Mixed-case ticker resolve dung. |
| 10 | `Top 10 co phieu HOSE theo close ngay 30/06/2025` | Universe ranking hop le, co bang ket qua. |
| 11 | `Top 10 co phieu HNX theo volume ngay 30/06/2025` | Scope guard (chi HOSE), khong tra ranking so cho HNX. |
| 12 | `Top 10 co phieu UPCOM theo close ngay 15/05/2025` | Scope guard (chi HOSE), khong tra ranking so cho UPCOM. |
| 13 | `Top 5 ngan hang theo EV/EBITDA tren HOSE ngay 31/12/2024` | Routing valuation ranking dung metric/date/filter. |
| 14 | `Gia dong VCB tu 01/01/2025 den 31/03/2025` | Range query, khong chi 1 diem. |
| 15 | `Gia dong VCB tu 31/03/2025 den 01/01/2025` | Xu ly range nguoc an toan (khong hallucinate). |
| 16 | `Gia dong VCB ngay 07/09/2025` | Neu khong co trading day thi co thong tin as-of ro rang. |
| 17 | `Khuyen nghi mua VNM ngan han` | Neu thieu evidence thi fallback policy, khong bịa numeric claims. |
| 18 | `PE hien tai la bao nhieu?` | Query mo ho: fallback/phai yeu cau symbol-scope, khong bịa so. |
| 19 | `Cho toi market overview VNINDEX, top gainer va top loser` | Route market snapshot dung, co citation market overview. |
| 20 | `BCTN moi nhat cua VNM: doanh thu, LNST, OCF, FCF` | Routing fundamentals dung, co grounding evidence/citations. |

## Multi-turn date carryover test

1. Turn 1: `Gia dong VCB ngay 31/12/2025`  
   Ky vong: tra du lieu hop le.
2. Turn 2: `Gia mo cua thi sao?`  
   Ky vong: **khong tu carry date cu** (do khong co cue ro rang).
3. Turn 3: `Giu nguyen ngay truoc, gia mo cua thi sao?`  
   Ky vong: **co carry date**.

## Acceptance gate de ket luan PASS

- Ty le pass >= 90% tren 20 prompt single-turn.
- Multi-turn carryover test pass ca 3 buoc.
- Khong co truong hop hallucinated numeric claim khi `policyStatus=fallback/shadow_blocked`.
- Cac query HNX/UPCOM ranking deu bi scope guard dung.
