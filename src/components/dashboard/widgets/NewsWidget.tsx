"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ExternalLink, Clock } from "lucide-react";

// Mock data - in production this would come from API
const MOCK_NEWS = [
  {
    id: 1,
    title: "VN-Index tiếp tục tăng phiên thứ 5 liên tiếp",
    summary: "Thị trường chứng khoán Việt Nam duy trì đà tăng với thanh khoản cải thiện...",
    source: "Cafef",
    time: "2 giờ trước",
    category: "market",
  },
  {
    id: 2,
    title: "Ngân hàng Nhà nước tiếp tục giảm lãi suất điều hành",
    summary: "Động thái này nhằm hỗ trợ tăng trưởng kinh tế trong năm 2026...",
    source: "VnEconomy",
    time: "4 giờ trước",
    category: "economy",
  },
  {
    id: 3,
    title: "VIC công bố kết quả kinh doanh Q4/2025 vượt kỳ vọng",
    summary: "Doanh thu quý 4 tăng 25% so với cùng kỳ năm trước...",
    source: "Vietstock",
    time: "5 giờ trước",
    category: "company",
  },
  {
    id: 4,
    title: "Khối ngoại tiếp tục mua ròng phiên thứ 3",
    summary: "Nộp ròng hôm nay đạt 250 tỷ đồng, tập trung vào nhóm blue-chip...",
    source: "TBTC",
    time: "6 giờ trước",
    category: "market",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  market: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  economy: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  company: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  market: "Thị trường",
  economy: "Kinh tế",
  company: "Doanh nghiệp",
};

// Memoized news card component
const NewsCard = React.memo(function NewsCard({
  news,
}: {
  news: (typeof MOCK_NEWS)[0];
}) {
  const categoryColor = CATEGORY_COLORS[news.category] || CATEGORY_COLORS.market;
  const categoryLabel = CATEGORY_LABELS[news.category] || news.category;

  return (
    <article className="p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group">
      {/* Category & Time */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium",
            categoryColor
          )}
        >
          {categoryLabel}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
          <Clock className="h-3 w-3" />
          {news.time}
        </span>
      </div>

      {/* Title */}
      <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {news.title}
      </h4>

      {/* Summary */}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
        {news.summary}
      </p>

      {/* Source */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {news.source}
        </span>
        <ExternalLink className="h-3 w-3 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </article>
  );
});

function NewsWidgetBase() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto space-y-3">
        {MOCK_NEWS.map((news) => (
          <NewsCard key={news.id} news={news} />
        ))}
      </div>

      {/* Footer */}
      <button className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline text-center w-full">
        Xem tất cả tin tức
      </button>
    </div>
  );
}

export const NewsWidget = React.memo(NewsWidgetBase);
