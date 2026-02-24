"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowRight, TrendingUp, Target, Activity, Shield, BarChart3 } from "lucide-react";

const backtestResults = [
  {
    strategy: "SMA Crossover",
    period: "2020-2024",
    totalReturn: 85.5,
    sharpeRatio: 1.45,
    winRate: 62.5,
    maxDrawdown: -18.5,
    trades: 48,
    equityCurve: [100, 105, 98, 112, 108, 120, 115, 128, 135, 142, 155, 185.5],
  },
  {
    strategy: "RSI Mean Reversion",
    period: "2020-2024",
    totalReturn: 62.3,
    sharpeRatio: 1.12,
    winRate: 58.2,
    maxDrawdown: -22.1,
    trades: 72,
    equityCurve: [100, 102, 96, 108, 105, 115, 110, 122, 130, 138, 148, 162.3],
  },
  {
    strategy: "MACD Momentum",
    period: "2020-2024",
    totalReturn: 95.8,
    sharpeRatio: 1.68,
    winRate: 65.8,
    maxDrawdown: -15.2,
    trades: 36,
    equityCurve: [100, 108, 104, 118, 115, 128, 125, 140, 150, 160, 172, 195.8],
  },
];

export function MiniBacktestSection() {
  const [selectedStrategy, setSelectedStrategy] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const currentResult = backtestResults[selectedStrategy];

  return (
    <section ref={sectionRef} className="py-20 bg-white dark:bg-neutral-950">
      <div className="max-w-5xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
            <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
              Kết Quả Thực Tế
            </span>
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight mb-4">
            Backtest Chiến Lược
          </h2>
          <p className="font-serif text-xl text-stone-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Xem kết quả thực tế từ các chiến lược phổ biến trên dữ liệu HOSE
          </p>
        </div>

        {/* Strategy Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {backtestResults.map((result, index) => (
            <button
              key={result.strategy}
              onClick={() => setSelectedStrategy(index)}
              className={`px-4 py-2 font-sans text-sm transition-colors ${
                selectedStrategy === index
                  ? "bg-emerald-700 dark:bg-emerald-600 text-white"
                  : "bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-400 hover:bg-stone-200 dark:hover:bg-neutral-700"
              }`}
            >
              {result.strategy}
            </button>
          ))}
        </div>

        {/* Results Card */}
        <div className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
          {/* Card Header */}
          <div className="px-6 py-4 border-b border-stone-200 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-900">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-white">
                  {currentResult.strategy}
                </h3>
                <p className="font-sans text-sm text-stone-500 dark:text-neutral-500">
                  Kỳ hạn: {currentResult.period} • {currentResult.trades} giao dịch
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs font-sans uppercase tracking-wider text-stone-500 dark:text-neutral-500">
                  Tổng lợi nhuận
                </div>
                <div className="font-serif text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  +{currentResult.totalReturn}%
                </div>
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className={`p-4 border border-stone-200 dark:border-neutral-800 transition-all duration-500 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-sans uppercase tracking-wider">Sharpe Ratio</span>
                </div>
                <span className="font-serif text-2xl font-bold text-stone-900 dark:text-white">
                  {currentResult.sharpeRatio}
                </span>
              </div>

              <div className={`p-4 border border-stone-200 dark:border-neutral-800 transition-all duration-500 delay-100 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                  <Target className="w-4 h-4" />
                  <span className="text-xs font-sans uppercase tracking-wider">Win Rate</span>
                </div>
                <span className="font-serif text-2xl font-bold text-stone-900 dark:text-white">
                  {currentResult.winRate}%
                </span>
              </div>

              <div className={`p-4 border border-stone-200 dark:border-neutral-800 transition-all duration-500 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                  <Shield className="w-4 h-4" />
                  <span className="text-xs font-sans uppercase tracking-wider">Max Drawdown</span>
                </div>
                <span className="font-serif text-2xl font-bold text-red-600 dark:text-red-400">
                  {currentResult.maxDrawdown}%
                </span>
              </div>

              <div className={`p-4 border border-stone-200 dark:border-neutral-800 transition-all duration-500 delay-300 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 mb-2">
                  <BarChart3 className="w-4 h-4" />
                  <span className="text-xs font-sans uppercase tracking-wider">Giao dịch</span>
                </div>
                <span className="font-serif text-2xl font-bold text-stone-900 dark:text-white">
                  {currentResult.trades}
                </span>
              </div>
            </div>

            {/* Equity Curve Mini Chart */}
            <div className="border border-stone-200 dark:border-neutral-800 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-sans uppercase tracking-wider text-stone-500 dark:text-neutral-500">
                    Đường cong vốn
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-sans">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-emerald-600 dark:bg-emerald-500" />
                    <span className="text-stone-600 dark:text-neutral-400">Chiến lược</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-stone-300 dark:bg-neutral-600" />
                    <span className="text-stone-600 dark:text-neutral-400">Benchmark</span>
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="relative h-32">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-xs font-sans text-stone-400 dark:text-neutral-600">
                  <span>+100%</span>
                  <span>+50%</span>
                  <span>0%</span>
                </div>

                {/* Chart area */}
                <div className="ml-12 h-full flex items-end gap-1">
                  {currentResult.equityCurve.map((value, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                      {/* Strategy bar */}
                      <div
                        className={`w-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-500 ${
                          isVisible ? "opacity-100" : "opacity-0"
                        }`}
                        style={{
                          height: `${Math.max(0, ((value - 100) / 100) * 100)}%`,
                          transitionDelay: `${i * 50}ms`,
                        }}
                      />
                      {/* Benchmark line (flat 20% return) */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-px bg-stone-300 dark:bg-neutral-600"
                        style={{ bottom: "20%" }}
                      />
                    </div>
                  ))}
                </div>

                {/* X-axis labels */}
                <div className="ml-12 mt-2 flex justify-between text-xs font-sans text-stone-400 dark:text-neutral-600">
                  <span>T1</span>
                  <span>T3</span>
                  <span>T6</span>
                  <span>T9</span>
                  <span>T12</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card Footer */}
          <div className="px-6 py-4 border-t border-stone-200 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-900 flex items-center justify-between">
            <p className="font-sans text-sm text-stone-500 dark:text-neutral-500">
              * Kết quả dựa trên dữ liệu lịch sử, không đảm bảo lợi nhuận tương lai
            </p>
            <Link
              href="/dashboard"
              className="group flex items-center gap-2 font-sans text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
            >
              Chạy backtest của bạn
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
