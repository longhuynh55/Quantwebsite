import type { ReactNode } from "react";
import React from "react";
import clsx from "clsx";

export interface TableProps {
  caption?: string;
  children: ReactNode;
  className?: string;
}

function styleTableChild(node: ReactNode): ReactNode {
  if (!React.isValidElement(node)) return node;
  if (node.type !== "table") return node;
  const tableNode = node as React.ReactElement<React.TableHTMLAttributes<HTMLTableElement>>;

  const nextClassName = clsx(
    "w-full border-collapse text-sm",
    "border border-slate-200 dark:border-slate-700",
    tableNode.props.className,
  );

  return React.cloneElement(tableNode, { className: nextClassName });
}

export function Table({ caption, children, className }: TableProps) {
  const styled = styleTableChild(children);

  return (
    <figure className={clsx("my-8", className)}>
      {caption && (
        <figcaption className="mb-3 text-sm font-medium leading-6 text-slate-700 dark:text-slate-200">
          {caption}
        </figcaption>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
        <div className="min-w-[640px] p-3 [&_th]:bg-slate-50 [&_th]:text-left [&_th]:font-semibold [&_th]:text-slate-900 [&_th]:dark:bg-slate-900/50 [&_th]:dark:text-slate-50 [&_td]:align-top [&_td]:text-slate-700 [&_td]:dark:text-slate-200 [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2 [&_tr]:border-b [&_tr]:border-slate-200 [&_tr]:dark:border-slate-700">
          {styled}
        </div>
      </div>
    </figure>
  );
}
