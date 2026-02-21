import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Archive, Search, Clock } from "lucide-react";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
      {...props}
    >
      {Icon && (
        <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4 mb-4">
          <Icon className="w-8 h-8 text-gray-500 dark:text-gray-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-4">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// Pre-configured empty states for common use cases
interface NoDataStateProps extends Omit<EmptyStateProps, 'icon' | 'title'> {
  title?: string;
}

export function NoDataState({ title = "No data available", ...props }: NoDataStateProps) {
  return (
    <EmptyState
      icon={Archive}
      title={title}
      {...props}
    />
  );
}

interface NoResultsStateProps extends Omit<EmptyStateProps, 'icon' | 'title'> {
  title?: string;
  onClear?: () => void;
}

export function NoResultsState({
  title = "No results found",
  description = "Try adjusting your search or filters to find what you're looking for.",
  onClear,
  ...props
}: NoResultsStateProps) {
  return (
    <EmptyState
      icon={Search}
      title={title}
      description={description}
      action={onClear ? <Button variant="outline" onClick={onClear}>Clear Filters</Button> : undefined}
      {...props}
    />
  );
}

interface ComingSoonStateProps extends Omit<EmptyStateProps, 'icon' | 'title'> {
  title?: string;
}

export function ComingSoonState({ title = "Coming Soon", ...props }: ComingSoonStateProps) {
  return (
    <EmptyState
      icon={Clock}
      title={title}
      description="This feature is currently under development. Check back soon for updates."
      {...props}
    />
  );
}
