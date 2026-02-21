import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  type SharedStrategy,
  type StrategiesQueryParams,
  type CreateStrategyPayload,
  generateMockStrategies,
  STRATEGY_TAGS,
} from "@/lib/community/strategy-service";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";
import { createLogger, createTraceId, toErrorMeta } from "@/lib/logger";

const RATE_LIMIT_MAX = 60; // 60 requests per minute
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;

const strategiesLogger = createLogger("api.strategies");

// In-memory storage for development (replace with database in production)
const strategiesStore: SharedStrategy[] = generateMockStrategies(20);

// Generate unique ID
const generateId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `strategy-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

// Validate strategy data
function validateStrategy(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Invalid request body"] };
  }

  const payload = data as Record<string, unknown>;

  // Validate name
  if (!payload.name || typeof payload.name !== "string" || payload.name.trim().length === 0) {
    errors.push("Name is required");
  } else if (payload.name.length > 100) {
    errors.push("Name must be less than 100 characters");
  }

  // Validate description
  if (payload.description !== undefined) {
    if (typeof payload.description !== "string") {
      errors.push("Description must be a string");
    } else if (payload.description.length > 1000) {
      errors.push("Description must be less than 1000 characters");
    }
  }

  // Validate tags
  if (payload.tags !== undefined) {
    if (!Array.isArray(payload.tags)) {
      errors.push("Tags must be an array");
    } else {
      const validTags = STRATEGY_TAGS.map(t => t.value);
      for (const tag of payload.tags) {
        if (typeof tag !== "string" || !validTags.includes(tag as typeof validTags[number])) {
          errors.push(`Invalid tag: ${tag}`);
        }
      }
    }
  }

  // Validate performance
  if (payload.performance !== undefined) {
    const perf = payload.performance as Record<string, unknown>;
    if (typeof perf !== "object" || perf === null) {
      errors.push("Performance must be an object");
    } else {
      const { totalReturn, sharpeRatio, maxDrawdown, winRate } = perf;
      if (typeof totalReturn !== "number") errors.push("totalReturn must be a number");
      if (typeof sharpeRatio !== "number") errors.push("sharpeRatio must be a number");
      if (typeof maxDrawdown !== "number") errors.push("maxDrawdown must be a number");
      if (typeof winRate !== "number") errors.push("winRate must be a number");
    }
  }

  return { valid: errors.length === 0, errors };
}

// GET /api/strategies - List strategies
export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const traceId = request.headers.get("x-trace-id")?.trim() || createTraceId("strategies");
  const logger = strategiesLogger.child({ traceId });

  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/strategies", clientId), RATE_LIMIT_MAX, 60000);
  if (!rateLimit.allowed) {
    logger.warn("rate_limit.blocked", {
      remaining: rateLimit.remaining,
      resetInMs: Math.max(0, rateLimit.resetTime - Date.now()),
    });
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
          "x-trace-id": traceId,
        },
      }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const search = searchParams.get("search")?.trim() || undefined;
    const tagsParam = searchParams.get("tags");
    const tags = tagsParam ? tagsParam.split(",").filter(Boolean) : undefined;
    const sortBy = (searchParams.get("sortBy") as StrategiesQueryParams["sortBy"]) || "date";
    const sortOrder = (searchParams.get("sortOrder") as StrategiesQueryParams["sortOrder"]) || "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10))
    );

    // Filter strategies
    let filtered = [...strategiesStore];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(searchLower) ||
          s.description.toLowerCase().includes(searchLower) ||
          s.author.toLowerCase().includes(searchLower)
      );
    }

    // Tags filter
    if (tags && tags.length > 0) {
      filtered = filtered.filter((s) => tags.some((tag) => s.tags.includes(tag)));
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "rating":
          comparison = a.rating - b.rating;
          break;
        case "return":
          comparison = a.performance.totalReturn - b.performance.totalReturn;
          break;
        case "downloads":
          comparison = a.downloads - b.downloads;
          break;
        case "date":
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    // Paginate
    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    logger.info("strategies.listed", {
      total,
      page,
      pageSize,
      filters: { search, tags, sortBy, sortOrder },
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        strategies: paginated,
        total,
        page,
        pageSize,
        totalPages,
      },
      { headers: { "x-trace-id": traceId } }
    );
  } catch (error) {
    logger.error("strategies.list_failed", {
      ...toErrorMeta(error),
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Failed to load strategies" },
      { status: 500, headers: { "x-trace-id": traceId } }
    );
  }
}

// POST /api/strategies - Create new strategy
export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const traceId = request.headers.get("x-trace-id")?.trim() || createTraceId("strategies");
  const logger = strategiesLogger.child({ traceId });

  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/strategies", clientId), RATE_LIMIT_MAX, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
          "x-trace-id": traceId,
        },
      }
    );
  }

  try {
    const body = await request.json();

    // Validate
    const validation = validateStrategy(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400, headers: { "x-trace-id": traceId } }
      );
    }

    const payload = body as CreateStrategyPayload;

    // Create new strategy
    const now = new Date().toISOString();
    const newStrategy: SharedStrategy = {
      id: generateId(),
      name: payload.name.trim(),
      description: payload.description?.trim() || "",
      author: "Anonymous", // In production, get from auth
      authorId: clientId, // In production, get from auth
      nodes: payload.nodes || [],
      edges: payload.edges || [],
      performance: payload.performance || {
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
      },
      rating: 0,
      ratingCount: 0,
      tags: payload.tags || [],
      downloads: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Add to store
    strategiesStore.unshift(newStrategy);

    logger.info("strategy.created", {
      id: newStrategy.id,
      name: newStrategy.name,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(newStrategy, {
      status: 201,
      headers: { "x-trace-id": traceId },
    });
  } catch (error) {
    logger.error("strategy.create_failed", {
      ...toErrorMeta(error),
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Failed to create strategy" },
      { status: 500, headers: { "x-trace-id": traceId } }
    );
  }
}
