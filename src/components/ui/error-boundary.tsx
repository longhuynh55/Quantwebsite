"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorBoundaryFallbackProps> | React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: Array<string | number | boolean>;
  resetOnPropsChange?: boolean;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export interface ErrorBoundaryFallbackProps {
  error: Error | null;
  resetErrorBoundary: () => void;
}

interface DefaultFallbackProps {
  error: Error | null;
  resetErrorBoundary: () => void;
}

const DefaultFallback: React.FC<DefaultFallbackProps> = ({ error, resetErrorBoundary }) => {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center min-h-[400px] py-12 px-4 text-center",
        "bg-white dark:bg-slate-950"
      )}
    >
      <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4 mb-6">
        <AlertTriangle className="w-10 h-10 text-red-500 dark:text-red-400" aria-hidden="true" />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
        Something went wrong
      </h2>

      <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
        {error?.message || "An unexpected error occurred. Please try again."}
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={resetErrorBoundary}
          className="rounded-xl"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>

        <Button
          variant="outline"
          onClick={() => window.location.href = "/"}
          className="rounded-xl"
        >
          Go to Homepage
        </Button>
      </div>

      {error && process.env.NODE_ENV === "development" && (
        <details className="mt-6 text-left w-full max-w-2xl">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Error details (development only)
          </summary>
          <pre className="text-xs bg-gray-100 dark:bg-slate-900 p-4 rounded-lg overflow-auto max-h-64 text-red-600 dark:text-red-400">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
};

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    if (!hasError) return;

    // Reset if resetKeys changed
    if (resetKeys && prevProps.resetKeys) {
      const prevKeys = JSON.stringify(prevProps.resetKeys);
      const currentKeys = JSON.stringify(resetKeys);

      if (prevKeys !== currentKeys) {
        this.reset();
        return;
      }
    }

    // Reset if props changed and resetOnPropsChange is true
    if (resetOnPropsChange && prevProps.children !== this.props.children) {
      this.reset();
    }
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): React.ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (!hasError) {
      return children;
    }

    const fallbackProps: ErrorBoundaryFallbackProps = {
      error,
      resetErrorBoundary: this.reset,
    };

    // Handle custom fallback
    if (fallback) {
      if (React.isValidElement(fallback)) {
        return fallback;
      }

      if (typeof fallback === "function") {
        const FallbackComponent = fallback as React.ComponentType<ErrorBoundaryFallbackProps>;
        return <FallbackComponent {...fallbackProps} />;
      }
    }

    // Use default fallback
    return <DefaultFallback {...fallbackProps} />;
  }
}

// Hook for programmatically triggering error boundaries
export function useErrorHandler(): (error: Error) => void {
  return React.useCallback((error: Error) => {
    throw error;
  }, []);
}

// Component for throwing errors from render
export interface ErrorTriggerProps {
  error: Error | null | boolean;
}

export function ErrorTrigger({ error }: ErrorTriggerProps): null {
  if (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    throw errorObj;
  }
  return null;
}
