"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";

// Animated counter component
function AnimatedCounter({
  end,
  suffix = "",
  duration = 2000,
}: {
  end: number;
  suffix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // Easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return (
    <span className="font-serif text-2xl font-bold text-stone-900 dark:text-white tabular-nums">
      {count.toLocaleString()}{suffix}
    </span>
  );
}

export function HeroSection() {
  return (
    <section className="relative bg-stone-50 dark:bg-neutral-950 min-h-[90vh] flex items-center">
      {/* Top accent line - editorial detail */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-700 dark:bg-emerald-600" />

      <div className="max-w-6xl mx-auto px-6 py-24 w-full">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Main editorial content */}
          <div className="lg:col-span-8">
            {/* Kicker - newspaper style */}
            <div className="flex items-center gap-3 mb-6">
              <span className="w-12 h-px bg-emerald-700 dark:bg-emerald-500" />
              <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
                Quantitative Finance Platform
              </span>
            </div>

            {/* Masthead headline - dramatic serif */}
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold text-stone-900 dark:text-white leading-[1.05] tracking-tight mb-8">
              Biến Dữ Liệu Thành
              <br />
              <span className="text-emerald-700 dark:text-emerald-400">Lợi Nhuận</span>
              <br />
              Với AI
            </h1>

            {/* Deck - supporting headline */}
            <p className="font-serif text-xl md:text-2xl text-stone-600 dark:text-neutral-400 leading-relaxed max-w-2xl mb-10">
              Nền tảng phân tích định lượng duy nhất cho thị trường Việt Nam.
              Lọc cổ phiếu, backtest chiến lược, tối ưu danh mục — không cần code.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/dashboard"
                className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-emerald-700 dark:bg-emerald-600 text-white font-sans font-semibold text-sm uppercase tracking-wider hover:bg-emerald-800 dark:hover:bg-emerald-500 transition-colors"
              >
                Dùng Thử Miễn Phí
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-stone-300 dark:border-neutral-700 text-stone-700 dark:text-neutral-300 font-sans font-semibold text-sm uppercase tracking-wider hover:border-stone-900 dark:hover:border-white hover:text-stone-900 dark:hover:text-white transition-colors"
              >
                Khám Phá Tính Năng
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-10 pt-8 border-t border-stone-200 dark:border-neutral-800">
              <p className="text-xs font-sans uppercase tracking-wider text-stone-500 dark:text-neutral-500 mb-4">
                Được tin dùng bởi
              </p>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-stone-600 dark:text-neutral-400">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="font-sans text-sm">400+ cổ phiếu HOSE</span>
                </div>
                <div className="flex items-center gap-2 text-stone-600 dark:text-neutral-400">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="font-sans text-sm">7 năm dữ liệu lịch sử</span>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-stone-600 dark:text-neutral-400">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="font-sans text-sm">AI tiếng Việt</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - stats preview */}
          <div className="lg:col-span-4">
            <div className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
              {/* Section label */}
              <div className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500 mb-4 pb-2 border-b border-stone-200 dark:border-neutral-800">
                Số Liệu Thống Kê
              </div>

              {/* Stats list with animated counters */}
              <div className="space-y-4">
                <div className="flex items-baseline justify-between py-2 border-b border-stone-100 dark:border-neutral-800">
                  <span className="font-sans text-sm text-stone-600 dark:text-neutral-400">Cổ Phiếu</span>
                  <AnimatedCounter end={400} suffix="+" />
                </div>
                <div className="flex items-baseline justify-between py-2 border-b border-stone-100 dark:border-neutral-800">
                  <span className="font-sans text-sm text-stone-600 dark:text-neutral-400">Dữ Liệu</span>
                  <AnimatedCounter end={7} suffix=" năm" />
                </div>
                <div className="flex items-baseline justify-between py-2 border-b border-stone-100 dark:border-neutral-800">
                  <span className="font-sans text-sm text-stone-600 dark:text-neutral-400">Chỉ Báo</span>
                  <AnimatedCounter end={50} suffix="+" />
                </div>
                <div className="flex items-baseline justify-between py-2">
                  <span className="font-sans text-sm text-stone-600 dark:text-neutral-400">Sàn</span>
                  <span className="font-serif text-lg font-bold text-emerald-700 dark:text-emerald-400">HOSE</span>
                </div>
              </div>

              {/* Mini chart */}
              <div className="mt-6 pt-4 border-t border-stone-200 dark:border-neutral-800">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-sans uppercase tracking-wider text-stone-500 dark:text-neutral-500">
                    Backtest Mẫu
                  </span>
                </div>
                <div className="flex items-end gap-0.5 h-12">
                  {[30, 45, 35, 55, 40, 65, 50, 70, 60, 80, 75, 90].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-emerald-600 dark:bg-emerald-500 transition-all hover:bg-emerald-700 dark:hover:bg-emerald-400"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs font-sans text-stone-500 dark:text-neutral-500">
                  <span>+85.5%</span>
                  <span>Sharpe: 1.45</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-stone-200 dark:bg-neutral-800" />
    </section>
  );
}
