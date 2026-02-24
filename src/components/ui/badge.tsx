import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-emerald-700 text-white hover:bg-emerald-700/85 dark:bg-emerald-600 dark:hover:bg-emerald-500",
    secondary: "bg-stone-100 text-stone-900 hover:bg-stone-100/80 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700",
    destructive: "bg-red-500 text-white hover:bg-red-500/80",
    outline: "text-stone-900 border border-stone-300 dark:text-neutral-100 dark:border-neutral-700",
    success: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100/80 dark:bg-emerald-950/50 dark:text-emerald-200",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-700 dark:focus:ring-emerald-400 focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
