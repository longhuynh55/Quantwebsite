"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'checked'> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked = false, onChange, label, description, disabled, id, ...props }, ref) => {
    const reactId = React.useId();
    const switchId = typeof id === "string" && id.trim() !== "" ? id : `switch-${reactId}`;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.checked);
    };

    return (
      <div className={cn("flex items-center", className)}>
        <div className="relative inline-flex items-center">
          <input
            ref={ref}
            type="checkbox"
            id={switchId}
            checked={checked}
            onChange={handleChange}
            disabled={disabled}
            className="sr-only peer"
            {...props}
          />
          <label
            htmlFor={switchId}
            className={cn(
              "relative inline-flex h-6 w-11 items-center transition-colors duration-200 cursor-pointer",
              "bg-stone-200 dark:bg-neutral-700 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-2",
              "peer-checked:bg-emerald-700 dark:peer-checked:bg-emerald-600",
              "peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform bg-white transition-transform duration-200",
                "translate-x-1 peer-checked:translate-x-6"
              )}
            />
          </label>
        </div>
        {(label || description) && (
          <div className="ml-3">
            {label && (
              <label
                htmlFor={switchId}
                className={cn(
                  "text-sm font-medium text-stone-700 dark:text-neutral-200 cursor-pointer",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-xs text-stone-500 dark:text-neutral-400">{description}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
