import clsx from "clsx";

export type TocDepth = 2 | 3;

export interface TocItem {
  id: string;
  text: string;
  depth: TocDepth;
}

export interface ToCProps {
  items: TocItem[];
  className?: string;
  title?: string;
}

export function ToC({ items, className, title = "On this page" }: ToCProps) {
  if (items.length === 0) return null;

  return (
    <nav className={clsx("rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950", className)} aria-label="Table of contents">
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
        {items.map((item) => (
          <li key={item.id} className={clsx(item.depth === 3 ? "pl-4" : undefined)}>
            <a className="hover:underline" href={`#${item.id}`}>
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

