"use client";

import { GraduationCap, Database, Code2, Globe } from "lucide-react";

const credentials = [
  {
    icon: GraduationCap,
    label: "Đồ Án Tốt Nghiệp",
    value: "Khoa học Máy tính",
    sub: "HCMUS 2025",
  },
  {
    icon: Database,
    label: "Độ Phủ Dữ Liệu",
    value: "400+ Cổ Phiếu",
    sub: "7 năm lịch sử",
  },
  {
    icon: Code2,
    label: "Công Nghệ",
    value: "Next.js + TypeScript",
    sub: "AI/ML hiện đại",
  },
  {
    icon: Globe,
    label: "Thị Trường",
    value: "HOSE Độc Quyền",
    sub: "Chứng khoán Việt Nam",
  },
];

export function SocialProofSection() {
  return (
    <section className="py-20 bg-stone-100 dark:bg-neutral-900">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header - editorial style */}
        <div className="text-center mb-12 pb-6 border-b border-stone-300 dark:border-neutral-700">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
            <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
              Theo Con Số
            </span>
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
          </div>
        </div>

        {/* Credentials grid - newspaper column style */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-stone-200 dark:bg-neutral-800">
          {credentials.map((item, index) => (
            <div key={index} className="bg-stone-100 dark:bg-neutral-900 p-8 text-center group hover:bg-white dark:hover:bg-neutral-950 transition-colors">
              <div className="w-12 h-12 border border-stone-200 dark:border-neutral-700 flex items-center justify-center mx-auto mb-4 group-hover:border-emerald-700 dark:group-hover:border-emerald-500 transition-colors">
                <item.icon className="w-6 h-6 text-emerald-700 dark:text-emerald-500" />
              </div>
              <div className="text-xs font-sans uppercase tracking-wider text-stone-500 dark:text-neutral-500 mb-2">
                {item.label}
              </div>
              <div className="font-serif text-xl lg:text-2xl font-bold text-stone-900 dark:text-white mb-1">
                {item.value}
              </div>
              <div className="text-sm font-sans text-stone-600 dark:text-neutral-400">
                {item.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Academic note */}
        <div className="mt-16 max-w-2xl mx-auto text-center">
          <div className="border border-stone-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-8">
            <p className="font-serif text-lg italic text-stone-700 dark:text-neutral-300 leading-relaxed">
              &quot;Dự án nghiên cứu ứng dụng phân tích định lượng
              cho thị trường chứng khoán Việt Nam.&quot;
            </p>
            <p className="mt-4 text-xs font-sans uppercase tracking-wider text-stone-500 dark:text-neutral-500">
              — Đồ Án Tốt Nghiệp, HCMUS 2025
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
