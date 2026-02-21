import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { type SharedStrategy, type UpdateStrategyPayload, STRATEGY_TAGS, generateMockStrategies } from "@/lib/community/strategy-service";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";
import { createLogger, createTraceId, toErrorMeta } from "@/lib/logger";

const RATE_LIMIT_MAX = 60; // 60 requests per minute

const strategiesLogger = createLogger("api.strategies.detail");

// Reference to the in-memory store (shared with parent route)
// In production, this would be a database query
declare global {
  var strategiesStore: SharedStrategy[] | undefined;
}

// Get or initialize the global store
function getStrategiesStore(): SharedStrategy[] {
  if (!global.strategiesStore) {
    global.strategiesStore = generateMockStrategies(20);
  }
  return global.strategiesStore ?? [];
}

// Generate unique ID
const generateId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `strategy-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

// Validate strategy update data
function validateUpdate(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Invalid request body"] };
  }

  const payload = data as Record<string, unknown>;

  // Validate name if provided
  if (payload.name !== undefined) {
    if (typeof payload.name !== "string" || payload.name.trim().length === 0) {
      errors.push("Name must be a non-empty string");
    } else if (payload.name.length > 100) {
      errors.push("Name must be less than 100 characters");
    }
  }

  // Validate description if provided
  if (payload.description !== undefined && payload.description !== null) {
    if (typeof payload.description !== "string") {
      errors.push("Description must be a string");
    } else if (payload.description.length > 1000) {
      errors.push("Description must be less than 1000 characters");
    }
  }

  // Validate tags if provided
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

  return { valid: errors.length === 0, errors };
}

// GET /api/strategies/[id] - Get single strategy
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  const traceId = request.headers.get("x-trace-id")?.trim() || createTraceId("strategies");
  const logger = strategiesLogger.child({ traceId });
  const { id } = await params;

  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/strategies/detail", clientId), RATE_LIMIT_MAX, 60000);
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
    const store = getStrategiesStore();
    const strategy = store.find((s) => s.id === id);

    if (!strategy) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404, headers: { "x-trace-id": traceId } }
      );
    }

    logger.info("strategy.fetched", {
      id: strategy.id,
      name: strategy.name,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(strategy, {
      headers: { "x-trace-id": traceId },
    });
  } catch (error) {
    logger.error("strategy.fetch_failed", {
      id,
      ...toErrorMeta(error),
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Failed to fetch strategy" },
      { status: 500, headers: { "x-trace-id": traceId } }
    );
  }
}

// PUT /api/strategies/[id] - Update strategy
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  const traceId = request.headers.get("x-trace-id")?.trim() || createTraceId("strategies");
  const logger = strategiesLogger.child({ traceId });
  const { id } = await params;

  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/strategies/detail", clientId), RATE_LIMIT_MAX, 60000);
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
    const store = getStrategiesStore();
    const index = store.findIndex((s) => s.id === id);

    if (index === -1) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404, headers: { "x-trace-id": traceId } }
      );
    }

    const body = await request.json();

    // Validate
    const validation = validateUpdate(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400, headers: { "x-trace-id": traceId } }
      );
    }

    const payload = body as UpdateStrategyPayload;
    const existing = store[index];

    // Update strategy
    const updated: SharedStrategy = {
      ...existing,
      name: payload.name?.trim() ?? existing.name,
      description: payload.description?.trim() ?? existing.description,
      nodes: payload.nodes ?? existing.nodes,
      edges: payload.edges ?? existing.edges,
      performance: payload.performance ?? existing.performance,
      tags: payload.tags ?? existing.tags,
      updatedAt: new Date().toISOString(),
    };

    store[index] = updated;

    logger.info("strategy.updated", {
      id: updated.id,
      name: updated.name,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(updated, {
      headers: { "x-trace-id": traceId },
    });
  } catch (error) {
    logger.error("strategy.update_failed", {
      id,
      ...toErrorMeta(error),
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Failed to update strategy" },
      { status: 500, headers: { "x-trace-id": traceId } }
    );
  }
}

// DELETE /api/strategies/[id] - Delete strategy
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  const traceId = request.headers.get("x-trace-id")?.trim() || createTraceId("strategies");
  const logger = strategiesLogger.child({ traceId });
  const { id } = await params;

  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/strategies/detail", clientId), RATE_LIMIT_MAX, 60000);
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
    const store = getStrategiesStore();
    const index = store.findIndex((s) => s.id === id);

    if (index === -1) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404, headers: { "x-trace-id": traceId } }
      );
    }

    const deleted = store.splice(index, 1)[0];

    logger.info("strategy.deleted", {
      id: deleted.id,
      name: deleted.name,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      { success: true, message: "Strategy deleted" },
      { headers: { "x-trace-id": traceId } }
    );
  } catch (error) {
    logger.error("strategy.delete_failed", {
      id,
      ...toErrorMeta(error),
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Failed to delete strategy" },
      { status: 500, headers: { "x-trace-id": traceId } }
    );
  }
}

// POST /api/strategies/[id]/import - Import/Copy strategy
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  const traceId = request.headers.get("x-trace-id")?.trim() || createTraceId("strategies");
  const logger = strategiesLogger.child({ traceId });
  const { id } = await params;

  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(createRateLimitKey("api/strategies/import", clientId), RATE_LIMIT_MAX, 60000);
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
    const store = getStrategiesStore();
    const original = store.find((s) => s.id === id);

    if (!original) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404, headers: { "x-trace-id": traceId } }
      );
    }

    // Create a copy
    const now = new Date().toISOString();
    const copy: SharedStrategy = {
      ...original,
      id: generateId(),
      name: `${original.name} (Copy)`,
      author: "Anonymous", // In production, get from auth
      authorId: clientId,
      rating: 0,
      ratingCount: 0,
      downloads: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Add to store
    store.unshift(copy);

    // Increment download count on original
    const originalIndex = store.findIndex((s) => s.id === original.id);
    if (originalIndex !== -1) {
      store[originalIndex].downloads += 1;
    }

    logger.info("strategy.imported", {
      originalId: original.id,
      copyId: copy.id,
      name: copy.name,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(copy, {
      status: 201,
      headers: { "x-trace-id": traceId },
    });
  } catch (error) {
    logger.error("strategy.import_failed", {
      id,
      ...toErrorMeta(error),
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Failed to import strategy" },
      { status: 500, headers: { "x-trace-id": traceId } }
    );
  }
}
