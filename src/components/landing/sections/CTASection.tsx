"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Clock, Shield, Coffee } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-24 bg-stone-900 dark:bg-black text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        {/* Kicker */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="w-12 h-px bg-emerald-500" />
          <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-400 dark:text-neutral-500">
            Bắt Đầu Hôm Nay
          </span>
          <span className="w-12 h-px bg-emerald-500" />
        </div>

        {/* Headline */}
        <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
          Đầu Tư Dựa Trên
          <br />
          <span className="text-emerald-400">Dữ Liệu</span>
          <br />
          Không Phải Cảm Tính
        </h2>

        {/* Subheadline */}
        <p className="font-serif text-xl text-stone-400 dark:text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Phân tích 400+ cổ phiếu trong 5 phút. Không cần thẻ tín dụng.
          <br />
          Bắt đầu với gói miễn phí và nâng cấp khi bạn cần thêm.
        </p>

        {/* Main CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <Link
            href="/dashboard"
            className="group inline-flex items-center justify-center gap-3 px-10 py-5 bg-white text-stone-900 font-sans font-semibold text-sm uppercase tracking-wider hover:bg-emerald-50 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            Dùng Thử Miễn Phí 14 Ngày
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-8 py-5 border border-stone-700 dark:border-neutral-700 text-stone-300 dark:text-neutral-300 font-sans font-semibold text-sm uppercase tracking-wider hover:border-white hover:text-white transition-colors"
          >
            Xem Demo 2 Phút
          </Link>
        </div>

        {/* Urgency element */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-900/30 border border-emerald-800/50 mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-sm text-emerald-300">
            Giới hạn 50 spots Pro miễn phí tháng này
          </span>
        </div>

        {/* Trust elements */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-stone-500 dark:text-neutral-500 mb-12">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>Không cần thẻ tín dụng</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-500" />
            <span>Hủy bất cứ lúc nào</span>
          </div>
          <div className="flex items-center gap-2">
            <Coffee className="w-4 h-4 text-emerald-500" />
            <span>Setup trong 2 phút</span>
          </div>
        </div>

        {/* Value comparison */}
        <div className="max-w-md mx-auto p-6 border border-stone-800 dark:border-neutral-800 bg-stone-950/50 mb-12">
          <div className="text-xs font-sans uppercase tracking-wider text-stone-500 dark:text-neutral-500 mb-3">
            Chi phí mỗi ngày
          </div>
          <div className="flex items-end justify-center gap-2">
            <span className="font-serif text-4xl font-bold text-white">₫6,600</span>
            <span className="font-sans text-stone-400 mb-1">/ ngày (gói Pro)</span>
          </div>
          <div className="text-sm text-stone-500 dark:text-neutral-500 mt-2">
            = 1 ly cà phê, tiết kiệm 3 giờ mỗi ngày
          </div>
        </div>

        {/* Academic footer */}
        <div className="pt-8 border-t border-stone-800 dark:border-neutral-800">
          <p className="font-serif italic text-stone-500 dark:text-neutral-500 max-w-2xl mx-auto">
            &quot;QuantVN Strategy Forge: A Reliability-Gated AI Assistant for Vietnamese
            Stock Market Analysis&quot; — Khóa luận tốt nghiệp nghiên cứu ứng dụng Machine Learning
            và AI trong phân tích định lượng.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <svg
              className="w-5 h-5 text-emerald-600 dark:text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 14l9-5-9-5-9 5 9 5z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
              />
            </svg>
            <p className="font-sans text-xs uppercase tracking-wider text-stone-600 dark:text-neutral-600">
              ĐH Kinh tế - Luật (UEL) 2026 — Khoa Tài chính - Ngân hàng
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
