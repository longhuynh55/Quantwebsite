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
          "flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-gray-950 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:file:text-gray-200 dark:placeholder:text-gray-500 dark:focus-visible:ring-gray-300",
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
