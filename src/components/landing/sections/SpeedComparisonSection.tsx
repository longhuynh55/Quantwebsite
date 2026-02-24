"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Zap, CheckCircle2 } from "lucide-react";

export function SpeedComparisonSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 bg-stone-50 dark:bg-neutral-950">
      <div className="max-w-5xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
            <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
              Tiết Kiệm Thời Gian
            </span>
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight mb-4">
            5 Phút Thay Vì 3 Giờ
          </h2>
          <p className="font-serif text-xl text-stone-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Phân tích toàn bộ 400+ cổ phiếu HOSE trong khi bạn uống một ly cà phê
          </p>
        </div>

        {/* Comparison Visual */}
        <div className="max-w-3xl mx-auto">
          {/* Manual Method */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
                <Clock className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <span className="font-sans font-semibold text-stone-900 dark:text-white uppercase tracking-wider text-sm">
                Phân tích thủ công (Excel/Tin tức)
              </span>
              <span className="ml-auto font-serif text-2xl font-bold text-red-600 dark:text-red-400">3+ Giờ</span>
            </div>
            <div className="relative h-4 bg-stone-200 dark:bg-neutral-800 overflow-hidden">
              <div
                className={`absolute left-0 top-0 h-full bg-red-500/80 dark:bg-red-600/80 transition-all duration-1000 ease-out ${
                  isVisible ? "w-full" : "w-0"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>
              {/* Markers */}
              <div className="absolute inset-0 flex items-center">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="flex-1 border-r border-stone-300 dark:border-neutral-700 h-full" />
                ))}
              </div>
            </div>
            <div className="flex justify-between mt-1 text-xs font-sans text-stone-400 dark:text-neutral-600">
              <span>0</span>
              <span>30 phút</span>
              <span>1 giờ</span>
              <span>1.5 giờ</span>
              <span>2 giờ</span>
              <span>2.5 giờ</span>
              <span>3+ giờ</span>
            </div>
          </div>

          {/* QuantVN Method */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="font-sans font-semibold text-stone-900 dark:text-white uppercase tracking-wider text-sm">
                QuantVN AI Screener
              </span>
              <span className="ml-auto font-serif text-2xl font-bold text-emerald-600 dark:text-emerald-400">5 Phút</span>
            </div>
            <div className="relative h-4 bg-stone-200 dark:bg-neutral-800 overflow-hidden">
              <div
                className={`absolute left-0 top-0 h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-1000 delay-300 ease-out ${
                  isVisible ? "w-[3%]" : "w-0"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
              </div>
            </div>
            <div className="flex justify-between mt-1 text-xs font-sans text-stone-400 dark:text-neutral-600">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">5 phút</span>
              <span>...</span>
              <span>...</span>
              <span>...</span>
              <span>...</span>
              <span>...</span>
              <span>3+ giờ</span>
            </div>
          </div>

          {/* Savings Badge */}
          <div className={`mt-12 text-center transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <div className="inline-flex items-center gap-4 px-8 py-4 bg-emerald-700 dark:bg-emerald-600 text-white">
              <CheckCircle2 className="w-6 h-6" />
              <div className="text-left">
                <div className="font-sans text-xs uppercase tracking-wider opacity-80">Tiết kiệm mỗi ngày</div>
                <div className="font-serif text-2xl font-bold">2 giờ 55 phút</div>
              </div>
              <div className="border-l border-emerald-500 pl-4 ml-2">
                <div className="font-sans text-xs uppercase tracking-wider opacity-80">Một tháng</div>
                <div className="font-serif text-xl font-bold">~60 giờ</div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <p className="font-serif text-lg text-stone-600 dark:text-neutral-400 mb-4">
              Thử ngay và thấy sự khác biệt
            </p>
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-3 px-8 py-4 bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-sans font-semibold text-sm uppercase tracking-wider hover:bg-emerald-700 dark:hover:bg-emerald-600 dark:hover:text-white transition-colors"
            >
              Bắt Đầu Ngay
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
