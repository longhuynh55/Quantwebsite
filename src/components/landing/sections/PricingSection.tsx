"use client";

import Link from "next/link";
import { Check, Minus } from "lucide-react";

const freeFeatures = [
  { text: "3 backtest/ngày", included: true },
  { text: "Stock screener cơ bản", included: true },
  { text: "5 chỉ báo kỹ thuật", included: true },
  { text: "Hỗ trợ cộng đồng", included: true },
  { text: "AI Assistant", included: false },
  { text: "Xuất báo cáo", included: false },
];

const proFeatures = [
  { text: "Backtest không giới hạn", included: true },
  { text: "AI Assistant tiếng Việt", included: true },
  { text: "50+ chỉ báo kỹ thuật", included: true },
  { text: "Xuất CSV/Excel", included: true },
  { text: "Hỗ trợ ưu tiên", included: true },
  { text: "Phân tích nâng cao", included: true },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 bg-stone-100 dark:bg-neutral-900">
      <div className="max-w-5xl mx-auto px-6">
        {/* Section header - editorial style */}
        <div className="text-center mb-12 pb-6 border-b border-stone-300 dark:border-neutral-700">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="w-8 h-px bg-stone-400 dark:bg-neutral-600" />
            <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
              Bảng Giá
            </span>
            <span className="w-8 h-px bg-stone-400 dark:bg-neutral-600" />
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white">
            Giá Cả Hợp Lý
          </h2>
        </div>

        {/* Pricing table - newspaper style */}
        <div className="grid md:grid-cols-2 gap-px bg-stone-300 dark:bg-neutral-700">
          {/* Free Plan */}
          <div className="bg-white dark:bg-neutral-950 p-8 lg:p-10">
            <div className="pb-6 mb-6 border-b border-stone-200 dark:border-neutral-800">
              <div className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500 mb-2">
                Miễn Phí
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-5xl font-bold text-stone-900 dark:text-white">₫0</span>
                <span className="font-sans text-stone-500 dark:text-neutral-500">/mãi mãi</span>
              </div>
              <p className="font-sans text-sm text-stone-500 dark:text-neutral-500 mt-2">
                Hoàn hảo để khám phá nền tảng
              </p>
            </div>

            <ul className="space-y-3 mb-8">
              {freeFeatures.map((feature, index) => (
                <li key={index} className="flex items-center gap-3">
                  {feature.included ? (
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <Minus className="w-4 h-4 text-stone-300 dark:text-neutral-600 flex-shrink-0" />
                  )}
                  <span className={`font-sans text-sm ${feature.included ? "text-stone-700 dark:text-neutral-300" : "text-stone-400 dark:text-neutral-500"}`}>
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href="/dashboard"
              className="block w-full py-3 border-2 border-stone-900 dark:border-white text-stone-900 dark:text-white text-center font-sans font-semibold text-sm uppercase tracking-wider hover:bg-stone-900 dark:hover:bg-white hover:text-white dark:hover:text-stone-900 transition-colors"
            >
              Bắt Đầu Ngay
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="bg-stone-900 dark:bg-neutral-950 p-8 lg:p-10 text-white dark:text-white border-2 border-emerald-600">
            <div className="pb-6 mb-6 border-b border-stone-700 dark:border-neutral-800">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-sans uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-400">
                  Pro
                </div>
                <div className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-sans font-medium uppercase">
                  Khuyên Dùng
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-5xl font-bold">₫199K</span>
                <span className="font-sans text-stone-400 dark:text-neutral-500">/tháng</span>
              </div>
              <p className="font-sans text-sm text-stone-400 dark:text-neutral-500 mt-2">
                ≈ ₫6,600/ngày — bằng 1 ly cà phê
              </p>
            </div>

            <ul className="space-y-3 mb-8">
              {proFeatures.map((feature, index) => (
                <li key={index} className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="font-sans text-sm text-stone-200 dark:text-neutral-200">
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href="/dashboard"
              className="block w-full py-3 bg-emerald-600 text-white text-center font-sans font-semibold text-sm uppercase tracking-wider hover:bg-emerald-700 transition-colors"
            >
              Dùng Thử 14 Ngày
            </Link>
          </div>
        </div>

        {/* Annual discount - editorial note style */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-4 px-6 py-4 border border-stone-300 dark:border-neutral-700 bg-white dark:bg-neutral-800">
            <div className="text-xs font-sans uppercase tracking-wider text-stone-500 dark:text-neutral-500">
              Gói Năm
            </div>
            <div className="w-px h-6 bg-stone-300 dark:bg-neutral-600" />
            <div>
              <span className="font-serif font-bold text-stone-900 dark:text-white">₫1,990,000/năm</span>
              <span className="ml-2 text-sm text-emerald-600 font-sans">Tiết kiệm ₫400K</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
