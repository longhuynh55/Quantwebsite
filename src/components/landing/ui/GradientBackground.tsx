"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

interface GradientBackgroundProps {
  readonly variant?: "hero" | "section" | "cta";
  readonly className?: string;
  readonly children?: React.ReactNode;
}

export const GradientBackground = memo(function GradientBackground({
  variant = "section",
  className,
  children,
}: GradientBackgroundProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Background layers */}
      {variant === "hero" && (
        <>
          {/* Mesh gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

          {/* Animated gradient blobs */}
          <div
            className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/30 dark:bg-blue-600/20 rounded-full blur-3xl"
            style={{
              animation: "blob 7s infinite",
            }}
          />
          <div
            className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-400/30 dark:bg-violet-600/20 rounded-full blur-3xl"
            style={{
              animation: "blob 7s infinite 3.5s",
            }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-400/20 dark:bg-pink-600/10 rounded-full blur-3xl"
            style={{
              animation: "blob 10s infinite 2s",
            }}
          />

          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]"
            style={{
              backgroundImage: `
                linear-gradient(to right, currentColor 1px, transparent 1px),
                linear-gradient(to bottom, currentColor 1px, transparent 1px)
              `,
              backgroundSize: "60px 60px",
            }}
          />

          {/* Radial gradient overlay for depth */}
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(circle at 50% 50%, transparent 0%, rgba(255,255,255,0.5) 100%)",
            }}
          />
        </>
      )}

      {variant === "section" && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-white dark:from-slate-900 dark:to-slate-950" />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-blue-500/5 to-violet-500/5 rounded-full blur-3xl"
            style={{
              animation: "pulse-slow 8s ease-in-out infinite",
            }}
          />
        </>
      )}

      {variant === "cta" && (
        <>
          {/* Animated gradient */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-blue-600 via-violet-600 to-purple-700"
            style={{
              backgroundSize: "200% 200%",
              animation: "gradient-shift 8s ease infinite",
            }}
          />

          {/* Dot pattern */}
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='30' height='30' viewBox='0 0 30 30' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='15' cy='15' r='1' fill='rgba(255,255,255,0.07)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Glow effects */}
          <div
            className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"
            style={{
              animation: "float 6s ease-in-out infinite",
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl"
            style={{
              animation: "float 6s ease-in-out infinite 3s",
            }}
          />
        </>
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
});
