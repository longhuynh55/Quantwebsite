"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

interface SectionBackgroundProps {
  readonly variant?: "white" | "gray" | "dark" | "accent";
  readonly className?: string;
  readonly children?: React.ReactNode;
}

/**
 * Clean, solid color backgrounds - NO gradients
 * Inspired by composer.trade's minimalist aesthetic
 */
export const SectionBackground = memo(function SectionBackground({
  variant = "white",
  className,
  children,
}: SectionBackgroundProps) {
  const variants = {
    white: "bg-white dark:bg-slate-950",
    gray: "bg-neutral-50 dark:bg-slate-900",
    dark: "bg-neutral-950 dark:bg-black text-white",
    accent: "bg-emerald-600 dark:bg-emerald-700 text-white",
  };

  return (
    <div className={cn("relative", variants[variant], className)}>
      <div className="relative z-10">{children}</div>
    </div>
  );
});
