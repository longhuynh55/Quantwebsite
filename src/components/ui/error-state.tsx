import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  message: string;
  description?: string;
  onRetry?: () => void;
  retryText?: string;
  variant?: "default" | "compact";
}

export function ErrorState({
  message,
  description,
  onRetry,
  retryText = "Try Again",
  variant = "default",
  className,
  ...props
}: ErrorStateProps) {
  if (variant === "compact") {
    return (
      <div
        role="alert"
        className={cn(
          "flex items-center justify-center gap-4 py-4 px-4 rounded-lg",
          "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-red-500 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm font-medium text-red-700 dark:text-red-300">{message}</span>
        </div>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            {retryText}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
      {...props}
    >
      <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4 mb-4">
        <svg
          className="w-8 h-8 text-red-500 dark:text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{message}</h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-4">{description}</p>
      )}
      {onRetry && (
        <Button onClick={onRetry}>
          {retryText}
        </Button>
      )}
    </div>
  );
}

// Network error state
interface NetworkErrorStateProps extends Omit<ErrorStateProps, 'message' | 'icon'> {
  message?: string;
}

export function NetworkErrorState({
  message = "Connection Error",
  description = "Unable to connect to the server. Please check your internet connection and try again.",
  ...props
}: NetworkErrorStateProps) {
  return (
    <ErrorState
      message={message}
      description={description}
      {...props}
    />
  );
}

// API error state for when server returns an error
interface ApiErrorStateProps extends Omit<ErrorStateProps, 'message' | 'icon'> {
  statusCode?: number;
  message?: string;
}

export function ApiErrorState({
  statusCode,
  message = "Something went wrong",
  description,
  ...props
}: ApiErrorStateProps) {
  const getErrorDescription = () => {
    if (description) return description;

    switch (statusCode) {
      case 400:
        return "The request was invalid. Please check your input and try again.";
      case 401:
        return "You are not authorized to access this resource. Please log in.";
      case 403:
        return "Access denied. You don't have permission to view this content.";
      case 404:
        return "The requested resource was not found.";
      case 429:
        return "Too many requests. Please wait a moment and try again.";
      case 500:
        return "An internal server error occurred. Please try again later.";
      case 503:
        return "The service is temporarily unavailable. Please try again later.";
      default:
        return "An unexpected error occurred. Please try again.";
    }
  };

  return (
    <ErrorState
      message={message}
      description={getErrorDescription()}
      {...props}
    />
  );
}
