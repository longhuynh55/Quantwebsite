"use client";

import { Database, Calendar, BarChart2, RefreshCw } from "lucide-react";

const stats = [
  {
    icon: Database,
    value: "400+",
    label: "Cổ Phiếu HOSE",
    description: "Tất cả mã niêm yết",
  },
  {
    icon: Calendar,
    value: "7",
    label: "Năm Dữ Liệu",
    description: "2018 - 2025",
  },
  {
    icon: BarChart2,
    value: "50+",
    label: "Chỉ Báo",
    description: "Kỹ thuật & cơ bản",
  },
  {
    icon: RefreshCw,
    value: "24H",
    label: "Cập Nhật",
    description: "Hàng ngày",
  },
];

export function DataCoverageSection() {
  return (
    <section className="py-20 bg-white dark:bg-neutral-950">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header - editorial style */}
        <div className="mb-16 pb-6 border-b border-stone-200 dark:border-neutral-800">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
            <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
              Độ Phủ Dữ Liệu
            </span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight">
            Dữ Liệu Thị Trường
            <br />
            <span className="text-emerald-700 dark:text-emerald-400">Toàn Diện</span>
          </h2>
          <p className="font-serif text-xl text-stone-600 dark:text-neutral-400 mt-4 max-w-2xl">
            Dữ liệu chất lượng cao từ HOSE, cập nhật hàng ngày. Tất cả những gì bạn cần
            để phân tích định lượng cổ phiếu Việt Nam.
          </p>
        </div>

        {/* Stats Grid - newspaper column style */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-stone-200 dark:bg-neutral-800">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-white dark:bg-neutral-950 p-8 text-center group hover:bg-stone-50 dark:hover:bg-neutral-900 transition-colors"
            >
              <div className="w-14 h-14 border border-stone-200 dark:border-neutral-700 flex items-center justify-center mx-auto mb-6 group-hover:border-emerald-700 dark:group-hover:border-emerald-500 transition-colors">
                <stat.icon className="w-7 h-7 text-stone-400 dark:text-neutral-500 group-hover:text-emerald-700 dark:group-hover:text-emerald-500 transition-colors" />
              </div>

              <div className="font-serif text-4xl font-bold text-stone-900 dark:text-white mb-2">
                {stat.value}
              </div>

              <div className="font-sans text-sm font-medium text-stone-900 dark:text-white mb-1">
                {stat.label}
              </div>

              <div className="font-sans text-sm text-stone-500 dark:text-neutral-500">
                {stat.description}
              </div>
            </div>
          ))}
        </div>

        {/* Data types - newspaper column style */}
        <div className="mt-16 grid md:grid-cols-3 gap-px bg-stone-200 dark:bg-neutral-800">
          <div className="bg-white dark:bg-neutral-950 p-8 hover:bg-stone-50 dark:hover:bg-neutral-900 transition-colors">
            <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-white mb-4">Dữ Liệu Giá</h3>
            <ul className="space-y-3 font-sans text-sm text-stone-600 dark:text-neutral-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-700 dark:bg-emerald-500" />
                Nến OHLCV hàng ngày
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-700 dark:bg-emerald-500" />
                Giá điều chỉnh cổ tức
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-700 dark:bg-emerald-500" />
                Bao gồm sự kiện doanh nghiệp
              </li>
            </ul>
          </div>
          <div className="bg-white dark:bg-neutral-950 p-8 hover:bg-stone-50 dark:hover:bg-neutral-900 transition-colors">
            <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-white mb-4">Dữ Liệu Cơ Bản</h3>
            <ul className="space-y-3 font-sans text-sm text-stone-600 dark:text-neutral-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-700 dark:bg-emerald-500" />
                Tỷ số P/E, P/B, ROE
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-700 dark:bg-emerald-500" />
                Tăng trưởng doanh thu & lợi nhuận
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-700 dark:bg-emerald-500" />
                Chỉ số nợ & dòng tiền
              </li>
            </ul>
          </div>
          <div className="bg-white dark:bg-neutral-950 p-8 hover:bg-stone-50 dark:hover:bg-neutral-900 transition-colors">
            <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-white mb-4">Chỉ Báo Kỹ Thuật</h3>
            <ul className="space-y-3 font-sans text-sm text-stone-600 dark:text-neutral-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-700 dark:bg-emerald-500" />
                Moving averages (SMA, EMA)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-700 dark:bg-emerald-500" />
                RSI, MACD, Bollinger Bands
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-700 dark:bg-emerald-500" />
                Chỉ báo khối lượng
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
