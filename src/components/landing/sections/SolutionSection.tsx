"use client";

import Link from "next/link";
import { ArrowRight, Database, MessageSquare, Laptop, MapPin, Check, Minus } from "lucide-react";

const solutionPoints = [
  {
    icon: Database,
    title: "Dữ Liệu HOSE Chính Thức",
    description: "400+ cổ phiếu với 7 năm dữ liệu lịch sử, cập nhật hàng ngày từ nguồn chính thức.",
    number: "01",
  },
  {
    icon: MessageSquare,
    title: "AI Assistant Tiếng Việt",
    description: "Hỗ trợ tiếng Việt bản địa, hiểu ngữ cảnh thị trường địa phương.",
    number: "02",
  },
  {
    icon: Laptop,
    title: "Platform Trên Browser",
    description: "Không cần cài đặt. Hoạt động trên desktop, tablet và mobile.",
    number: "03",
  },
  {
    icon: MapPin,
    title: "Xây Dựng Cho Việt Nam",
    description: "Giao diện tiếng Việt, hỗ trợ địa phương, thiết kế cho đặc thù HOSE.",
    number: "04",
  },
];

const comparisonData = [
  { feature: "Dữ Liệu HOSE", excel: false, foreign: false, quantvn: true },
  { feature: "AI Tiếng Việt", excel: false, foreign: false, quantvn: true },
  { feature: "Backtesting Tự Động", excel: false, foreign: true, quantvn: true },
  { feature: "Tối Ưu Danh Mục", excel: false, foreign: true, quantvn: true },
  { feature: "Cập Nhật Hàng Ngày", excel: false, foreign: true, quantvn: true },
  { feature: "Giá Cả Hợp Lý", excel: true, foreign: false, quantvn: true },
];

export function SolutionSection() {
  return (
    <section className="py-20 bg-stone-50 dark:bg-neutral-900">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header - Editorial style */}
        <div className="mb-16 pb-6 border-b border-stone-200 dark:border-neutral-800">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
            <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
              Giải Pháp
            </span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight">
            Được Xây Dựng Riêng Cho
            <br />
            <span className="text-emerald-700 dark:text-emerald-400">Nhà Đầu Tư Việt Nam</span>
          </h2>
          <p className="font-serif text-xl text-stone-600 dark:text-neutral-400 mt-4 max-w-2xl">
            Trong khi công cụ nước ngoài bỏ qua thị trường Việt Nam,
            QuantVN được thiết kế từ đầu cho phân tích HOSE.
          </p>
        </div>

        {/* Solution Points - Numbered Grid */}
        <div className="grid md:grid-cols-2 gap-px bg-stone-200 dark:bg-neutral-800 mb-20">
          {solutionPoints.map((point, index) => (
            <div
              key={index}
              className="bg-white dark:bg-neutral-950 p-8 lg:p-10 group hover:bg-stone-50 dark:hover:bg-neutral-900 transition-colors"
            >
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="font-serif text-4xl font-bold text-stone-200 dark:text-neutral-700 group-hover:text-emerald-700 dark:group-hover:text-emerald-500 transition-colors">
                    {point.number}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <point.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                    <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-white">
                      {point.title}
                    </h3>
                  </div>
                  <p className="font-sans text-stone-600 dark:text-neutral-400 leading-relaxed">
                    {point.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Comparison Table - Editorial style */}
        <div className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
          <div className="px-6 py-4 border-b border-stone-200 dark:border-neutral-800">
            <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-white">
              So Sánh Với Các Lựa Chọn Khác
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 dark:border-neutral-800">
                  <th className="text-left py-4 px-6 text-xs font-sans uppercase tracking-wider text-stone-500 dark:text-neutral-500">
                    Tính Năng
                  </th>
                  <th className="py-4 px-6 text-xs font-sans uppercase tracking-wider text-stone-500 dark:text-neutral-500 text-center">
                    Excel / Sheets
                  </th>
                  <th className="py-4 px-6 text-xs font-sans uppercase tracking-wider text-stone-500 dark:text-neutral-500 text-center">
                    Tools Nước Ngoài
                  </th>
                  <th className="py-4 px-6 text-xs font-sans uppercase tracking-wider text-center bg-emerald-700 dark:bg-emerald-600 text-white">
                    QuantVN
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-neutral-800">
                {comparisonData.map((row, index) => (
                  <tr key={index} className="hover:bg-stone-50 dark:hover:bg-neutral-900 transition-colors">
                    <td className="py-4 px-6 text-sm font-sans text-stone-700 dark:text-neutral-300">
                      {row.feature}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {row.excel ? (
                        <Check className="w-5 h-5 text-emerald-600 mx-auto" />
                      ) : (
                        <Minus className="w-5 h-5 text-stone-300 dark:text-neutral-600 mx-auto" />
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {row.foreign ? (
                        <Check className="w-5 h-5 text-emerald-600 mx-auto" />
                      ) : (
                        <Minus className="w-5 h-5 text-stone-300 dark:text-neutral-600 mx-auto" />
                      )}
                    </td>
                    <td className="py-4 px-6 text-center bg-emerald-50 dark:bg-emerald-950/30">
                      <Check className="w-5 h-5 text-emerald-600 mx-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Link
            href="/dashboard"
            className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-emerald-700 dark:bg-emerald-600 text-white font-sans font-semibold text-sm uppercase tracking-wider hover:bg-emerald-800 dark:hover:bg-emerald-500 transition-colors"
          >
            Dùng Thử Ngay
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
