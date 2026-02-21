import clsx from "clsx";

export type ReferenceType = "paper" | "book" | "web" | "dataset" | "other";

export interface ReferenceItem {
  id: string;
  type?: ReferenceType;
  authors?: string;
  year?: number;
  title: string;
  venue?: string;
  url?: string;
  doi?: string;
  notes?: string;
}

export interface ReferencesProps {
  items?: ReferenceItem[];
  className?: string;
  heading?: string;
}

function formatReference(ref: ReferenceItem): string {
  const parts: string[] = [];
  if (ref.authors) parts.push(ref.authors);
  if (typeof ref.year === "number") parts.push(`(${ref.year})`);
  parts.push(ref.title);
  if (ref.venue) parts.push(ref.venue);
  if (ref.doi) parts.push(`DOI: ${ref.doi}`);
  return parts.join(". ");
}

export function References({ items, className, heading = "References" }: ReferencesProps) {
  if (!items || items.length === 0) return null;

  return (
    <section className={clsx("mt-10", className)} aria-label={heading}>
      <h2 className="text-xl font-semibold">{heading}</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-200">
        {items.map((ref) => (
          <li key={ref.id} id={`ref-${ref.id}`}>
            <span className="font-medium">{formatReference(ref)}</span>
            {ref.url && (
              <>
                {" "}
                <a className="text-blue-700 hover:underline dark:text-blue-300" href={ref.url}>
                  {ref.url}
                </a>
              </>
            )}
            {ref.notes && <div className="mt-1 text-slate-600 dark:text-slate-300">{ref.notes}</div>}
          </li>
        ))}
      </ol>
    </section>
  );
}

