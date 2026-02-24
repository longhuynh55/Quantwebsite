"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    question: "QuantVN lấy dữ liệu từ đâu?",
    answer:
      "Chúng tôi sử dụng dữ liệu đã xác minh từ Sở Giao dịch Chứng khoán TP.HCM (HOSE), bao phủ 400+ cổ phiếu với 7 năm dữ liệu giá từ 2018 đến nay. Dữ liệu được cập nhật hàng ngày sau giờ giao dịch.",
  },
  {
    question: "Dữ liệu cá nhân của tôi có an toàn không?",
    answer:
      "Hoàn toàn an toàn. Chúng tôi sử dụng mã hóa SSL/TLS cho tất cả kết nối, và dữ liệu được lưu trữ trên AWS với tiêu chuẩn bảo mật cao. Chúng tôi không bán dữ liệu người dùng cho bên thứ ba.",
  },
  {
    question: "Tôi có thể xuất kết quả phân tích không?",
    answer:
      "Có! Người dùng Pro có thể xuất kết quả backtest, danh sách cổ phiếu đã lọc, và báo cáo phân tích sang CSV hoặc Excel. Định dạng được tối ưu cho việc phân tích thêm.",
  },
  {
    question: "QuantVN có phải là lời khuyên đầu tư không?",
    answer:
      "Không. QuantVN là công cụ phân tích và nghiên cứu. Chúng tôi cung cấp dữ liệu và công cụ để hỗ trợ quyết định đầu tư, nhưng không đưa ra khuyến nghị mua/bán cụ thể. Mọi quyết định đầu tư là trách nhiệm của bạn.",
  },
  {
    question: "Làm sao để hủy gói Pro?",
    answer:
      "Bạn có thể hủy bất cứ lúc nào trong Cài đặt Tài khoản. Sau khi hủy, bạn vẫn có thể sử dụng tính năng Pro đến hết kỳ thanh toán. Không phí hủy, hoàn tiền cho thời gian chưa sử dụng.",
  },
  {
    question: "Có hỗ trợ tiếng Anh không?",
    answer:
      "Giao diện chính có đầy đủ tiếng Việt và tiếng Anh. AI Assistant hỗ trợ cả tiếng Việt và tiếng Anh. Chúng tôi đang phát triển thêm các ngôn ngữ khác trong tương lai.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 bg-stone-50 dark:bg-neutral-900">
      <div className="max-w-3xl mx-auto px-6">
        {/* Section header - editorial style */}
        <div className="mb-16 pb-6 border-b border-stone-200 dark:border-neutral-800">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
            <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
              FAQ
            </span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight">
            Câu Hỏi
            <br />
            <span className="text-emerald-700 dark:text-emerald-400">Thường Gặp</span>
          </h2>
          <p className="font-serif text-xl text-stone-600 dark:text-neutral-400 mt-4">
            Tìm câu trả lời cho các câu hỏi thường gặp về QuantVN.
          </p>
        </div>

        {/* FAQ List - editorial style */}
        <div className="border-t border-stone-200 dark:border-neutral-800">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border-b border-stone-200 dark:border-neutral-800"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full py-6 flex items-start justify-between text-left group"
              >
                <span className="font-serif text-lg text-stone-900 dark:text-white pr-8 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                  {faq.question}
                </span>
                <span className="flex-shrink-0">
                  {openIndex === index ? (
                    <Minus className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  ) : (
                    <Plus className="w-5 h-5 text-stone-400 dark:text-neutral-500 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors" />
                  )}
                </span>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? "max-h-96 pb-6" : "max-h-0"
                }`}
              >
                <p className="font-sans text-stone-600 dark:text-neutral-400 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
