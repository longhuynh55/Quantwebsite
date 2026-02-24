"use client";

import { GraduationCap, Code2 } from "lucide-react";

export function TrustLogos({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-center gap-6 mb-6">
        {/* University/Thesis badge */}
        <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-700 px-4 py-2">
          <GraduationCap className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Graduation Thesis
          </span>
        </div>

        {/* Tech stack badge */}
        <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-700 px-4 py-2">
          <Code2 className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Next.js + TypeScript
          </span>
        </div>
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-500 mb-6 text-center uppercase tracking-wider">
        Built with modern web technologies
      </p>

      {/* Tech logos */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {[
          { name: "Next.js", abbr: "Next" },
          { name: "TypeScript", abbr: "TS" },
          { name: "Tailwind", abbr: "TW" },
          { name: "Recharts", abbr: "RC" },
          { name: "Zustand", abbr: "ZU" },
        ].map((tech) => (
          <div
            key={tech.name}
            className="w-14 h-8 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-xs font-medium text-neutral-400 dark:text-neutral-500 hover:border-emerald-600 hover:text-emerald-600 transition-colors"
            title={tech.name}
          >
            {tech.abbr}
          </div>
        ))}
      </div>
    </div>
  );
}
