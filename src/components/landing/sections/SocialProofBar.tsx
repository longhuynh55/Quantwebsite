"use client";

import { TrendingUp, Clock, Database, Shield } from "lucide-react";

const stats = [
  {
    icon: TrendingUp,
    value: "400+",
    label: "Stock Symbols",
    sublabel: "HOSE coverage",
  },
  {
    icon: Clock,
    value: "7 Years",
    label: "Historical Data",
    sublabel: "Complete records",
  },
  {
    icon: Database,
    value: "50+",
    label: "Screening Criteria",
    sublabel: "Available filters",
  },
  {
    icon: Shield,
    value: "99.9%",
    label: "Uptime",
    sublabel: "Reliability",
  },
];

export function SocialProofBar() {
  return (
    <section className="py-12 bg-white dark:bg-slate-950 border-y border-gray-100 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-violet-100 dark:from-blue-900/30 dark:to-violet-900/30 rounded-lg flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {stat.value}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-500">{stat.sublabel}</div>
            </div>
          ))}
        </div>

        {/* University badge - for thesis context */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-50 dark:bg-violet-900/20 rounded-full text-violet-700 dark:text-violet-300 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
            Graduation Thesis Project — Quantitative Finance Research
          </div>
        </div>
      </div>
    </section>
  );
}
