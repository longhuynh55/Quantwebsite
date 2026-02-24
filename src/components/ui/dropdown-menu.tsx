"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerId: string;
  contentId: string;
  rootRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | undefined>(undefined);

function useDropdownMenu() {
  const context = React.useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("DropdownMenu components must be used within a DropdownMenu");
  }
  return context;
}

function focusMenuItem(
  items: HTMLElement[],
  direction: "first" | "last" | "next" | "prev"
) {
  if (items.length === 0) return;

  const activeElement = document.activeElement as HTMLElement | null;
  const currentIndex = items.findIndex((item) => item === activeElement);
  let nextIndex = 0;

  if (direction === "first") {
    nextIndex = 0;
  } else if (direction === "last") {
    nextIndex = items.length - 1;
  } else if (direction === "next") {
    nextIndex = currentIndex >= 0 ? (currentIndex + 1) % items.length : 0;
  } else {
    nextIndex = currentIndex >= 0 ? (currentIndex - 1 + items.length) % items.length : items.length - 1;
  }

  items[nextIndex]?.focus();
}

interface DropdownMenuProps {
  children: React.ReactNode;
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const menuId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const triggerId = `${menuId}-trigger`;
  const contentId = `${menuId}-content`;

  return (
    <DropdownMenuContext.Provider
      value={{
        open,
        setOpen,
        triggerId,
        contentId,
        rootRef,
        triggerRef,
        contentRef,
      }}
    >
      <div ref={rootRef} className="relative inline-block">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  ({ children, asChild, className, onClick, ...props }, ref) => {
    const { open, setOpen, triggerId, contentId, triggerRef } = useDropdownMenu();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      setOpen(!open);
      onClick?.(e);
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(
        children as React.ReactElement<{
          onClick?: (e: React.MouseEvent<Element, MouseEvent>) => void;
          className?: string;
          id?: string;
          "aria-expanded"?: boolean;
          "aria-haspopup"?: "menu";
          "aria-controls"?: string;
        }>,
        {
          id: triggerId,
          onClick: handleClick as (e: React.MouseEvent<Element, MouseEvent>) => void,
          className: cn((children as React.ReactElement<{ className?: string }>).props?.className, className),
          "aria-expanded": open,
          "aria-haspopup": "menu",
          "aria-controls": contentId,
        }
      );
    }

    return (
      <button
        ref={(node) => {
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
          triggerRef.current = node;
        }}
        id={triggerId}
        type="button"
        onClick={handleClick}
        className={className}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={contentId}
        {...props}
      >
        {children}
      </button>
    );
  }
);
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, align = "center", children, onKeyDown, ...props }, ref) => {
    const { open, setOpen, contentId, triggerId, rootRef, triggerRef, contentRef } = useDropdownMenu();

    React.useEffect(() => {
      const handlePointerDownOutside = (event: MouseEvent | TouchEvent) => {
        const root = rootRef.current;
        if (!root) return;
        if (!root.contains(event.target as Node)) {
          setOpen(false);
        }
      };

      if (open) {
        document.addEventListener("mousedown", handlePointerDownOutside);
        document.addEventListener("touchstart", handlePointerDownOutside);
      }

      return () => {
        document.removeEventListener("mousedown", handlePointerDownOutside);
        document.removeEventListener("touchstart", handlePointerDownOutside);
      };
    }, [open, rootRef, setOpen]);

    React.useEffect(() => {
      if (!open) return;
      const timer = window.setTimeout(() => {
        const menu = contentRef.current;
        if (!menu) return;
        const items = Array.from(menu.querySelectorAll<HTMLElement>("[role='menuitem']:not([disabled])"));
        focusMenuItem(items, "first");
      }, 0);

      return () => window.clearTimeout(timer);
    }, [open, contentRef]);

    if (!open) return null;

    const alignmentClasses = {
      start: "left-0",
      center: "left-1/2 -translate-x-1/2",
      end: "right-0",
    };

    return (
      <div
        ref={(node) => {
          contentRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        id={contentId}
        role="menu"
        aria-labelledby={triggerId}
        tabIndex={-1}
        className={cn(
          "absolute top-full mt-2 z-50 min-w-[180px] border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-1.5",
          "animate-in fade-in-0 zoom-in-95 duration-150",
          alignmentClasses[align],
          className
        )}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;

          const menu = contentRef.current;
          if (!menu) return;
          const items = Array.from(menu.querySelectorAll<HTMLElement>("[role='menuitem']:not([disabled])"));

          if (event.key === "ArrowDown") {
            event.preventDefault();
            focusMenuItem(items, "next");
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            focusMenuItem(items, "prev");
            return;
          }
          if (event.key === "Home") {
            event.preventDefault();
            focusMenuItem(items, "first");
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            focusMenuItem(items, "last");
            return;
          }
          if (event.key === "Escape" || event.key === "Tab") {
            setOpen(false);
            const trigger = triggerRef.current ?? (document.getElementById(triggerId) as HTMLElement | null);
            trigger?.focus();
          }
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DropdownMenuContent.displayName = "DropdownMenuContent";

interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  inset?: boolean;
}

export const DropdownMenuItem = React.forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  ({ className, inset, children, onClick, ...props }, ref) => {
    const { setOpen } = useDropdownMenu();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      setOpen(false);
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={handleClick}
        className={cn(
          "flex w-full items-center px-3 py-2 text-sm text-stone-700 dark:text-neutral-200 outline-none",
          "hover:bg-stone-100 dark:hover:bg-neutral-700 focus:bg-stone-100 dark:focus:bg-neutral-700 transition-colors",
          inset && "pl-8",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
DropdownMenuItem.displayName = "DropdownMenuItem";

export function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  return (
    <div
      className={cn(
        "px-3 py-2 text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wide",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("my-1 h-px bg-stone-200 dark:bg-neutral-700", className)} {...props} />;
}

type DropdownMenuShortcutProps = React.HTMLAttributes<HTMLSpanElement>;

export function DropdownMenuShortcut({ className, ...props }: DropdownMenuShortcutProps) {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-stone-400 dark:text-neutral-500", className)}
      {...props}
    />
  );
}
