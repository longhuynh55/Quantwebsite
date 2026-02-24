import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label for screen readers when visual label is not present */
  ariaLabel?: string;
  /** ID of element that describes error state for this input */
  errorId?: string;
}

/**
 * Input component with proper accessibility support.
 * - Supports `id` for label association
 * - Supports `aria-label` for standalone inputs
 * - Supports `aria-describedby` for error messages
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ariaLabel, errorId, id, ...props }, ref) => {
    return (
      <input
        type={type}
        id={id}
        className={cn(
          "flex h-9 w-full border border-stone-300 bg-transparent px-3 py-1 text-sm font-sans transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-stone-950 placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:file:text-neutral-200 dark:placeholder:text-neutral-500 dark:focus-visible:ring-emerald-400",
          className
        )}
        ref={ref}
        aria-label={ariaLabel}
        aria-describedby={errorId}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
