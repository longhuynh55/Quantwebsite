"use client";

import Link from "next/link";
import { UserPlus, Search, LineChart, Rocket, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "Đăng Ký",
    duration: "30 giây",
    description: "Tạo tài khoản miễn phí",
    number: "01",
  },
  {
    icon: Search,
    title: "Lọc Cổ Phiếu",
    duration: "2 phút",
    description: "Dùng screener hoặc AI assistant",
    number: "02",
  },
  {
    icon: LineChart,
    title: "Backtest",
    duration: "5 phút",
    description: "Test chiến lược của bạn",
    number: "03",
  },
  {
    icon: Rocket,
    title: "Thực Thi",
    duration: "Tự tin hơn",
    description: "Đầu tư dựa trên dữ liệu",
    number: "04",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-20 bg-white dark:bg-neutral-950">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header - editorial style */}
        <div className="mb-16 pb-6 border-b border-stone-200 dark:border-neutral-800">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
            <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
              Cách Thức Hoạt Động
            </span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight">
            Bắt Đầu Phân Tích
            <br />
            <span className="text-emerald-700 dark:text-emerald-400">Trong Vài Phút</span>
          </h2>
          <p className="font-serif text-xl text-stone-600 dark:text-neutral-400 mt-4 max-w-2xl">
            Từ đăng ký đến backtest đầu tiên — không cần cài đặt phức tạp.
          </p>
        </div>

        {/* Steps - newspaper column layout */}
        <div className="grid md:grid-cols-4 gap-px bg-stone-200 dark:bg-neutral-800">
          {steps.map((step, index) => (
            <div
              key={index}
              className="bg-white dark:bg-neutral-950 p-8 group hover:bg-stone-50 dark:hover:bg-neutral-900 transition-colors"
            >
              {/* Number */}
              <div className="font-serif text-5xl font-bold text-stone-200 dark:text-neutral-700 group-hover:text-emerald-700 dark:group-hover:text-emerald-500 transition-colors mb-6">
                {step.number}
              </div>

              {/* Icon */}
              <div className="w-12 h-12 border border-stone-200 dark:border-neutral-700 flex items-center justify-center mb-6 group-hover:border-emerald-700 dark:group-hover:border-emerald-500 transition-colors">
                <step.icon className="w-6 h-6 text-stone-400 dark:text-neutral-500 group-hover:text-emerald-700 dark:group-hover:text-emerald-500 transition-colors" />
              </div>

              {/* Content */}
              <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-white mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium mb-2">
                {step.duration}
              </p>
              <p className="font-sans text-sm text-stone-500 dark:text-neutral-500">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-3 px-8 py-4 bg-emerald-700 dark:bg-emerald-600 text-white font-sans font-semibold text-sm uppercase tracking-wider hover:bg-emerald-800 dark:hover:bg-emerald-500 transition-colors"
          >
            Bắt Đầu Ngay
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
