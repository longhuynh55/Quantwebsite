"use client";

import { Users, Activity, Server } from "lucide-react";
import { AnimatedCounter } from "../ui";

const stats = [
  {
    icon: Users,
    value: 1200,
    suffix: "+",
    label: "Người dùng",
    description: "Nhà đầu tư đang sử dụng",
  },
  {
    icon: Activity,
    value: 500000,
    suffix: "+",
    label: "Phân tích đã chạy",
    description: "Backtests và screeners",
  },
  {
    icon: Server,
    value: 99.9,
    suffix: "%",
    label: "Uptime",
    description: "Server luôn sẵn sàng",
  },
];

export function StatsSection() {
  return (
    <section className="py-16 bg-emerald-700 dark:bg-emerald-900">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-px bg-emerald-600 dark:bg-emerald-800">
          {stats.map((stat, index) => (
            <div key={index} className="bg-emerald-700 dark:bg-emerald-900 p-8 text-center group hover:bg-emerald-800 dark:hover:bg-emerald-950 transition-colors">
              <div className="w-12 h-12 border border-emerald-500 flex items-center justify-center mx-auto mb-4 group-hover:border-white transition-colors">
                <stat.icon className="w-6 h-6 text-emerald-300 group-hover:text-white transition-colors" />
              </div>

              <div className="font-serif text-4xl font-bold text-white mb-2 tabular-nums">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} formatNumber={true} />
              </div>

              <div className="font-sans text-lg font-medium text-emerald-100 mb-1">{stat.label}</div>
              <div className="font-sans text-sm text-emerald-300">{stat.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
