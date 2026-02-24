"use client";

import Link from "next/link";
import { ArrowRight, TrendingUp, Clock, Target, BarChart3, CheckCircle2, Quote } from "lucide-react";

const caseStudy = {
  name: "Trần Minh Tuấn",
  role: "Nhà đầu tư cá nhân",
  experience: "3 năm kinh nghiệm",
  location: "TP. Hồ Chí Minh",
  avatar: "TMT",
  before: [
    { icon: Clock, label: "Thời gian phân tích", value: "3+ giờ/ngày" },
    { icon: BarChart3, label: "Lợi nhuận/năm", value: "15%" },
    { icon: Target, label: "Phương pháp", value: "Cảm tính" },
  ],
  after: [
    { icon: Clock, label: "Thời gian phân tích", value: "30 phút", highlight: true },
    { icon: BarChart3, label: "Lợi nhuận/năm", value: "35%", highlight: true },
    { icon: Target, label: "Phương pháp", value: "Dữ liệu", highlight: true },
  ],
  quote: "Tôi đã thử nhiều tools nhưng QuantVN là duy nhất hiểu thị trường Việt Nam. ROI tăng 133% chỉ trong 3 tháng!",
  strategy: "MA Crossover",
};

const stats = [
  { value: "35%", label: "Lợi nhuận TB", sublabel: "theo chiến lược MA" },
  { value: "3 phút", label: "Thời gian backtest", sublabel: "thay vì 3 giờ" },
  { value: "400+", label: "Mã HOSE", sublabel: "có sẵn dữ liệu" },
];

export function ResultsSection() {
  return (
    <section className="py-20 bg-white dark:bg-neutral-950">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header - editorial style */}
        <div className="mb-16 pb-6 border-b border-stone-200 dark:border-neutral-800">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
            <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
              Kết Quả Thực Tế
            </span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight">
            Từ <span className="text-red-600 dark:text-red-400">15%</span> Lên{" "}
            <span className="text-emerald-700 dark:text-emerald-400">35%</span>
            <br />
            Lợi Nhuận
          </h2>
          <p className="font-serif text-xl text-stone-600 dark:text-neutral-400 mt-4">
            Xem cách người dùng QuantVN cải thiện kết quả đầu tư chỉ trong 3 tháng.
          </p>
        </div>

        {/* Case Study Card - editorial style */}
        <div className="max-w-4xl mx-auto">
          <div className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            {/* Header */}
            <div className="bg-emerald-700 dark:bg-emerald-900 px-6 py-4 border-b border-emerald-600 dark:border-emerald-800">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 border-2 border-white/50 flex items-center justify-center text-white font-serif font-bold text-lg">
                  {caseStudy.avatar}
                </div>
                <div className="text-white">
                  <div className="font-serif text-lg font-bold">{caseStudy.name}</div>
                  <div className="font-sans text-white/80 text-sm">
                    {caseStudy.role} • {caseStudy.experience} • {caseStudy.location}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="font-sans text-white/80 text-xs uppercase tracking-wider">Chiến lược</div>
                  <div className="mt-1 px-3 py-1 bg-white/20 text-white font-sans text-sm font-medium">
                    {caseStudy.strategy}
                  </div>
                </div>
              </div>
            </div>

            {/* Before/After Comparison */}
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Before */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
                      <XIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="font-serif font-bold text-stone-900 dark:text-white">TRƯỚC QUANTVN</h3>
                  </div>
                  <div className="space-y-3">
                    {caseStudy.before.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10"
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="w-5 h-5 text-red-500" />
                          <span className="font-sans text-sm text-stone-600 dark:text-neutral-400">{item.label}</span>
                        </div>
                        <span className="font-sans font-semibold text-red-600 dark:text-red-400">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* After */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="font-serif font-bold text-stone-900 dark:text-white">SAU 3 THÁNG</h3>
                  </div>
                  <div className="space-y-3">
                    {caseStudy.after.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/10"
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="w-5 h-5 text-emerald-500" />
                          <span className="font-sans text-sm text-stone-600 dark:text-neutral-400">{item.label}</span>
                        </div>
                        <span className={`font-sans font-semibold ${item.highlight ? "text-emerald-600 dark:text-emerald-400" : "text-stone-900 dark:text-white"}`}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quote */}
              <div className="mt-6 p-4 border-l-4 border-emerald-700 dark:border-emerald-500 bg-stone-50 dark:bg-neutral-900">
                <div className="flex gap-3">
                  <Quote className="w-6 h-6 text-emerald-700 dark:text-emerald-500 flex-shrink-0" />
                  <p className="font-serif text-stone-700 dark:text-neutral-300 italic">
                    &quot;{caseStudy.quote}&quot;
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row - editorial style */}
        <div className="grid grid-cols-3 gap-px bg-stone-200 dark:bg-neutral-800 mt-12 max-w-3xl mx-auto">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white dark:bg-neutral-950 p-6 text-center">
              <div className="font-serif text-3xl md:text-4xl font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                {stat.value}
              </div>
              <div className="font-sans text-sm font-medium text-stone-900 dark:text-white">{stat.label}</div>
              <div className="font-sans text-xs text-stone-500 dark:text-neutral-500">{stat.sublabel}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="font-serif text-lg text-stone-600 dark:text-neutral-400 mb-4">
            Sẵn sàng đạt kết quả tương tự?
          </p>
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-3 px-8 py-4 bg-emerald-700 dark:bg-emerald-600 text-white font-sans font-semibold text-sm uppercase tracking-wider hover:bg-emerald-800 dark:hover:bg-emerald-500 transition-colors"
          >
            Dùng Thử Miễn Phí
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// X icon component
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
