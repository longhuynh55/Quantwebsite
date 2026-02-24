"use client";

import Link from "next/link";
import {
  Search,
  LineChart,
  Bot,
  Briefcase,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    number: "01",
    title: "Stock Screener",
    description:
      "Lọc 400+ cổ phiếu HOSE với 50+ tiêu chí. Tìm cơ hội đầu tư trong vài giây thay vì hàng giờ.",
    href: "/screener",
    icon: Search,
    highlight: "50+ chỉ số",
  },
  {
    number: "02",
    title: "Backtesting Engine",
    description:
      "Test chiến lược với 7 năm dữ liệu lịch sử. Xem metrics hiệu suất chi tiết trong 3 phút.",
    href: "/backtesting",
    icon: LineChart,
    highlight: "7 năm data",
  },
  {
    number: "03",
    title: "AI Assistant",
    description:
      "AI nói tiếng Việt, hiểu ngữ cảnh thị trường địa phương. Phân tích và gợi ý tức thì.",
    href: "/dashboard",
    icon: Bot,
    highlight: "Tiếng Việt",
  },
  {
    number: "04",
    title: "Portfolio Optimizer",
    description:
      "Tối ưu Markowitz, efficient frontier, risk parity. Xây dựng danh mục tối ưu về mặt toán học.",
    href: "/portfolio",
    icon: Briefcase,
    highlight: "Auto-optimize",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-white dark:bg-neutral-950">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header - editorial masthead style */}
        <div className="mb-16 pb-6 border-b border-stone-200 dark:border-neutral-800">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
            <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
              Tính Năng Nền Tảng
            </span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight">
            Công Cụ Được Xây Dựng
            <br />
            <span className="text-emerald-700 dark:text-emerald-400">Cho Nhà Đầu Tư Việt</span>
          </h2>
        </div>

        {/* Features - newspaper column layout */}
        <div className="grid md:grid-cols-2 gap-px bg-stone-200 dark:bg-neutral-800">
          {features.map((feature, index) => (
            <Link
              key={index}
              href={feature.href}
              className="group bg-white dark:bg-neutral-950 p-8 lg:p-10 hover:bg-stone-50 dark:hover:bg-neutral-900 transition-colors"
            >
              {/* Number and icon */}
              <div className="flex items-start justify-between mb-6">
                <span className="font-serif text-4xl font-bold text-stone-200 dark:text-neutral-700 group-hover:text-emerald-700 dark:group-hover:text-emerald-500 transition-colors">
                  {feature.number}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-sans uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-medium">
                    {feature.highlight}
                  </span>
                  <feature.icon className="w-6 h-6 text-stone-400 dark:text-neutral-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                </div>
              </div>

              {/* Title */}
              <h3 className="font-serif text-2xl font-bold text-stone-900 dark:text-white mb-3 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                {feature.title}
              </h3>

              {/* Description */}
              <p className="font-sans text-stone-600 dark:text-neutral-400 leading-relaxed mb-6">
                {feature.description}
              </p>

              {/* Link */}
              <div className="flex items-center gap-2 text-sm font-sans font-medium text-stone-500 dark:text-neutral-500 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                <span>Khám phá tính năng</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom editorial note */}
        <div className="mt-12 pt-8 border-t border-stone-200 dark:border-neutral-800">
          <p className="font-serif text-lg italic text-stone-600 dark:text-neutral-400 text-center max-w-2xl mx-auto">
            Tất cả công cụ chạy trên trình duyệt. Không cần cài đặt.
            Hoạt động trên desktop, tablet và mobile.
          </p>
        </div>
      </div>
    </section>
  );
}
