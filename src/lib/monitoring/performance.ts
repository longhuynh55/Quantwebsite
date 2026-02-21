/**
 * Performance Monitoring Utilities
 *
 * Track page load times, API response times, and component render times.
 * All tracking is non-blocking and designed for production use.
 */

// Performance metrics storage (in-memory, resets on server restart)
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: "ms" | "s" | "count";
  timestamp: number;
  tags?: Record<string, string>;
}

export interface PerformanceSummary {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

// In-memory metrics store
const metricsStore: PerformanceMetric[] = [];
const MAX_METRICS = 1000; // Limit to prevent memory issues

/**
 * Add a metric to the store
 */
function addMetric(metric: PerformanceMetric): void {
  if (metricsStore.length >= MAX_METRICS) {
    metricsStore.shift(); // Remove oldest metric
  }
  metricsStore.push(metric);
}

/**
 * Track page load time (client-side)
 * Call this in useEffect after page mount
 */
export function trackPageLoad(pageName: string): void {
  if (typeof window === "undefined") return;

  try {
    const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;

    if (navigationEntry) {
      const metrics = {
        // Time to first byte
        ttfb: navigationEntry.responseStart - navigationEntry.requestStart,
        // DOM content loaded
        domContentLoaded: navigationEntry.domContentLoadedEventEnd - navigationEntry.domContentLoadedEventStart,
        // Full page load
        loadComplete: navigationEntry.loadEventEnd - navigationEntry.loadEventStart,
        // Total page load time
        total: navigationEntry.loadEventEnd - navigationEntry.fetchStart,
      };

      // Log in development
      if (process.env.NODE_ENV === "development") {
        console.log(`[Performance] Page load: ${pageName}`, metrics);
      }

      // Store metrics
      addMetric({
        name: `page.load.${pageName}`,
        value: metrics.total,
        unit: "ms",
        timestamp: Date.now(),
        tags: { type: "page_load", page: pageName },
      });

      // Report to analytics (if configured)
      reportMetric("page_load", pageName, metrics.total);
    }
  } catch (error) {
    console.error("[Performance] Error tracking page load:", error);
  }
}

/**
 * Track API response time
 */
export function trackApiResponse(
  endpoint: string,
  duration: number,
  status: number,
  method: string = "GET"
): void {
  const metric: PerformanceMetric = {
    name: `api.${endpoint}`,
    value: duration,
    unit: "ms",
    timestamp: Date.now(),
    tags: {
      type: "api",
      endpoint,
      method,
      status: status.toString(),
      statusCategory: `${Math.floor(status / 100)}xx`,
    },
  };

  addMetric(metric);

  // Log slow requests in development
  if (process.env.NODE_ENV === "development" && duration > 1000) {
    console.warn(`[Performance] Slow API request: ${method} ${endpoint} took ${duration}ms`);
  }

  // Report to external monitoring (if configured)
  reportMetric("api_response", endpoint, duration, {
    method,
    status: status.toString(),
  });
}

/**
 * Track component render time (client-side)
 * Use with React Profiler or manual measurement
 */
export function trackComponentRender(
  componentName: string,
  duration: number
): void {
  if (typeof window === "undefined") return;

  const metric: PerformanceMetric = {
    name: `component.render.${componentName}`,
    value: duration,
    unit: "ms",
    timestamp: Date.now(),
    tags: { type: "component_render", component: componentName },
  };

  addMetric(metric);

  // Log slow renders in development
  if (process.env.NODE_ENV === "development" && duration > 16) {
    console.warn(
      `[Performance] Slow component render: ${componentName} took ${duration.toFixed(2)}ms`
    );
  }
}

/**
 * Track custom timing for any operation
 */
export function trackTiming(
  name: string,
  duration: number,
  tags?: Record<string, string>
): void {
  const metric: PerformanceMetric = {
    name,
    value: duration,
    unit: "ms",
    timestamp: Date.now(),
    tags,
  };

  addMetric(metric);

  if (process.env.NODE_ENV === "development") {
    console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
  }
}

/**
 * Create a timer for measuring operation duration
 */
export function startTimer(name: string, tags?: Record<string, string>): () => number {
  const startTime = performance.now();

  return () => {
    const duration = performance.now() - startTime;
    trackTiming(name, duration, tags);
    return duration;
  };
}

/**
 * Track Web Vitals (client-side)
 * Call this once in your app entry point
 */
export function trackWebVitals(): void {
  if (typeof window === "undefined") return;

  // Use the web-vitals library if available, or use PerformanceObserver
  try {
    // Track Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as LargestContentfulPaintEntry;

      addMetric({
        name: "web_vitals.lcp",
        value: lastEntry.renderTime || lastEntry.loadTime,
        unit: "ms",
        timestamp: Date.now(),
        tags: { type: "web_vital", metric: "lcp" },
      });

      reportMetric("web_vital", "lcp", lastEntry.renderTime || lastEntry.loadTime);
    });

    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

    // Track First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        const fidEntry = entry as PerformanceEventTiming;
        if (fidEntry.processingStart) {
          const fid = fidEntry.processingStart - fidEntry.startTime;

          addMetric({
            name: "web_vitals.fid",
            value: fid,
            unit: "ms",
            timestamp: Date.now(),
            tags: { type: "web_vital", metric: "fid" },
          });

          reportMetric("web_vital", "fid", fid);
        }
      });
    });

    fidObserver.observe({ type: "first-input", buffered: true });

    // Track Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        const clsEntry = entry as LayoutShiftEntry;
        if (!clsEntry.hadRecentInput) {
          clsValue += clsEntry.value;
        }
      });

      addMetric({
        name: "web_vitals.cls",
        value: clsValue * 1000, // Convert to ms-like scale
        unit: "ms",
        timestamp: Date.now(),
        tags: { type: "web_vital", metric: "cls" },
      });

      reportMetric("web_vital", "cls", clsValue * 1000);
    });

    clsObserver.observe({ type: "layout-shift", buffered: true });

  } catch (error) {
    console.error("[Performance] Error setting up web vitals tracking:", error);
  }
}

/**
 * Get performance summary for a metric name pattern
 */
export function getPerformanceSummary(namePattern: string): PerformanceSummary | null {
  const matchingMetrics = metricsStore.filter((m) =>
    m.name.includes(namePattern)
  );

  if (matchingMetrics.length === 0) return null;

  const values = matchingMetrics.map((m) => m.value).sort((a, b) => a - b);
  const count = values.length;
  const sum = values.reduce((acc, val) => acc + val, 0);

  return {
    count,
    min: values[0],
    max: values[count - 1],
    avg: sum / count,
    p50: values[Math.floor(count * 0.5)],
    p95: values[Math.floor(count * 0.95)],
    p99: values[Math.floor(count * 0.99)],
  };
}

/**
 * Get all metrics (for debugging/monitoring endpoints)
 */
export function getAllMetrics(): PerformanceMetric[] {
  return [...metricsStore];
}

/**
 * Clear all metrics
 */
export function clearMetrics(): void {
  metricsStore.length = 0;
}

/**
 * Report metric to external monitoring service
 * Replace with actual implementation for production
 */
function reportMetric(
  type: string,
  name: string,
  value: number,
  tags?: Record<string, string>
): void {
  // Only report in production and if monitoring is configured
  if (process.env.NODE_ENV !== "production") return;

  // Check if external monitoring is enabled
  const monitoringEnabled = process.env.NEXT_PUBLIC_ENABLE_MONITORING === "true";
  if (!monitoringEnabled) return;

  // Placeholder for external monitoring integration
  // Example integrations:
  // - DataDog: ddClient.timing(`${type}.${name}`, value, tags)
  // - New Relic: newrelic.recordMetric(`${type}/${name}`, value)
  // - Custom endpoint: fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ type, name, value, tags }) })

  // For now, just log in production
  console.log(`[Metric] ${type}.${name}: ${value.toFixed(2)}ms`, tags || "");
}

// Type declarations for Performance Observer entries
interface LargestContentfulPaintEntry extends PerformanceEntry {
  renderTime: number;
  loadTime: number;
}

interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number;
  startTime: number;
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

// Export a performance tracker object for convenience
export const performanceTracker = {
  trackPageLoad,
  trackApiResponse,
  trackComponentRender,
  trackTiming,
  startTimer,
  trackWebVitals,
  getPerformanceSummary,
  getAllMetrics,
  clearMetrics,
};

export default performanceTracker;
