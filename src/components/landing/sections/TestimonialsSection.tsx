"use client";

import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { useState } from "react";

const testimonials = [
  {
    quote: "QuantVN giúp tôi tiết kiệm 3 giờ mỗi ngày. Chiến lược MA crossover đã giúp tôi đạt 15% lợi nhuận trong 6 tháng.",
    author: "Trần Minh Tuấn",
    role: "Nhà đầu tư cá nhân",
    experience: "3 năm kinh nghiệm",
    location: "TP. Hồ Chí Minh",
  },
  {
    quote: "AI Assistant rất hữu ích. Tôi chỉ cần hỏi và nhận câu trả lời ngay về các chỉ số tài chính. Tiết kiệm rất nhiều thời gian nghiên cứu.",
    author: "Nguyễn Thị Mai",
    role: "Giám đốc tài chính",
    experience: "10 năm kinh nghiệm",
    location: "Hà Nội",
  },
  {
    quote: "Backtesting engine rất mạnh. Tôi có thể test nhiều chiến lược cùng lúc và so sánh kết quả. Đáng đồng tiền bát gạo.",
    author: "Lê Văn Đức",
    role: "Trader chuyên nghiệp",
    experience: "5 năm kinh nghiệm",
    location: "Đà Nẵng",
  },
  {
    quote: "Giao diện chuyên nghiệp, dễ sử dụng. Screener có nhiều tiêu chí hơn các tool khác trên thị trường.",
    author: "Phạm Thanh Hằng",
    role: "Nhà đầu tư cá nhân",
    experience: "2 năm kinh nghiệm",
    location: "TP. Hồ Chí Minh",
  },
];

export function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };

  return (
    <section className="py-20 bg-stone-50 dark:bg-neutral-900">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header - editorial style */}
        <div className="mb-16 pb-6 border-b border-stone-200 dark:border-neutral-800">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
            <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
              Đánh Giá
            </span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight">
            Người Dùng Nói Gì
            <br />
            <span className="text-emerald-700 dark:text-emerald-400">Về QuantVN</span>
          </h2>
          <p className="font-serif text-xl text-stone-600 dark:text-neutral-400 mt-4">
            Hơn 1,200 nhà đầu tư đang tin dùng
          </p>
        </div>

        {/* Testimonials - Desktop Grid */}
        <div className="hidden md:grid md:grid-cols-2 gap-px bg-stone-200 dark:bg-neutral-800">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-white dark:bg-neutral-950 p-8 group hover:bg-stone-50 dark:hover:bg-neutral-900 transition-colors"
            >
              <Quote className="w-8 h-8 text-emerald-200 dark:text-emerald-900 mb-4" />
              <p className="font-serif text-lg text-stone-700 dark:text-neutral-300 leading-relaxed mb-6 italic">
                &quot;{testimonial.quote}&quot;
              </p>
              <div className="border-t border-stone-100 dark:border-neutral-800 pt-4">
                <div className="font-sans font-bold text-stone-900 dark:text-white">
                  {testimonial.author}
                </div>
                <div className="font-sans text-sm text-stone-500 dark:text-neutral-500">
                  {testimonial.role} • {testimonial.location}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Testimonials - Mobile Carousel */}
        <div className="md:hidden">
          <div className="bg-white dark:bg-neutral-950 p-8 border border-stone-200 dark:border-neutral-800">
            <Quote className="w-8 h-8 text-emerald-200 dark:text-emerald-900 mb-4" />
            <p className="font-serif text-lg text-stone-700 dark:text-neutral-300 leading-relaxed mb-6 italic">
              &quot;{testimonials[currentIndex].quote}&quot;
            </p>
            <div className="border-t border-stone-100 dark:border-neutral-800 pt-4">
              <div className="font-sans font-bold text-stone-900 dark:text-white">
                {testimonials[currentIndex].author}
              </div>
              <div className="font-sans text-sm text-stone-500 dark:text-neutral-500">
                {testimonials[currentIndex].role} • {testimonials[currentIndex].location}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={handlePrev}
              className="p-2 border border-stone-200 dark:border-neutral-700 hover:border-emerald-700 dark:hover:border-emerald-500 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-stone-600 dark:text-neutral-400" />
            </button>

            <div className="flex gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 transition-colors ${
                    index === currentIndex
                      ? "bg-emerald-700 dark:bg-emerald-500"
                      : "bg-stone-300 dark:bg-neutral-600"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="p-2 border border-stone-200 dark:border-neutral-700 hover:border-emerald-700 dark:hover:border-emerald-500 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-stone-600 dark:text-neutral-400" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
