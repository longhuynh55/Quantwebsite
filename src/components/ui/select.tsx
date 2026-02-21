import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  /** Label for screen readers when visual label is not present */
  ariaLabel?: string;
  /** ID of element that describes error state for this select */
  errorId?: string;
}

/**
 * Select component with proper accessibility support.
 * - Supports `id` for label association
 * - Supports `aria-label` for standalone selects
 * - Supports `aria-describedby` for error messages
 * - Validates option values are non-empty strings
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, ariaLabel, errorId, id, ...props }, ref) => {
    return (
      <select
        id={id}
        className={cn(
          "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm shadow-sm ring-offset-white dark:ring-offset-gray-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50 text-gray-900 dark:text-gray-100",
          className
        )}
        ref={ref}
        aria-label={ariaLabel}
        aria-describedby={errorId}
        {...props}
      >
        {options.map((option) => {
          // Validate option value is a non-empty string
          const optionValue = String(option.value ?? "");
          return (
            <option
              key={optionValue || `option-${option.label}`}
              value={optionValue}
              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {option.label}
            </option>
          );
        })}
      </select>
    );
  }
);
Select.displayName = "Select";

export { Select };
