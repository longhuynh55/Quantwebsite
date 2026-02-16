import * as React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Enable hover effects for interactive cards */
  interactive?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, ...props }, ref) => {
    const baseStyles = cn(
      "rounded-xl border border-gray-200 bg-white text-gray-950 shadow-sm",
      "dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50",
      "transition-[transform,box-shadow,border-color] duration-300 ease-out"
    );

    const interactiveStyles = interactive && cn(
      "hover:-translate-y-1 hover:shadow-lg",
      "hover:border-gray-300 dark:hover:border-gray-700",
      "cursor-pointer"
    );

    return (
      <div
        ref={ref}
        className={cn(baseStyles, interactiveStyles, className)}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-gray-500 dark:text-gray-400", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

/**
 * MetricCard - Specialized card for displaying metrics with animation support
 */
interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
  animated?: boolean;
}

const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  ({ title, value, description, trend, trendValue, className, animated = false }, ref) => {
    const trendColors = {
      up: "text-green-600 dark:text-green-400",
      down: "text-red-600 dark:text-red-400",
      neutral: "text-gray-600 dark:text-gray-400",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4 shadow-sm",
          "transition-[transform,box-shadow,border-color] duration-300 ease-out",
          "hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700",
          animated && "animate-in fade-in zoom-in-95 duration-500",
          className
        )}
      >
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <p
            className={cn(
              "text-2xl font-bold",
              trend === "up" && "text-green-600 dark:text-green-400",
              trend === "down" && "text-red-600 dark:text-red-400",
              (!trend || trend === "neutral") && "text-gray-900 dark:text-white"
            )}
          >
            {value}
          </p>
          {trendValue && (
            <span className={cn("text-sm font-medium", trendColors[trend || "neutral"])}>
              {trend === "up" && "^"}
              {trend === "down" && "v"}
              {trendValue}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
        )}
      </div>
    );
  }
);
MetricCard.displayName = "MetricCard";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, MetricCard };
