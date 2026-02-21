import { NextResponse } from "next/server";

/**
 * Health check endpoint for monitoring and load balancers
 * Returns system status, version info, and uptime
 */

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: {
      status: "ok" | "error" | "not_configured";
      latency?: number;
      error?: string;
    };
    api: {
      status: "ok" | "error";
      responseTime: number;
    };
    memory: {
      status: "ok" | "warning" | "critical";
      heapUsed: number;
      heapTotal: number;
      usagePercent: number;
    };
  };
}

// Track server start time
const serverStartTime = Date.now();

/**
 * Check database connection (placeholder for actual DB check)
 */
async function checkDatabase(): Promise<HealthStatus["checks"]["database"]> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return {
      status: "not_configured",
    };
  }

  try {
    const startTime = performance.now();

    // Placeholder for actual database ping
    // In production, replace with actual database connection check
    // Example: await prisma.$queryRaw`SELECT 1`
    // or: await pool.query('SELECT 1')

    // Simulate database check delay
    await new Promise((resolve) => setTimeout(resolve, 10));

    const latency = performance.now() - startTime;

    return {
      status: "ok",
      latency: Math.round(latency * 100) / 100,
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

/**
 * Check API responsiveness
 */
async function checkApi(): Promise<HealthStatus["checks"]["api"]> {
  const startTime = performance.now();

  // The fact that this endpoint is running means the API is responsive
  const responseTime = performance.now() - startTime;

  return {
    status: "ok",
    responseTime: Math.round(responseTime * 100) / 100,
  };
}

/**
 * Check memory usage
 */
function checkMemory(): HealthStatus["checks"]["memory"] {
  const memoryUsage = process.memoryUsage();
  const heapUsed = memoryUsage.heapUsed;
  const heapTotal = memoryUsage.heapTotal;
  const usagePercent = (heapUsed / heapTotal) * 100;

  let status: "ok" | "warning" | "critical";
  if (usagePercent > 90) {
    status = "critical";
  } else if (usagePercent > 75) {
    status = "warning";
  } else {
    status = "ok";
  }

  return {
    status,
    heapUsed,
    heapTotal,
    usagePercent: Math.round(usagePercent * 100) / 100,
  };
}

/**
 * Calculate overall health status
 */
function calculateOverallStatus(
  checks: HealthStatus["checks"]
): HealthStatus["status"] {
  // If any check is critical, system is unhealthy
  if (checks.memory.status === "critical") {
    return "unhealthy";
  }

  // If database is not configured but other things work, still healthy
  if (
    checks.database.status === "error" ||
    checks.api.status === "error"
  ) {
    return "unhealthy";
  }

  // If memory is warning or database not configured, system is degraded
  if (
    checks.memory.status === "warning" ||
    checks.database.status === "not_configured"
  ) {
    return "degraded";
  }

  return "healthy";
}

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const [database, api] = await Promise.all([checkDatabase(), checkApi()]);
  const memory = checkMemory();

  const checks: HealthStatus["checks"] = {
    database,
    api,
    memory,
  };

  const healthStatus: HealthStatus = {
    status: calculateOverallStatus(checks),
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    checks,
  };

  // Set appropriate HTTP status based on health
  const httpStatus = healthStatus.status === "unhealthy" ? 503 : 200;

  return NextResponse.json(healthStatus, { status: httpStatus });
}

/**
 * Lightweight health check for load balancers (no detailed checks)
 */
export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200 });
}
