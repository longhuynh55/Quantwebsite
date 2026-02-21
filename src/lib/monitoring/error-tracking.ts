/**
 * Error Tracking Utilities
 *
 * Capture errors with context, log appropriately based on environment,
 * and prepare for Sentry integration in production.
 */

import { NextApiResponse } from "next";
import type { ErrorInfo } from "react";

// Error context interface
export interface ErrorContext {
  // Where the error occurred
  component?: string;
  page?: string;
  action?: string;
  endpoint?: string;

  // User context (non-PII)
  userId?: string;
  sessionId?: string;
  userRole?: string;

  // Technical context
  requestId?: string;
  timestamp?: string;
  userAgent?: string;
  url?: string;
  method?: string;
  statusCode?: number;

  // Additional data
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;

  // Stack trace
  stack?: string;
}

// Tracked error interface
export interface TrackedError {
  id: string;
  message: string;
  name: string;
  context: ErrorContext;
  timestamp: string;
  environment: string;
  release?: string;
}

// In-memory error store for development/debugging
const errorStore: TrackedError[] = [];
const MAX_ERRORS = 100;

// Generate unique error ID
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Capture and track an error
 */
export function captureError(
  error: Error | unknown,
  context: ErrorContext = {}
): string {
  const errorId = generateErrorId();

  // Extract error details
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : "UnknownError";
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Build tracked error object
  const trackedError: TrackedError = {
    id: errorId,
    message: errorMessage,
    name: errorName,
    context: {
      ...context,
      timestamp: context.timestamp || new Date().toISOString(),
      stack: errorStack,
    },
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    release: process.env.npm_package_version,
  };

  // Store error (limited)
  if (errorStore.length >= MAX_ERRORS) {
    errorStore.shift();
  }
  errorStore.push(trackedError);

  // Log based on environment
  if (process.env.NODE_ENV === "development") {
    logToConsole(trackedError);
  }

  // Send to external service in production
  if (process.env.NODE_ENV === "production") {
    sendToErrorService(trackedError);
  }

  return errorId;
}

/**
 * Log error to console with full context (development only)
 */
function logToConsole(error: TrackedError): void {
  console.group(`[Error] ${error.name}: ${error.message}`);
  console.log("Error ID:", error.id);
  console.log("Timestamp:", error.timestamp);

  if (error.context.component) {
    console.log("Component:", error.context.component);
  }
  if (error.context.page) {
    console.log("Page:", error.context.page);
  }
  if (error.context.action) {
    console.log("Action:", error.context.action);
  }
  if (error.context.endpoint) {
    console.log("Endpoint:", error.context.endpoint);
  }
  if (error.context.statusCode) {
    console.log("Status Code:", error.context.statusCode);
  }
  if (error.context.requestId) {
    console.log("Request ID:", error.context.requestId);
  }

  if (error.context.tags) {
    console.log("Tags:", error.context.tags);
  }
  if (error.context.extra) {
    console.log("Extra:", error.context.extra);
  }

  if (error.context.stack) {
    console.log("\nStack Trace:");
    console.log(error.context.stack);
  }

  console.groupEnd();
}

/**
 * Send error to external error tracking service
 * Ready for Sentry, DataDog, or custom integration
 */
function sendToErrorService(error: TrackedError): void {
  // Check if Sentry is configured
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

  if (sentryDsn) {
    sendToSentry(error);
    return;
  }

  // Check if custom error endpoint is configured
  const errorEndpoint = process.env.NEXT_PUBLIC_ERROR_ENDPOINT;

  if (errorEndpoint) {
    sendToCustomEndpoint(error, errorEndpoint);
    return;
  }

  // Fallback to console in production if no service configured
  console.error("[Error Tracking] No error service configured. Error:", {
    id: error.id,
    name: error.name,
    message: error.message,
    context: error.context,
  });
}

/**
 * Send error to Sentry (when configured)
 */
function sendToSentry(error: TrackedError): void {
  // This would use @sentry/nextjs in production
  // Example implementation:
  /*
  import * as Sentry from "@sentry/nextjs";

  Sentry.captureException(new Error(error.message), {
    tags: {
      errorId: error.id,
      ...error.context.tags,
    },
    extra: {
      ...error.context.extra,
      component: error.context.component,
      page: error.context.page,
      action: error.context.action,
      endpoint: error.context.endpoint,
    },
    user: error.context.userId
      ? {
          id: error.context.userId,
          role: error.context.userRole,
        }
      : undefined,
  });
  */

  // Placeholder for now
  console.log("[Sentry] Would capture error:", error.id);
}

/**
 * Send error to custom endpoint
 */
async function sendToCustomEndpoint(
  error: TrackedError,
  endpoint: string
): Promise<void> {
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(error),
    });
  } catch (sendError) {
    console.error("[Error Tracking] Failed to send error to endpoint:", sendError);
  }
}

/**
 * Capture API error with request context
 */
export function captureApiError(
  error: Error | unknown,
  request: {
    endpoint: string;
    method?: string;
    statusCode?: number;
    requestId?: string;
  },
  additionalContext?: Omit<ErrorContext, "endpoint" | "method" | "statusCode" | "requestId">
): string {
  return captureError(error, {
    ...additionalContext,
    endpoint: request.endpoint,
    method: request.method,
    statusCode: request.statusCode,
    requestId: request.requestId,
  });
}

/**
 * Capture component error with React context
 */
export function captureComponentError(
  error: Error | unknown,
  componentName: string,
  additionalContext?: Omit<ErrorContext, "component">
): string {
  return captureError(error, {
    ...additionalContext,
    component: componentName,
  });
}

/**
 * Capture page error with routing context
 */
export function capturePageError(
  error: Error | unknown,
  pageName: string,
  additionalContext?: Omit<ErrorContext, "page">
): string {
  return captureError(error, {
    ...additionalContext,
    page: pageName,
  });
}

/**
 * Capture user action error
 */
export function captureActionError(
  error: Error | unknown,
  action: string,
  additionalContext?: Omit<ErrorContext, "action">
): string {
  return captureError(error, {
    ...additionalContext,
    action,
  });
}

/**
 * Handle API errors consistently
 * Returns a standardized error response
 */
export function handleApiError(
  error: Error | unknown,
  res: NextApiResponse,
  options: {
    endpoint?: string;
    statusCode?: number;
    message?: string;
  } = {}
): void {
  const statusCode = options.statusCode || 500;
  const message = options.message || "Internal Server Error";

  // Capture the error
  const errorId = captureApiError(error, {
    endpoint: options.endpoint || "unknown",
    statusCode,
  });

  // Return error response
  res.status(statusCode).json({
    error: message,
    errorId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Create an error boundary handler for client components
 */
export function createErrorBoundaryHandler(componentName: string) {
  return (error: Error, errorInfo: ErrorInfo) => {
    captureComponentError(error, componentName, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
  };
}

/**
 * Get recent errors (for debugging/monitoring)
 */
export function getRecentErrors(limit: number = 20): TrackedError[] {
  return errorStore.slice(-limit);
}

/**
 * Get error by ID
 */
export function getErrorById(id: string): TrackedError | undefined {
  return errorStore.find((e) => e.id === id);
}

/**
 * Clear error store
 */
export function clearErrors(): void {
  errorStore.length = 0;
}

/**
 * Wrap an async function with error tracking
 */
export function withErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context: Omit<ErrorContext, "stack">
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureError(error, context);
      throw error;
    }
  }) as T;
}

/**
 * Wrap a sync function with error tracking
 */
export function withSyncErrorTracking<T extends (...args: unknown[]) => unknown>(
  fn: T,
  context: Omit<ErrorContext, "stack">
): T {
  return ((...args: Parameters<T>) => {
    try {
      return fn(...args);
    } catch (error) {
      captureError(error, context);
      throw error;
    }
  }) as T;
}

// Export error tracker object for convenience
export const errorTracker = {
  capture: captureError,
  captureApi: captureApiError,
  captureComponent: captureComponentError,
  capturePage: capturePageError,
  captureAction: captureActionError,
  handleApi: handleApiError,
  createBoundaryHandler: createErrorBoundaryHandler,
  getRecent: getRecentErrors,
  getById: getErrorById,
  clear: clearErrors,
  withTracking: withErrorTracking,
  withSyncTracking: withSyncErrorTracking,
};

export default errorTracker;
