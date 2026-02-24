"use client";

import { useEffect, useState, useRef } from "react";
import { TrendingUp, Database, BarChart3, Cpu } from "lucide-react";

const stats = [
  {
    icon: TrendingUp,
    value: 400,
    suffix: "+",
    label: "Cổ phiếu",
    sublabel: "HOSE coverage",
    color: "emerald",
  },
  {
    icon: Database,
    value: 7,
    suffix: " năm",
    label: "Dữ liệu lịch sử",
    sublabel: "Complete records",
    color: "teal",
  },
  {
    icon: BarChart3,
    value: 50,
    suffix: "+",
    label: "Chỉ báo kỹ thuật",
    sublabel: "Available filters",
    color: "blue",
  },
  {
    icon: Cpu,
    value: 1,
    suffix: " AI",
    label: "Assistant tiếng Việt",
    sublabel: "Ready to help",
    color: "violet",
  },
];

export function TrustNumbersBar() {
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
    <section ref={sectionRef} className="py-16 bg-white dark:bg-neutral-950 border-y border-stone-200 dark:border-neutral-800">
      <div className="max-w-6xl mx-auto px-6">
        {/* Editorial style header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="w-12 h-px bg-stone-300 dark:bg-neutral-700" />
            <span className="text-xs font-sans uppercase tracking-[0.2em] text-stone-500 dark:text-neutral-500">
              Số Liệu Thống Kê
            </span>
            <span className="w-12 h-px bg-stone-300 dark:bg-neutral-700" />
          </div>
          <h3 className="font-serif text-2xl font-bold text-stone-900 dark:text-white">
            Được Xây Dựng Cho Thị Trường Việt Nam
          </h3>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-stone-200 dark:bg-neutral-800">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={`bg-white dark:bg-neutral-950 p-6 text-center transition-all duration-700 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              {/* Icon */}
              <div className="flex justify-center mb-3">
                <div
                  className={`w-10 h-10 border flex items-center justify-center ${
                    stat.color === "emerald"
                      ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30"
                      : stat.color === "teal"
                      ? "border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950/30"
                      : stat.color === "blue"
                      ? "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30"
                      : "border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/30"
                  }`}
                >
                  <stat.icon
                    className={`w-5 h-5 ${
                      stat.color === "emerald"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : stat.color === "teal"
                        ? "text-teal-600 dark:text-teal-400"
                        : stat.color === "blue"
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-violet-600 dark:text-violet-400"
                    }`}
                  />
                </div>
              </div>

              {/* Animated Number */}
              <AnimatedNumber
                value={stat.value}
                suffix={stat.suffix}
                isVisible={isVisible}
                delay={index * 100}
              />

              {/* Label */}
              <div className="font-sans text-sm font-medium text-stone-900 dark:text-white mt-2">
                {stat.label}
              </div>
              <div className="font-sans text-xs text-stone-500 dark:text-neutral-500">
                {stat.sublabel}
              </div>
            </div>
          ))}
        </div>

        {/* Academic Badge */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 border border-stone-200 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-900">
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
            <div className="text-left">
              <div className="font-sans text-sm font-medium text-stone-900 dark:text-white">
                Graduation Thesis Project
              </div>
              <div className="font-sans text-xs text-stone-500 dark:text-neutral-500">
                UEL FinTech 2026 — ĐH Kinh tế - Luật
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Animated counter component
function AnimatedNumber({
  value,
  suffix,
  isVisible,
  delay,
}: {
  value: number;
  suffix: string;
  isVisible: boolean;
  delay: number;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    const timeout = setTimeout(() => {
      let startTime: number;
      let animationFrame: number;
      const duration = 1500;

      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);

        // Easing
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        setCount(Math.floor(easeOutQuart * value));

        if (progress < 1) {
          animationFrame = requestAnimationFrame(animate);
        }
      };

      animationFrame = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationFrame);
    }, delay);

    return () => clearTimeout(timeout);
  }, [isVisible, value, delay]);

  return (
    <div className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white tabular-nums">
      {count}
      {suffix}
    </div>
  );
}
