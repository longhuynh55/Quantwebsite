"use client";

import { Sparkles, MessageSquare, Zap, Globe, Brain } from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "Hội Thoại Tự Nhiên",
    description: "Hỏi đáp bằng tiếng Việt về bất kỳ cổ phiếu",
  },
  {
    icon: Zap,
    title: "Phản Hồi Tức Thì",
    description: "AI phân tích và trả lời trong vài giây",
  },
  {
    icon: Globe,
    title: "Tập Trung Việt Nam",
    description: "Được huấn luyện riêng trên dữ liệu HOSE",
  },
  {
    icon: Brain,
    title: "Gợi Ý Thông Minh",
    description: "Đề xuất chiến lược theo hồ sơ rủi ro",
  },
];

const exampleQueries = [
  "Tìm cổ phiếu P/E thấp ngành bất động sản",
  "Backtest MA crossover cho VNM",
  "So sánh FPT và CMG",
  "Phân tích kỹ thuật cho HPG",
];

export function AIAssistantPreviewSection() {
  return (
    <section className="py-20 bg-stone-50 dark:bg-neutral-900">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
              <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
                AI Assistant
              </span>
            </div>

            <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight mb-6">
              Trợ Lý AI
              <br />
              <span className="text-emerald-700 dark:text-emerald-400">Tiếng Việt</span>
            </h2>

            <p className="font-serif text-xl text-stone-600 dark:text-neutral-400 mb-10 leading-relaxed">
              Hỗ trợ tiếng Việt bản địa với hiểu biết về ngữ cảnh thị trường địa phương.
              Hỏi đáp tự nhiên, nhận phân tích tức thì.
            </p>

            {/* Features grid */}
            <div className="grid sm:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="w-10 h-10 border border-stone-200 dark:border-neutral-700 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-5 h-5 text-emerald-700 dark:text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-stone-900 dark:text-white mb-1">
                      {feature.title}
                    </h3>
                    <p className="font-sans text-sm text-stone-500 dark:text-neutral-500">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Chat Preview - editorial style */}
          <div className="border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-stone-200 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-900 flex items-center gap-4">
              <div className="w-10 h-10 border border-emerald-700 dark:border-emerald-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-emerald-700 dark:text-emerald-500" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-stone-900 dark:text-white">QuantVN AI Assistant</h3>
                <p className="font-sans text-xs text-stone-500 dark:text-neutral-500">Hỗ trợ tiếng Việt • Phản hồi tức thì</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-600 rounded-full" />
                <span className="font-sans text-xs text-stone-500 dark:text-neutral-500">Online</span>
              </div>
            </div>

            {/* Chat messages preview */}
            <div className="p-6 space-y-4">
              {/* User message */}
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-stone-900 dark:bg-white text-white dark:text-stone-900 px-4 py-3 font-sans text-sm">
                  Tìm cổ phiếu P/E thấp nhất ngành bất động sản
                </div>
              </div>

              {/* AI response */}
              <div className="flex gap-3">
                <div className="w-8 h-8 border border-emerald-700 dark:border-emerald-500 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-500" />
                </div>
                <div className="flex-1 border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3 font-sans text-sm">
                  <p className="text-stone-700 dark:text-neutral-300 mb-3">
                    Tôi tìm thấy các cổ phiếu bất động sản có P/E thấp nhất:
                  </p>
                  <div className="space-y-2">
                    {[
                      { symbol: "VHM", pe: "5.2", roe: "18%" },
                      { symbol: "NLG", pe: "6.8", roe: "15%" },
                      { symbol: "VIC", pe: "12.8", roe: "15%" },
                    ].map((stock, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 border border-stone-100 dark:border-neutral-800"
                      >
                        <span className="font-sans font-medium text-stone-900 dark:text-white">{stock.symbol}</span>
                        <div className="flex gap-4 text-xs">
                          <span className="font-sans text-stone-500 dark:text-neutral-500">P/E: {stock.pe}</span>
                          <span className="font-sans text-emerald-700 dark:text-emerald-400">ROE: {stock.roe}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Input placeholder */}
              <div className="pt-4 border-t border-stone-200 dark:border-neutral-800">
                <div className="flex gap-2">
                  <div className="flex-1 px-4 py-3 border border-stone-200 dark:border-neutral-700 text-stone-400 dark:text-neutral-500 font-sans text-sm">
                    Hỏi AI về cổ phiếu...
                  </div>
                  <div className="px-4 py-3 bg-emerald-700 dark:bg-emerald-600 text-white">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Example queries */}
        <div className="mt-12 pt-12 border-t border-stone-200 dark:border-neutral-800">
          <p className="font-sans text-sm text-stone-500 dark:text-neutral-500 mb-4">Câu hỏi mẫu:</p>
          <div className="flex flex-wrap gap-3">
            {exampleQueries.map((query, index) => (
              <span
                key={index}
                className="px-4 py-2 border border-stone-200 dark:border-neutral-700 text-stone-600 dark:text-neutral-400 font-sans text-sm hover:border-emerald-700 dark:hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer"
              >
                {query}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
