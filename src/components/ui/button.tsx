import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

/**
 * Button - Primary button component with variants and sizes
 *
 * Supports multiple visual variants (default, destructive, outline, secondary, ghost, link)
 * and sizes (default, sm, lg, icon).
 *
 * @accessibility
 * - All buttons should have discernible text or an aria-label
 * - **Icon buttons (size="icon") MUST have an aria-label or aria-labelledby attribute**
 * - Focus states are visible with ring styling
 * - Disabled state is properly announced
 *
 * @example
 * ```tsx
 * // Standard button with text
 * <Button>Click me</Button>
 *
 * // Icon button - MUST have aria-label
 * <Button size="icon" aria-label="Open menu">
 *   <MenuIcon />
 * </Button>
 * ```
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    // In development, throw error if icon button without aria-label
    if (process.env.NODE_ENV === 'development' && size === 'icon') {
      const hasAriaLabel = Boolean(props['aria-label'] || props['aria-labelledby']);
      if (!hasAriaLabel) {
        throw new Error(
          'Accessibility Error: Icon button MUST have an aria-label or aria-labelledby attribute. ' +
          'Icon-only buttons provide no context for screen reader users without an accessible name.\n' +
          'Example: <Button size="icon" aria-label="Open menu"><MenuIcon /></Button>'
        );
      }
    }

    // Base styles with smooth transitions for all properties
    const baseStyles = cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium",
      "transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-out",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      "disabled:pointer-events-none disabled:opacity-50",
      // Subtle transform on hover for "lift" effect
      "hover:-translate-y-px active:translate-y-0"
    );

    const variants = {
      default: cn(
        "bg-blue-600 text-white shadow-md",
        "hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/25",
        "dark:bg-blue-500 dark:hover:bg-blue-600 dark:hover:shadow-blue-500/25"
      ),
      destructive: cn(
        "bg-red-500 text-white shadow-sm",
        "hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/25",
        "dark:bg-red-600 dark:hover:bg-red-700 dark:hover:shadow-red-600/25"
      ),
      outline: cn(
        "border border-gray-300 bg-white shadow-sm text-gray-700",
        "hover:bg-gray-50 hover:border-gray-400 hover:shadow-md",
        "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200",
        "dark:hover:bg-gray-700 dark:hover:border-gray-500"
      ),
      secondary: cn(
        "bg-gray-100 text-gray-900 shadow-sm",
        "hover:bg-gray-200 hover:shadow-md",
        "dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
      ),
      ghost: cn(
        "text-gray-700",
        "hover:bg-gray-100 hover:text-gray-900",
        "dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
      ),
      link: cn(
        "text-blue-600 underline-offset-4",
        "hover:underline hover:text-blue-700",
        "dark:text-blue-400 dark:hover:text-blue-300"
      ),
    };

    const sizes = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-10 rounded-md px-8",
      icon: "h-9 w-9",
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
