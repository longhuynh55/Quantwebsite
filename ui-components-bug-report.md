# UI Components Bug Research Report

## High-Severity Bugs

### 1. **Dialog Component - Focus Management Issue**
- **File**: `src/components/ui/dialog.tsx`
- **Lines**: 142-145
- **Description**: The dialog component does not properly clean up focus event listeners when the component unmounts while open. This can cause memory leaks and focus issues.
- **Severity**: High
- **Suggested Fix**:
  ```tsx
  React.useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement;

      const rafId = requestAnimationFrame(() => {
        contentRef.current?.focus();
      });

      const handleTab = (e: KeyboardEvent) => {
        // ... existing code
      };

      document.addEventListener("keydown", handleTab);

      return () => {
        cancelAnimationFrame(rafId);
        document.removeEventListener("keydown", handleTab);
      };
    } else {
      // ... existing code
    }
  }, [open]);
  ```

### 2. **Slider Component - Accessibility Improvements**
- **File**: `src/components/ui/slider.tsx`
- **Lines**: 202-217, 229-237
- **Description**: The range slider uses pointer-events-none on track but pointer-events-auto on thumbs, which creates a confusing interaction pattern. Also missing proper aria attributes for the track.
- **Severity**: High
- **Suggested Fix**:
  ```tsx
  <input
    // ... other props
    aria-label={minLabel}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={minVal}
    className={cn(
      "absolute w-full h-2 appearance-none bg-transparent cursor-pointer",
      "[&::-webkit-slider-thumb]:appearance-none",
      "[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5",
      "[&::-webkit-slider-thumb]:bg-white",
      "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-emerald-600",
      "[&::-webkit-slider-thumb]:cursor-grab"
    )}
  />
  ```

### 3. **AnimatedNumber Component - Race Condition**
- **File**: `src/components/ui/animated-number.tsx`
- **Lines**: 117-134
- **Description**: The animation start frame request can be delayed, causing inconsistent animations when values change rapidly. The cleanup might not properly cancel all animation frames.
- **Severity**: High
- **Suggested Fix**:
  ```tsx
  useEffect(() => {
    if (prefersReducedMotion) {
      targetValueRef.current = value;
      return;
    }

    if (value === targetValueRef.current) return;

    // Cancel any pending animation frame before requesting a new one
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const frameId = window.requestAnimationFrame(() => {
      startAnimation(displayValue, value);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [value, hasAnimated, displayValue, startAnimation, prefersReducedMotion]);
  ```

## Medium-Severity Bugs

### 4. **Dropdown Menu - Keyboard Navigation Bug**
- **File**: `src/components/ui/dropdown-menu.tsx`
- **Lines**: 231-235
- **Description**: When Escape is pressed, the menu closes but the focus is restored to trigger before animation completes. This can cause visual jittering and focus issues.
- **Severity**: Medium
- **Suggested Fix**:
  ```tsx
  if (event.key === "Escape" || event.key === "Tab") {
    event.stopPropagation();
    setTimeout(() => {
      setOpen(false);
      const trigger = triggerRef.current ?? (document.getElementById(triggerId) as HTMLElement | null);
      trigger?.focus();
    }, 0);
  }
  ```

### 5. **Input Component - Missing Validation**
- **File**: `src/components/ui/input.tsx`
- **Lines**: 17-33
- **Description**: The input component lacks proper validation for disabled and readonly states. No visual distinction between disabled and readonly states.
- **Severity**: Medium
- **Suggested Fix**:
  ```tsx
  const isDisabled = props.disabled || props.readOnly;
  return (
    <input
      type={type}
      id={id}
      disabled={isDisabled}
      readOnly={props.readOnly}
      className={cn(
        "flex h-9 w-full border border-stone-300 bg-transparent px-3 py-1 text-sm font-sans transition-colors",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-stone-950 placeholder:text-stone-400",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-700",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "readonly:bg-stone-50 readonly:cursor-text",
        "dark:border-neutral-600 dark:file:text-neutral-200 dark:placeholder:text-neutral-500",
        "dark:focus-visible:ring-emerald-400 disabled:dark:opacity-50",
        "readonly:dark:bg-neutral-800",
        className
      )}
      ref={ref}
      aria-label={ariaLabel}
      aria-describedby={errorId}
      {...props}
    />
  );
  ```

### 6. **Button Component - Missing ARIA Support**
- **File**: `src/components/ui/button.tsx`
- **Lines**: 32-102
- **Description**: While development-only errors are thrown for missing aria-label on icon buttons, there's no runtime protection in production. Also missing proper disabled state handling.
- **Severity**: Medium
- **Suggested Fix**:
  ```tsx
  const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", disabled, ...props }, ref) => {
      // Production check for aria-label on icon buttons
      if (size === 'icon' && !disabled && !props['aria-label'] && !props['aria-labelledby']) {
        console.warn(
          'Warning: Icon button should have an aria-label or aria-labelledby attribute for accessibility'
        );
      }

      const baseStyles = cn(
        "inline-flex items-center justify-center whitespace-nowrap font-sans font-semibold text-sm uppercase tracking-wider",
        "transition-[background-color,color,border-color,transform] duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-700",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        disabled && "pointer-events-none",
        className
      );

      // ... rest of component
    }
  );
  ```

## Low-Severity Bugs

### 7. **Tooltip Component - Click Interaction Missing**
- **File**: `src/components/ui/tooltip.tsx`
- **Lines**: 61-91
- **Description**: Tooltip only shows on hover/focus but not on click. For better accessibility, it should support click-to-show/click-to-hide on touch devices.
- **Severity**: Low
- **Suggested Fix**:
  ```tsx
  const [isVisible, setIsVisible] = React.useState(false);
  const [isHovering, setIsHovering] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const showTooltip = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(true);
    setIsHovering(true);
  }, []);

  const hideTooltip = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsHovering(false);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 150);
  }, []);

  const toggleTooltip = React.useCallback(() => {
    if (isHovering) {
      hideTooltip();
    } else {
      showTooltip();
      setIsActive(true);
    }
  }, [isHovering, showTooltip, hideTooltip]);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      onClick={toggleTooltip}
      onTouchStart={showTooltip}
    >
      {/* ... rest of component */}
    </div>
  );
  ```

### 8. **Card Component - Missing Loading State**
- **File**: `src/components/ui/card.tsx`
- **Lines**: 11-32
- **Description**: The interactive card hover effect lacks disabled state styling. No loading spinner support.
- **Severity**: Low
- **Suggested Fix**:
  ```tsx
  const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, interactive = false, loading = false, disabled = false, ...props }, ref) => {
      const baseStyles = cn(
        "border border-stone-200 bg-white text-stone-950",
        "dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50",
        "transition-[border-color,background-color] duration-300 ease-out",
        disabled && "opacity-50 cursor-not-allowed",
        loading && "pointer-events-none",
        className
      );

      const interactiveStyles = interactive && !disabled && !loading && cn(
        "hover:border-stone-300 dark:hover:border-neutral-700",
        "cursor-pointer"
      );

      return (
        <div
          ref={ref}
          className={cn(baseStyles, interactiveStyles, className)}
          {...props}
        >
          {loading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-neutral-900/80 flex items-center justify-center">
              <div className="animate-spin h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full" />
            </div>
          )}
        </div>
      );
    }
  );
  ```

## Dark Mode Issues

### 9. **Select Component - Text Color Inconsistency**
- **File**: `src/components/ui/select.tsx`
- **Lines**: 23-32
- **Description**: The dark mode text color might not have sufficient contrast in all cases.
- **Severity**: Medium
- **Suggested Fix**:
  ```tsx
  className={cn(
    "flex h-9 w-full items-center justify-between whitespace-nowrap border border-stone-300",
    "dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm",
    "font-sans ring-offset-white dark:ring-offset-neutral-900",
    "placeholder:text-stone-400 dark:placeholder:text-neutral-500",
    "focus:outline-none focus:ring-1 focus:ring-emerald-700",
    "dark:focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50",
    "text-stone-900 dark:text-neutral-100 transition-colors",
    className
  )}
  ```

### 10. **Tooltip Component - Dark Mode Arrow Colors**
- **File**: `src/components/ui/tooltip.tsx`
- **Lines**: 54-59
- **Description**: Dark mode arrow border colors might not match the tooltip background properly.
- **Severity**: Low
- **Suggested Fix**:
  ```tsx
  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-white dark:border-t-neutral-700 border-l-transparent border-r-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-white dark:border-b-neutral-700 border-l-transparent border-r-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-white dark:border-l-neutral-700 border-t-transparent border-b-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-white dark:border-r-neutral-700 border-t-transparent border-b-transparent border-l-transparent",
  };
  ```

## Recommendations

1. **Add comprehensive testing suite** for all components with Jest and React Testing Library
2. **Implement component stories** in Storybook for better visual testing
3. **Add E2E tests** for critical user flows involving multiple components
4. **Create accessibility audit** with axe-core or similar tool
5. **Add prop validation** with PropTypes for all public APIs
6. **Implement proper error boundaries** around components
7. **Add TypeScript strict null checks** for all component props