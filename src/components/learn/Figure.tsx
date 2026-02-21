import type { ReactNode } from "react";
import clsx from "clsx";

export interface FigureProps {
  src?: string;
  alt?: string;
  caption?: string;
  credit?: string;
  children?: ReactNode;
  className?: string;
}

export function Figure({ src, alt, caption, credit, children, className }: FigureProps) {
  const body =
    children ??
    (src ? (
      // Use <img> for maximum compatibility in MDX and to avoid requiring width/height.
      // If you need Next.js image optimization, wrap an <Image> in <Figure> as children instead.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        className="block h-auto w-full rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
      />
    ) : null);

  return (
    <figure className={clsx("my-8", className)}>
      {body}
      {(caption || credit) && (
        <figcaption className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {caption && <span className="font-medium text-slate-700 dark:text-slate-200">{caption}</span>}
          {credit && (
            <span className={clsx(caption ? "ml-2" : undefined)}>
              <span className="text-slate-400 dark:text-slate-500">·</span> {credit}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
