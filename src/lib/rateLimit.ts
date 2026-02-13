/**
 * Simple in-memory rate limiting utility
 *
 * Note: This is a basic implementation suitable for single-server deployments.
 * For production with multiple servers, consider using Redis-based rate limiting.
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();
const TRUST_PROXY_HEADERS = process.env.TRUST_PROXY_HEADERS === "true";
const PLATFORM_IP_HEADERS = [
  "cf-connecting-ip",
  "x-vercel-forwarded-for",
  "fly-client-ip",
  "x-azure-clientip",
];
const GENERIC_PROXY_IP_HEADERS = ["x-real-ip", "x-forwarded-for"];

// Cleanup old entries every minute
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000);
}

/**
 * Check if a request should be rate limited
 *
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // No record or window expired - create new record
  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime: now + windowMs,
    };
  }

  // Check if limit exceeded
  if (record.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  // Increment count
  record.count++;
  return {
    allowed: true,
    remaining: limit - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Create a scoped identifier for rate limiting.
 *
 * Without scoping, all API routes would share one bucket per client identifier, which makes
 * per-route limits interact in surprising ways (the strictest limit effectively dominates).
 */
export function createRateLimitKey(scope: string, identifier: string): string {
  const normalizedScope = String(scope ?? "default")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "default";

  return `${normalizedScope}:${identifier}`;
}

/**
 * Get client identifier from request
 * Uses multiple sources for IP detection with validation
 */
export function getClientIdentifier(request: Request): string {
  const isValidIP = (ip: string): boolean =>
    /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) ||
    /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(ip);

  const extractFirstValidIp = (value: string | null): string | null => {
    if (!value) return null;
    const candidates = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    for (const candidate of candidates) {
      if (isValidIP(candidate)) return candidate;
    }
    return null;
  };

  // Trust infra-managed headers first (Cloudflare/Vercel/Fly/Azure).
  for (const header of PLATFORM_IP_HEADERS) {
    const ip = extractFirstValidIp(request.headers.get(header));
    if (ip) return ip;
  }

  // Generic proxy headers are opt-in; otherwise they are spoofable.
  if (TRUST_PROXY_HEADERS) {
    for (const header of GENERIC_PROXY_IP_HEADERS) {
      const ip = extractFirstValidIp(request.headers.get(header));
      if (ip) return ip;
    }
  }

  // Fallback: Use a unique identifier based on available request info
  // This prevents all unknown clients from sharing one static bucket.
  const userAgent = request.headers.get('user-agent') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';
  const accept = request.headers.get('accept') || '';
  const secChUa = request.headers.get('sec-ch-ua') || '';
  const secChUaPlatform = request.headers.get('sec-ch-ua-platform') || '';
  const acceptEncoding = request.headers.get('accept-encoding') || '';

  // Create a hash-like identifier from available headers
  const fingerprint = [
    userAgent,
    acceptLanguage,
    accept,
    secChUa,
    secChUaPlatform,
    acceptEncoding,
  ].join("|");
  const fallbackId = `fallback-${hashString(fingerprint)}`;
  return fallbackId;
}

/**
 * Simple string hash function for creating fallback identifiers
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(
  limit: number,
  remaining: number,
  resetTime: number
): Headers {
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', String(limit));
  headers.set('X-RateLimit-Remaining', String(remaining));
  headers.set('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));
  return headers;
}
