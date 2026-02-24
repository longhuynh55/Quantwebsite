"use client";

import { cn } from "@/lib/utils";

interface SkipLinkProps {
 /** Target element ID to skip to */
 targetId?: string;
 className?: string;
}

/**
 * SkipLink - Accessibility component for keyboard users to skip navigation
 *
 * Renders a link that becomes visible when focused, allowing keyboard users
 * to skip directly to the main content area.
 *
 * Usage:
 * ```tsx
 * <SkipLink /> // Defaults to skipping to #main-content
 * <SkipLink targetId="custom-content" />
 * ```
 */
export function SkipLink({ targetId = "main-content", className }: SkipLinkProps) {
 return (
 <a
 href={`#${targetId}`}
 className={cn(
 // Hidden by default
 "sr-only focus:not-sr-only",
 // When focused, show as fixed overlay
 "focus:fixed focus:top-4 focus:left-4 focus:z-[9999]",
 "focus:px-4 focus:py-2",
 "focus:bg-emerald-700 focus:text-white",
 
 "focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-emerald-700",
 // Smooth transition
 "transition-all duration-200",
 // Font styling
 "focus:text-sm focus:font-medium",
 className
 )}
 >
 Skip to main content
 </a>
 );
}

/**
 * MainContent - Wrapper for main content with proper id and ARIA attributes
 */
interface MainContentProps {
 children: React.ReactNode;
 className?: string;
 id?: string;
}

export function MainContent({ children, className, id = "main-content" }: MainContentProps) {
 return (
 <main
 id={id}
 role="main"
 aria-label="Main content"
 className={className}
 // Allow focus for skip link targeting
 tabIndex={-1}
 >
 {children}
 </main>
 );
}

/**
 * FocusTrap - Traps focus within a container (for modals, dialogs)
 */
interface FocusTrapProps {
 children: React.ReactNode;
 active?: boolean;
 className?: string;
}

export function FocusTrap({ children, active = true, className }: FocusTrapProps) {
 return (
 <div
 className={className}
 aria-hidden={!active}
 data-focus-trap={active}
 >
 {children}
 </div>
 );
}

/**
 * VisuallyHidden - Hides content visually but keeps it accessible to screen readers
 */
interface VisuallyHiddenProps {
 children: React.ReactNode;
 className?: string;
}

export function VisuallyHidden({ children, className }: VisuallyHiddenProps) {
 return (
 <span className={cn("sr-only", className)}>
 {children}
 </span>
 );
}

export default SkipLink;
