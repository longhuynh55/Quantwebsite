"use client";

import { TrendingDown, Clock, Globe, DollarSign } from "lucide-react";

const problems = [
  {
    icon: TrendingDown,
    title: "Quyết Định Cảm Tính",
    description: "Mua theo FOMO, bán theo hoảng loạn. Quyết định dựa trên tin đồn thay vì dữ liệu.",
    stat: "80% thua lỗ",
  },
  {
    icon: Clock,
    title: "Phân Tích Tốn Thời Gian",
    description: "Dành hàng giờ mỗi ngày với Excel và tính toán thủ công mà không ra kết quả.",
    stat: "3+ giờ/ngày",
  },
  {
    icon: Globe,
    title: "Công Cụ Không Phù Hợp",
    description: "Tools nước ngoài xây cho thị trường Mỹ/Âu, không hiểu đặc thù HOSE.",
    stat: "Không local data",
  },
  {
    icon: DollarSign,
    title: "Chi Phí Cao",
    description: "Bloomberg Professional giá $24,000/năm — vượt quá khả năng của đa số nhà đầu tư.",
    stat: "$24K/năm",
  },
];

export function ProblemSection() {
  return (
    <section className="py-20 bg-white dark:bg-neutral-950">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header - Editorial style */}
        <div className="mb-16 pb-6 border-b border-stone-200 dark:border-neutral-800">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-stone-400 dark:bg-neutral-600" />
            <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
              Thách Thức
            </span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight">
            Tại Sao Phân Tích Định Lượng
            <br />
            <span className="text-red-600 dark:text-red-400">Lại Khó Ở Việt Nam?</span>
          </h2>
          <p className="font-serif text-xl text-stone-600 dark:text-neutral-400 mt-4 max-w-2xl">
            Công cụ chuyên nghiệp tồn tại cho thị trường phát triển.
            Thị trường chứng khoán Việt Nam thiếu hạ tầng phân tích chuyên dụng.
          </p>
        </div>

        {/* Problems Grid - Newspaper style */}
        <div className="grid md:grid-cols-2 gap-px bg-stone-200 dark:bg-neutral-800 mb-12">
          {problems.map((problem, index) => (
            <div
              key={index}
              className="bg-white dark:bg-neutral-950 p-8 lg:p-10 hover:bg-stone-50 dark:hover:bg-neutral-900 transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                  <problem.icon className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-white mb-2">
                    {problem.title}
                  </h3>
                  <p className="font-sans text-stone-600 dark:text-neutral-400 leading-relaxed">
                    {problem.description}
                  </p>
                  <div className="mt-4 pt-4 border-t border-stone-100 dark:border-neutral-800">
                    <span className="font-mono text-sm text-red-600 dark:text-red-400 uppercase tracking-wider">
                      {problem.stat}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Agitation - Stark reality */}
        <div className="border-l-4 border-red-600 dark:border-red-500 bg-red-50 dark:bg-red-950/30 p-8">
          <p className="font-serif text-2xl text-stone-900 dark:text-white leading-relaxed">
            &quot;Không có nền tảng nào cung cấp công cụ phân tích định lượng toàn diện
            <span className="font-bold text-red-600 dark:text-red-400"> được thiết kế riêng cho nhà đầu tư Việt Nam</span>.
            QuantVN được xây dựng để lấp đầy khoảng trống này.&quot;
          </p>
        </div>
      </div>
    </section>
  );
}
