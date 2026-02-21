"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
  baseId: string;
}

const TabsContext = React.createContext<TabsContextType | null>(null);

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

function toIdSuffix(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tab";
}

const Tabs: React.FC<TabsProps> = ({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className,
}) => {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || "");
  const value = controlledValue ?? uncontrolledValue;
  const handleValueChange = onValueChange || setUncontrolledValue;
  const baseId = React.useId();

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange, baseId }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
};

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, onKeyDown, ...props }, ref) => {
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;

      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
        return;
      }

      const currentTarget = event.currentTarget;
      const tabs = Array.from(
        currentTarget.querySelectorAll<HTMLButtonElement>("button[role='tab']:not([disabled])")
      );
      if (tabs.length === 0) return;

      const activeElement = document.activeElement as HTMLElement | null;
      const currentIndex = tabs.findIndex((tab) => tab === activeElement);
      const fallbackIndex = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
      const startIndex = currentIndex >= 0 ? currentIndex : Math.max(fallbackIndex, 0);

      let nextIndex = startIndex;
      if (event.key === "ArrowRight") {
        nextIndex = (startIndex + 1) % tabs.length;
      } else if (event.key === "ArrowLeft") {
        nextIndex = (startIndex - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = tabs.length - 1;
      }

      const nextTab = tabs[nextIndex];
      if (!nextTab) return;
      event.preventDefault();
      nextTab.focus();
      nextTab.click();
    };

    return (
      <div
        ref={ref}
        role="tablist"
        aria-orientation="horizontal"
        className={cn(
          "inline-flex h-9 items-center justify-center rounded-lg bg-gray-100 p-1 text-gray-500",
          className
        )}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  }
);
TabsList.displayName = "TabsList";

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error("TabsTrigger must be used within Tabs");

    const isSelected = context.value === value;
    const valueKey = toIdSuffix(value);
    const triggerId = `${context.baseId}-trigger-${valueKey}`;
    const contentId = `${context.baseId}-content-${valueKey}`;

    return (
      <button
        ref={ref}
        id={triggerId}
        type="button"
        role="tab"
        data-value={value}
        data-state={isSelected ? "active" : "inactive"}
        aria-selected={isSelected}
        aria-controls={contentId}
        tabIndex={isSelected ? 0 : -1}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-white transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          isSelected ? "bg-white text-gray-950 shadow" : "text-gray-600 hover:text-gray-900",
          className
        )}
        onClick={(event) => {
          context.onValueChange(value);
          onClick?.(event);
        }}
        {...props}
      />
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error("TabsContent must be used within Tabs");

    const valueKey = toIdSuffix(value);
    const triggerId = `${context.baseId}-trigger-${valueKey}`;
    const contentId = `${context.baseId}-content-${valueKey}`;
    const isSelected = context.value === value;
    if (!isSelected) return null;

    return (
      <div
        ref={ref}
        id={contentId}
        role="tabpanel"
        aria-labelledby={triggerId}
        data-state={isSelected ? "active" : "inactive"}
        tabIndex={0}
        className={cn(
          "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2",
          className
        )}
        {...props}
       />
     );
   }
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
