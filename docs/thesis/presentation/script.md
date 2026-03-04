# Script Trình Bày Bảo Vệ Khóa Luận

**Tổng thời gian: ~20–25 phút** (không tính Q&A)

---

## Slide 1: Title (~30 giây)

> Kính chào thầy cô và hội đồng.
>
> Em tên **Liêu Hoài Phúc**, MSSV K224141735. Khóa luận của em mang tên **"QuantVN Strategy Forge"** — một nền tảng phân tích định lượng tích hợp trợ lý AI đáng tin cậy, hỗ trợ xây dựng và kiểm định chiến lược giao dịch trên cổ phiếu HOSE.
>
> Bài trình bày hôm nay gồm 13 slides, dự kiến khoảng 20 phút.

---

## Slide 2: Motivation — "Ý tưởng từ đâu?" (~1.5 phút)

> Trước tiên, em xin chia sẻ ý tưởng hình thành đề tài.
>
> **Thứ nhất, bối cảnh thị trường.** Đến năm 2024, số tài khoản giao dịch chứng khoán tại Việt Nam đã đạt 9,2 triệu — vượt mục tiêu 2025 của Chính phủ. Nhà đầu tư cá nhân chiếm hơn 80% giá trị giao dịch trên HOSE. Thị trường fintech Việt Nam ước tính 16,9 tỷ USD, với 84% dân số sử dụng smartphone. Nhu cầu công cụ phân tích tài chính là rất lớn.
>
> **Thứ hai, rào cản thực tế.** Khi em muốn thử backtest một chiến lược đầu tư, em phải viết Python, chuẩn bị dữ liệu thủ công. Và khi hỏi AI — ví dụ hỏi giá cổ phiếu VNM — thì nhận được con số trả lời rất tự tin, nhưng hoàn toàn bịa đặt.
>
> **Từ đó, ý tưởng hình thành:** Xây dựng một nền tảng no-code, chuyên biệt cho thị trường Việt Nam, tích hợp AI mà biết khi nào nên — và khi nào không nên — trả lời.

---

## Slide 3: Đặt vấn đề (~1.5 phút)

> Cụ thể hóa hơn, em nhìn thấy **hai vấn đề chính**.
>
> **Vấn đề 1:** Tạo chiến lược giao dịch hiện nay đòi hỏi viết code. Python, R, hay QuantConnect — đây là rào cản lớn cho nhà đầu tư cá nhân và sinh viên tài chính.
>
> **Vấn đề 2:** AI "bịa" con số tài chính. Khi hỏi Sharpe ratio hay giá cổ phiếu, LLM đưa ra số rất tự tin nhưng sai. Trong tài chính, sai số nghĩa là mất tiền.
>
> Đây không phải nhận định cá nhân mà có cơ sở từ nghiên cứu: Lin et al. 2022 về truthfulness của LLM, Min et al. 2023 về claim-level evaluation, và Bailey 2016 về backtest overfitting.

---

## Slide 4: Khoảng trống nền tảng (~1.5 phút)

> Em đã khảo sát các nền tảng hiện có dành cho NĐT Việt Nam.
>
> Bảng này — Bảng 2 trong khóa luận — so sánh 5 nền tảng phổ biến. Thầy cô có thể thấy:
>
> - **TCBS, SSI:** Mạnh về giao dịch và biểu đồ, nhưng **không có** backtest tùy chỉnh, Strategy Builder no-code, hay phân tích rủi ro VaR/CVaR.
> - **Algotrade:** Có backtesting nhưng hướng tự động hóa cho tổ chức, không phải giao diện cho NĐT cá nhân.
> - **TradingView:** Backtesting hạn chế (cần Pine Script = vẫn phải code).
> - **Miquant:** Có AI chatbot nhưng không grounded vào dữ liệu thực.
>
> **Khoảng trống rõ ràng:** Chưa có nền tảng nào kết hợp Strategy Builder no-code, backtesting đầy đủ, tối ưu danh mục, phân tích rủi ro VÀ AI đáng tin cậy — tất cả trong một. Đó chính là vị trí mà QuantVN muốn lấp đầy.

---

## Slide 5: Câu hỏi NC & Giả thuyết (~1.5 phút)

> Từ khoảng trống đó, em đặt ra **3 câu hỏi nghiên cứu** và **5 giả thuyết**.
>
> **RQ1:** Liệu nền tảng có thể được thiết kế đủ dễ sử dụng cho NĐT cá nhân Việt Nam? → dẫn đến H1 (dễ tiếp cận) và H3 (Strategy Builder no-code).
>
> **RQ2:** Liệu backtest có thể thực hiện với tham số minh bạch theo bối cảnh thị trường nội địa? → H2 (tham số VN) và H4 (pipeline dữ liệu mã nguồn mở).
>
> **RQ3:** Liệu AI có thể giải thích kết quả mà không bịa đặt? → H5 (grounding + abstention).
>
> Phương pháp đánh giá dựa trên **bằng chứng triển khai** và **minh họa có thể tái lập**, thay vì nghiên cứu người dùng có kiểm soát — đây là hạn chế mà em sẽ nói ở cuối.

---

## Slide 6: Giải pháp — QuantVN Strategy Forge (~1.5 phút)

> Giải pháp của em là **QuantVN Strategy Forge** — nền tảng web phân tích định lượng tích hợp AI.
>
> Hai tính năng cốt lõi:
>
> **Strategy Builder — kéo thả, không code.** Người dùng kéo 12 loại node vào canvas, nối chúng để tạo chiến lược. Có connection rules để tránh lỗi logic, template gallery cho người mới, và AI Suggest hỗ trợ gợi ý.
>
> **AI Assistant — biết khi nào KHÔNG trả lời.** Trợ lý được grounded bằng chính các công cụ tính toán của nền tảng. Khi không có đủ bằng chứng, nó sẽ từ chối trả lời thay vì bịa — đây gọi là policy-gated abstention. Mỗi claim đều có thể đo lường được.

---

## Slide 7: Kiến trúc hệ thống (~1.5 phút)

> Về kiến trúc, hệ thống có 4 module chính:
>
> **Module 1 — Data Pipeline:** Thu thập dữ liệu từ vnstock API, xử lý 412 mã HOSE với 768.718 bản ghi OHLCV, qua các quality gates: completeness >95%, no-gap validation.
>
> **Module 2 — Quant Engine:** Hỗ trợ 5 loại backtest (SMA Cross, RSI, MACD, Bollinger, Custom), tối ưu danh mục 4 phương pháp (Mean-Variance, HRP, Risk Parity, Min CVaR), phân tích rủi ro VaR/CVaR, và khám phá nhân tố.
>
> **Module 3 — Strategy Canvas:** React Flow-based, 12 node types, validation engine, template engine.
>
> **Module 4 — AI Layer:** Tool-calling architecture, grounding pipeline, abstention policy.

---

## Slide 8: Strategy Builder (~1.5 phút)

> Đây là Strategy Builder — tính năng mà em cho là đóng góp chính của đề tài.
>
> Thầy cô có thể thấy canvas với các node được kéo thả. Ở đây em đang minh họa template RSI Reversal: node Signal phát tín hiệu khi RSI < 30, node Entry thực hiện mua, node Exit bán khi RSI > 70.
>
> Các node được nối bằng edge có validation — hệ thống kiểm tra logic trước khi cho phép nối. Ví dụ, không thể nối Entry trước Signal.
>
> Kết quả backtest hiển thị trực tiếp bên dưới: equity curve, drawdown, và các metrics.

---

## Slide 9: AI Assistant (~1.5 phút)

> Tiếp theo là AI Assistant — trọng tâm RQ3.
>
> Em minh họa hai kịch bản:
>
> **Kịch bản 1 — Grounded Answer:** Khi hỏi "Sharpe ratio của chiến lược SMA Cross trên VNM?", trợ lý gọi backtest engine → nhận kết quả → trả lời kèm citation. Con số hoàn toàn từ computation, không phải LLM generate.
>
> **Kịch bản 2 — Abstention:** Khi hỏi "Giá VNM ngày mai?", trợ lý nhận ra không có tool nào dự đoán giá tương lai → từ chối trả lời, giải thích lý do. Đây là thiết kế có chủ đích: better silence than hallucination.

---

## Slide 10: Live Demo (~5–8 phút)

> Bây giờ em xin demo trực tiếp trên nền tảng đã deploy.
>
> Em sẽ demo 3 phần:
> 1. **Strategy Builder** (~5 phút): Tạo chiến lược từ đầu, kéo node, nối, chạy backtest
> 2. **Backtesting** (~2 phút): Xem kết quả chi tiết
> 3. **AI Assistant** (~3 phút): Hỏi câu hỏi có bằng chứng và câu hỏi nên từ chối
>
> *(Chuyển sang browser — demo trực tiếp)*

---

## Slide 11: Đánh giá giả thuyết (~2 phút)

> Quay lại 5 giả thuyết đã đặt ra.
>
> **H1 — Ủng hộ.** Nền tảng web với 8 mô-đun, không cần cài đặt phần mềm, truy cập qua trình duyệt.
>
> **H2 — Ủng hộ.** Backtesting áp dụng tham số thị trường VN: lot 100 cổ phiếu, phí sàn, thuế bán 0,1%, fill price next-open để tránh look-ahead bias.
>
> **H3 — Ủng hộ.** Strategy Builder cho phép kéo-thả trên canvas, không cần viết code.
>
> **H4 — Ủng hộ.** Pipeline dữ liệu xử lý 768.718 bản ghi, quality gates đạt 95%, mã nguồn mở.
>
> **H5 — Một phần.** Trợ lý có grounding và abstention hoạt động, nhưng **chưa có user study** quy mô để đo lường mức độ tin cậy của người dùng thực tế. Đây là hạn chế chính.
>
> Bên dưới bảng là các con số tổng quan: 412 mã HOSE, 768K bản ghi, 8 mô-đun tích hợp, dữ liệu giai đoạn 2018–2025.

---

## Slide 12: Đóng góp & Hạn chế (~1.5 phút)

> Tóm tắt 3 đóng góp chính:
>
> **1. No-code Strategy Builder** — 12 node types, drag-drop, connection validation, AI Suggest. Đây là tính năng chưa có trên bất kỳ nền tảng nào tại VN.
>
> **2. Reliability-gated AI Assistant** — Grounded generation + policy-gated abstention. AI không bao giờ generate số mà không qua computation.
>
> **3. Measurable evaluation framework** — 5-metric gate, acceptance suites, reproducible artifacts. Mọi claim đều có thể verify.
>
> **Hạn chế:** Chưa có user study có kiểm soát, nên kết luận về hành vi người dùng còn bị giới hạn. Đánh giá dựa trên minh họa, không phải thử nghiệm lâm sàng.
>
> **Hướng phát triển:** A/B testing với NĐT thực, mở rộng sang HNX/UPCoM, và multi-asset coverage.

---

## Slide 13: Kết luận & Q&A (~1 phút)

> Tóm lại, QuantVN Strategy Forge đã chứng minh rằng:
>
> - Các quy trình định lượng **có thể** được thiết kế dễ sử dụng cho NĐT cá nhân Việt Nam
> - Backtest **có thể** thực hiện với tham số minh bạch phù hợp bối cảnh HOSE
> - Và trợ lý AI **có thể** giải thích kết quả đáng tin cậy — bằng cách biết khi nào không nên trả lời
>
> Em xin cảm ơn thầy cô. Em sẵn sàng trả lời câu hỏi của hội đồng.

---

## Phụ lục: Câu hỏi phòng thủ

### Q: "TCBS cũng có tối ưu danh mục Markowitz, sao bảng so sánh ghi là 'Không'?"
> Em ghi nhận TCInvest có hỗ trợ Markowitz cơ bản. Tuy nhiên, QuantVN cung cấp **4 phương pháp** tối ưu (Mean-Variance, HRP, Risk Parity, Min CVaR) cùng phân tích rủi ro **VaR/CVaR riêng biệt** — đây là điểm khác biệt chính. Trong bảng so sánh, em tập trung vào mức độ integrated pipeline end-to-end, không chỉ một tính năng đơn lẻ.

### Q: "H5 chỉ 'Một phần' — vậy AI có thật sự đáng tin cậy không?"
> H5 được đánh giá "Một phần" vì em *chưa thực hiện user study*. Cơ chế grounding và abstention **đều hoạt động** và có thể verify qua demo. Tuy nhiên, để kết luận về mức độ *tin cậy chủ quan* của người dùng, cần thêm A/B testing với NĐT thực tế — đây là hướng phát triển tương lai.

### Q: "Tại sao chọn HOSE mà không phải cả HNX, UPCoM?"
> Phạm vi khóa luận giới hạn ở HOSE vì: (1) HOSE chiếm phần lớn giá trị giao dịch, (2) dữ liệu HOSE có chất lượng và tính liên tục cao hơn, (3) hạn chế về thời gian. Mở rộng sang HNX/UPCoM là hướng phát triển tiếp theo.

### Q: "Dữ liệu lấy từ đâu? Có vấn đề bản quyền không?"
> Dữ liệu thu thập qua **vnstock** — thư viện Python mã nguồn mở (MIT License). Dữ liệu OHLCV là dữ liệu công khai từ HOSE. Pipeline có quality gates kiểm tra completeness >95% và no-gap validation.

### Q: "Backtest có look-ahead bias không?"
> Không, em đã thiết kế cẩn thận: fill price sử dụng **next-open** (giá mở cửa phiên kế tiếp), không phải giá đóng cửa ngày signal. Phí sàn, thuế bán 0,1%, và lot size 100 đều được tính vào.
