import clsx from "clsx";

export interface CiteProps {
  id: string;
  label?: string;
  className?: string;
}

export function Cite({ id, label, className }: CiteProps) {
  const text = label ?? id;
  return (
    <a
      href={`#ref-${id}`}
      className={clsx(
        "whitespace-nowrap rounded px-1 py-0.5 text-xs font-medium text-slate-700 hover:underline dark:text-slate-300",
        className,
      )}
    >
      [{text}]
    </a>
  );
}

