"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ExternalLink, Clock } from "lucide-react";

const MOCK_NEWS = [
  {
    id: 1,
    title: "VN-Index extends gains for a fifth straight session",
    summary: "Vietnam equities continue to rise with stronger liquidity and broad participation.",
    source: "Cafef",
    time: "2h ago",
    category: "market",
  },
  {
    id: 2,
    title: "State Bank keeps policy rates accommodative",
    summary: "The latest guidance aims to support growth momentum through 2026.",
    source: "VnEconomy",
    time: "4h ago",
    category: "economy",
  },
  {
    id: 3,
    title: "VIC posts Q4 earnings above consensus",
    summary: "Revenue growth accelerated year-over-year with margin expansion.",
    source: "Vietstock",
    time: "5h ago",
    category: "company",
  },
  {
    id: 4,
    title: "Foreign investors remain net buyers",
    summary: "Net inflow reached 250B VND, concentrated in large-cap names.",
    source: "TBTC",
    time: "6h ago",
    category: "market",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  market: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  economy: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  company: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  market: "Market",
  economy: "Economy",
  company: "Company",
};

const NewsCard = React.memo(function NewsCard({
  news,
}: {
  news: (typeof MOCK_NEWS)[0];
}) {
  const categoryColor = CATEGORY_COLORS[news.category] || CATEGORY_COLORS.market;
  const categoryLabel = CATEGORY_LABELS[news.category] || news.category;

  return (
    <article className="group cursor-pointer rounded-lg p-3 transition-colors hover:bg-stone-100 dark:hover:bg-neutral-900/60">
      <div className="mb-1.5 flex items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", categoryColor)}>{categoryLabel}</span>
        <span className="flex items-center gap-1 text-xs text-stone-500 dark:text-neutral-500">
          <Clock className="h-3 w-3" />
          {news.time}
        </span>
      </div>

      <h4 className="line-clamp-2 text-sm font-medium text-stone-900 transition-colors group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
        {news.title}
      </h4>

      <p className="mt-1 line-clamp-2 text-xs text-stone-600 dark:text-neutral-400">{news.summary}</p>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-stone-500 dark:text-neutral-500">{news.source}</span>
        <ExternalLink className="h-3 w-3 text-stone-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-neutral-600" />
      </div>
    </article>
  );
});

function NewsWidgetBase() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-auto">
        {MOCK_NEWS.map((news) => (
          <NewsCard key={news.id} news={news} />
        ))}
      </div>

      <button className="mt-4 w-full text-center text-sm text-emerald-700 hover:underline dark:text-emerald-400">
        View all news
      </button>
    </div>
  );
}

export const NewsWidget = React.memo(NewsWidgetBase);
