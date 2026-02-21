import type { ReactNode } from "react";
import { AlertTriangle, BookOpen, Info, Lightbulb, Pencil } from "lucide-react";
import clsx from "clsx";

export type CalloutType = "note" | "tip" | "warning" | "definition" | "example";

export interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
  className?: string;
}

const TYPE_META: Record<
  CalloutType,
  {
    icon: typeof Info;
    defaultTitle: string;
    className: string;
  }
> = {
  note: {
    icon: Info,
    defaultTitle: "Note",
    className: "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-50",
  },
  tip: {
    icon: Lightbulb,
    defaultTitle: "Tip",
    className: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-50",
  },
  warning: {
    icon: AlertTriangle,
    defaultTitle: "Warning",
    className: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-50",
  },
  definition: {
    icon: BookOpen,
    defaultTitle: "Definition",
    className: "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-50",
  },
  example: {
    icon: Pencil,
    defaultTitle: "Example",
    className: "border-purple-200 bg-purple-50 text-purple-950 dark:border-purple-900/60 dark:bg-purple-950/25 dark:text-purple-50",
  },
};

export function Callout({ type = "note", title, children, className }: CalloutProps) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;

  return (
    <aside
      role="note"
      className={clsx(
        "my-6 rounded-lg border p-4",
        meta.className,
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 opacity-90" aria-hidden="true" />
        <div className="min-w-0">
          <div className="font-semibold">{title ?? meta.defaultTitle}</div>
          <div className="mt-2 text-sm leading-6">{children}</div>
        </div>
      </div>
    </aside>
  );
}

