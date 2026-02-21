import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware for request logging, request ID generation, and response time tracking
 */

// Generate a unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Paths to exclude from logging
const EXCLUDED_PATHS = [
  "/_next",
  "/static",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/api/health", // Exclude health checks from logging
];

// Static file extensions to exclude
const STATIC_EXTENSIONS = [
  ".js",
  ".css",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".webp",
];

/**
 * Check if path should be excluded from logging
 */
function shouldExclude(pathname: string): boolean {
  // Check excluded paths
  if (EXCLUDED_PATHS.some((path) => pathname.startsWith(path))) {
    return true;
  }

  // Check static extensions
  if (STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
    return true;
  }

  return false;
}

/**
 * Determine log level based on status code
 */
function getLogLevel(statusCode: number): "info" | "warn" | "error" {
  if (statusCode >= 500) return "error";
  if (statusCode >= 400) return "warn";
  return "info";
}

/**
 * Format duration for logging
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = new URL(request.url);
  const method = request.method;

  // Skip logging for excluded paths
  const skipLogging = shouldExclude(pathname);

  // Generate request ID
  const requestId = generateRequestId();

  // Start timing
  const startTime = performance.now();

  // Clone the request headers and add request ID
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  // Create response with request ID header
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add request ID to response headers
  response.headers.set("x-request-id", requestId);

  // Log the request (skip if excluded)
  if (!skipLogging) {
    // Calculate response time
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Get status code (default to 200 for middleware pass-through)
    const statusCode = response.status;

    // Format log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      method,
      path: pathname + search,
      status: statusCode,
      duration: formatDuration(duration),
      userAgent: request.headers.get("user-agent") || "unknown",
      ip: request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
    };

    // Log based on level
    const logLevel = getLogLevel(statusCode);

    if (logLevel === "error") {
      console.error("[Request]", JSON.stringify(logEntry));
    } else if (logLevel === "warn") {
      console.warn("[Request]", JSON.stringify(logEntry));
    } else if (process.env.NODE_ENV === "development") {
      // Only log info level in development
      console.log("[Request]", JSON.stringify(logEntry));
    }

    // Track API response time (for API routes)
    if (pathname.startsWith("/api/")) {
      // Import performance tracking dynamically to avoid issues
      import("./lib/monitoring/performance").then(({ trackApiResponse }) => {
        trackApiResponse(pathname, duration, statusCode, method);
      }).catch(() => {
        // Ignore import errors in middleware
      });
    }
  }

  return response;
}

/**
 * Configure which routes use this middleware
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
