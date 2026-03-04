"""
Generate thesis .docx with UEL cover page + Chapter 3 (Methodology) draft.

Usage:
    python generate_thesis.py

Output:
    thesis/thesis_draft.docx
"""
import os
from docx import Document
from docx.shared import Pt, Cm, Inches, RGBColor, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn


# ── Helpers ──────────────────────────────────────────────────────────

def set_paragraph_format(paragraph, space_after=Pt(6), space_before=Pt(0),
                         line_spacing=1.5, first_line_indent=Cm(1.27)):
    """Set paragraph formatting for thesis body text."""
    fmt = paragraph.paragraph_format
    fmt.space_after = space_after
    fmt.space_before = space_before
    fmt.line_spacing = line_spacing
    if first_line_indent:
        fmt.first_line_indent = first_line_indent


def add_body_text(doc, text, bold=False, italic=False, font_name="Times New Roman",
                  font_size=Pt(13), align=WD_ALIGN_PARAGRAPH.JUSTIFY):
    """Add a paragraph of body text in thesis format."""
    p = doc.add_paragraph()
    p.alignment = align
    set_paragraph_format(p)
    run = p.add_run(text)
    run.font.name = font_name
    run.font.size = font_size
    run.bold = bold
    run.italic = italic
    # Vietnamese font fallback
    run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)
    return p


def add_heading_styled(doc, text, level=1):
    """Add heading manually formatted (no reliance on built-in styles)."""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    fmt = p.paragraph_format
    fmt.space_before = Pt(18) if level == 1 else Pt(12)
    fmt.space_after = Pt(6)
    fmt.line_spacing = 1.5
    fmt.first_line_indent = None
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run._element.rPr.rFonts.set(qn('w:eastAsia'), "Times New Roman")
    run.font.color.rgb = RGBColor(0, 0, 0)
    run.bold = True
    if level == 1:
        run.font.size = Pt(16)
    elif level == 2:
        run.font.size = Pt(14)
    else:
        run.font.size = Pt(13)
    return p


# ── Cover Page ───────────────────────────────────────────────────────

def create_cover_page(doc):
    """Create UEL-style cover page."""
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(2.0)
    section.bottom_margin = Cm(2.0)
    section.left_margin = Cm(3.0)
    section.right_margin = Cm(2.0)

    # University name
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run("VIET NAM NATIONAL UNIVERSITY HO CHI MINH CITY")
    run.font.name = "Times New Roman"
    run.font.size = Pt(13)
    run.font.color.rgb = RGBColor(0x1F, 0x49, 0x7D)  # Dark blue
    run.bold = True

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(12)
    run = p.add_run("UNIVERSITY OF ECONOMICS AND LAW")
    run.font.name = "Times New Roman"
    run.font.size = Pt(14)
    run.font.color.rgb = RGBColor(0x1F, 0x49, 0x7D)
    run.bold = True

    # Faculty
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(24)
    p.paragraph_format.space_before = Pt(12)
    run = p.add_run("KHOA TÀI CHÍNH NGÂN HÀNG")
    run.font.name = "Times New Roman"
    run.font.size = Pt(14)
    run.bold = True

    # Spacer
    for _ in range(2):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(0)

    # Document type
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(12)
    run = p.add_run("CHUYÊN ĐỀ THỰC TẬP TỐT NGHIỆP")
    run.font.name = "Times New Roman"
    run.font.size = Pt(14)
    run.bold = True

    # Title
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.space_before = Pt(12)
    run = p.add_run("SO SÁNH CÁC KIẾN TRÚC HỌC SÂU")
    run.font.name = "Times New Roman"
    run.font.size = Pt(16)
    run.bold = True

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run("CHO TỐI ƯU DANH MỤC ĐẦU TƯ")
    run.font.name = "Times New Roman"
    run.font.size = Pt(16)
    run.bold = True

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(24)
    run = p.add_run("TRÊN SÀN GIAO DỊCH CHỨNG KHOÁN TP.HCM")
    run.font.name = "Times New Roman"
    run.font.size = Pt(16)
    run.bold = True

    # Spacer
    for _ in range(4):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(0)

    # Advisor & Student info
    for label, value in [
        ("GVHD:", "[Tên Giảng Viên Hướng Dẫn]"),
        ("SVTH:", "[Họ và Tên Sinh Viên]"),
        ("MSSV:", "[Mã Số Sinh Viên]"),
    ]:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(6)
        run = p.add_run(f"{label}  ")
        run.font.name = "Times New Roman"
        run.font.size = Pt(13)
        run.bold = True
        run = p.add_run(value)
        run.font.name = "Times New Roman"
        run.font.size = Pt(13)

    # Spacer
    for _ in range(5):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(0)

    # Footer
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("TP. HỒ CHÍ MINH, THÁNG ... NĂM 2026")
    run.font.name = "Times New Roman"
    run.font.size = Pt(13)
    run.bold = True

    # Page break after cover
    doc.add_page_break()


# ── Table of Contents placeholder ────────────────────────────────────

def create_toc_page(doc):
    """Add a Table of Contents placeholder page."""
    add_heading_styled(doc, "MỤC LỤC", level=1)
    add_body_text(doc, "[Mục lục sẽ được tạo tự động sau khi hoàn thành các chương]",
                  italic=True, font_size=Pt(12))
    doc.add_page_break()


# ── Chapter 3: Methodology ──────────────────────────────────────────

def write_chapter3(doc):
    """Write Chapter 3: Research Methodology."""

    add_heading_styled(doc, "CHƯƠNG 3: PHƯƠNG PHÁP NGHIÊN CỨU", level=1)

    # ── 3.1 Data ──
    add_heading_styled(doc, "3.1. Dữ liệu", level=2)

    add_heading_styled(doc, "3.1.1. Nguồn dữ liệu", level=3)
    add_body_text(doc,
        "Nghiên cứu sử dụng dữ liệu giá cổ phiếu lịch sử từ Sở Giao dịch Chứng khoán "
        "Thành phố Hồ Chí Minh (HOSE) trong giai đoạn từ tháng 1 năm 2020 đến tháng 12 "
        "năm 2025. Bộ dữ liệu bao gồm 755 mã cổ phiếu với 1.499 phiên giao dịch, tạo "
        "thành một vũ trụ đầu tư đáng tin cậy và có tính thanh khoản cao."
    )
    add_body_text(doc,
        "Dữ liệu OHLCV (Open, High, Low, Close, Volume) được thu thập thông qua API vnstock, "
        "đảm bảo tính chính xác và cập nhật. Quá trình lọc dữ liệu áp dụng tiêu chí nghiêm "
        "ngặt: mỗi mã phải có ít nhất 1.480 phiên giao dịch (trong tổng số 1.499) và khối "
        "lượng giao dịch trung bình trên 5.000 đơn vị/phiên. Điều này loại bỏ các mã có thanh "
        "khoản thấp và các mã bị niêm yết/hủy niêm yết giữa chừng, tránh hiện tượng survivorship "
        "bias (Elton et al., 1996)."
    )

    add_heading_styled(doc, "3.1.2. Tiền xử lý dữ liệu", level=3)
    add_body_text(doc,
        "Dữ liệu thô được tiền xử lý qua ba bước chính. Thứ nhất, áp dụng point-in-time "
        "filtering để đảm bảo tại mỗi thời điểm t, hệ thống chỉ sử dụng thông tin có sẵn "
        "trước thời điểm đó, tránh look-ahead bias (Hou et al., 2020). Thứ hai, sử dụng "
        "tradable mask để đánh dấu và loại bỏ các mã bị tạm ngừng giao dịch hoặc hủy niêm "
        "yết trong từng phiên. Thứ ba, áp dụng gap-filling bằng phương pháp forward-fill "
        "với giới hạn tối đa 5 phiên giao dịch cho các khoảng trống dữ liệu."
    )

    # ── 3.2 Feature Engineering ──
    add_heading_styled(doc, "3.2. Kỹ thuật đặc trưng (Feature Engineering)", level=2)
    add_body_text(doc,
        "Nghiên cứu sử dụng 10 đặc trưng kỹ thuật (technical indicators) được chia thành "
        "4 nhóm chính, phù hợp với các nghiên cứu trước đó về dự đoán lợi suất cổ phiếu "
        "bằng deep learning (Bao et al., 2017; Chen et al., 2015)."
    )
    add_body_text(doc,
        "Nhóm lợi suất (Returns) bao gồm lợi suất 1 ngày và lợi suất 5 ngày, phản ánh "
        "biến động giá ngắn hạn. Nhóm động lượng (Momentum) gồm RSI(14), MACD histogram, "
        "và momentum 21 ngày, đo lường xu hướng và sức mạnh của giá. Nhóm biến động "
        "(Volatility) gồm Bollinger Band width, %B, và độ lệch chuẩn 21 ngày, đánh giá "
        "mức độ rủi ro. Nhóm xu hướng (Trend) sử dụng SMA crossover (10/50 ngày) và tỷ lệ "
        "khối lượng giao dịch so với trung bình 20 ngày."
    )
    add_body_text(doc,
        "Tất cả đặc trưng được chuẩn hóa theo hai bước: (1) clipping trong khoảng [-10, 10] "
        "để hạn chế ảnh hưởng của các giá trị ngoại lai, và (2) cross-sectional z-score "
        "normalization cho biến mục tiêu (target) theo từng ngày, đảm bảo so sánh công bằng "
        "giữa các cổ phiếu trong cùng thời điểm (Gu et al., 2020)."
    )

    # ── 3.3 Model Architectures ──
    add_heading_styled(doc, "3.3. Kiến trúc mô hình", level=2)
    add_body_text(doc,
        "Nghiên cứu so sánh 5 kiến trúc deep learning đại diện cho 3 paradigm chính trong "
        "xử lý chuỗi thời gian: mạng hồi quy (RNN), mạng tích chập (CNN), và cơ chế "
        "attention. Việc lựa chọn nhiều kiến trúc nhằm tránh hiện tượng cherry-picking "
        "và đảm bảo tính toàn diện của kết luận (Harvey et al., 2016)."
    )

    add_heading_styled(doc, "3.3.1. Linear MLP (Baseline)", level=3)
    add_body_text(doc,
        "Mô hình tuyến tính Multi-Layer Perceptron đóng vai trò baseline để đánh giá "
        "liệu các kiến trúc deep learning phức tạp hơn có thực sự cần thiết hay không. "
        "Mô hình gồm 2 lớp fully-connected với hàm kích hoạt ReLU, nhận đầu vào là "
        "chuỗi lookback đã được flatten và dự đoán lợi suất kỳ vọng. Với khoảng 10.000 "
        "tham số, đây là mô hình đơn giản nhất trong nghiên cứu."
    )

    add_heading_styled(doc, "3.3.2. LSTM (Long Short-Term Memory)", level=3)
    add_body_text(doc,
        "LSTM (Hochreiter & Schmidhuber, 1997) là kiến trúc RNN được thiết kế để xử lý "
        "vấn đề vanishing gradient, cho phép học các phụ thuộc dài hạn trong chuỗi thời "
        "gian. Mô hình sử dụng 2 lớp LSTM stacked với hidden size 64, theo sau bởi lớp "
        "fully-connected để dự đoán. Đây là baseline cho paradigm RNN, đã được chứng minh "
        "hiệu quả trong dự đoán tài chính (Fischer & Krauss, 2018)."
    )

    add_heading_styled(doc, "3.3.3. LSTM + Temporal Attention", level=3)
    add_body_text(doc,
        "Mô hình chính của nghiên cứu kết hợp LSTM với cơ chế temporal attention "
        "(Bahdanau et al., 2015). Attention cho phép mô hình tự động xác định những "
        "thời điểm nào trong chuỗi lookback quan trọng nhất cho việc dự đoán, thay vì "
        "chỉ dựa vào hidden state cuối cùng. Cơ chế này đặc biệt phù hợp cho dữ liệu "
        "tài chính, nơi các sự kiện ở những thời điểm khác nhau có mức độ ảnh hưởng khác "
        "nhau (Chen et al., 2019). Mô hình có khoảng 50.000 tham số."
    )

    add_heading_styled(doc, "3.3.4. TCN (Temporal Convolutional Network)", level=3)
    add_body_text(doc,
        "TCN (Bai et al., 2018) là kiến trúc CNN cho chuỗi thời gian, sử dụng causal "
        "convolution và dilated convolution để đảm bảo tính nhân quả và mở rộng receptive "
        "field. Ưu điểm chính của TCN so với LSTM là khả năng xử lý song song (parallelizable), "
        "giúp tốc độ huấn luyện nhanh hơn đáng kể. Mô hình sử dụng 4 lớp residual blocks "
        "với kernel size 3 và dilation tăng dần (1, 2, 4, 8)."
    )

    add_heading_styled(doc, "3.3.5. Transformer Encoder", level=3)
    add_body_text(doc,
        "Transformer (Vaswani et al., 2017) sử dụng cơ chế self-attention thuần túy, "
        "không dựa vào cấu trúc hồi quy hay tích chập. Nghiên cứu áp dụng phần Encoder "
        "của Transformer với 2 lớp, 4 attention heads, và positional encoding để mã hóa "
        "thứ tự thời gian. Với khoảng 80.000 tham số, đây là mô hình lớn nhất và đại diện "
        "cho kiến trúc state-of-the-art hiện tại (Zhang et al., 2021)."
    )

    # ── 3.4 Training Protocol ──
    add_heading_styled(doc, "3.4. Quy trình huấn luyện", level=2)

    add_heading_styled(doc, "3.4.1. Hàm mất mát (Loss Function)", level=3)
    add_body_text(doc,
        "Hàm mất mát kết hợp hai thành phần: Mean Squared Error (MSE) để học giá trị "
        "tuyệt đối của lợi suất, và Pairwise Ranking Loss để học thứ hạng tương đối giữa "
        "các cổ phiếu trong cùng ngày. Công thức tổng quát:"
    )
    add_body_text(doc,
        "L = (1 - w) × L_MSE + w × L_rank",
        italic=True, align=WD_ALIGN_PARAGRAPH.CENTER
    )
    add_body_text(doc,
        "trong đó w = 0.6, cho thấy nghiên cứu ưu tiên khả năng xếp hạng hơn dự đoán "
        "giá trị chính xác. Rank loss được tính bằng phương pháp random pair sampling "
        "với độ phức tạp O(k) thay vì O(n²), phù hợp cho thị trường có nhiều mã cổ phiếu "
        "(Feng et al., 2019)."
    )

    add_heading_styled(doc, "3.4.2. Tối ưu hóa và Early Stopping", level=3)
    add_body_text(doc,
        "Mô hình được tối ưu bằng Adam optimizer (Kingma & Ba, 2015) với learning rate "
        "khởi tạo 1×10⁻³. Learning rate scheduler ReduceLROnPlateau tự động giảm learning "
        "rate khi validation loss không cải thiện sau 3 epochs (factor=0.5). Early stopping "
        "với patience=5 epochs được áp dụng để tránh overfitting (Prechelt, 1998). "
        "Gradient clipping (max_norm=1.0) ngăn chặn hiện tượng gradient explosion. "
        "Trên GPU, mixed-precision training (AMP) được sử dụng để tăng tốc độ huấn luyện."
    )

    add_heading_styled(doc, "3.4.3. Phân chia dữ liệu (Data Splitting)", level=3)
    add_body_text(doc,
        "Dữ liệu được phân chia theo thời gian (temporal split) với tỷ lệ 80% train - "
        "20% validation. Đặc biệt, việc phân chia dựa trên ngày giao dịch duy nhất "
        "(unique trading days), đảm bảo không có cổ phiếu từ cùng một ngày xuất hiện "
        "trong cả tập train và validation, tránh data leakage (Prado, 2018)."
    )
    add_body_text(doc,
        "Batching sử dụng phương pháp Day-Grouped Batch Sampler — một đóng góp kỹ thuật "
        "của nghiên cứu. Phương pháp này giữ tất cả cổ phiếu trong cùng ngày trong một "
        "batch, đảm bảo rank loss được tính trên toàn bộ cross-section. Đồng thời, thứ "
        "tự các ngày được xáo trộn (shuffle) giữa các epoch để đảm bảo tính stochastic "
        "cho SGD."
    )

    # ── 3.5 Portfolio Construction ──
    add_heading_styled(doc, "3.5. Xây dựng danh mục đầu tư", level=2)
    add_body_text(doc,
        "Danh mục đầu tư được xây dựng theo phương pháp Top-K Equal Weight. Cụ thể, "
        "lợi suất dự đoán được điều chỉnh theo rủi ro bằng cách chia cho độ biến động "
        "gần đây (risk-adjusted scores). Sau đó, K=30 cổ phiếu có điểm cao nhất được "
        "chọn và phân bổ trọng số bằng nhau (1/K). Trong giai đoạn biến động cao "
        "(high-volatility regime), K được giảm xuống 20 để tập trung vào các cổ phiếu "
        "có tín hiệu mạnh nhất."
    )
    add_body_text(doc,
        "Giới hạn turnover tối đa 35% mỗi lần tái cân bằng được áp dụng để kiểm soát "
        "chi phí giao dịch. Phương pháp equal weight được chọn dựa trên nghiên cứu của "
        "DeMiguel et al. (2009), cho thấy danh mục 1/N thường vượt trội so với tối ưu "
        "hóa mean-variance trong thực tế, đặc biệt khi ước lượng ma trận hiệp phương sai "
        "không chính xác."
    )

    # ── 3.6 Walk-Forward Backtesting ──
    add_heading_styled(doc, "3.6. Kiểm định ngược Walk-Forward", level=2)
    add_body_text(doc,
        "Nghiên cứu áp dụng phương pháp walk-forward backtesting — tiêu chuẩn vàng trong "
        "đánh giá chiến lược đầu tư (Bailey et al., 2014; Prado, 2018). Quy trình như sau: "
        "tại mỗi ngày tái cân bằng t (mỗi 21 ngày giao dịch, tương đương 1 tháng), hệ "
        "thống chỉ sử dụng dữ liệu đến ngày t-1 để huấn luyện mô hình và dự đoán lợi "
        "suất cho kỳ tiếp theo. Mô hình được tái huấn luyện mỗi 4 lần tái cân bằng "
        "(khoảng 3 tháng) để cân bằng giữa tính thích ứng và chi phí tính toán."
    )
    add_body_text(doc,
        "Chi phí giao dịch được mô phỏng theo thực tế thị trường Việt Nam: phí mua 0.15% "
        "(phí môi giới) và phí bán 0.25% (0.15% phí môi giới + 0.1% thuế). Đây là mức phí "
        "phổ biến tại các công ty chứng khoán Việt Nam, đảm bảo kết quả backtest phản ánh "
        "đúng hiệu suất thực tế."
    )

    # ── 3.7 Evaluation Metrics ──
    add_heading_styled(doc, "3.7. Tiêu chí đánh giá", level=2)

    add_heading_styled(doc, "3.7.1. Chỉ số danh mục đầu tư", level=3)
    add_body_text(doc,
        "Hiệu suất danh mục được đánh giá qua các chỉ số: Sharpe Ratio (Sharpe, 1994) "
        "đo lường lợi suất điều chỉnh theo rủi ro; Maximum Drawdown đo lường mức sụt "
        "giảm tối đa từ đỉnh; Sortino Ratio chỉ xét biến động âm (downside volatility); "
        "và Annual Return đo lường lợi suất hàng năm. Danh mục Equal Weight (1/N) được "
        "sử dụng làm benchmark so sánh."
    )

    add_heading_styled(doc, "3.7.2. Chỉ số dự đoán", level=3)
    add_body_text(doc,
        "Chất lượng dự đoán được đánh giá qua: Information Coefficient (IC) — hệ số "
        "tương quan Spearman giữa dự đoán và lợi suất thực tế, phản ánh khả năng xếp "
        "hạng của mô hình (Grinold & Kahn, 2000); Hit Rate — tỷ lệ dự đoán đúng dấu; "
        "và Long-Short Spread — chênh lệch lợi suất trung bình giữa nhóm cổ phiếu được "
        "xếp hạng cao nhất và thấp nhất."
    )

    # ── 3.8 Statistical Testing ──
    add_heading_styled(doc, "3.8. Kiểm định thống kê", level=2)

    add_heading_styled(doc, "3.8.1. Kiểm định Diebold-Mariano", level=3)
    add_body_text(doc,
        "Kiểm định Diebold-Mariano (DM test; Diebold & Mariano, 1995) được sử dụng để "
        "kiểm tra xem mô hình DL có dự đoán chính xác hơn benchmark Equal Weight một cách "
        "có ý nghĩa thống kê hay không. Giả thuyết H₀: không có sự khác biệt về độ chính "
        "xác dự đoán giữa hai mô hình. Hiệu chỉnh Holm-Bonferroni được áp dụng để kiểm "
        "soát false discovery rate khi so sánh nhiều mô hình cùng lúc (Holm, 1979)."
    )

    add_heading_styled(doc, "3.8.2. Kiểm định SPA (Superior Predictive Ability)", level=3)
    add_body_text(doc,
        "Kiểm định Hansen's SPA (Hansen, 2005) kiểm soát hiện tượng data-snooping bias "
        "khi so sánh nhiều mô hình. Phương pháp block bootstrap với 500 mẫu và block "
        "size 10 được sử dụng để tạo phân phối dưới H₀, tính đến hiện tượng tự tương "
        "quan (serial correlation) trong chuỗi lợi suất. Đây là kiểm định quan trọng "
        "để đảm bảo kết quả nghiên cứu không phải do may mắn khi thử nhiều mô hình "
        "(Harvey et al., 2016)."
    )

    # ── 3.9 Robustness Checks ──
    add_heading_styled(doc, "3.9. Kiểm tra tính mạnh mẽ (Robustness Checks)", level=2)
    add_body_text(doc,
        "Ba phương pháp kiểm tra tính mạnh mẽ được áp dụng. Thứ nhất, multi-seed "
        "evaluation: mỗi mô hình được huấn luyện với 3 seed khác nhau (42, 123, 456) "
        "và kết quả được báo cáo dưới dạng trung bình ± độ lệch chuẩn, đảm bảo kết "
        "quả không phụ thuộc vào việc khởi tạo ngẫu nhiên."
    )
    add_body_text(doc,
        "Thứ hai, sub-period analysis: phân tích hiệu suất theo từng giai đoạn thị "
        "trường — COVID (2020H1), Bull (2020H2-2021), Bear (2022), Recovery (2023-24), "
        "và Recent (2025) — để đánh giá khả năng thích ứng của mô hình với các chế độ "
        "thị trường khác nhau (Pástor & Stambaugh, 2012)."
    )
    add_body_text(doc,
        "Thứ ba, ablation study: so sánh hiệu suất khi thay đổi các hyperparameters "
        "chính (lookback window, hidden size, rank loss weight) để đánh giá độ nhạy "
        "của mô hình đối với các lựa chọn thiết kế."
    )


# ── Front Matter Pages ───────────────────────────────────────────────

def create_declaration_page(doc):
    """Lời cam đoan."""
    add_heading_styled(doc, "LỜI CAM ĐOAN", level=1)
    add_body_text(doc,
        "Tôi xin cam đoan đây là công trình nghiên cứu của riêng tôi dưới sự hướng dẫn "
        "của [Tên GVHD]. Các số liệu, kết quả nêu trong chuyên đề là trung thực và chưa "
        "từng được ai công bố trong bất kỳ công trình nào khác."
    )
    add_body_text(doc,
        "Tôi xin chịu trách nhiệm về tính trung thực và chính xác của nội dung "
        "chuyên đề này."
    )
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_before = Pt(36)
    run = p.add_run("TP. Hồ Chí Minh, ngày ... tháng ... năm 2026")
    run.font.name = "Times New Roman"
    run.font.size = Pt(13)
    run.italic = True

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_before = Pt(12)
    run = p.add_run("Sinh viên thực hiện")
    run.font.name = "Times New Roman"
    run.font.size = Pt(13)
    run.bold = True

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_before = Pt(36)
    run = p.add_run("[Họ và Tên]")
    run.font.name = "Times New Roman"
    run.font.size = Pt(13)
    doc.add_page_break()


def create_acknowledgment_page(doc):
    """Lời cảm ơn."""
    add_heading_styled(doc, "LỜI CẢM ƠN", level=1)
    add_body_text(doc,
        "Để hoàn thành chuyên đề thực tập tốt nghiệp này, tôi xin gửi lời cảm ơn chân "
        "thành đến [Tên GVHD] — người đã tận tình hướng dẫn, góp ý và định hướng cho "
        "tôi trong suốt quá trình nghiên cứu."
    )
    add_body_text(doc,
        "Tôi cũng xin cảm ơn quý Thầy/Cô Khoa Tài chính — Ngân hàng, Trường Đại học "
        "Kinh tế — Luật, Đại học Quốc gia TP. Hồ Chí Minh đã trang bị cho tôi những "
        "kiến thức nền tảng quý báu trong suốt thời gian học tập tại trường."
    )
    add_body_text(doc,
        "Cuối cùng, tôi xin gửi lời cảm ơn đến gia đình và bạn bè đã luôn ủng hộ, "
        "động viên tôi trong suốt quá trình thực hiện chuyên đề."
    )
    doc.add_page_break()


def create_abstract_page(doc):
    """Tóm tắt."""
    add_heading_styled(doc, "TÓM TẮT", level=1)
    add_body_text(doc,
        "Chuyên đề nghiên cứu ứng dụng và so sánh 5 kiến trúc deep learning — Linear MLP, "
        "LSTM, LSTM kết hợp Attention, TCN (Temporal Convolutional Network), và Transformer "
        "— cho bài toán dự đoán lợi suất cổ phiếu và tối ưu danh mục đầu tư trên Sở Giao "
        "dịch Chứng khoán TP. Hồ Chí Minh (HOSE)."
    )
    add_body_text(doc,
        "Nghiên cứu sử dụng dữ liệu OHLCV của 755 mã cổ phiếu trong giai đoạn 2020–2025. "
        "Các mô hình được huấn luyện với hàm mất mát kết hợp MSE và Pairwise Ranking Loss, "
        "tối ưu bằng Adam optimizer với early stopping. Hiệu suất được đánh giá thông qua "
        "phương pháp walk-forward backtesting với chi phí giao dịch thực tế."
    )
    add_body_text(doc,
        "Kết quả cho thấy [sẽ cập nhật sau khi chạy experiments]. Tính ý nghĩa thống kê "
        "được kiểm chứng bằng kiểm định Diebold-Mariano và Hansen's SPA test. Nghiên cứu "
        "đóng góp vào hiểu biết về khả năng ứng dụng deep learning cho thị trường chứng "
        "khoán Việt Nam — một thị trường cận biên với đặc thù riêng."
    )
    add_heading_styled(doc, "ABSTRACT", level=1)
    add_body_text(doc,
        "This study investigates and compares five deep learning architectures — Linear MLP, "
        "LSTM, LSTM with Attention, TCN, and Transformer — for stock return prediction and "
        "portfolio optimization on the Ho Chi Minh Stock Exchange (HOSE).",
        italic=True
    )
    add_body_text(doc,
        "Using OHLCV data of 755 stocks from 2020 to 2025, models are trained with a combined "
        "MSE and Pairwise Ranking Loss, evaluated via walk-forward backtesting with realistic "
        "transaction costs. Statistical significance is validated using Diebold-Mariano and "
        "Hansen's SPA tests. Results show [to be updated after experiments].",
        italic=True
    )
    doc.add_page_break()


def create_abbreviations_page(doc):
    """Danh mục viết tắt."""
    add_heading_styled(doc, "DANH MỤC VIẾT TẮT", level=1)
    abbreviations = [
        ("AMP", "Automatic Mixed Precision"),
        ("CNN", "Convolutional Neural Network"),
        ("DL", "Deep Learning"),
        ("DM test", "Diebold-Mariano test"),
        ("GPU", "Graphics Processing Unit"),
        ("HOSE", "Sở Giao dịch Chứng khoán TP. Hồ Chí Minh"),
        ("IC", "Information Coefficient"),
        ("LSTM", "Long Short-Term Memory"),
        ("MACD", "Moving Average Convergence Divergence"),
        ("MDD", "Maximum Drawdown"),
        ("MLP", "Multi-Layer Perceptron"),
        ("MSE", "Mean Squared Error"),
        ("OHLCV", "Open, High, Low, Close, Volume"),
        ("RNN", "Recurrent Neural Network"),
        ("RSI", "Relative Strength Index"),
        ("SGD", "Stochastic Gradient Descent"),
        ("SMA", "Simple Moving Average"),
        ("SPA test", "Superior Predictive Ability test"),
        ("TCN", "Temporal Convolutional Network"),
        ("VNUHCM", "Đại học Quốc gia TP. Hồ Chí Minh"),
    ]
    for abbr, meaning in abbreviations:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        fmt = p.paragraph_format
        fmt.space_after = Pt(2)
        fmt.line_spacing = 1.3
        fmt.first_line_indent = None
        run = p.add_run(f"{abbr}")
        run.font.name = "Times New Roman"
        run.font.size = Pt(12)
        run.bold = True
        run = p.add_run(f"  —  {meaning}")
        run.font.name = "Times New Roman"
        run.font.size = Pt(12)
    doc.add_page_break()


# ── References ───────────────────────────────────────────────────────

def write_references(doc):
    """Danh mục tài liệu tham khảo — APA format."""
    add_heading_styled(doc, "TÀI LIỆU THAM KHẢO", level=1)
    references = [
        "Bahdanau, D., Cho, K., & Bengio, Y. (2015). Neural machine translation by jointly learning to align and translate. Proceedings of ICLR 2015.",
        "Bai, S., Kolter, J. Z., & Koltun, V. (2018). An empirical evaluation of generic convolutional and recurrent networks for sequence modeling. arXiv:1803.01271.",
        "Bailey, D. H., et al. (2014). The probability of backtest overfitting. Journal of Computational Finance, 17(4), 1–30.",
        "Bao, W., Yue, J., & Rao, Y. (2017). A deep learning framework for financial time series using stacked autoencoders and LSTM. PLoS ONE, 12(7), e0180944.",
        "Chen, K., Zhou, Y., & Dai, F. (2015). A LSTM-based method for stock returns prediction. Proceedings of IEEE BigData, 2823–2824.",
        "Chen, L., Pelger, M., & Zhu, J. (2019). Deep learning in asset pricing. SSRN Working Paper No. 3350138.",
        "DeMiguel, V., Garlappi, L., & Uppal, R. (2009). Optimal versus naive diversification. Review of Financial Studies, 22(5), 1915–1953.",
        "Diebold, F. X., & Mariano, R. S. (1995). Comparing predictive accuracy. Journal of Business & Economic Statistics, 13(3), 253–263.",
        "Elton, E. J., Gruber, M. J., & Blake, C. R. (1996). Survivor bias and mutual fund performance. Review of Financial Studies, 9(4), 1097–1120.",
        "Feng, G., He, J., & Polson, N. G. (2019). Deep learning for predicting asset returns. arXiv:1804.09314.",
        "Fischer, T., & Krauss, C. (2018). Deep learning with LSTM networks for financial market predictions. European Journal of Operational Research, 270(2), 654–669.",
        "Grinold, R. C., & Kahn, R. N. (2000). Active Portfolio Management (2nd ed.). McGraw-Hill.",
        "Gu, S., Kelly, B., & Xiu, D. (2020). Empirical asset pricing via machine learning. Review of Financial Studies, 33(5), 2223–2273.",
        "Hansen, P. R. (2005). A test for superior predictive ability. Journal of Business & Economic Statistics, 23(4), 365–380.",
        "Harvey, C. R., Liu, Y., & Zhu, H. (2016). … and the cross-section of expected returns. Review of Financial Studies, 29(1), 5–68.",
        "Hochreiter, S., & Schmidhuber, J. (1997). Long short-term memory. Neural Computation, 9(8), 1735–1780.",
        "Holm, S. (1979). A simple sequentially rejective multiple test procedure. Scandinavian Journal of Statistics, 6(2), 65–70.",
        "Hou, K., Xue, C., & Zhang, L. (2020). Replicating anomalies. Review of Financial Studies, 33(5), 2019–2133.",
        "Kingma, D. P., & Ba, J. (2015). Adam: A method for stochastic optimization. Proceedings of ICLR 2015.",
        "Moreira, A., & Muir, T. (2017). Volatility-managed portfolios. The Journal of Finance, 72(4), 1611–1644.",
        "Pástor, Ľ., & Stambaugh, R. F. (2012). On the size of the active management industry. Journal of Political Economy, 120(4), 740–781.",
        "Prado, M. L. de (2018). Advances in Financial Machine Learning. John Wiley & Sons.",
        "Prechelt, L. (1998). Early stopping — but when? In Neural Networks: Tricks of the Trade (pp. 55–69). Springer.",
        "Sharpe, W. F. (1994). The Sharpe ratio. The Journal of Portfolio Management, 21(1), 49–58.",
        "Vaswani, A., et al. (2017). Attention is all you need. Advances in NeurIPS, 30.",
        "Zhang, K., et al. (2021). Stock market prediction based on generative adversarial network. Procedia Computer Science, 147, 400–406.",
    ]
    for i, ref in enumerate(references):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        fmt = p.paragraph_format
        fmt.space_after = Pt(4)
        fmt.space_before = Pt(2)
        fmt.line_spacing = 1.3
        fmt.first_line_indent = None
        fmt.left_indent = Cm(1.27)
        fmt.first_line_indent = Cm(-1.27)
        run = p.add_run(f"[{i+1}]  {ref}")
        run.font.name = "Times New Roman"
        run.font.size = Pt(12)
        run._element.rPr.rFonts.set(qn('w:eastAsia'), "Times New Roman")


# ── Main ─────────────────────────────────────────────────────────────

def main():
    # Script is now inside thesis/ folder
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(os.path.join(script_dir, "figures"), exist_ok=True)

    template_path = r"D:\KLTN\antigravity\[Bản digital] Bìa BCTT - ENG.docx"
    if os.path.exists(template_path):
        doc = Document(template_path)
        print(f"📄 Loaded UEL template: {template_path}")
    else:
        doc = Document()
        print("⚠️ Template not found, creating blank document")

    try:
        style = doc.styles["Normal"]
        font = style.font
        font.name = "Times New Roman"
        font.size = Pt(13)
    except KeyError:
        pass

    # New section for content (after cover)
    new_section = doc.add_section()
    new_section.page_width = Cm(21.0)
    new_section.page_height = Cm(29.7)
    new_section.top_margin = Cm(2.5)
    new_section.bottom_margin = Cm(2.5)
    new_section.left_margin = Cm(3.0)
    new_section.right_margin = Cm(2.0)

    # ── Front matter ──
    create_declaration_page(doc)
    create_acknowledgment_page(doc)
    create_abstract_page(doc)
    create_toc_page(doc)
    create_abbreviations_page(doc)

    # ── Main content ──
    write_chapter3(doc)

    # ── Back matter ──
    write_references(doc)

    output_path = os.path.join(script_dir, "thesis_v2.docx")
    doc.save(output_path)
    print(f"✅ Thesis draft saved to: {output_path}")
    print(f"   📋 Bìa UEL → Lời cam đoan → Lời cảm ơn → Tóm tắt")
    print(f"   📋 Mục lục → Danh mục viết tắt")
    print(f"   📖 Chương 3: Phương pháp nghiên cứu")
    print(f"   📚 Tài liệu tham khảo (26 entries)")


if __name__ == "__main__":
    main()

