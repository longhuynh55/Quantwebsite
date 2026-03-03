import { NextRequest, NextResponse } from "next/server";
import {
  generateWithProviderFallback,
  type LlmMessage,
  type LlmResponseFormat,
} from "@/lib/assistant/providers";
import { checkRateLimit, createRateLimitKey, getClientIdentifier } from "@/lib/rateLimit";
import { createLogger, hashText, toErrorMeta } from "@/lib/logger";
import {
  applyStrategyPatchOps,
  sanitizeStrategyGraph,
  type StrategyPatchOp,
} from "@/lib/strategy-builder/graph-guardrails";
import type { StrategyEdge, StrategyNode } from "@/lib/stores/strategyBuilderStore";
import {
  STRATEGY_PATCH_REPAIR_PROMPT,
  STRATEGY_PATCH_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/strategy-patch-prompts";

const patchApiLogger = createLogger("api.ai.strategy-patch");
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_PROMPT_LENGTH = 1200;
const parsedParseRepairRetries = Number.parseInt(
  process.env.STRATEGY_PATCH_PARSE_REPAIR_RETRIES ?? "1",
  10
);
const PARSE_REPAIR_RETRIES = Number.isFinite(parsedParseRepairRetries)
  ? Math.max(0, parsedParseRepairRetries)
  : 1;
const parsedRequestTimeoutMs = Number.parseInt(process.env.STRATEGY_PATCH_TIMEOUT_MS ?? "30000", 10);
const REQUEST_TIMEOUT_MS = Number.isFinite(parsedRequestTimeoutMs)
  ? Math.max(5_000, parsedRequestTimeoutMs)
  : 30_000;

const STRATEGY_PATCH_RESPONSE_FORMAT: LlmResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "strategy_patch",
    strict: false,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["ops"],
      properties: {
        summary: { type: "string" },
        ops: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true,
            required: ["op"],
            properties: {
              op: { type: "string" },
              nodeType: { type: "string" },
              nodeId: { type: "string" },
              label: { type: "string" },
              source: { type: "string" },
              target: { type: "string" },
              sourceHandle: { type: "string" },
              targetHandle: { type: "string" },
              mode: { type: "string" },
              config: { type: "object", additionalProperties: true },
            },
          },
        },
      },
    },
  },
};

type PatchMode = "preview" | "apply";

interface StrategyPatchResponse {
  success: boolean;
  mode?: PatchMode;
  patchedGraph?: {
    name: string;
    nodes: StrategyNode[];
    edges: StrategyEdge[];
  };
  ops?: StrategyPatchOp[];
  summary?: string;
  diffSummary?: string[];
  issues?: Array<{
    severity: "error" | "warning";
    code: string;
    message: string;
    nodeId?: string;
    edgeId?: string;
  }>;
  warnings?: string[];
  requestId?: string;
  providerUsed?: string;
  latencyMs?: number;
  error?: string;
  rawResponse?: string;
}

interface ParsedPatchModelResponse {
  ops: StrategyPatchOp[];
  summary?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPatchMode(value: unknown): value is PatchMode {
  return value === "preview" || value === "apply";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStrategyNodePayload(value: unknown): value is StrategyNode {
  if (!isRecord(value)) return false;
  if (typeof value.type !== "string" || value.type.trim().length === 0) return false;
  if (value.id !== undefined && typeof value.id !== "string") return false;

  const position = value.position;
  if (
    position !== undefined &&
    (!isRecord(position) || !isFiniteNumber(position.x) || !isFiniteNumber(position.y))
  ) {
    return false;
  }

  if (!isRecord(value.data)) return false;
  if (value.data.label !== undefined && typeof value.data.label !== "string") return false;
  if (value.data.type !== undefined && typeof value.data.type !== "string") return false;
  if (value.data.config !== undefined && !isRecord(value.data.config)) return false;

  return true;
}

function isStrategyEdgePayload(value: unknown): value is StrategyEdge {
  if (!isRecord(value)) return false;
  if (typeof value.source !== "string" || value.source.trim().length === 0) return false;
  if (typeof value.target !== "string" || value.target.trim().length === 0) return false;
  if (value.id !== undefined && typeof value.id !== "string") return false;
  if (value.sourceHandle !== undefined && typeof value.sourceHandle !== "string") return false;
  if (value.targetHandle !== undefined && typeof value.targetHandle !== "string") return false;
  return true;
}

function parsePatchModelResponse(raw: string): ParsedPatchModelResponse | null {
  const extractJson = (source: string): string => {
    const trimmed = source.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return fenced[1].trim();
    }
    return trimmed;
  };

  const jsonText = extractJson(raw);

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!isRecord(parsed)) return null;
    if (!Array.isArray(parsed.ops)) return null;

    const validOps = parsed.ops.filter((item): item is StrategyPatchOp => isRecord(item) && typeof item.op === "string");
    if (validOps.length !== parsed.ops.length) return null;

    return {
      ops: validOps,
      summary: typeof parsed.summary === "string" ? parsed.summary.trim() : undefined,
    };
  } catch {
    return null;
  }
}

function parseGraphFromBody(body: Record<string, unknown>): {
  name: string;
  nodes: StrategyNode[];
  edges: StrategyEdge[];
} | null {
  const graph = body.graph;
  if (!isRecord(graph)) {
    return null;
  }
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return null;
  }
  if (!graph.nodes.every(isStrategyNodePayload) || !graph.edges.every(isStrategyEdgePayload)) {
    return null;
  }
  const name = typeof graph.name === "string" ? graph.name.trim() : "Untitled Strategy";
  return {
    name: name || "Untitled Strategy",
    nodes: graph.nodes,
    edges: graph.edges,
  };
}

function buildGraphContextForPrompt(name: string, nodes: StrategyNode[], edges: StrategyEdge[]): string {
  const compactNodes = nodes.slice(0, 80).map((node) => ({
    id: node.id,
    type: node.type,
    label: node.data?.label,
    config: node.data?.config ?? {},
  }));
  const compactEdges = edges.slice(0, 160).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));

  return JSON.stringify(
    {
      name,
      nodes: compactNodes,
      edges: compactEdges,
    },
    null,
    2
  );
}

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `strategy-patch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

class StrategyPatchDeadlineError extends Error {
  constructor() {
    super("strategy_patch_deadline_exceeded");
  }
}

async function awaitWithDeadline<T>(
  promiseFactory: (abortSignal: AbortSignal) => Promise<T>,
  deadlineAt: number | null
): Promise<T> {
  if (deadlineAt === null) {
    return promiseFactory(new AbortController().signal);
  }

  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) {
    throw new StrategyPatchDeadlineError();
  }

  const deadlineController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race<T>([
      promiseFactory(deadlineController.signal),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          deadlineController.abort();
          reject(new StrategyPatchDeadlineError());
        }, remainingMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<StrategyPatchResponse>> {
  const startedAt = Date.now();
  const deadlineAt = startedAt + REQUEST_TIMEOUT_MS;
  const requestId = generateRequestId();
  const logger = patchApiLogger.child({ requestId });

  try {
    const clientId = getClientIdentifier(request);
    const rateLimitKey = createRateLimitKey("strategy-patch", clientId);
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMIT, RATE_LIMIT_WINDOW);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many patch requests. Please wait and try again.",
          requestId,
        },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON payload.",
          requestId,
        },
        { status: 400 }
      );
    }

    if (!isRecord(body)) {
      return NextResponse.json(
        {
          success: false,
          error: "Request body must be a JSON object.",
          requestId,
        },
        { status: 400 }
      );
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          error: "Prompt is required.",
          requestId,
        },
        { status: 400 }
      );
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: `Prompt is too long. Maximum ${MAX_PROMPT_LENGTH} characters allowed.`,
          requestId,
        },
        { status: 400 }
      );
    }

    const mode = isPatchMode(body.mode) ? body.mode : "preview";
    const graph = parseGraphFromBody(body);
    if (!graph) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid graph payload.",
          requestId,
        },
        { status: 400 }
      );
    }

    const baseSanitized = sanitizeStrategyGraph(graph.nodes, graph.edges, {
      overflowPolicy: "reject",
    });
    const baseBlockingIssues = baseSanitized.issues.filter((issue) => issue.severity === "error");
    if (baseBlockingIssues.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Current graph contains validation issues. Resolve them before applying AI patch.",
          issues: baseSanitized.issues,
          warnings: baseSanitized.issues
            .filter((issue) => issue.severity === "warning")
            .map((issue) => issue.message),
          requestId,
        },
        { status: 422 }
      );
    }

    const graphContext = buildGraphContextForPrompt(
      graph.name,
      baseSanitized.nodes,
      baseSanitized.edges
    );
    const totalAttempts = Math.max(1, PARSE_REPAIR_RETRIES + 1);
    let parsedPatch: ParsedPatchModelResponse | null = null;
    let rawResponse = "";
    let providerUsed = "";

    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
      if (Date.now() >= deadlineAt) {
        logger.warn("patch.deadline_exceeded", {
          attempt,
          totalAttempts,
          timeoutMs: REQUEST_TIMEOUT_MS,
        });
        return NextResponse.json(
          {
            success: false,
            error: "AI patch generation timed out. Please try again.",
            requestId,
          },
          { status: 504 }
        );
      }

      const isRepairAttempt = attempt > 1;
      const systemPrompt = isRepairAttempt
        ? `${STRATEGY_PATCH_SYSTEM_PROMPT}\n\n${STRATEGY_PATCH_REPAIR_PROMPT}`
        : STRATEGY_PATCH_SYSTEM_PROMPT;
      const userPrompt = `Current graph:\n${graphContext}\n\nUser request:\n${prompt}`;

      const messages: LlmMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      const modelResult = await awaitWithDeadline(
        (abortSignal) =>
          generateWithProviderFallback(messages, {
            requestId,
            responseFormat: STRATEGY_PATCH_RESPONSE_FORMAT,
            abortSignal,
          }),
        deadlineAt
      );
      if (!modelResult.success) {
        const message = modelResult.message || "AI provider unavailable";
        const status =
          modelResult.statusCode ??
          (modelResult.kind === "timeout"
            ? 504
            : modelResult.kind === "rate_limit"
              ? 429
              : modelResult.kind === "configuration"
                ? 500
                : 502);
        logger.warn("patch.provider_failed", {
          kind: modelResult.kind,
          status,
          attempt,
          totalAttempts,
          latencyMs: Date.now() - startedAt,
        });
        return NextResponse.json(
          {
            success: false,
            error: message,
            requestId,
          },
          { status }
        );
      }

      rawResponse = modelResult.text;
      providerUsed = modelResult.providerUsed;
      parsedPatch = parsePatchModelResponse(modelResult.text);
      if (parsedPatch) {
        break;
      }

      logger.warn("patch.parse_failed", {
        attempt,
        totalAttempts,
        providerUsed: modelResult.providerUsed,
        responseLength: modelResult.text.length,
        responseDigest: hashText(modelResult.text),
      });
    }

    if (!parsedPatch) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid patch response format from AI.",
          rawResponse,
          requestId,
        },
        { status: 422 }
      );
    }

    const applyResult = applyStrategyPatchOps(
      baseSanitized.nodes,
      baseSanitized.edges,
      parsedPatch.ops,
      { overflowPolicy: "reject" }
    );
    const combinedIssues = [...baseSanitized.issues, ...applyResult.issues];
    const combinedWarnings = combinedIssues
      .filter((issue) => issue.severity === "warning")
      .map((issue) => issue.message);

    if (combinedIssues.some((issue) => issue.severity === "error")) {
      return NextResponse.json(
        {
          success: false,
          mode,
          error: "Patch contains invalid graph operations.",
          issues: combinedIssues,
          ops: parsedPatch.ops,
          summary: parsedPatch.summary,
          diffSummary: applyResult.diffSummary,
          warnings: combinedWarnings,
          requestId,
          providerUsed,
          latencyMs: Date.now() - startedAt,
        },
        { status: 422 }
      );
    }

    logger.info("patch.completed", {
      mode,
      opCount: parsedPatch.ops.length,
      appliedOps: applyResult.appliedOps,
      warningCount: combinedWarnings.length,
      latencyMs: Date.now() - startedAt,
      providerUsed,
    });

    return NextResponse.json({
      success: true,
      mode,
      patchedGraph: {
        name: graph.name,
        nodes: applyResult.nodes,
        edges: applyResult.edges,
      },
      ops: parsedPatch.ops,
      summary: parsedPatch.summary,
      diffSummary: applyResult.diffSummary,
      issues: combinedIssues,
      warnings: combinedWarnings,
      requestId,
      providerUsed,
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    if (error instanceof StrategyPatchDeadlineError) {
      return NextResponse.json(
        {
          success: false,
          error: "AI patch generation timed out. Please try again.",
          requestId,
        },
        { status: 504 }
      );
    }

    logger.error("patch.exception", {
      ...toErrorMeta(error),
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Unexpected error during patch generation.",
        requestId,
      },
      { status: 500 }
    );
  }
}
