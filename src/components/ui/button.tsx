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

    // Base styles with smooth transitions for all properties - Editorial Fintech style
    const baseStyles = cn(
      "inline-flex items-center justify-center whitespace-nowrap font-sans font-semibold text-sm uppercase tracking-wider",
      "transition-[background-color,color,border-color,transform] duration-200 ease-out",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-400",
      "disabled:pointer-events-none disabled:opacity-50"
    );

    const variants = {
      default: cn(
        "bg-emerald-700 text-white",
        "hover:bg-emerald-800",
        "dark:bg-emerald-600 dark:hover:bg-emerald-500"
      ),
      destructive: cn(
        "bg-red-700 text-white",
        "hover:bg-red-800",
        "dark:bg-red-600 dark:hover:bg-red-700"
      ),
      outline: cn(
        "border-2 border-stone-900 bg-transparent text-stone-900",
        "hover:bg-stone-900 hover:text-white",
        "dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-stone-900"
      ),
      secondary: cn(
        "bg-stone-100 text-stone-900",
        "hover:bg-stone-200",
        "dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600"
      ),
      ghost: cn(
        "text-stone-700",
        "hover:bg-stone-100 hover:text-stone-900",
        "dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      ),
      link: cn(
        "text-emerald-700 underline-offset-4",
        "hover:underline hover:text-emerald-800",
        "dark:text-emerald-400 dark:hover:text-emerald-300"
      ),
    };

    const sizes = {
      default: "h-9 px-4 py-2",
      sm: "h-8 px-3 text-xs",
      lg: "h-10 px-8",
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
