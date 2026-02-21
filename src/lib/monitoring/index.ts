/**
 * Monitoring Utilities
 *
 * Export all monitoring, performance tracking, and error tracking utilities.
 */

// Performance monitoring
export {
  performanceTracker,
  trackPageLoad,
  trackApiResponse,
  trackComponentRender,
  trackTiming,
  startTimer,
  trackWebVitals,
  getPerformanceSummary,
  getAllMetrics,
  clearMetrics,
} from "./performance";

// Re-export types from performance
export type {
  PerformanceMetric,
  PerformanceSummary,
} from "./performance";

// Error tracking
export {
  errorTracker,
  captureError,
  captureApiError,
  captureComponentError,
  capturePageError,
  captureActionError,
  handleApiError,
  createErrorBoundaryHandler,
  getRecentErrors,
  getErrorById,
  clearErrors,
  withErrorTracking,
  withSyncErrorTracking,
} from "./error-tracking";

// Re-export types from error-tracking
export type {
  ErrorContext,
  TrackedError,
} from "./error-tracking";
